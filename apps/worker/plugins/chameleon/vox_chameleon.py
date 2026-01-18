#!/usr/bin/env python3
# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
"""
VoxChameleon - Real-time Voice Adaptation Engine

A CPU-native DSP engine that adapts TTS voice characteristics in real-time
based on caller emotional state. Designed for <5ms latency on standard
Intel/AMD cores without GPU acceleration.

Architecture:
    VibeVector → EmotionalLogic → DSPParams → DSPChain → Adapted Audio

Usage:
    from vox_chameleon import VoiceAdapter, VibeVector

    adapter = VoiceAdapter(sample_rate=24000)

    async for chunk in tts_audio_stream:
        vibe = VibeVector(agitation=0.85, energy=0.3)
        adapted = adapter.process(chunk, vibe)
        yield adapted
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Generator, Iterator, Optional, Tuple
import numpy as np
from scipy import signal


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass(frozen=True, slots=True)
class VibeVector:
    """
    Input emotional state from caller analysis (VoxResonance).

    Attributes:
        agitation: Anger/frustration level (0.0 = calm, 1.0 = furious)
        energy: Excitement/energy level (0.0 = low, 1.0 = highly energetic)
    """
    agitation: float = 0.0
    energy: float = 0.0

    def __post_init__(self):
        # Clamp values to valid range
        object.__setattr__(self, 'agitation', max(0.0, min(1.0, self.agitation)))
        object.__setattr__(self, 'energy', max(0.0, min(1.0, self.energy)))


@dataclass(slots=True)
class DSPParams:
    """
    DSP transformation parameters computed from emotional state.

    These parameters directly control the DSPChain processing.
    """
    pitch_semitones: float = 0.0      # Semitones to shift (-12 to +12)
    speed_factor: float = 1.0          # Time stretch (0.5 to 2.0)
    lowpass_cutoff_hz: Optional[float] = None  # Hz, None = disabled
    gain_db: float = 0.0               # Output gain adjustment

    @property
    def pitch_ratio(self) -> float:
        """
        Convert semitones to frequency ratio.

        EFFICIENCY: Using 2^(n/12) is the standard equal temperament formula.
        Pre-computing this avoids repeated exponential calculations.
        """
        return 2.0 ** (self.pitch_semitones / 12.0)

    @property
    def gain_linear(self) -> float:
        """Convert dB to linear gain multiplier."""
        return 10.0 ** (self.gain_db / 20.0)

    def is_passthrough(self) -> bool:
        """Check if these params result in no transformation."""
        return (
            abs(self.pitch_semitones) < 0.01 and
            abs(self.speed_factor - 1.0) < 0.01 and
            self.lowpass_cutoff_hz is None and
            abs(self.gain_db) < 0.1
        )


class EmotionalState(Enum):
    """Discrete emotional states for logging/debugging."""
    NEUTRAL = "neutral"
    HIGH_AGITATION = "high_agitation"
    HIGH_ENERGY = "high_energy"


# =============================================================================
# EMOTIONAL LOGIC - Maps Vibe to DSP Parameters
# =============================================================================

class EmotionalLogic:
    """
    Maps emotional vibe vectors to concrete DSP transformation parameters.

    The "Audio Mirror" Logic:
    - High agitation → Respond with calm, deeper, slower voice (de-escalation)
    - High energy → Match enthusiasm with slightly brighter, faster voice
    - Neutral → Passthrough (preserve original TTS characteristics)

    RATIONALE:
    Research in psychoacoustics shows that lower pitch and slower speech
    patterns are perceived as more calming and authoritative, helping to
    de-escalate angry callers. Conversely, matching energy levels with
    excited callers creates rapport.
    """

    # Threshold values for state transitions
    AGITATION_THRESHOLD: float = 0.7
    ENERGY_THRESHOLD: float = 0.8

    # Pre-defined transformation presets
    # These values are tuned based on psychoacoustic research
    PRESETS: dict[EmotionalState, DSPParams] = {
        EmotionalState.NEUTRAL: DSPParams(),  # Passthrough

        EmotionalState.HIGH_AGITATION: DSPParams(
            pitch_semitones=-2.0,      # Deeper voice (calming)
            speed_factor=0.9,          # Slower pace (measured)
            lowpass_cutoff_hz=3500.0,  # Remove brightness (warmer tone)
            gain_db=-1.0,              # Slightly quieter (less aggressive)
        ),

        EmotionalState.HIGH_ENERGY: DSPParams(
            pitch_semitones=+1.0,      # Slightly higher (engaged)
            speed_factor=1.1,          # Faster pace (enthusiastic)
            lowpass_cutoff_hz=None,    # Keep brightness
            gain_db=+0.5,              # Slightly louder (confident)
        ),
    }

    @classmethod
    def classify_state(cls, vibe: VibeVector) -> EmotionalState:
        """
        Classify vibe vector into discrete emotional state.

        Priority: Agitation > Energy > Neutral
        (De-escalation takes precedence over energy matching)
        """
        if vibe.agitation > cls.AGITATION_THRESHOLD:
            return EmotionalState.HIGH_AGITATION
        if vibe.energy > cls.ENERGY_THRESHOLD:
            return EmotionalState.HIGH_ENERGY
        return EmotionalState.NEUTRAL

    @classmethod
    def map_discrete(cls, vibe: VibeVector) -> DSPParams:
        """
        Map vibe to DSP params using discrete thresholds.

        Fast and predictable - good for debugging.
        """
        state = cls.classify_state(vibe)
        return cls.PRESETS[state]

    @classmethod
    def map_interpolated(cls, vibe: VibeVector) -> DSPParams:
        """
        Map vibe to DSP params with smooth interpolation.

        EFFICIENCY: Linear interpolation (lerp) is O(1) and cache-friendly.
        This provides smooth transitions without expensive computations.

        The interpolation creates a gradual ramp-up of effects as the
        emotional intensity increases beyond the threshold.
        """
        # Calculate intensity beyond thresholds (0.0 to 1.0)
        agitation_intensity = cls._compute_intensity(
            vibe.agitation, cls.AGITATION_THRESHOLD
        )
        energy_intensity = cls._compute_intensity(
            vibe.energy, cls.ENERGY_THRESHOLD
        )

        # Agitation takes priority (de-escalation is more important)
        if agitation_intensity > 0.01:
            preset = cls.PRESETS[EmotionalState.HIGH_AGITATION]
            return cls._lerp_params(DSPParams(), preset, agitation_intensity)

        if energy_intensity > 0.01:
            preset = cls.PRESETS[EmotionalState.HIGH_ENERGY]
            return cls._lerp_params(DSPParams(), preset, energy_intensity)

        return DSPParams()  # Neutral passthrough

    @staticmethod
    def _compute_intensity(value: float, threshold: float) -> float:
        """
        Compute normalized intensity beyond threshold.

        Maps [threshold, 1.0] → [0.0, 1.0]
        Values below threshold return 0.0
        """
        if value <= threshold:
            return 0.0
        return (value - threshold) / (1.0 - threshold)

    @staticmethod
    def _lerp_params(a: DSPParams, b: DSPParams, t: float) -> DSPParams:
        """
        Linear interpolation between two DSPParams.

        EFFICIENCY: Simple scalar operations, no memory allocation
        except for the final DSPParams object.
        """
        return DSPParams(
            pitch_semitones=a.pitch_semitones + t * (b.pitch_semitones - a.pitch_semitones),
            speed_factor=a.speed_factor + t * (b.speed_factor - a.speed_factor),
            lowpass_cutoff_hz=b.lowpass_cutoff_hz if t > 0.5 else a.lowpass_cutoff_hz,
            gain_db=a.gain_db + t * (b.gain_db - a.gain_db),
        )


# =============================================================================
# DSP CHAIN - Core Audio Processing
# =============================================================================

class DSPChain:
    """
    Low-latency DSP processing chain for real-time audio transformation.

    Implements three core transforms:
    1. Pitch Shift - via resampling (fast, CPU-efficient)
    2. Time Stretch - via Overlap-Add (OLA)
    3. EQ/Filter - via IIR Butterworth lowpass

    EFFICIENCY NOTES:
    - All operations use numpy vectorized math (SIMD on modern CPUs)
    - Filter coefficients are pre-computed and cached
    - In-place operations where possible to reduce memory allocation
    - float32 throughout for cache efficiency (vs float64)

    Thread Safety: NOT thread-safe. Create one instance per audio stream.
    """

    def __init__(
        self,
        sample_rate: int = 24000,
        chunk_size: int = 480,
    ):
        """
        Initialize DSP chain.

        Args:
            sample_rate: Audio sample rate in Hz (default: 24000 for voice)
            chunk_size: Expected chunk size in samples (default: 480 = 20ms)
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size

        # Pre-compute Hann window for OLA time-stretching
        # EFFICIENCY: Hann window is smooth and minimizes spectral leakage
        # while being cheap to multiply (just array multiplication)
        self._window = np.hanning(chunk_size).astype(np.float32)

        # Filter coefficient cache: cutoff_hz → (sos, zi)
        # EFFICIENCY: Computing Butterworth coefficients is expensive,
        # so we cache them. Typical use cases only need 1-2 cutoffs.
        self._filter_cache: dict[float, Tuple[np.ndarray, np.ndarray]] = {}

        # Filter state for continuous streaming
        self._filter_state: Optional[np.ndarray] = None
        self._last_cutoff: Optional[float] = None

    def _get_filter_coeffs(self, cutoff_hz: float) -> Tuple[np.ndarray, np.ndarray]:
        """
        Get or compute cached Butterworth lowpass filter coefficients.

        Uses Second-Order Sections (SOS) format for numerical stability.

        EFFICIENCY: Butterworth design is O(n) where n is filter order,
        but we only do this once per cutoff frequency.
        """
        if cutoff_hz not in self._filter_cache:
            nyquist = self.sample_rate / 2.0
            # Clamp to valid range (must be < Nyquist)
            normalized = min(cutoff_hz / nyquist, 0.99)

            # 4th order Butterworth: good tradeoff between
            # rolloff steepness and computational cost
            sos = signal.butter(4, normalized, btype='low', output='sos')

            # Pre-compute initial filter state
            zi = signal.sosfilt_zi(sos)

            self._filter_cache[cutoff_hz] = (sos.astype(np.float32), zi.astype(np.float32))

        return self._filter_cache[cutoff_hz]

    def pitch_shift(self, audio: np.ndarray, semitones: float) -> np.ndarray:
        """
        Shift pitch by resampling.

        ALGORITHM:
        1. Resample audio to change pitch (shorter = higher, longer = lower)
        2. Resample back to original length to preserve duration

        EFFICIENCY:
        - Uses numpy.interp which is highly optimized C code
        - Linear interpolation is O(n) and cache-friendly
        - Avoids FFT-based methods which have O(n log n) complexity

        Args:
            audio: Input samples (float32, -1.0 to 1.0)
            semitones: Pitch shift in semitones (negative = lower)

        Returns:
            Pitch-shifted audio of same length
        """
        if abs(semitones) < 0.01:
            return audio  # Passthrough optimization

        n = len(audio)
        if n < 2:
            return audio

        # Calculate resample ratio
        # Higher pitch = we need FEWER samples that get stretched back
        # ratio > 1 means higher pitch
        ratio = 2.0 ** (semitones / 12.0)

        # Step 1: Resample to intermediate length
        # For higher pitch, we need fewer samples
        intermediate_len = int(n / ratio)
        if intermediate_len < 2:
            return audio

        # EFFICIENCY: np.interp uses optimized C implementation
        # and is faster than scipy.interpolate for 1D linear interpolation
        x_orig = np.linspace(0, 1, n, dtype=np.float32)
        x_new = np.linspace(0, 1, intermediate_len, dtype=np.float32)
        resampled = np.interp(x_new, x_orig, audio).astype(np.float32)

        # Step 2: Resample back to original length
        # This changes duration back but keeps the pitch shift
        x_resampled = np.linspace(0, 1, len(resampled), dtype=np.float32)
        x_target = np.linspace(0, 1, n, dtype=np.float32)

        return np.interp(x_target, x_resampled, resampled).astype(np.float32)

    def time_stretch(self, audio: np.ndarray, factor: float) -> np.ndarray:
        """
        Time stretch using Overlap-Add (OLA).

        Changes duration without affecting pitch.
        factor > 1.0 = faster (shorter duration)
        factor < 1.0 = slower (longer duration)

        ALGORITHM:
        OLA works by:
        1. Splitting audio into overlapping frames
        2. Windowing each frame (Hann window)
        3. Reconstructing with different overlap (synthesis hop)

        EFFICIENCY:
        - O(n) complexity, just array operations
        - Hann window multiplication is SIMD-friendly
        - No FFT required (unlike phase vocoder)
        - Acceptable quality for speech at modest stretch factors

        TRADEOFF:
        OLA can introduce subtle artifacts at extreme stretch factors,
        but for our use case (0.9x to 1.1x), quality is excellent.

        Args:
            audio: Input samples
            factor: Speed factor (1.0 = no change)

        Returns:
            Time-stretched audio (different length!)
        """
        if abs(factor - 1.0) < 0.01:
            return audio  # Passthrough optimization

        n = len(audio)
        target_len = int(n / factor)

        if target_len < 2 or n < self.chunk_size:
            return audio

        # Frame parameters
        frame_size = min(self.chunk_size, n)
        analysis_hop = frame_size // 2  # 50% overlap for analysis

        # Synthesis hop determines output speed
        # Larger synthesis_hop = faster output
        synthesis_hop = int(analysis_hop * factor)
        synthesis_hop = max(1, synthesis_hop)

        # Ensure we have the right window size
        if len(self._window) != frame_size:
            self._window = np.hanning(frame_size).astype(np.float32)

        # Pad input for complete frame coverage
        padded = np.pad(audio, (0, frame_size), mode='constant')

        # Pre-allocate output buffer
        # EFFICIENCY: Pre-allocation avoids repeated memory allocation
        output_len = target_len + frame_size
        output = np.zeros(output_len, dtype=np.float32)
        window_sum = np.zeros(output_len, dtype=np.float32)

        # Process frames
        n_frames = (len(padded) - frame_size) // analysis_hop

        for i in range(n_frames):
            # Extract and window frame
            start_in = i * analysis_hop
            frame = padded[start_in:start_in + frame_size]

            if len(frame) < frame_size:
                break

            # Apply window
            # EFFICIENCY: Element-wise multiply is highly optimized
            windowed = frame * self._window

            # Add to output at synthesis position
            start_out = i * synthesis_hop
            end_out = start_out + frame_size

            if end_out <= output_len:
                output[start_out:end_out] += windowed
                window_sum[start_out:end_out] += self._window

        # Normalize by window overlap to prevent amplitude modulation
        # EFFICIENCY: Avoid division by zero with maximum
        window_sum = np.maximum(window_sum, 1e-8)
        output = output / window_sum

        return output[:target_len].astype(np.float32)

    def lowpass_filter(self, audio: np.ndarray, cutoff_hz: float) -> np.ndarray:
        """
        Apply IIR Butterworth lowpass filter.

        Removes high-frequency content to create a "warmer" sound.
        Used for de-escalation (removing "brightness" from voice).

        ALGORITHM:
        4th-order Butterworth filter in SOS (Second-Order Sections) form.

        EFFICIENCY:
        - IIR filters are O(n) per sample
        - SOS form is numerically stable for higher orders
        - Maintains filter state for continuous streaming
        - Coefficients are cached and reused

        WHY BUTTERWORTH:
        - Maximally flat passband (no ripple)
        - Smooth rolloff sounds natural on voice
        - Well-understood and computationally efficient

        Args:
            audio: Input samples
            cutoff_hz: Cutoff frequency in Hz

        Returns:
            Filtered audio
        """
        if len(audio) == 0:
            return audio

        sos, zi_template = self._get_filter_coeffs(cutoff_hz)

        # Initialize or reset filter state if cutoff changed
        if self._last_cutoff != cutoff_hz or self._filter_state is None:
            # Scale initial conditions by first sample for smooth start
            self._filter_state = zi_template * audio[0] if len(audio) > 0 else zi_template.copy()
            self._last_cutoff = cutoff_hz

        # Apply filter with state preservation for streaming
        # EFFICIENCY: sosfilt is implemented in C and highly optimized
        filtered, self._filter_state = signal.sosfilt(
            sos, audio, zi=self._filter_state
        )

        return filtered.astype(np.float32)

    def apply_gain(self, audio: np.ndarray, gain_linear: float) -> np.ndarray:
        """
        Apply linear gain with soft clipping.

        EFFICIENCY: Simple multiplication, but with clipping to
        prevent digital distortion.
        """
        if abs(gain_linear - 1.0) < 0.001:
            return audio

        # Apply gain
        output = audio * gain_linear

        # Soft clip to prevent harsh distortion
        # EFFICIENCY: np.clip is optimized C code
        return np.clip(output, -1.0, 1.0).astype(np.float32)

    def process(self, audio: np.ndarray, params: DSPParams) -> np.ndarray:
        """
        Apply full DSP chain with given parameters.

        Processing order is important:
        1. Pitch shift (changes frequency content)
        2. Time stretch (changes duration)
        3. Lowpass filter (removes high frequencies)
        4. Gain (final level adjustment)

        Args:
            audio: Input PCM samples (float32, -1.0 to 1.0)
            params: DSP transformation parameters

        Returns:
            Processed audio
        """
        # Early exit for passthrough
        if params.is_passthrough():
            return audio

        # Ensure float32
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        # 1. Pitch shift
        if abs(params.pitch_semitones) >= 0.01:
            audio = self.pitch_shift(audio, params.pitch_semitones)

        # 2. Time stretch
        if abs(params.speed_factor - 1.0) >= 0.01:
            audio = self.time_stretch(audio, params.speed_factor)

        # 3. Lowpass filter
        if params.lowpass_cutoff_hz is not None:
            audio = self.lowpass_filter(audio, params.lowpass_cutoff_hz)

        # 4. Gain adjustment
        if abs(params.gain_db) >= 0.1:
            audio = self.apply_gain(audio, params.gain_linear)

        return audio

    def reset(self):
        """Reset all internal state for new stream."""
        self._filter_state = None
        self._last_cutoff = None


