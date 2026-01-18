# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
"""
VoxChameleon Voice Adapter - Real-time Audio Mirror

Main interface for real-time voice adaptation based on caller emotional state.
Processes TTS audio streams and applies DSP transformations to match the vibe.
"""

import time
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

from .engine import DSPEngine, TransformMapper, TransformParams, VibeVector


@dataclass
class AdapterStats:
    """Performance statistics for monitoring."""
    chunks_processed: int = 0
    total_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0
    current_state: str = "neutral"


@dataclass
class AdapterConfig:
    """Configuration for VoiceAdapter."""
    sample_rate: int = 24000
    chunk_size: int = 480  # 20ms at 24kHz
    use_interpolation: bool = True  # Smooth parameter transitions
    smoothing_factor: float = 0.3   # EMA smoothing for parameters
    latency_target_ms: float = 5.0  # Target max latency


class VoiceAdapter:
    """
    Real-time voice adaptation engine.

    The Audio Mirror: Adapts TTS voice characteristics in real-time
    based on the caller's emotional state (vibe vector).

    Usage:
        adapter = VoiceAdapter()

        # During call - process each TTS chunk
        for chunk in tts_stream:
            vibe = VibeVector(agitation=0.8, energy=0.3)
            adapted = adapter.process(chunk, vibe)
            # Send adapted audio to caller

    Thread Safety:
        This class is NOT thread-safe. Create one instance per call/session.
    """

    def __init__(self, config: Optional[AdapterConfig] = None):
        self.config = config or AdapterConfig()
        self.engine = DSPEngine(
            sample_rate=self.config.sample_rate,
            chunk_size=self.config.chunk_size,
        )

        # State tracking
        self._current_params = TransformParams()
        self._target_params = TransformParams()
        self._last_vibe = VibeVector()

        # Performance stats
        self.stats = AdapterStats()

        # State name for logging
        self._state_name = "neutral"

    def _determine_state(self, vibe: VibeVector) -> str:
        """Determine the emotional state name for logging."""
        if vibe.agitation > TransformMapper.AGITATION_THRESHOLD:
            return "high_agitation"
        elif vibe.energy > TransformMapper.ENERGY_THRESHOLD:
            return "high_energy"
        return "neutral"

    def _smooth_params(
        self,
        current: TransformParams,
        target: TransformParams,
        alpha: float,
    ) -> TransformParams:
        """
        Exponential moving average smoothing of parameters.

        Prevents jarring audio transitions when vibe changes rapidly.
        """
        def lerp(a: float, b: float) -> float:
            return a + alpha * (b - a)

        return TransformParams(
            pitch_semitones=lerp(current.pitch_semitones, target.pitch_semitones),
            speed_factor=lerp(current.speed_factor, target.speed_factor),
            lowpass_cutoff=(
                target.lowpass_cutoff  # Don't interpolate filter on/off
                if target.lowpass_cutoff is not None
                else None
            ),
        )

    def process(
        self,
        audio: np.ndarray,
        vibe: VibeVector,
    ) -> np.ndarray:
        """
        Process an audio chunk with vibe-based adaptation.

        This is the main entry point for real-time processing.

        Args:
            audio: Raw PCM audio chunk (int16 or float32)
                   Shape: (n_samples,) for mono
            vibe: Current emotional state from VoxResonance

        Returns:
            Adapted audio chunk (same format as input)
        """
        start_time = time.perf_counter()

        # Convert int16 to float32 if needed
        input_dtype = audio.dtype
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        # Ensure float32
        audio = audio.astype(np.float32)

        # Map vibe to transform parameters
        if self.config.use_interpolation:
            self._target_params = TransformMapper.interpolate_transform(
                vibe, self.config.smoothing_factor
            )
        else:
            self._target_params = TransformMapper.map_vibe_to_transform(vibe)

        # Smooth parameter transitions
        self._current_params = self._smooth_params(
            self._current_params,
            self._target_params,
            alpha=0.1,  # Slow transition for smooth audio
        )

        # Update state tracking
        self._state_name = self._determine_state(vibe)
        self._last_vibe = vibe

        # Check if passthrough (no transformation needed)
        if self._is_passthrough(self._current_params):
            output = audio
        else:
            # Apply DSP transformations
            output = self.engine.process_chunk(audio, self._current_params)

        # Convert back to original dtype if needed
        if input_dtype == np.int16:
            output = (output * 32767).astype(np.int16)

        # Update stats
        latency_ms = (time.perf_counter() - start_time) * 1000
        self._update_stats(latency_ms)

        return output

    def _is_passthrough(self, params: TransformParams) -> bool:
        """Check if parameters result in no transformation."""
        return (
            abs(params.pitch_semitones) < 0.01 and
            abs(params.speed_factor - 1.0) < 0.01 and
            params.lowpass_cutoff is None
        )

    def _update_stats(self, latency_ms: float):
        """Update performance statistics."""
        self.stats.chunks_processed += 1
        self.stats.total_latency_ms += latency_ms
        self.stats.max_latency_ms = max(self.stats.max_latency_ms, latency_ms)
        self.stats.avg_latency_ms = (
            self.stats.total_latency_ms / self.stats.chunks_processed
        )
        self.stats.current_state = self._state_name

    def get_current_params(self) -> TransformParams:
        """Get the currently active transformation parameters."""
        return self._current_params

    def get_state(self) -> str:
        """Get the current adaptation state name."""
        return self._state_name

    def reset(self):
        """Reset adapter state for a new call."""
        self.engine.reset()
        self._current_params = TransformParams()
        self._target_params = TransformParams()
        self._last_vibe = VibeVector()
        self.stats = AdapterStats()
        self._state_name = "neutral"


