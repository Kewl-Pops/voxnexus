# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
"""
VoxChameleon DSP Engine - Real-time Audio Transformation

High-performance, CPU-native DSP engine for real-time voice adaptation.
Designed for <5ms latency on standard Intel/AMD cores.

Core transformations:
- Pitch shifting via resampling + time correction
- Time stretching via overlap-add (OLA)
- Low-pass filtering via IIR Butterworth filter
"""

from dataclasses import dataclass
from typing import Optional
import numpy as np
from scipy import signal
from scipy.interpolate import interp1d


@dataclass
class VibeVector:
    """Input vibe state from VoxResonance analysis."""
    agitation: float = 0.0  # 0.0 - 1.0
    energy: float = 0.0     # 0.0 - 1.0


@dataclass
class TransformParams:
    """DSP transformation parameters."""
    pitch_semitones: float = 0.0    # Semitones to shift (-12 to +12)
    speed_factor: float = 1.0        # Time stretch factor (0.5 to 2.0)
    lowpass_cutoff: Optional[float] = None  # Hz, None = disabled

    @property
    def pitch_ratio(self) -> float:
        """Convert semitones to frequency ratio."""
        return 2.0 ** (self.pitch_semitones / 12.0)


class DSPEngine:
    """
    Low-latency DSP engine for real-time audio transformation.

    Optimized for:
    - CPU-only processing (no GPU dependencies)
    - <5ms latency per chunk
    - Streaming audio with state preservation
    """

    def __init__(
        self,
        sample_rate: int = 24000,
        chunk_size: int = 480,  # 20ms at 24kHz
        overlap_ratio: float = 0.5,
    ):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.overlap_ratio = overlap_ratio
        self.overlap_size = int(chunk_size * overlap_ratio)

        # Pre-compute Hann window for OLA
        self.window = np.hanning(chunk_size).astype(np.float32)

        # State buffers for streaming
        self._input_buffer = np.zeros(chunk_size * 2, dtype=np.float32)
        self._output_buffer = np.zeros(chunk_size * 2, dtype=np.float32)
        self._overlap_buffer = np.zeros(self.overlap_size, dtype=np.float32)

        # Pre-computed filter coefficients (lazy init)
        self._filter_cache: dict[float, tuple] = {}

        # Resampler state
        self._resample_remainder = np.array([], dtype=np.float32)

    def _get_lowpass_coefficients(self, cutoff_hz: float) -> tuple:
        """Get or create cached Butterworth lowpass filter coefficients."""
        if cutoff_hz not in self._filter_cache:
            # 4th order Butterworth for smooth rolloff
            nyquist = self.sample_rate / 2.0
            normalized_cutoff = min(cutoff_hz / nyquist, 0.99)
            sos = signal.butter(4, normalized_cutoff, btype='low', output='sos')
            # Initialize filter state
            zi = signal.sosfilt_zi(sos)
            self._filter_cache[cutoff_hz] = (sos, zi.copy())
        return self._filter_cache[cutoff_hz]

    def _pitch_shift_resample(
        self,
        audio: np.ndarray,
        pitch_ratio: float,
    ) -> np.ndarray:
        """
        Pitch shift via resampling.

        Fast, CPU-efficient method:
        1. Resample to change pitch
        2. Time-stretch back to original length

        Args:
            audio: Input audio samples (float32)
            pitch_ratio: Frequency multiplier (>1 = higher pitch)

        Returns:
            Pitch-shifted audio of same length
        """
        if abs(pitch_ratio - 1.0) < 0.001:
            return audio

        n_samples = len(audio)

        # Resample: higher ratio = more samples = lower pitch when played back
        # We want the opposite, so invert
        resample_ratio = 1.0 / pitch_ratio
        new_length = int(n_samples * resample_ratio)

        if new_length < 2:
            return audio

        # Fast linear interpolation resampling
        x_old = np.linspace(0, 1, n_samples)
        x_new = np.linspace(0, 1, new_length)

        # Use numpy interp for speed (faster than scipy for 1D)
        resampled = np.interp(x_new, x_old, audio).astype(np.float32)

        # Now stretch back to original length
        if len(resampled) != n_samples:
            x_resampled = np.linspace(0, 1, len(resampled))
            x_target = np.linspace(0, 1, n_samples)
            resampled = np.interp(x_target, x_resampled, resampled).astype(np.float32)

        return resampled

    def _time_stretch_ola(
        self,
        audio: np.ndarray,
        speed_factor: float,
    ) -> np.ndarray:
        """
        Time stretch using Overlap-Add (OLA).

        Simple but effective for speech. Maintains pitch while
        changing duration.

        Args:
            audio: Input audio samples
            speed_factor: >1.0 = faster, <1.0 = slower

        Returns:
            Time-stretched audio
        """
        if abs(speed_factor - 1.0) < 0.001:
            return audio

        n_samples = len(audio)
        target_length = int(n_samples / speed_factor)

        if target_length < 2:
            return audio

        # Analysis hop (input stride)
        analysis_hop = self.chunk_size // 2
        # Synthesis hop (output stride) - adjusted for speed
        synthesis_hop = int(analysis_hop / speed_factor)

        if synthesis_hop < 1:
            synthesis_hop = 1

        # Pad input for complete processing
        padded = np.pad(audio, (0, self.chunk_size), mode='constant')

        # Output buffer
        output = np.zeros(target_length + self.chunk_size, dtype=np.float32)
        output_norm = np.zeros_like(output)

        # OLA processing
        n_frames = (len(padded) - self.chunk_size) // analysis_hop

        for i in range(n_frames):
            # Extract frame from input
            start_in = i * analysis_hop
            frame = padded[start_in:start_in + self.chunk_size]

            if len(frame) < self.chunk_size:
                break

            # Apply window
            windowed = frame * self.window

            # Place in output at synthesis position
            start_out = i * synthesis_hop
            end_out = start_out + self.chunk_size

            if end_out <= len(output):
                output[start_out:end_out] += windowed
                output_norm[start_out:end_out] += self.window

        # Normalize by window overlap
        output_norm = np.maximum(output_norm, 1e-8)
        output = output / output_norm

        return output[:target_length].astype(np.float32)

    def _apply_lowpass(
        self,
        audio: np.ndarray,
        cutoff_hz: float,
    ) -> np.ndarray:
        """
        Apply low-pass filter to remove high-frequency brightness.

        Uses pre-computed IIR Butterworth coefficients for speed.
        """
        sos, zi = self._get_lowpass_coefficients(cutoff_hz)

        # Scale initial conditions to first sample
        zi_scaled = zi * audio[0] if len(audio) > 0 else zi

        # Apply filter
        filtered, _ = signal.sosfilt(sos, audio, zi=zi_scaled)

        return filtered.astype(np.float32)

    def process_chunk(
        self,
        audio: np.ndarray,
        params: TransformParams,
    ) -> np.ndarray:
        """
        Process a single audio chunk with all transformations.

        Applies transforms in optimal order:
        1. Pitch shift (resampling)
        2. Time stretch (OLA)
        3. Low-pass filter (IIR)

        Args:
            audio: Input PCM samples (float32, -1.0 to 1.0)
            params: Transformation parameters

        Returns:
            Processed audio chunk
        """
        # Ensure float32 for performance
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        # 1. Pitch shift
        if abs(params.pitch_semitones) > 0.01:
            audio = self._pitch_shift_resample(audio, params.pitch_ratio)

        # 2. Time stretch
        if abs(params.speed_factor - 1.0) > 0.01:
            audio = self._time_stretch_ola(audio, params.speed_factor)

        # 3. Low-pass filter (for removing brightness)
        if params.lowpass_cutoff is not None:
            audio = self._apply_lowpass(audio, params.lowpass_cutoff)

        # Clip to valid range
        audio = np.clip(audio, -1.0, 1.0)

        return audio

    def reset(self):
        """Reset all internal state buffers."""
        self._input_buffer.fill(0)
        self._output_buffer.fill(0)
        self._overlap_buffer.fill(0)
        self._resample_remainder = np.array([], dtype=np.float32)