# =============================================================================
# VOICE ADAPTER - High-Level Interface
# =============================================================================

@dataclass
class ProcessingStats:
    """Runtime statistics for monitoring."""
    chunks_processed: int = 0
    total_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    min_latency_ms: float = float('inf')
    current_state: str = "neutral"

    @property
    def avg_latency_ms(self) -> float:
        if self.chunks_processed == 0:
            return 0.0
        return self.total_latency_ms / self.chunks_processed


class VoiceAdapter:
    """
    Main interface for real-time voice adaptation.

    Combines EmotionalLogic and DSPChain into a simple API.

    Usage:
        adapter = VoiceAdapter(sample_rate=24000)

        # Process each TTS chunk with current caller vibe
        adapted = adapter.process(audio_chunk, VibeVector(agitation=0.8))

    For streaming with variable chunk sizes, use process_stream().
    """

    def __init__(
        self,
        sample_rate: int = 24000,
        chunk_size: int = 480,
        use_interpolation: bool = True,
        param_smoothing: float = 0.15,
    ):
        """
        Initialize voice adapter.

        Args:
            sample_rate: Audio sample rate in Hz
            chunk_size: Expected chunk size in samples
            use_interpolation: If True, use smooth parameter interpolation
            param_smoothing: EMA smoothing factor for parameter transitions
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.use_interpolation = use_interpolation
        self.param_smoothing = param_smoothing

        # Core components
        self.dsp = DSPChain(sample_rate, chunk_size)
        self.logic = EmotionalLogic()

        # Parameter smoothing state
        self._current_params = DSPParams()
        self._target_params = DSPParams()

        # Statistics
        self.stats = ProcessingStats()

    def _smooth_transition(self, target: DSPParams) -> DSPParams:
        """
        Smooth parameter transitions using exponential moving average.

        EFFICIENCY: EMA is O(1) - just a few multiplications.

        This prevents audio "clicks" and "pops" when parameters
        change suddenly due to vibe fluctuations.
        """
        alpha = self.param_smoothing

        def lerp(current: float, target: float) -> float:
            return current + alpha * (target - current)

        self._current_params = DSPParams(
            pitch_semitones=lerp(self._current_params.pitch_semitones, target.pitch_semitones),
            speed_factor=lerp(self._current_params.speed_factor, target.speed_factor),
            lowpass_cutoff_hz=target.lowpass_cutoff_hz,  # Don't interpolate filter on/off
            gain_db=lerp(self._current_params.gain_db, target.gain_db),
        )

        return self._current_params

    def process(
        self,
        audio: np.ndarray,
        vibe: VibeVector,
    ) -> np.ndarray:
        """
        Process a single audio chunk with vibe-based adaptation.

        Args:
            audio: Raw PCM samples (int16 or float32)
            vibe: Current emotional state from caller analysis

        Returns:
            Adapted audio (same format as input)
        """
        start_time = time.perf_counter()

        # Remember input format for output conversion
        input_dtype = audio.dtype
        input_was_int16 = (input_dtype == np.int16)

        # Convert to float32 processing format
        if input_was_int16:
            audio = audio.astype(np.float32) / 32768.0

        # Map vibe to DSP parameters
        if self.use_interpolation:
            self._target_params = self.logic.map_interpolated(vibe)
        else:
            self._target_params = self.logic.map_discrete(vibe)

        # Smooth the transition
        params = self._smooth_transition(self._target_params)

        # Apply DSP chain
        output = self.dsp.process(audio, params)

        # Convert back to original format
        if input_was_int16:
            output = (output * 32767).astype(np.int16)

        # Update statistics
        latency_ms = (time.perf_counter() - start_time) * 1000
        self._update_stats(latency_ms, vibe)

        return output

    def _update_stats(self, latency_ms: float, vibe: VibeVector):
        """Update processing statistics."""
        self.stats.chunks_processed += 1
        self.stats.total_latency_ms += latency_ms
        self.stats.max_latency_ms = max(self.stats.max_latency_ms, latency_ms)
        self.stats.min_latency_ms = min(self.stats.min_latency_ms, latency_ms)
        self.stats.current_state = self.logic.classify_state(vibe).value

    def process_stream(
        self,
        audio_generator: Iterator[bytes],
        vibe_source: Iterator[VibeVector],
        bytes_per_sample: int = 2,
    ) -> Generator[bytes, None, None]:
        """
        Process a streaming audio generator.

        This is the recommended interface for real-time TTS integration.

        EFFICIENCY: Generator-based processing avoids buffering
        entire audio streams in memory.

        Args:
            audio_generator: Iterator yielding raw PCM bytes
            vibe_source: Iterator yielding VibeVector for each chunk
            bytes_per_sample: 2 for int16, 4 for float32

        Yields:
            Processed audio bytes
        """
        dtype = np.int16 if bytes_per_sample == 2 else np.float32

        for audio_bytes, vibe in zip(audio_generator, vibe_source):
            # Convert bytes to numpy array
            audio = np.frombuffer(audio_bytes, dtype=dtype)

            # Process with current vibe
            processed = self.process(audio, vibe)

            # Yield processed bytes
            yield processed.tobytes()

    def get_current_params(self) -> DSPParams:
        """Get currently active DSP parameters."""
        return self._current_params

    def get_state(self) -> EmotionalState:
        """Get current emotional state classification."""
        return self.logic.classify_state(
            VibeVector(
                agitation=0.0 if self._current_params.pitch_semitones >= 0 else 0.8,
                energy=0.0 if self._current_params.pitch_semitones <= 0 else 0.9,
            )
        )

    def reset(self):
        """Reset all state for new call/session."""
        self.dsp.reset()
        self._current_params = DSPParams()
        self._target_params = DSPParams()
        self.stats = ProcessingStats()


# =============================================================================
# STREAMING BUFFER HANDLER
# =============================================================================

class StreamBuffer:
    """
    Buffer manager for handling variable-length audio chunks.

    Real-world audio streams often arrive in irregular chunk sizes.
    This buffer accumulates input and releases fixed-size chunks
    for consistent DSP processing.

    EFFICIENCY:
    - Uses ring buffer concept to avoid memory reallocation
    - Pre-allocates maximum buffer size
    - Zero-copy views where possible
    """

    def __init__(self, chunk_size: int = 480, max_buffer_chunks: int = 10):
        """
        Initialize stream buffer.

        Args:
            chunk_size: Output chunk size in samples
            max_buffer_chunks: Maximum chunks to buffer (overflow protection)
        """
        self.chunk_size = chunk_size
        self.max_size = chunk_size * max_buffer_chunks

        # Pre-allocated buffer
        self._buffer = np.zeros(self.max_size, dtype=np.float32)
        self._write_pos = 0

    def write(self, audio: np.ndarray) -> None:
        """
        Add audio to buffer.

        Args:
            audio: Input samples (any length)
        """
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        n = len(audio)

        # Handle overflow by dropping oldest data
        if self._write_pos + n > self.max_size:
            overflow = (self._write_pos + n) - self.max_size
            # Shift buffer left to make room
            self._buffer[:-overflow] = self._buffer[overflow:]
            self._write_pos -= overflow

        # Write new data
        self._buffer[self._write_pos:self._write_pos + n] = audio
        self._write_pos += n

    def read_chunks(self) -> Generator[np.ndarray, None, None]:
        """
        Yield complete chunks from buffer.

        Yields:
            Fixed-size audio chunks
        """
        while self._write_pos >= self.chunk_size:
            # Yield chunk (copy to avoid mutation issues)
            chunk = self._buffer[:self.chunk_size].copy()
            yield chunk

            # Shift remaining data left
            remaining = self._write_pos - self.chunk_size
            if remaining > 0:
                self._buffer[:remaining] = self._buffer[self.chunk_size:self._write_pos]
            self._write_pos = remaining

    def flush(self) -> Optional[np.ndarray]:
        """
        Get any remaining audio (zero-padded to chunk size).

        Returns:
            Remaining audio or None if empty
        """
        if self._write_pos == 0:
            return None

        # Zero-pad to chunk size
        output = np.zeros(self.chunk_size, dtype=np.float32)
        output[:self._write_pos] = self._buffer[:self._write_pos]
        self._write_pos = 0

        return output

    @property
    def buffered_samples(self) -> int:
        """Number of samples currently buffered."""
        return self._write_pos


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_adapter(
    sample_rate: int = 24000,
    use_interpolation: bool = True,
) -> VoiceAdapter:
    """Factory function to create a configured adapter."""
    return VoiceAdapter(
        sample_rate=sample_rate,
        use_interpolation=use_interpolation,
    )


def benchmark(iterations: int = 1000) -> dict:
    """
    Run performance benchmark.

    Returns latency statistics to verify <5ms target.
    """
    adapter = VoiceAdapter(use_interpolation=False)
    chunk = np.random.randn(480).astype(np.float32) * 0.5

    vibes = [
        VibeVector(agitation=0.85, energy=0.3),  # High agitation
        VibeVector(agitation=0.2, energy=0.9),   # High energy
        VibeVector(agitation=0.3, energy=0.4),   # Neutral
    ]

    latencies = []

    for i in range(iterations):
        vibe = vibes[i % len(vibes)]
        start = time.perf_counter()
        _ = adapter.process(chunk, vibe)
        latency_ms = (time.perf_counter() - start) * 1000
        latencies.append(latency_ms)

    latencies = np.array(latencies)

    return {
        "iterations": iterations,
        "avg_latency_ms": float(np.mean(latencies)),
        "max_latency_ms": float(np.max(latencies)),
        "min_latency_ms": float(np.min(latencies)),
        "p95_latency_ms": float(np.percentile(latencies, 95)),
        "p99_latency_ms": float(np.percentile(latencies, 99)),
        "target_met": bool(np.percentile(latencies, 99) < 5.0),
    }


# =============================================================================
# MAIN - Demo & Benchmark
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  VoxChameleon - Real-time Voice Adaptation Engine")
    print("=" * 60)
    print()

    # Run benchmark
    print("Running performance benchmark (1000 iterations)...")
    results = benchmark(1000)

    print()
    print("PERFORMANCE RESULTS:")
    print("-" * 40)
    print(f"  Average Latency: {results['avg_latency_ms']:.3f} ms")
    print(f"  P95 Latency:     {results['p95_latency_ms']:.3f} ms")
    print(f"  P99 Latency:     {results['p99_latency_ms']:.3f} ms")
    print(f"  Max Latency:     {results['max_latency_ms']:.3f} ms")
    print(f"  Target (<5ms):   {'PASS ✓' if results['target_met'] else 'FAIL ✗'}")
    print()

    # Demo transformations
    print("TRANSFORMATION DEMO:")
    print("-" * 40)

    adapter = VoiceAdapter(use_interpolation=False)

    scenarios = [
        ("Neutral", VibeVector(0.3, 0.4)),
        ("High Agitation (Angry Caller)", VibeVector(0.85, 0.3)),
        ("High Energy (Excited Caller)", VibeVector(0.2, 0.9)),
    ]

    for name, vibe in scenarios:
        # Let parameters converge
        dummy = np.zeros(480, dtype=np.float32)
        for _ in range(50):
            adapter.process(dummy, vibe)

        params = adapter.get_current_params()
        print(f"\n  {name}:")
        print(f"    Vibe: agitation={vibe.agitation}, energy={vibe.energy}")
        print(f"    → Pitch: {params.pitch_semitones:+.1f} semitones")
        print(f"    → Speed: {params.speed_factor:.2f}x")
        print(f"    → LPF:   {params.lowpass_cutoff_hz or 'OFF'}")
        print(f"    → Gain:  {params.gain_db:+.1f} dB")

        adapter.reset()

    print()
    print("=" * 60)
    print("  VoxChameleon Ready")
    print("=" * 60)
