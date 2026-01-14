# =============================================================================
# VoxNexus Plugin Interfaces
# =============================================================================
# MIT License - Copyright (c) 2024 VoxNexus Contributors
# =============================================================================

from __future__ import annotations

"""
Core Interfaces for VoxNexus Plugin Architecture

This module defines the Abstract Base Classes (ABCs) that all plugins must
implement. The Strategy Pattern allows swapping providers by changing a
single environment variable.

Example:
    To create a custom LLM plugin:

    ```python
    from voxnexus.core.interfaces import BaseLLM, Message

    class MyCustomLLM(BaseLLM):
        async def generate(self, messages: list[Message]) -> AsyncIterator[str]:
            # Your implementation here
            yield "Hello from custom LLM!"
    ```
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any,
    AsyncIterator,
    Callable,
    Optional,
    TypeVar,
    Generic,
)
import uuid
from datetime import datetime


# =============================================================================
# Enums & Constants
# =============================================================================

class MessageRole(str, Enum):
    """Role of the message sender in a conversation."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class AgentState(str, Enum):
    """Current state of the voice agent."""
    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    ERROR = "error"


class ProviderType(str, Enum):
    """Type of service provider."""
    LLM = "llm"
    STT = "stt"
    TTS = "tts"


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Message:
    """
    A single message in a conversation.

    Attributes:
        role: The role of the message sender (system, user, assistant, tool)
        content: The text content of the message
        name: Optional name for tool messages
        tool_call_id: Optional ID linking to a tool call
        metadata: Optional additional metadata
    """
    role: MessageRole
    content: str
    name: Optional[str] = None
    tool_call_id: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API calls."""
        result = {"role": self.role.value, "content": self.content}
        if self.name:
            result["name"] = self.name
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id
        return result


@dataclass
class ToolCall:
    """
    Represents a tool/function call requested by the LLM.

    Attributes:
        id: Unique identifier for this tool call
        name: Name of the tool/function to call
        arguments: JSON arguments for the tool
    """
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class AudioFrame:
    """
    A frame of audio data.

    Attributes:
        data: Raw audio bytes
        sample_rate: Audio sample rate in Hz
        channels: Number of audio channels
        timestamp_ms: Timestamp in milliseconds
    """
    data: bytes
    sample_rate: int = 16000
    channels: int = 1
    timestamp_ms: float = 0.0


@dataclass
class TranscriptionResult:
    """
    Result from Speech-to-Text transcription.

    Attributes:
        text: The transcribed text
        confidence: Confidence score (0.0 to 1.0)
        is_final: Whether this is a final or interim result
        language: Detected language code
        words: Word-level timestamps if available
    """
    text: str
    confidence: float = 1.0
    is_final: bool = True
    language: Optional[str] = None
    words: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class SynthesisResult:
    """
    Result from Text-to-Speech synthesis.

    Attributes:
        audio: Raw audio bytes
        sample_rate: Audio sample rate in Hz
        duration_ms: Duration in milliseconds
        format: Audio format (e.g., 'pcm', 'mp3', 'opus')
    """
    audio: bytes
    sample_rate: int = 24000
    duration_ms: float = 0.0
    format: str = "pcm"


@dataclass
class WebhookConfig:
    """
    Configuration for an external webhook.

    Attributes:
        url: The webhook URL to call
        method: HTTP method (GET, POST, etc.)
        headers: Custom headers to include
        timeout_ms: Request timeout in milliseconds
        retry_count: Number of retries on failure
        secret: Optional secret for request signing
    """
    url: str
    method: str = "POST"
    headers: dict[str, str] = field(default_factory=dict)
    timeout_ms: int = 30000
    retry_count: int = 3
    secret: Optional[str] = None


@dataclass
class LLMConfig:
    """
    Configuration for an LLM provider.

    Attributes:
        provider: Provider name (e.g., 'openai', 'anthropic', 'ollama')
        model: Model identifier
        api_key: API key (loaded from environment if not specified)
        base_url: Custom API base URL
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        system_prompt: Default system prompt
        tools: List of tool definitions
        extra: Provider-specific extra configuration
    """
    provider: str = "openai"
    model: str = "gpt-4o"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1024
    system_prompt: Optional[str] = None
    tools: list[dict[str, Any]] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class STTConfig:
    """
    Configuration for a Speech-to-Text provider.

    Attributes:
        provider: Provider name (e.g., 'deepgram', 'whisper', 'assemblyai')
        model: Model identifier
        api_key: API key (loaded from environment if not specified)
        language: Target language code
        sample_rate: Expected audio sample rate
        interim_results: Whether to emit interim results
        extra: Provider-specific extra configuration
    """
    provider: str = "deepgram"
    model: str = "nova-2"
    api_key: Optional[str] = None
    language: str = "en"
    sample_rate: int = 16000
    interim_results: bool = True
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class TTSConfig:
    """
    Configuration for a Text-to-Speech provider.

    Attributes:
        provider: Provider name (e.g., 'cartesia', 'elevenlabs', 'openai')
        model: Model identifier
        api_key: API key (loaded from environment if not specified)
        voice_id: Voice identifier
        sample_rate: Output audio sample rate
        speed: Speech speed multiplier
        extra: Provider-specific extra configuration
    """
    provider: str = "cartesia"
    model: str = "sonic-english"
    api_key: Optional[str] = None
    voice_id: str = "default"
    sample_rate: int = 24000
    speed: float = 1.0
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentConfig:
    """
    Complete configuration for a VoxNexus voice agent.

    Attributes:
        id: Unique agent identifier
        tenant_id: Tenant ID for multi-tenancy
        name: Human-readable agent name
        llm: LLM provider configuration
        stt: Speech-to-Text configuration
        tts: Text-to-Speech configuration
        webhooks: Named webhook configurations
        metadata: Additional agent metadata
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    name: str = "VoxNexus Agent"
    llm: LLMConfig = field(default_factory=LLMConfig)
    stt: STTConfig = field(default_factory=STTConfig)
    tts: TTSConfig = field(default_factory=TTSConfig)
    webhooks: dict[str, WebhookConfig] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentConfig":
        """Create an AgentConfig from a dictionary (e.g., from database)."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            tenant_id=data.get("tenant_id", "default"),
            name=data.get("name", "VoxNexus Agent"),
            llm=LLMConfig(**data.get("llm_config", {})),
            stt=STTConfig(**data.get("stt_config", {})),
            tts=TTSConfig(**data.get("tts_config", {})),
            webhooks={
                k: WebhookConfig(**v)
                for k, v in data.get("webhooks", {}).items()
            },
            metadata=data.get("metadata", {}),
        )


# =============================================================================
# Abstract Base Classes (Plugin Interfaces)
# =============================================================================

class BaseLLM(ABC):
    """
    Abstract base class for Large Language Model providers.

    Implement this interface to add support for new LLM providers.
    The plugin system will automatically discover and register implementations.

    Example:
        ```python
        class OllamaLLM(BaseLLM):
            def __init__(self, config: LLMConfig):
                self.config = config
                self.client = ollama.AsyncClient(host=config.base_url)

            async def generate(self, messages, **kwargs):
                async for chunk in self.client.chat(
                    model=self.config.model,
                    messages=[m.to_dict() for m in messages],
                    stream=True
                ):
                    yield chunk['message']['content']
        ```
    """

    def __init__(self, config: LLMConfig):
        """
        Initialize the LLM provider.

        Args:
            config: LLM configuration object
        """
        self.config = config

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the unique provider name (e.g., 'openai', 'anthropic')."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: list[Message],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """
        Generate a streaming response from the LLM.

        Args:
            messages: List of conversation messages
            **kwargs: Additional provider-specific arguments

        Yields:
            Text chunks as they are generated
        """
        pass

    @abstractmethod
    async def generate_with_tools(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
        **kwargs: Any,
    ) -> AsyncIterator[str | ToolCall]:
        """
        Generate a response that may include tool calls.

        Args:
            messages: List of conversation messages
            tools: List of tool definitions in OpenAI format
            **kwargs: Additional provider-specific arguments

        Yields:
            Text chunks or ToolCall objects
        """
        pass

    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and accessible.

        Returns:
            True if the provider is operational
        """
        try:
            async for _ in self.generate([
                Message(role=MessageRole.USER, content="Hi")
            ]):
                return True
        except Exception:
            return False
        return False

    async def close(self) -> None:
        """Clean up any resources (connections, etc.)."""
        pass