class StreamingVoiceAdapter(VoiceAdapter):
    """
    Extended adapter with buffer management for variable-length chunks.

    Handles the reality of network audio where chunk sizes may vary.
    Maintains internal buffer to ensure consistent processing.
    """

    def __init__(self, config: Optional[AdapterConfig] = None):
        super().__init__(config)

        # Input/output buffers for chunk normalization
        self._input_buffer = np.array([], dtype=np.float32)
        self._output_buffer = np.array([], dtype=np.float32)

    def process_stream(
        self,
        audio: np.ndarray,
        vibe: VibeVector,
    ) -> np.ndarray:
        """
        Process audio with internal buffering.

        Handles variable-length input chunks by buffering and
        processing in fixed-size segments.

        Args:
            audio: Input audio (any length)
            vibe: Current vibe state

        Returns:
            Processed audio (may be different length due to buffering)
        """
        # Convert to float32 if needed
        input_dtype = audio.dtype
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        # Add to input buffer
        self._input_buffer = np.concatenate([self._input_buffer, audio])

        # Process complete chunks
        processed_chunks = []
        chunk_size = self.config.chunk_size

        while len(self._input_buffer) >= chunk_size:
            chunk = self._input_buffer[:chunk_size]
            self._input_buffer = self._input_buffer[chunk_size:]

            # Process with base class method
            processed = super().process(chunk, vibe)
            processed_chunks.append(processed)

        # Combine processed chunks
        if processed_chunks:
            output = np.concatenate(processed_chunks)
        else:
            output = np.array([], dtype=np.float32)

        # Convert back if needed
        if input_dtype == np.int16 and len(output) > 0:
            output = (output * 32767).astype(np.int16)

        return output

    def flush(self) -> np.ndarray:
        """
        Flush remaining audio from buffers.

        Call at end of stream to get any remaining processed audio.
        """
        if len(self._input_buffer) == 0:
            return np.array([], dtype=np.float32)

        # Pad to chunk size and process
        padding_needed = self.config.chunk_size - len(self._input_buffer)
        padded = np.pad(self._input_buffer, (0, padding_needed), mode='constant')

        output = super().process(padded, self._last_vibe)

        # Return only the valid portion
        valid_length = len(self._input_buffer)
        self._input_buffer = np.array([], dtype=np.float32)

        return output[:valid_length]

    def reset(self):
        """Reset all state including buffers."""
        super().reset()
        self._input_buffer = np.array([], dtype=np.float32)
        self._output_buffer = np.array([], dtype=np.float32)