class TransformMapper:
    """
    Maps vibe vectors to DSP transformation parameters.

    Implements the "Audio Mirror" logic:
    - High agitation → Deeper, slower, warmer voice
    - High energy → Slightly higher, faster voice
    - Neutral → Passthrough
    """

    # Thresholds
    AGITATION_THRESHOLD = 0.7
    ENERGY_THRESHOLD = 0.8

    # Transform presets
    CALM_RESPONSE = TransformParams(
        pitch_semitones=-2.0,   # Deeper voice
        speed_factor=0.9,       # Slower pace
        lowpass_cutoff=3500.0,  # Remove brightness (warmth)
    )

    ENERGETIC_RESPONSE = TransformParams(
        pitch_semitones=+1.0,   # Slightly higher
        speed_factor=1.1,       # Faster pace
        lowpass_cutoff=None,    # Keep brightness
    )

    NEUTRAL = TransformParams()  # Passthrough

    @classmethod
    def map_vibe_to_transform(cls, vibe: VibeVector) -> TransformParams:
        """
        Map a vibe vector to appropriate DSP parameters.

        Priority: Agitation > Energy > Neutral
        (Calming an angry caller takes precedence)
        """
        # High agitation - respond with calm, warm voice
        if vibe.agitation > cls.AGITATION_THRESHOLD:
            return cls.CALM_RESPONSE

        # High energy - match the enthusiasm
        if vibe.energy > cls.ENERGY_THRESHOLD:
            return cls.ENERGETIC_RESPONSE

        # Neutral - passthrough
        return cls.NEUTRAL

    @classmethod
    def interpolate_transform(
        cls,
        vibe: VibeVector,
        smoothing: float = 0.3,
    ) -> TransformParams:
        """
        Smoothly interpolate transform parameters based on vibe intensity.

        Provides gradual transitions instead of hard thresholds.
        Useful for more natural-sounding adaptation.

        Args:
            vibe: Current vibe state
            smoothing: Interpolation factor (0 = hard threshold, 1 = full range)
        """
        # Calculate intensities beyond thresholds
        agitation_intensity = max(0, (vibe.agitation - cls.AGITATION_THRESHOLD) / (1.0 - cls.AGITATION_THRESHOLD))
        energy_intensity = max(0, (vibe.energy - cls.ENERGY_THRESHOLD) / (1.0 - cls.ENERGY_THRESHOLD))

        # Agitation takes priority
        if agitation_intensity > 0:
            intensity = agitation_intensity * smoothing
            return TransformParams(
                pitch_semitones=cls.CALM_RESPONSE.pitch_semitones * intensity,
                speed_factor=1.0 + (cls.CALM_RESPONSE.speed_factor - 1.0) * intensity,
                lowpass_cutoff=cls.CALM_RESPONSE.lowpass_cutoff if intensity > 0.5 else None,
            )

        if energy_intensity > 0:
            intensity = energy_intensity * smoothing
            return TransformParams(
                pitch_semitones=cls.ENERGETIC_RESPONSE.pitch_semitones * intensity,
                speed_factor=1.0 + (cls.ENERGETIC_RESPONSE.speed_factor - 1.0) * intensity,
                lowpass_cutoff=None,
            )

        return cls.NEUTRAL