class BaseSTT(ABC):
    """
    Abstract base class for Speech-to-Text providers.

    Implement this interface to add support for new STT providers.
    Supports both streaming and batch transcription.

    Example:
        ```python
        class WhisperSTT(BaseSTT):
            def __init__(self, config: STTConfig):
                self.config = config
                self.client = openai.AsyncOpenAI()

            async def transcribe(self, audio: bytes, **kwargs):
                result = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                )
                return TranscriptionResult(text=result.text)
        ```
    """

    def __init__(self, config: STTConfig):
        """
        Initialize the STT provider.

        Args:
            config: STT configuration object
        """
        self.config = config

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the unique provider name (e.g., 'deepgram', 'whisper')."""
        pass

    @abstractmethod
    async def transcribe(
        self,
        audio: bytes,
        **kwargs: Any,
    ) -> TranscriptionResult:
        """
        Transcribe a complete audio segment.

        Args:
            audio: Raw audio bytes
            **kwargs: Additional provider-specific arguments

        Returns:
            TranscriptionResult with the transcribed text
        """
        pass

    @abstractmethod
    async def stream_transcribe(
        self,
        audio_stream: AsyncIterator[AudioFrame],
        **kwargs: Any,
    ) -> AsyncIterator[TranscriptionResult]:
        """
        Stream transcription for real-time audio.

        Args:
            audio_stream: Async iterator of audio frames
            **kwargs: Additional provider-specific arguments

        Yields:
            TranscriptionResult objects (may include interim results)
        """
        pass

    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and accessible.

        Returns:
            True if the provider is operational
        """
        try:
            # Generate a tiny audio sample for testing
            test_audio = b'\x00' * 1600  # 100ms of silence at 16kHz
            await self.transcribe(test_audio)
            return True
        except Exception:
            return False

    async def close(self) -> None:
        """Clean up any resources (connections, etc.)."""
        pass


