# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
"""
VoxChameleon - Real-time Voice Adaptation Module

The Audio Mirror: Physically adapts TTS voice characteristics in real-time
based on caller emotional state to reduce psychological friction.

Usage:
    from plugins.chameleon import VoiceAdapter, VibeVector

    adapter = VoiceAdapter()

    # Process TTS audio with caller's emotional state
    vibe = VibeVector(agitation=0.8, energy=0.3)  # Angry caller
    adapted_audio = adapter.process(tts_audio, vibe)
    # Result: Deeper, slower, warmer voice to calm the caller

Transformation Logic:
    | State              | Trigger          | Transformation                    |
    |--------------------|------------------|-----------------------------------|
    | High Agitation     | agitation > 0.7  | Pitch -2, Speed 0.9x, LPF 3.5kHz  |
    | High Energy        | energy > 0.8     | Pitch +1, Speed 1.1x              |
    | Neutral            | default          | Passthrough                       |

Performance:
    - Target latency: <5ms per chunk
    - CPU-native (no GPU required)
    - Optimized for Intel/AMD cores
"""

# Legacy imports (original modular implementation)
from .engine import (
    DSPEngine,
    TransformMapper,
    TransformParams,
    VibeVector,
)
from .adapter import (
    VoiceAdapter,
    StreamingVoiceAdapter,
    AdapterConfig,
    AdapterStats,
)

# Consolidated module (recommended)
from .vox_chameleon import (
    VoiceAdapter as ChameleonAdapter,
    DSPChain,
    DSPParams,
    EmotionalLogic,
    EmotionalState,
    StreamBuffer,
    ProcessingStats,
    benchmark as run_benchmark,
)

__version__ = "1.0.0"
__all__ = [
    # Consolidated module (recommended)
    "ChameleonAdapter",
    "DSPChain",
    "DSPParams",
    "EmotionalLogic",
    "EmotionalState",
    "StreamBuffer",
    "ProcessingStats",
    "run_benchmark",
    # Legacy modular implementation
    "VoiceAdapter",
    "StreamingVoiceAdapter",
    "VibeVector",
    "AdapterConfig",
    "AdapterStats",
    "TransformParams",
    "DSPEngine",
    "TransformMapper",
]


def create_adapter(
    sample_rate: int = 24000,
    chunk_size: int = 480,
    streaming: bool = False,
) -> VoiceAdapter:
    """
    Factory function to create a configured adapter.

    Args:
        sample_rate: Audio sample rate in Hz
        chunk_size: Processing chunk size in samples
        streaming: If True, use StreamingVoiceAdapter with buffering

    Returns:
        Configured VoiceAdapter instance
    """
    config = AdapterConfig(
        sample_rate=sample_rate,
        chunk_size=chunk_size,
    )

    if streaming:
        return StreamingVoiceAdapter(config)
    return VoiceAdapter(config)


def benchmark(iterations: int = 1000) -> dict:
    """
    Run performance benchmark.

    Returns latency statistics to verify <5ms target.
    """
    import time
    import numpy as np

    adapter = VoiceAdapter()
    chunk = np.random.randn(480).astype(np.float32) * 0.5

    vibes = [
        VibeVector(agitation=0.8, energy=0.3),  # High agitation
        VibeVector(agitation=0.2, energy=0.9),  # High energy
        VibeVector(agitation=0.3, energy=0.4),  # Neutral
    ]

    latencies = []

    for i in range(iterations):
        vibe = vibes[i % len(vibes)]
        start = time.perf_counter()
        _ = adapter.process(chunk, vibe)
        latency_ms = (time.perf_counter() - start) * 1000
        latencies.append(latency_ms)

    return {
        "iterations": iterations,
        "avg_latency_ms": np.mean(latencies),
        "max_latency_ms": np.max(latencies),
        "min_latency_ms": np.min(latencies),
        "p95_latency_ms": np.percentile(latencies, 95),
        "p99_latency_ms": np.percentile(latencies, 99),
        "target_met": np.percentile(latencies, 99) < 5.0,
    }
