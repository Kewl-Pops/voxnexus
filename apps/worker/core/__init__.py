# =============================================================================
# VoxNexus Worker Core Module
# =============================================================================
# MIT License - Copyright (c) 2024 VoxNexus Contributors
# =============================================================================

"""
VoxNexus Worker Core - Plugin Architecture Foundation

This module provides the abstract base classes and interfaces that enable
the extensible plugin architecture. Community developers can create custom
plugins by implementing these interfaces.
"""

from .interfaces import (
    BaseLLM,
    BaseSTT,
    BaseTTS,
    BaseVoiceAgent,
    AgentConfig,
    LLMConfig,
    STTConfig,
    TTSConfig,
    WebhookConfig,
    Message,
    MessageRole,
    AudioFrame,
    TranscriptionResult,
    SynthesisResult,
)

__all__ = [
    "BaseLLM",
    "BaseSTT",
    "BaseTTS",
    "BaseVoiceAgent",
    "AgentConfig",
    "LLMConfig",
    "STTConfig",
    "TTSConfig",
    "WebhookConfig",
    "Message",
    "MessageRole",
    "AudioFrame",
    "TranscriptionResult",
    "SynthesisResult",
]

__version__ = "0.1.0"