class BaseTTS(ABC):
    """
    Abstract base class for Text-to-Speech providers.

    Implement this interface to add support for new TTS providers.
    Supports both streaming and batch synthesis.

    Example:
        ```python
        class ElevenLabsTTS(BaseTTS):
            def __init__(self, config: TTSConfig):
                self.config = config
                self.client = elevenlabs.AsyncClient(api_key=config.api_key)

            async def synthesize(self, text: str, **kwargs):
                audio = await self.client.generate(
                    text=text,
                    voice=self.config.voice_id,
                )
                return SynthesisResult(audio=audio)
        ```
    """

    def __init__(self, config: TTSConfig):
        """
        Initialize the TTS provider.

        Args:
            config: TTS configuration object
        """
        self.config = config

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the unique provider name (e.g., 'cartesia', 'elevenlabs')."""
        pass

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        """
        Synthesize speech from text.

        Args:
            text: Text to synthesize
            **kwargs: Additional provider-specific arguments

        Returns:
            SynthesisResult with the audio data
        """
        pass

    @abstractmethod
    async def stream_synthesize(
        self,
        text_stream: AsyncIterator[str],
        **kwargs: Any,
    ) -> AsyncIterator[AudioFrame]:
        """
        Stream synthesis for real-time text-to-speech.

        Args:
            text_stream: Async iterator of text chunks
            **kwargs: Additional provider-specific arguments

        Yields:
            AudioFrame objects as audio is generated
        """
        pass

    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and accessible.

        Returns:
            True if the provider is operational
        """
        try:
            result = await self.synthesize("Test")
            return len(result.audio) > 0
        except Exception:
            return False

    async def close(self) -> None:
        """Clean up any resources (connections, etc.)."""
        pass


class BaseVoiceAgent(ABC):
    """
    Abstract base class for the complete voice agent pipeline.

    This interface combines LLM, STT, and TTS into a cohesive agent
    that can handle real-time voice conversations.

    Example:
        ```python
        class CustomAgent(BaseVoiceAgent):
            async def process_audio(self, audio_stream):
                async for frame in audio_stream:
                    # Your custom pipeline here
                    transcription = await self.stt.transcribe(frame.data)
                    async for chunk in self.llm.generate([...]):
                        async for audio in self.tts.stream_synthesize(...):
                            yield audio
        ```
    """

    def __init__(
        self,
        config: AgentConfig,
        llm: BaseLLM,
        stt: BaseSTT,
        tts: BaseTTS,
    ):
        """
        Initialize the voice agent.

        Args:
            config: Complete agent configuration
            llm: LLM provider instance
            stt: STT provider instance
            tts: TTS provider instance
        """
        self.config = config
        self.llm = llm
        self.stt = stt
        self.tts = tts
        self._state = AgentState.IDLE
        self._conversation_history: list[Message] = []

    @property
    def state(self) -> AgentState:
        """Get the current agent state."""
        return self._state

    @property
    def conversation_history(self) -> list[Message]:
        """Get the conversation history."""
        return self._conversation_history.copy()

    @abstractmethod
    async def process_audio(
        self,
        audio_stream: AsyncIterator[AudioFrame],
    ) -> AsyncIterator[AudioFrame]:
        """
        Process incoming audio and generate voice responses.

        This is the main entry point for real-time voice interaction.

        Args:
            audio_stream: Incoming audio frames from the user

        Yields:
            Audio frames containing the agent's response
        """
        pass

    @abstractmethod
    async def process_text(
        self,
        text: str,
    ) -> AsyncIterator[str]:
        """
        Process text input and generate text responses.

        Useful for testing and text-based fallback.

        Args:
            text: User's text input

        Yields:
            Text chunks of the agent's response
        """
        pass

    async def call_webhook(
        self,
        webhook_name: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Call a configured webhook.

        Args:
            webhook_name: Name of the webhook from config
            payload: JSON payload to send

        Returns:
            Response data from the webhook

        Raises:
            KeyError: If webhook is not configured
            httpx.HTTPError: If webhook call fails
        """
        import httpx

        if webhook_name not in self.config.webhooks:
            raise KeyError(f"Webhook '{webhook_name}' not configured")

        webhook = self.config.webhooks[webhook_name]

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=webhook.method,
                url=webhook.url,
                json=payload,
                headers=webhook.headers,
                timeout=webhook.timeout_ms / 1000,
            )
            response.raise_for_status()
            return response.json()

    async def reset(self) -> None:
        """Reset the agent state and conversation history."""
        self._state = AgentState.IDLE
        self._conversation_history.clear()

    async def close(self) -> None:
        """Clean up all resources."""
        await self.llm.close()
        await self.stt.close()
        await self.tts.close()


# =============================================================================
# Plugin Registry Type
# =============================================================================

T = TypeVar('T', BaseLLM, BaseSTT, BaseTTS)


class PluginRegistry(Generic[T]):
    """
    Registry for plugin implementations.

    Used by the AgentFactory to discover and instantiate plugins.

    Example:
        ```python
        llm_registry = PluginRegistry[BaseLLM]()
        llm_registry.register("openai", OpenAIPlugin)
        llm_registry.register("anthropic", AnthropicPlugin)

        llm = llm_registry.create("openai", config)
        ```
    """

    def __init__(self):
        self._plugins: dict[str, type[T]] = {}

    def register(self, name: str, plugin_class: type[T]) -> None:
        """
        Register a plugin implementation.

        Args:
            name: Unique provider name
            plugin_class: Plugin class implementing the interface
        """
        self._plugins[name.lower()] = plugin_class

    def get(self, name: str) -> type[T] | None:
        """
        Get a registered plugin class.

        Args:
            name: Provider name

        Returns:
            Plugin class or None if not found
        """
        return self._plugins.get(name.lower())

    def create(self, name: str, config: Any) -> T:
        """
        Create an instance of a registered plugin.

        Args:
            name: Provider name
            config: Configuration object for the plugin

        Returns:
            Instantiated plugin

        Raises:
            ValueError: If plugin is not registered
        """
        plugin_class = self.get(name)
        if plugin_class is None:
            available = ", ".join(self._plugins.keys())
            raise ValueError(
                f"Unknown provider '{name}'. Available: {available}"
            )
        return plugin_class(config)

    def list_providers(self) -> list[str]:
        """List all registered provider names."""
        return list(self._plugins.keys())


# =============================================================================
# Guardian Security Suite Interface (Open Core Plugin Protocol)
# =============================================================================

class RiskLevel(str, Enum):
    """Risk level classification for conversation sentiment."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RiskScore:
    """
    Risk assessment result from Guardian sentiment analysis.

    Attributes:
        level: Overall risk level classification
        score: Numeric score (0.0 = safe, 1.0 = critical)
        sentiment: Sentiment polarity (-1.0 negative to 1.0 positive)
        keywords: Detected risk keywords/phrases
        category: Risk category (e.g., 'frustration', 'threat', 'churn')
        confidence: Confidence in the assessment (0.0 to 1.0)
        metadata: Additional analysis metadata
    """
    level: RiskLevel
    score: float
    sentiment: float = 0.0
    keywords: list[str] = field(default_factory=list)
    category: Optional[str] = None
    confidence: float = 1.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class GuardianConfig:
    """
    Configuration for the Guardian Security Suite.

    Attributes:
        api_key: License key for Guardian activation
        auto_handoff_threshold: Risk score that triggers automatic handoff
        alert_webhook: URL to POST alerts to
        enable_sentiment: Enable real-time sentiment analysis
        enable_risk_detection: Enable risk keyword detection
        enable_takeover: Enable human takeover capability
        custom_keywords: Additional risk keywords to detect (deprecated, use categorized keywords)
        critical_keywords: Keywords that trigger CRITICAL alerts
        high_risk_keywords: Keywords that trigger HIGH alerts
        medium_risk_keywords: Keywords that trigger MEDIUM alerts
    """
    api_key: Optional[str] = None
    auto_handoff_threshold: float = 0.8
    alert_webhook: Optional[str] = None
    enable_sentiment: bool = True
    enable_risk_detection: bool = True
    enable_takeover: bool = True
    custom_keywords: list[str] = field(default_factory=list)
    # Categorized keywords from GuardianConfig table
    critical_keywords: list[str] = field(default_factory=list)
    high_risk_keywords: list[str] = field(default_factory=list)
    medium_risk_keywords: list[str] = field(default_factory=list)


class BaseGuardian(ABC):
    """
    Abstract base class for the Guardian Security Suite.

    The Guardian plugin provides real-time sentiment analysis, risk detection,
    and human takeover capabilities for voice conversations. This is a
    proprietary module that upgrades VoxNexus with enterprise security features.

    The open-source VoxNexus engine functions perfectly without Guardian,
    but enables advanced monitoring when the proprietary module is installed.

    Example:
        ```python
        # Guardian is auto-detected at startup
        try:
            from voxnexus_guardian import Guardian
            guardian = Guardian(api_key=os.getenv("GUARDIAN_KEY"))
            logger.info("Guardian Security Suite: ACTIVE")
        except ImportError:
            guardian = None
            logger.info("Running in Open Source Mode")

        # Hook into conversation pipeline
        if guardian:
            risk = await guardian.analyze_text(user_text)
            if guardian.should_intervene(risk):
                await guardian.trigger_handoff(room, reason="high_risk")
        ```
    """

    def __init__(self, config: GuardianConfig):
        """
        Initialize Guardian with configuration.

        Args:
            config: Guardian configuration object
        """
        self.config = config
        self._active = False
        self._room = None

    @property
    @abstractmethod
    def is_licensed(self) -> bool:
        """Check if Guardian has a valid license."""
        pass

    @property
    def is_active(self) -> bool:
        """Check if Guardian is currently active in a session."""
        return self._active

    @abstractmethod
    async def on_room_join(self, room: Any) -> None:
        """
        Called when the agent joins a LiveKit room.

        Initialize session state, start monitoring, connect to alert systems.

        Args:
            room: The LiveKit room object
        """
        pass

    @abstractmethod
    async def on_room_leave(self) -> None:
        """
        Called when the agent leaves a room.

        Clean up session state, send final analytics, close connections.
        """
        pass

    @abstractmethod
    async def analyze_text(self, text: str, speaker: str = "user") -> RiskScore:
        """
        Analyze text for sentiment and risk indicators.

        This is called on every transcription from the user and every
        response from the agent to maintain conversation context.

        Args:
            text: The text to analyze
            speaker: Who said this ('user' or 'agent')

        Returns:
            RiskScore with sentiment and risk assessment
        """
        pass

    @abstractmethod
    def should_intervene(self, risk: RiskScore) -> bool:
        """
        Determine if human intervention is needed.

        Args:
            risk: The latest risk assessment

        Returns:
            True if automatic handoff should be triggered
        """
        pass

    @abstractmethod
    async def trigger_handoff(
        self,
        room: Any,
        reason: str,
        metadata: Optional[dict] = None,
    ) -> bool:
        """
        Initiate handoff to human agent.

        Args:
            room: The LiveKit room
            reason: Reason for handoff (e.g., 'high_risk', 'user_request')
            metadata: Additional context for the human agent

        Returns:
            True if handoff was successful
        """
        pass

    @abstractmethod
    async def on_human_takeover(self, data: dict) -> None:
        """
        Handle incoming takeover command from human agent.

        Called when a human clicks "Take Over" in the Guardian dashboard.
        Should gracefully pause AI responses and hand control to human.

        Args:
            data: Takeover command data (agent_id, reason, human_name, etc.)
        """
        pass

    @abstractmethod
    async def on_human_release(self) -> None:
        """
        Handle release of control back to AI agent.

        Called when human agent releases control back to the AI.
        Should resume normal AI conversation flow.
        """
        pass

    @abstractmethod
    async def get_session_analytics(self) -> dict[str, Any]:
        """
        Get analytics for the current session.

        Returns:
            Dictionary with session metrics (avg sentiment, risk events, etc.)
        """
        pass

    @abstractmethod
    async def push_alert(
        self,
        alert_type: str,
        message: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """
        Push an alert to the monitoring dashboard.

        Args:
            alert_type: Type of alert ('risk', 'sentiment', 'system')
            message: Human-readable alert message
            metadata: Additional alert data
        """
        pass

    async def close(self) -> None:
        """Clean up resources."""
        self._active = False
        self._room = None
