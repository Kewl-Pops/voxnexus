#!/usr/bin/env python3
# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
# =============================================================================
# VoxNexus Worker - Main Entry Point
# =============================================================================

from __future__ import annotations

"""
VoxNexus Voice Agent Worker

This is the main entry point for the VoxNexus voice agent worker.
It initializes the plugin system, connects to LiveKit, and handles
voice interactions using the configured providers.

Usage:
    python main.py

Environment Variables:
    See .env.example for full configuration options.
"""

import asyncio
import logging
import os
import signal
import sys
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Any

from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from core.interfaces import (
    AgentConfig,
    AgentState,
    AudioFrame,
    BaseGuardian,
    BaseLLM,
    BaseSTT,
    BaseTTS,
    BaseVoiceAgent,
    GuardianConfig,
    LLMConfig,
    Message,
    MessageRole,
    PluginRegistry,
    RiskLevel,
    RiskScore,
    STTConfig,
    SynthesisResult,
    ToolCall,
    TranscriptionResult,
    TTSConfig,
)

# =============================================================================
# Logging Configuration
# =============================================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("voxnexus.worker")


# =============================================================================
# Database Connection Pool
# =============================================================================

_db_pool = None


def get_clean_database_url() -> str:
    """Get DATABASE_URL with Prisma-specific parameters stripped."""
    url = os.getenv("DATABASE_URL", "")
    # Remove ?schema=public which Prisma adds but asyncpg doesn't understand
    if "?schema=" in url:
        url = url.split("?schema=")[0]
    return url


async def get_db_pool():
    """Get or create the database connection pool."""
    global _db_pool
    if _db_pool is None:
        import asyncpg
        _db_pool = await asyncpg.create_pool(get_clean_database_url(), min_size=1, max_size=5)
    return _db_pool


# =============================================================================
# Guardian Security Suite (Proprietary Plugin - Optional)
# =============================================================================

# Global Guardian instance - None if not installed/licensed
_guardian_plugin: BaseGuardian | None = None


def load_guardian_plugin() -> BaseGuardian | None:
    """
    Dynamically load the Guardian Security Suite if available.

    The Guardian plugin is a proprietary module that provides:
    - Real-time sentiment analysis (VADER + custom ML)
    - Risk detection and keyword monitoring
    - Human takeover capability
    - Live monitoring dashboard

    The open-source VoxNexus engine works perfectly without Guardian.
    Guardian "upgrades" the system when the module is detected.

    Returns:
        Guardian instance if available and licensed, None otherwise
    """
    global _guardian_plugin

    if _guardian_plugin is not None:
        return _guardian_plugin

    guardian_key = os.getenv("GUARDIAN_KEY")

    # Try to import Guardian from multiple sources:
    # 1. Local plugins.guardian (development/integrated mode)
    # 2. External voxnexus_guardian package (production distribution)
    Guardian = None

    try:
        # First, try local plugins.guardian module
        from plugins.guardian import Guardian as LocalGuardian
        if LocalGuardian is not None:
            Guardian = LocalGuardian
            logger.debug("Loaded Guardian from local plugins")
    except ImportError:
        pass

    if Guardian is None:
        try:
            # Fall back to external package
            from voxnexus_guardian import Guardian as ExternalGuardian
            Guardian = ExternalGuardian
            logger.debug("Loaded Guardian from voxnexus_guardian package")
        except ImportError:
            pass

    if Guardian is None:
        # Guardian module not available
        logger.info("🔓 Guardian Security Suite: NOT DETECTED")
        logger.info("   Running in Open Source Mode")
        logger.info("   Visit https://voxnexus.pro/guardian for enterprise features")
        return None

    try:
        config = GuardianConfig(
            api_key=guardian_key,
            auto_handoff_threshold=float(os.getenv("GUARDIAN_HANDOFF_THRESHOLD", "0.8")),
            alert_webhook=os.getenv("GUARDIAN_ALERT_WEBHOOK"),
            enable_sentiment=os.getenv("GUARDIAN_ENABLE_SENTIMENT", "true").lower() == "true",
            enable_risk_detection=os.getenv("GUARDIAN_ENABLE_RISK", "true").lower() == "true",
            enable_takeover=os.getenv("GUARDIAN_ENABLE_TAKEOVER", "true").lower() == "true",
        )

        _guardian_plugin = Guardian(config)

        if _guardian_plugin.is_licensed:
            logger.info("=" * 60)
            logger.info("🔐 GUARDIAN SECURITY SUITE: ACTIVE")
            logger.info("   Real-time sentiment analysis: ENABLED")
            logger.info("   Risk detection: ENABLED")
            logger.info("   Human takeover: ENABLED")
            logger.info("=" * 60)
            return _guardian_plugin
        else:
            logger.warning("🔐 Guardian detected but license invalid")
            _guardian_plugin = None
            return None

    except Exception as e:
        logger.error(f"Guardian initialization failed: {e}")
        return None


def get_guardian() -> BaseGuardian | None:
    """Get the current Guardian instance."""
    return _guardian_plugin


async def load_guardian_config_from_db(agent_config_id: str) -> None:
    """
    Load Guardian configuration from the database and update the Guardian instance.

    This fetches custom keywords and thresholds from the GuardianConfig table
    and applies them to the running Guardian instance.

    Args:
        agent_config_id: The UUID of the agent config to load settings for
    """
    guardian = get_guardian()
    if guardian is None:
        return

    try:
        import asyncpg

        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            logger.warning("[Guardian] No DATABASE_URL configured, using default keywords")
            return

        conn = await asyncpg.connect(database_url)
        try:
            # Query the guardian_configs table
            row = await conn.fetchrow(
                """
                SELECT critical_keywords, high_risk_keywords, medium_risk_keywords,
                       auto_handoff_threshold, enabled
                FROM guardian_configs
                WHERE agent_config_id = $1
                """,
                agent_config_id
            )

            if row and row["enabled"]:
                # Update Guardian with DB keywords
                guardian.update_keywords(
                    critical=row["critical_keywords"] if row["critical_keywords"] else None,
                    high=row["high_risk_keywords"] if row["high_risk_keywords"] else None,
                    medium=row["medium_risk_keywords"] if row["medium_risk_keywords"] else None,
                )

                # Update threshold
                if row["auto_handoff_threshold"]:
                    guardian.update_threshold(row["auto_handoff_threshold"])

                logger.info(f"[Guardian] Loaded custom config for agent {agent_config_id[:8]}...")
            else:
                logger.debug(f"[Guardian] No custom config found for agent, using defaults")

        finally:
            await conn.close()

    except ImportError:
        logger.warning("[Guardian] asyncpg not installed, cannot load DB config")
    except Exception as e:
        logger.error(f"[Guardian] Failed to load config from DB: {e}")
        # CRITICAL: Alert admin that Guardian is using stale keywords
        try:
            # Push alert to Redis for dashboard notification
            redis_client = redis.asyncio.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
            await redis_client.publish("guardian:alerts", json.dumps({
                "type": "config_load_failed",
                "agent_config_id": agent_config_id,
                "error": str(e),
                "timestamp": time.time()
            }))
            await redis_client.close()
        except Exception as alert_error:
            logger.error(f"[Guardian] Failed to push config error alert: {alert_error}")
        
        # Also log to stderr for monitoring systems
        print(f"🚨 GUARDIAN CONFIG LOAD FAILED: {e}", file=sys.stderr)


# =============================================================================
# VoxEvolve Adaptive Memory (Proprietary Plugin - Optional)
# =============================================================================

async def fetch_approved_lessons(agent_id: str) -> list[str]:
    """
    Fetch approved lessons from VoxEvolve for an agent.

    These lessons are behavioral improvements learned from past negative
    sentiment events. Only APPROVED lessons are included in the prompt.

    Args:
        agent_id: The agent configuration ID

    Returns:
        List of improved instruction strings
    """
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT improved_instruction
                FROM agent_lessons
                WHERE agent_config_id = $1 AND status = 'APPROVED'
                ORDER BY created_at DESC
                LIMIT 10
                """,
                agent_id
            )

            if rows:
                lessons = [row["improved_instruction"] for row in rows]
                logger.info(f"[VoxEvolve] Loaded {len(lessons)} approved lesson(s) for agent {agent_id[:8]}...")
                return lessons

            return []

    except Exception as e:
        logger.debug(f"[VoxEvolve] Could not fetch lessons: {e}")
        return []


def build_adaptive_memory_suffix(lessons: list[str]) -> str:
    """
    Build the adaptive memory section for the system prompt.

    Args:
        lessons: List of approved lesson instructions

    Returns:
        Formatted adaptive memory string to append to system prompt
    """
    if not lessons:
        return ""

    lesson_lines = "\n".join(f"- {lesson}" for lesson in lessons)

    return f"""

# ADAPTIVE MEMORY
Based on past interactions, adhere to these behavioral guidelines:
{lesson_lines}
"""


# =============================================================================
# Plugin Registries
# =============================================================================

llm_registry: PluginRegistry[BaseLLM] = PluginRegistry()
stt_registry: PluginRegistry[BaseSTT] = PluginRegistry()
tts_registry: PluginRegistry[BaseTTS] = PluginRegistry()


def register_plugin(provider_type: str, name: str):
    """
    Decorator to register a plugin with the appropriate registry.

    Usage:
        @register_plugin("llm", "openai")
        class OpenAIPlugin(BaseLLM):
            ...
    """
    def decorator(cls):
        if provider_type == "llm":
            llm_registry.register(name, cls)
        elif provider_type == "stt":
            stt_registry.register(name, cls)
        elif provider_type == "tts":
            tts_registry.register(name, cls)
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")
        logger.info(f"Registered {provider_type} plugin: {name}")
        return cls
    return decorator


# =============================================================================
# Default Plugin Implementations
# =============================================================================

@register_plugin("llm", "openai")
class OpenAILLM(BaseLLM):
    """OpenAI LLM implementation using the official SDK."""

    @property
    def provider_name(self) -> str:
        return "openai"

    async def _get_client(self):
        """Lazy-load the OpenAI client."""
        if not hasattr(self, "_client"):
            try:
                from openai import AsyncOpenAI
            except ImportError:
                raise ImportError(
                    "OpenAI SDK not installed. Run: pip install openai"
                )
            self._client = AsyncOpenAI(
                api_key=self.config.api_key or os.getenv("OPENAI_API_KEY"),
                base_url=self.config.base_url,
            )
        return self._client

    async def generate(
        self,
        messages: list[Message],
        **kwargs: Any,
    ):
        client = await self._get_client()
        stream = await client.chat.completions.create(
            model=self.config.model,
            messages=[m.to_dict() for m in messages],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
            **kwargs,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def generate_with_tools(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
        **kwargs: Any,
    ):
        client = await self._get_client()
        stream = await client.chat.completions.create(
            model=self.config.model,
            messages=[m.to_dict() for m in messages],
            tools=tools,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
            **kwargs,
        )

        tool_calls: dict[int, dict] = {}

        async for chunk in stream:
            delta = chunk.choices[0].delta

            # Handle text content
            if delta.content:
                yield delta.content

            # Handle tool calls
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.index not in tool_calls:
                        tool_calls[tc.index] = {
                            "id": tc.id or "",
                            "name": "",
                            "arguments": "",
                        }
                    if tc.id:
                        tool_calls[tc.index]["id"] = tc.id
                    if tc.function and tc.function.name:
                        tool_calls[tc.index]["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        tool_calls[tc.index]["arguments"] += tc.function.arguments

        # Yield completed tool calls
        import json
        for tc_data in tool_calls.values():
            yield ToolCall(
                id=tc_data["id"],
                name=tc_data["name"],
                arguments=json.loads(tc_data["arguments"]),
            )


@register_plugin("llm", "anthropic")
class AnthropicLLM(BaseLLM):
    """Anthropic Claude LLM implementation."""

    @property
    def provider_name(self) -> str:
        return "anthropic"

    async def _get_client(self):
        if not hasattr(self, "_client"):
            try:
                from anthropic import AsyncAnthropic
            except ImportError:
                raise ImportError(
                    "Anthropic SDK not installed. Run: pip install anthropic"
                )
            self._client = AsyncAnthropic(
                api_key=self.config.api_key or os.getenv("ANTHROPIC_API_KEY"),
            )
        return self._client

    async def generate(
        self,
        messages: list[Message],
        **kwargs: Any,
    ):
        client = await self._get_client()

        # Extract system message
        system_msg = None
        chat_messages = []
        for m in messages:
            if m.role == MessageRole.SYSTEM:
                system_msg = m.content
            else:
                chat_messages.append({
                    "role": "user" if m.role == MessageRole.USER else "assistant",
                    "content": m.content,
                })

        async with client.messages.stream(
            model=self.config.model,
            messages=chat_messages,
            system=system_msg or self.config.system_prompt or "",
            max_tokens=self.config.max_tokens,
            **kwargs,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def generate_with_tools(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
        **kwargs: Any,
    ):
        # Convert OpenAI tool format to Anthropic format
        anthropic_tools = []
        for tool in tools:
            if "function" in tool:
                anthropic_tools.append({
                    "name": tool["function"]["name"],
                    "description": tool["function"].get("description", ""),
                    "input_schema": tool["function"].get("parameters", {}),
                })

        client = await self._get_client()

        system_msg = None
        chat_messages = []
        for m in messages:
            if m.role == MessageRole.SYSTEM:
                system_msg = m.content
            else:
                chat_messages.append({
                    "role": "user" if m.role == MessageRole.USER else "assistant",
                    "content": m.content,
                })

        response = await client.messages.create(
            model=self.config.model,
            messages=chat_messages,
            system=system_msg or self.config.system_prompt or "",
            max_tokens=self.config.max_tokens,
            tools=anthropic_tools if anthropic_tools else None,
            **kwargs,
        )

        for block in response.content:
            if block.type == "text":
                yield block.text
            elif block.type == "tool_use":
                yield ToolCall(
                    id=block.id,
                    name=block.name,
                    arguments=block.input,
                )


@register_plugin("llm", "ollama")
class OllamaLLM(BaseLLM):
    """Ollama local LLM implementation."""

    @property
    def provider_name(self) -> str:
        return "ollama"

    async def _get_client(self):
        if not hasattr(self, "_client"):
            try:
                import ollama
            except ImportError:
                raise ImportError(
                    "Ollama SDK not installed. Run: pip install ollama"
                )
            self._client = ollama.AsyncClient(
                host=self.config.base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            )
        return self._client

    async def generate(
        self,
        messages: list[Message],
        **kwargs: Any,
    ):
        client = await self._get_client()
        response = await client.chat(
            model=self.config.model or os.getenv("OLLAMA_MODEL", "llama3.2"),
            messages=[m.to_dict() for m in messages],
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            if chunk.get("message", {}).get("content"):
                yield chunk["message"]["content"]

    async def generate_with_tools(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
        **kwargs: Any,
    ):
        # Ollama tool calling support
        client = await self._get_client()
        response = await client.chat(
            model=self.config.model or os.getenv("OLLAMA_MODEL", "llama3.2"),
            messages=[m.to_dict() for m in messages],
            tools=tools,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            if chunk.get("message", {}).get("content"):
                yield chunk["message"]["content"]
            if chunk.get("message", {}).get("tool_calls"):
                for tc in chunk["message"]["tool_calls"]:
                    yield ToolCall(
                        id=tc.get("id", ""),
                        name=tc["function"]["name"],
                        arguments=tc["function"]["arguments"],
                    )


@register_plugin("stt", "deepgram")
class DeepgramSTT(BaseSTT):
    """Deepgram Speech-to-Text implementation."""

    @property
    def provider_name(self) -> str:
        return "deepgram"

    async def transcribe(
        self,
        audio: bytes,
        **kwargs: Any,
    ) -> TranscriptionResult:
        try:
            from deepgram import DeepgramClient, PrerecordedOptions
        except ImportError:
            raise ImportError(
                "Deepgram SDK not installed. Run: pip install deepgram-sdk"
            )

        client = DeepgramClient(
            api_key=self.config.api_key or os.getenv("DEEPGRAM_API_KEY")
        )

        options = PrerecordedOptions(
            model=self.config.model,
            language=self.config.language,
            smart_format=True,
        )

        response = await client.listen.asyncrest.v("1").transcribe_file(
            {"buffer": audio, "mimetype": "audio/raw"},
            options,
        )

        result = response.results.channels[0].alternatives[0]
        return TranscriptionResult(
            text=result.transcript,
            confidence=result.confidence,
            is_final=True,
            words=[
                {"word": w.word, "start": w.start, "end": w.end}
                for w in result.words
            ] if result.words else [],
        )

    async def stream_transcribe(
        self,
        audio_stream,
        **kwargs: Any,
    ):
        try:
            from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions
        except ImportError:
            raise ImportError(
                "Deepgram SDK not installed. Run: pip install deepgram-sdk"
            )

        client = DeepgramClient(
            api_key=self.config.api_key or os.getenv("DEEPGRAM_API_KEY")
        )

        options = LiveOptions(
            model=self.config.model,
            language=self.config.language,
            encoding="linear16",
            sample_rate=self.config.sample_rate,
            channels=1,
            interim_results=self.config.interim_results,
            smart_format=True,
        )

        connection = await client.listen.asynclive.v("1").create_websocket(options)
        result_queue: asyncio.Queue[TranscriptionResult] = asyncio.Queue()

        async def on_message(_, result, **kw):
            if result.channel and result.channel.alternatives:
                alt = result.channel.alternatives[0]
                await result_queue.put(TranscriptionResult(
                    text=alt.transcript,
                    confidence=alt.confidence,
                    is_final=result.is_final,
                ))

        connection.on(LiveTranscriptionEvents.Transcript, on_message)
        await connection.start()

        async def send_audio():
            async for frame in audio_stream:
                await connection.send(frame.data)
            await connection.finish()

        send_task = asyncio.create_task(send_audio())

        try:
            while not send_task.done() or not result_queue.empty():
                try:
                    result = await asyncio.wait_for(result_queue.get(), timeout=0.1)
                    yield result
                except asyncio.TimeoutError:
                    continue
        finally:
            send_task.cancel()
            await connection.finish()


@register_plugin("stt", "whisper")
class WhisperSTT(BaseSTT):
    """OpenAI Whisper Speech-to-Text implementation."""

    @property
    def provider_name(self) -> str:
        return "whisper"

    async def transcribe(
        self,
        audio: bytes,
        **kwargs: Any,
    ) -> TranscriptionResult:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError(
                "OpenAI SDK not installed. Run: pip install openai"
            )

        import io

        client = AsyncOpenAI(
            api_key=self.config.api_key or os.getenv("OPENAI_API_KEY")
        )

        # Wrap bytes in a file-like object
        audio_file = io.BytesIO(audio)
        audio_file.name = "audio.wav"

        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=self.config.language,
        )

        return TranscriptionResult(
            text=response.text,
            confidence=1.0,
            is_final=True,
        )

    async def stream_transcribe(
        self,
        audio_stream,
        **kwargs: Any,
    ):
        # Whisper doesn't support streaming, so we buffer and transcribe
        buffer = bytearray()
        buffer_duration_ms = 0
        chunk_threshold_ms = 3000  # Transcribe every 3 seconds

        async for frame in audio_stream:
            buffer.extend(frame.data)
            buffer_duration_ms += len(frame.data) / (self.config.sample_rate * 2) * 1000

            if buffer_duration_ms >= chunk_threshold_ms:
                result = await self.transcribe(bytes(buffer))
                yield result
                buffer.clear()
                buffer_duration_ms = 0

        # Transcribe remaining audio
        if buffer:
            result = await self.transcribe(bytes(buffer))
            yield result


@register_plugin("tts", "cartesia")
class CartesiaTTS(BaseTTS):
    """Cartesia Text-to-Speech implementation."""

    @property
    def provider_name(self) -> str:
        return "cartesia"

    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        try:
            from cartesia import AsyncCartesia
        except ImportError:
            raise ImportError(
                "Cartesia SDK not installed. Run: pip install cartesia"
            )

        client = AsyncCartesia(
            api_key=self.config.api_key or os.getenv("CARTESIA_API_KEY")
        )

        output = await client.tts.sse(
            model_id=self.config.model,
            transcript=text,
            voice_id=self.config.voice_id or os.getenv("CARTESIA_VOICE_ID", "default"),
            output_format={
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.config.sample_rate,
            },
        )

        audio_chunks = []
        async for chunk in output:
            if hasattr(chunk, "audio"):
                audio_chunks.append(chunk.audio)

        audio_data = b"".join(audio_chunks)
        return SynthesisResult(
            audio=audio_data,
            sample_rate=self.config.sample_rate,
            duration_ms=len(audio_data) / (self.config.sample_rate * 2) * 1000,
            format="pcm",
        )

    async def stream_synthesize(
        self,
        text_stream,
        **kwargs: Any,
    ):
        try:
            from cartesia import AsyncCartesia
        except ImportError:
            raise ImportError(
                "Cartesia SDK not installed. Run: pip install cartesia"
            )

        client = AsyncCartesia(
            api_key=self.config.api_key or os.getenv("CARTESIA_API_KEY")
        )

        async for text_chunk in text_stream:
            output = await client.tts.sse(
                model_id=self.config.model,
                transcript=text_chunk,
                voice_id=self.config.voice_id or os.getenv("CARTESIA_VOICE_ID", "default"),
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": self.config.sample_rate,
                },
            )

            async for chunk in output:
                if hasattr(chunk, "audio"):
                    yield AudioFrame(
                        data=chunk.audio,
                        sample_rate=self.config.sample_rate,
                    )


@register_plugin("tts", "elevenlabs")
class ElevenLabsTTS(BaseTTS):
    """ElevenLabs Text-to-Speech implementation."""

    @property
    def provider_name(self) -> str:
        return "elevenlabs"

    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        try:
            from elevenlabs import AsyncElevenLabs
        except ImportError:
            raise ImportError(
                "ElevenLabs SDK not installed. Run: pip install elevenlabs"
            )

        client = AsyncElevenLabs(
            api_key=self.config.api_key or os.getenv("ELEVENLABS_API_KEY")
        )

        audio = await client.generate(
            text=text,
            voice=self.config.voice_id or os.getenv("ELEVENLABS_VOICE_ID", "Rachel"),
            model=self.config.model or "eleven_turbo_v2_5",
        )

        audio_data = b"".join([chunk async for chunk in audio])

        return SynthesisResult(
            audio=audio_data,
            sample_rate=self.config.sample_rate,
            format="mp3",
        )

    async def stream_synthesize(
        self,
        text_stream,
        **kwargs: Any,
    ):
        try:
            from elevenlabs import AsyncElevenLabs
        except ImportError:
            raise ImportError(
                "ElevenLabs SDK not installed. Run: pip install elevenlabs"
            )

        client = AsyncElevenLabs(
            api_key=self.config.api_key or os.getenv("ELEVENLABS_API_KEY")
        )

        async for text_chunk in text_stream:
            audio = await client.generate(
                text=text_chunk,
                voice=self.config.voice_id or os.getenv("ELEVENLABS_VOICE_ID", "Rachel"),
                model=self.config.model or "eleven_turbo_v2_5",
                stream=True,
            )

            async for chunk in audio:
                yield AudioFrame(data=chunk, sample_rate=self.config.sample_rate)


@register_plugin("tts", "openai")
class OpenAITTS(BaseTTS):
    """OpenAI Text-to-Speech implementation."""

    @property
    def provider_name(self) -> str:
        return "openai"

    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError(
                "OpenAI SDK not installed. Run: pip install openai"
            )

        client = AsyncOpenAI(
            api_key=self.config.api_key or os.getenv("OPENAI_API_KEY")
        )

        response = await client.audio.speech.create(
            model=self.config.model or "tts-1",
            voice=self.config.voice_id or os.getenv("OPENAI_TTS_VOICE", "alloy"),
            input=text,
            response_format="pcm",
            speed=self.config.speed,
        )

        audio_data = response.content

        return SynthesisResult(
            audio=audio_data,
            sample_rate=24000,  # OpenAI TTS outputs 24kHz
            format="pcm",
        )

    async def stream_synthesize(
        self,
        text_stream,
        **kwargs: Any,
    ):
        async for text_chunk in text_stream:
            result = await self.synthesize(text_chunk)
            yield AudioFrame(
                data=result.audio,
                sample_rate=result.sample_rate,
            )


@register_plugin("tts", "kokoro")
class KokoroLocalTTS(BaseTTS):
    """Kokoro Local TTS implementation via HTTP microservice."""

    @property
    def provider_name(self) -> str:
        return "kokoro"

    def _get_base_url(self) -> str:
        return self.config.base_url or os.getenv("TTS_URL", "http://localhost:8880")

    def _get_voice_id(self) -> str:
        return self.config.voice_id or os.getenv("KOKORO_VOICE", "af_bella")

    async def _get_client(self):
        if not hasattr(self, "_client"):
            try:
                import httpx
            except ImportError:
                raise ImportError("httpx not installed. Run: pip install httpx")
            self._client = httpx.AsyncClient(
                base_url=self._get_base_url(),
                timeout=30.0,
            )
        return self._client

    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        client = await self._get_client()

        response = await client.post(
            "/v1/audio/speech",
            json={
                "input": text,
                "voice": self._get_voice_id(),
                "speed": self.config.speed,
                "response_format": "pcm",
            },
        )
        response.raise_for_status()

        audio_data = response.content
        sample_rate = 24000  # Kokoro outputs 24kHz

        return SynthesisResult(
            audio=audio_data,
            sample_rate=sample_rate,
            duration_ms=len(audio_data) / (sample_rate * 2) * 1000,
            format="pcm",
        )

    async def stream_synthesize(
        self,
        text_stream,
        **kwargs: Any,
    ):
        client = await self._get_client()
        buffer = ""
        sentence_endings = ".!?\n"

        async for chunk in text_stream:
            buffer += chunk

            # Check for sentence endings to synthesize
            for i, char in enumerate(buffer):
                if char in sentence_endings:
                    sentence = buffer[: i + 1].strip()
                    buffer = buffer[i + 1 :]

                    if sentence:
                        try:
                            response = await client.post(
                                "/v1/audio/speech",
                                json={
                                    "input": sentence,
                                    "voice": self._get_voice_id(),
                                    "speed": self.config.speed,
                                    "response_format": "pcm",
                                },
                            )
                            response.raise_for_status()
                            yield AudioFrame(
                                data=response.content,
                                sample_rate=24000,
                            )
                        except Exception as e:
                            logger.error(f"Kokoro TTS chunk failed: {e}")
                    break

        # Synthesize remaining buffer
        if buffer.strip():
            try:
                response = await client.post(
                    "/v1/audio/speech",
                    json={
                        "input": buffer.strip(),
                        "voice": self._get_voice_id(),
                        "speed": self.config.speed,
                        "response_format": "pcm",
                    },
                )
                response.raise_for_status()
                yield AudioFrame(
                    data=response.content,
                    sample_rate=24000,
                )
            except Exception as e:
                logger.error(f"Kokoro TTS final chunk failed: {e}")


@register_plugin("tts", "voxclone")
class VoxCloneTTS(BaseTTS):
    """
    VoxNexus Voice Cloning TTS implementation.
    
    This plugin calls the external voice cloning microservice to perform
    zero-shot voice cloning using reference audio.
    """
    
    def __init__(self, config: TTSConfig):
        """
        Initialize VoxClone TTS plugin.
        
        Args:
            config: TTS configuration including voice_id as reference audio
        """
        super().__init__(config)
        
        # API endpoint for cloning microservice
        self.api_url = os.getenv("VOXCLONE_API_URL", "http://localhost:8000")
        self.license_key = os.getenv("VOXNEXUS_LICENSE_KEY", "")
        
        # Reference audio for cloning (voice_id contains path or base64)
        self.reference_audio = self._load_reference_audio()
        
        # HTTP client for API calls
        self._client: Optional[httpx.AsyncClient] = None
        
        logger.info(
            f"VoxCloneTTS initialized: api_url={self.api_url}, "
            f"voice_id={config.voice_id[:50]}..., "
            f"license_configured={'yes' if self.license_key else 'no'}"
        )
    
    @property
    def provider_name(self) -> str:
        """Return provider name."""
        return "voxclone"
    
    def _load_reference_audio(self) -> bytes:
        """
        Load reference audio for voice cloning.

        The voice_id can be:
        - VoiceProfile database ID (looked up to get file path)
        - Path to audio file (will be loaded)
        - Base64-encoded audio (starts with data:audio/)
        - File path relative to a configured directory
        """
        try:
            if not self.config.voice_id:
                raise ValueError("voice_id is required for VoxClone - must be reference audio")

            # Check if voice_id is base64-encoded audio
            if self.config.voice_id.startswith("data:audio/"):
                # Extract base64 part (after comma)
                base64_part = self.config.voice_id.split(",")[1]
                return base64.b64decode(base64_part)

            # Check if voice_id is a file path that exists
            elif os.path.exists(self.config.voice_id):
                with open(self.config.voice_id, "rb") as f:
                    return f.read()

            # Check if voice_id looks like a database ID (not a path)
            # Database IDs are alphanumeric without path separators
            elif "/" not in self.config.voice_id and "\\" not in self.config.voice_id:
                # Look up voice profile from database
                audio_path = self._lookup_voice_profile(self.config.voice_id)
                if audio_path and os.path.exists(audio_path):
                    logger.info(f"Loaded voice profile audio from: {audio_path}")
                    with open(audio_path, "rb") as f:
                        return f.read()
                else:
                    raise FileNotFoundError(
                        f"Voice profile {self.config.voice_id} audio not found at {audio_path}"
                    )

            # Try relative path from VOXCLONE_AUDIO_DIR
            else:
                audio_dir = os.getenv("VOXCLONE_AUDIO_DIR", "/app/audio/cloning")
                audio_path = os.path.join(audio_dir, self.config.voice_id)

                if os.path.exists(audio_path):
                    with open(audio_path, "rb") as f:
                        return f.read()
                else:
                    raise FileNotFoundError(
                        f"Reference audio not found at {self.config.voice_id} "
                        f"or {audio_path}"
                    )

        except Exception as e:
            logger.error(f"Failed to load reference audio: {e}")
            # Return empty bytes - will fail on first synthesis attempt
            return b""

    def _lookup_voice_profile(self, profile_id: str) -> Optional[str]:
        """
        Look up voice profile from database to get audio file path.

        Args:
            profile_id: VoiceProfile database ID

        Returns:
            Full path to the audio file, or None if not found
        """
        import psycopg2

        try:
            database_url = get_clean_database_url()
            if not database_url:
                logger.error("DATABASE_URL not configured for voice profile lookup")
                return None

            # Connect to database
            conn = psycopg2.connect(database_url)
            cursor = conn.cursor()

            # Query voice profile
            cursor.execute(
                "SELECT reference_audio_url FROM voice_profiles WHERE id = %s",
                (profile_id,)
            )

            row = cursor.fetchone()
            cursor.close()
            conn.close()

            if not row:
                logger.warning(f"Voice profile not found: {profile_id}")
                return None

            reference_audio_url = row[0]  # e.g., "/uploads/voices/voice_xxx.wav"

            # Construct full path from web app's public directory
            web_public_dir = os.getenv(
                "VOXNEXUS_WEB_PUBLIC_DIR",
                "/var/www/voxnexus/apps/web/public"
            )

            full_path = os.path.join(web_public_dir, reference_audio_url.lstrip("/"))
            logger.debug(f"Voice profile {profile_id} -> {full_path}")

            return full_path

        except Exception as e:
            logger.error(f"Failed to lookup voice profile {profile_id}: {e}")
            return None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                timeout=30.0,
                limits=httpx.Limits(
                    max_connections=10,
                    max_keepalive_connections=5,
                    keepalive_expiry=30.0
                )
            )
        return self._client
    
    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        """
        Synthesize speech using voice cloning.
        
        Args:
            text: Text to synthesize
            **kwargs: Additional arguments (e.g., reference_audio_override)
            
        Returns:
            SynthesisResult with cloned audio
        """
        if not self.reference_audio:
            raise RuntimeError("No reference audio loaded - cannot clone voice")
        
        try:
            logger.debug(f"Synthesizing with VoxClone: {text[:50]}...")
            
            # Use override reference audio if provided (for per-request cloning)
            reference_audio = kwargs.get("reference_audio", self.reference_audio)
            
            if not reference_audio:
                raise ValueError("Reference audio required for voice cloning")
            
            # Prepare request
            request_data = {
                "text": text,
                "reference_audio_base64": base64.b64encode(reference_audio).decode('utf-8'),
                "speed": kwargs.get("speed", self.config.speed),
                "sample_rate": self.config.sample_rate,
            }
            
            # Get HTTP client
            client = await self._get_client()
            
            # Call cloning API
            response = await client.post(
                "/v1/clone",
                json=request_data,
                headers={
                    "X-VoxNexus-License": self.license_key,
                    "User-Agent": "VoxNexus-Worker/1.0",
                }
            )
            
            # Handle errors
            if response.status_code == 403:
                error_detail = response.json().get("detail", {})
                raise RuntimeError(
                    f"License verification failed: {error_detail.get('error', 'Unknown')}. "
                    f"{error_detail.get('help', 'Check VOXNEXUS_LICENSE_KEY')}"
                )
            elif response.status_code != 200:
                raise RuntimeError(
                    f"Voice cloning failed: HTTP {response.status_code} - "
                    f"{response.text}"
                )
            
            # Parse response
            result = response.json()
            
            # Decode audio
            audio_data = base64.b64decode(result["audio_base64"])
            
            logger.info(
                f"✓ Voice cloning completed: "
                f"text_length={len(text)}, "
                f"latency={result['latency_ms']:.2f}ms, "
                f"audio_duration={result['duration_ms']:.2f}ms"
            )
            
            return SynthesisResult(
                audio=audio_data,
                sample_rate=result.get("sample_rate", self.config.sample_rate),
                duration_ms=result["duration_ms"],
                format="pcm",  # WAV PCM format
            )
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error in VoxClone API call: {e}")
            raise RuntimeError(f"Voice cloning service unavailable: {e}")
        except Exception as e:
            logger.error(f"Failed to synthesize with VoxClone: {e}", exc_info=True)
            raise
    
    async def stream_synthesize(
        self,
        text_stream: AsyncIterator[str],
        **kwargs: Any,
    ) -> AsyncIterator[AudioFrame]:
        """
        Stream synthesis for real-time voice cloning.
        
        Since OpenVoice is fast but not true streaming, we accumulate text
        into sentences and yield audio chunks as they're generated.
        
        Args:
            text_stream: Async iterator of text chunks
            **kwargs: Additional arguments
            
        Yields:
            AudioFrame objects as audio is generated
        """
        if not self.reference_audio:
            raise RuntimeError("No reference audio loaded - cannot clone voice")
        
        sentence_buffer = ""
        sentence_endings = ".!?\n"
        
        try:
            async for text_chunk in text_stream:
                sentence_buffer += text_chunk
                
                # Check for complete sentences
                for i, char in enumerate(sentence_buffer):
                    if char in sentence_endings:
                        sentence = sentence_buffer[:i + 1].strip()
                        sentence_buffer = sentence_buffer[i + 1:]
                        
                        if sentence:
                            # Synthesize this sentence
                            logger.debug(f"Synthesizing sentence: {sentence}")
                            result = await self.synthesize(sentence, **kwargs)
                            
                            # Yield as audio frame
                            yield AudioFrame(
                                data=result.audio,
                                sample_rate=result.sample_rate,
                                channels=1,
                                timestamp_ms=0.0  # Could calculate actual timestamp
                            )
            
            # Handle remaining buffer
            if sentence_buffer.strip():
                result = await self.synthesize(sentence_buffer.strip(), **kwargs)
                yield AudioFrame(
                    data=result.audio,
                    sample_rate=result.sample_rate,
                    channels=1,
                    timestamp_ms=0.0
                )
        
        except Exception as e:
            logger.error(f"Stream synthesis failed: {e}", exc_info=True)
            raise
    
    async def health_check(self) -> bool:
        """Check if the cloning service is healthy and accessible."""
        try:
            if not self.reference_audio:
                logger.warning("Health check: No reference audio configured")
                return False
            
            if not self.license_key:
                logger.warning("Health check: No license key configured")
                return False
            
            client = await self._get_client()
            response = await client.get("/health", timeout=5.0)
            
            if response.status_code != 200:
                logger.warning(f"Health check failed: HTTP {response.status_code}")
                return False
            
            health = response.json()
            if not health.get("models_loaded", False):
                logger.warning("Health check: Voice models not loaded")
                return False
            
            logger.debug("Health check passed")
            return True
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    async def close(self) -> None:
        """Clean up resources."""
        if self._client:
            await self._client.aclose()
            self._client = None
        logger.debug("VoxCloneTTS resources cleaned up")


# =============================================================================
# Agent Factory
# =============================================================================

class AgentFactory:
    """
    Factory for creating voice agents from configuration.

    The factory reads configuration from the database or environment
    and assembles the appropriate plugins into a working agent.

    Usage:
        ```python
        factory = AgentFactory()

        # Create from database config
        agent = await factory.create_from_db(agent_id="abc123")

        # Create from config object
        config = AgentConfig(...)
        agent = await factory.create(config)
        ```
    """

    def __init__(
        self,
        llm_registry: PluginRegistry[BaseLLM] = llm_registry,
        stt_registry: PluginRegistry[BaseSTT] = stt_registry,
        tts_registry: PluginRegistry[BaseTTS] = tts_registry,
    ):
        self.llm_registry = llm_registry
        self.stt_registry = stt_registry
        self.tts_registry = tts_registry
        self._db_pool = None

    async def _get_db_pool(self):
        """Get or create database connection pool."""
        if self._db_pool is None:
            try:
                import asyncpg
            except ImportError:
                raise ImportError(
                    "asyncpg not installed. Run: pip install asyncpg"
                )
            self._db_pool = await asyncpg.create_pool(
                os.getenv("DATABASE_URL")
            )
        return self._db_pool

    async def create(self, config: AgentConfig) -> "VoiceAgent":
        """
        Create a voice agent from a configuration object.

        Args:
            config: Complete agent configuration

        Returns:
            Configured VoiceAgent instance
        """
        logger.info(f"Creating agent '{config.name}' (id={config.id})")

        # Create provider instances
        llm = self.llm_registry.create(config.llm.provider, config.llm)
        stt = self.stt_registry.create(config.stt.provider, config.stt)
        tts = self.tts_registry.create(config.tts.provider, config.tts)

        logger.info(
            f"Providers: LLM={config.llm.provider}, "
            f"STT={config.stt.provider}, TTS={config.tts.provider}"
        )

        return VoiceAgent(config, llm, stt, tts)

    async def create_from_db(self, agent_id: str) -> "VoiceAgent":
        """
        Create a voice agent by loading configuration from the database.

        Args:
            agent_id: The agent's unique identifier

        Returns:
            Configured VoiceAgent instance

        Raises:
            ValueError: If agent is not found
        """
        pool = await self._get_db_pool()

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, tenant_id, name, llm_config, stt_config,
                       tts_config, webhooks, metadata, created_at, updated_at
                FROM agent_configs
                WHERE id = $1
                """,
                agent_id,
            )

        if not row:
            raise ValueError(f"Agent not found: {agent_id}")

        import json
        config = AgentConfig.from_dict({
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]),
            "name": row["name"],
            "llm_config": json.loads(row["llm_config"]) if row["llm_config"] else {},
            "stt_config": json.loads(row["stt_config"]) if row["stt_config"] else {},
            "tts_config": json.loads(row["tts_config"]) if row["tts_config"] else {},
            "webhooks": json.loads(row["webhooks"]) if row["webhooks"] else {},
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
        })

        return await self.create(config)

    async def create_from_env(self) -> "VoiceAgent":
        """
        Create a voice agent using environment variable configuration.

        This is useful for quick testing and single-agent deployments.

        Returns:
            Configured VoiceAgent instance
        """
        config = AgentConfig(
            name=os.getenv("AGENT_NAME", "VoxNexus Agent"),
            llm=LLMConfig(
                provider=os.getenv("LLM_PROVIDER", "openai"),
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
                max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1024")),
            ),
            stt=STTConfig(
                provider=os.getenv("STT_PROVIDER", "deepgram"),
                model=os.getenv("DEEPGRAM_MODEL", "nova-2"),
                language=os.getenv("STT_LANGUAGE", "en"),
            ),
            tts=TTSConfig(
                provider=os.getenv("TTS_PROVIDER", "cartesia"),
                model=os.getenv("TTS_MODEL", "sonic-english"),
                voice_id=os.getenv("TTS_VOICE_ID", "default"),
            ),
        )

        return await self.create(config)

    def list_available_providers(self) -> dict[str, list[str]]:
        """List all registered providers by type."""
        return {
            "llm": self.llm_registry.list_providers(),
            "stt": self.stt_registry.list_providers(),
            "tts": self.tts_registry.list_providers(),
        }


# =============================================================================
# Default Voice Agent Implementation
# =============================================================================

class VoiceAgent(BaseVoiceAgent):
    """
    Default implementation of a VoxNexus voice agent.

    This implementation provides a complete voice conversation pipeline:
    1. Receive audio from the user
    2. Transcribe using STT
    3. Generate response using LLM
    4. Synthesize audio using TTS
    5. Stream audio back to the user
    """

    async def process_audio(
        self,
        audio_stream,
    ):
        """Process incoming audio and generate voice responses."""
        self._state = AgentState.LISTENING

        # Transcribe the audio
        transcription_text = ""
        async for result in self.stt.stream_transcribe(audio_stream):
            if result.is_final:
                transcription_text = result.text
                break

        if not transcription_text.strip():
            return

        logger.info(f"User said: {transcription_text}")

        # Add user message to history
        self._conversation_history.append(
            Message(role=MessageRole.USER, content=transcription_text)
        )

        # Generate LLM response
        self._state = AgentState.THINKING

        # Prepare messages with system prompt
        messages = []
        if self.config.llm.system_prompt:
            messages.append(
                Message(role=MessageRole.SYSTEM, content=self.config.llm.system_prompt)
            )
        messages.extend(self._conversation_history)

        # Stream LLM response to TTS
        self._state = AgentState.SPEAKING
        response_text = ""

        async def text_generator():
            nonlocal response_text
            async for chunk in self.llm.generate(messages):
                response_text += chunk
                yield chunk

        async for audio_frame in self.tts.stream_synthesize(text_generator()):
            yield audio_frame

        # Save assistant response to history
        self._conversation_history.append(
            Message(role=MessageRole.ASSISTANT, content=response_text)
        )

        logger.info(f"Agent said: {response_text}")
        self._state = AgentState.IDLE

    async def process_text(
        self,
        text: str,
    ):
        """Process text input and generate text responses."""
        self._conversation_history.append(
            Message(role=MessageRole.USER, content=text)
        )

        messages = []
        if self.config.llm.system_prompt:
            messages.append(
                Message(role=MessageRole.SYSTEM, content=self.config.llm.system_prompt)
            )
        messages.extend(self._conversation_history)

        response_text = ""
        async for chunk in self.llm.generate(messages):
            response_text += chunk
            yield chunk

        self._conversation_history.append(
            Message(role=MessageRole.ASSISTANT, content=response_text)
        )


# =============================================================================
# Knowledge Base RAG Functions
# =============================================================================

async def generate_query_embedding(query: str) -> list[float]:
    """Generate embedding for a search query using OpenAI."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError("OpenAI SDK not installed. Run: pip install openai")

    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
        dimensions=1536,
    )
    return response.data[0].embedding


async def query_knowledge_base(
    agent_id: str,
    query: str,
    top_k: int = 5,
    similarity_threshold: float = 0.7,
) -> list[dict]:
    """
    Query the knowledge base using vector similarity search.

    Args:
        agent_id: The agent's ID to scope the search
        query: The user's question or search query
        top_k: Maximum number of results to return
        similarity_threshold: Minimum cosine similarity (0-1)

    Returns:
        List of relevant document chunks with their similarity scores
    """
    try:
        import asyncpg
    except ImportError:
        raise ImportError("asyncpg not installed. Run: pip install asyncpg")

    # Generate embedding for the query
    query_embedding = await generate_query_embedding(query)

    # Connect to database (use clean URL without Prisma schema parameter)
    conn = await asyncpg.connect(get_clean_database_url())

    try:
        # Perform vector similarity search using pgvector
        # Uses cosine distance: 1 - cosine_similarity, so we want lower values
        results = await conn.fetch(
            """
            SELECT
                id,
                filename,
                chunk_index,
                content,
                1 - (embedding <=> $1::vector) as similarity
            FROM knowledge_documents
            WHERE agent_config_id = $2
              AND status = 'ready'
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> $1::vector) >= $3
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            str(query_embedding),
            agent_id,
            similarity_threshold,
            top_k,
        )

        return [
            {
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "similarity": float(row["similarity"]),
            }
            for row in results
        ]
    finally:
        await conn.close()


# Tool definition for the LLM to use knowledge base
KNOWLEDGE_BASE_TOOL = {
    "type": "function",
    "function": {
        "name": "search_knowledge_base",
        "description": "Search the knowledge base for relevant information to answer user questions. Use this when the user asks factual questions that might be in the uploaded documents.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant information",
                },
            },
            "required": ["query"],
        },
    },
}


async def execute_knowledge_search(agent_id: str, query: str) -> str:
    """
    Execute a knowledge base search and format results for the LLM.

    Args:
        agent_id: The agent's ID
        query: The search query

    Returns:
        Formatted string with search results or a message if none found
    """
    try:
        results = await query_knowledge_base(agent_id, query)

        if not results:
            return "No relevant information found in the knowledge base."

        formatted = "Here is relevant information from the knowledge base:\n\n"
        for i, result in enumerate(results, 1):
            formatted += f"--- Source: {result['filename']} (relevance: {result['similarity']:.0%}) ---\n"
            formatted += f"{result['content']}\n\n"

        return formatted
    except Exception as e:
        logger.error(f"Knowledge base search failed: {e}")
        return f"Knowledge base search failed: {str(e)}"


# =============================================================================
# Dynamic Webhook Execution Engine
# =============================================================================

async def fetch_agent_webhooks(agent_id: str) -> list[dict]:
    """
    Fetch configured webhooks for an agent from the database.

    Args:
        agent_id: The agent's ID

    Returns:
        List of webhook definitions with name, url, method, description, secret
    """
    try:
        import asyncpg
    except ImportError:
        raise ImportError("asyncpg not installed. Run: pip install asyncpg")

    conn = await asyncpg.connect(get_clean_database_url())

    try:
        results = await conn.fetch(
            """
            SELECT id, name, url, method, headers, secret, timeout_ms, retry_count
            FROM webhook_endpoints
            WHERE agent_config_id = $1 AND is_active = true
            ORDER BY created_at ASC
            """,
            agent_id,
        )

        webhooks = []
        for row in results:
            webhooks.append({
                "id": str(row["id"]),
                "name": row["name"],
                "url": row["url"],
                "method": row["method"] or "POST",
                "headers": row["headers"] if row["headers"] else {},
                "secret": row["secret"],
                "timeout_ms": row["timeout_ms"] or 30000,
                "retry_count": row["retry_count"] or 3,
            })

        logger.info(f"Fetched {len(webhooks)} webhooks for agent {agent_id}")
        return webhooks
    except Exception as e:
        logger.error(f"Failed to fetch webhooks for agent {agent_id}: {e}")
        return []
    finally:
        await conn.close()


async def execute_webhook(
    webhook: dict,
    payload: dict,
) -> str:
    """
    Execute a webhook HTTP request.

    Args:
        webhook: Webhook definition (url, method, headers, secret, timeout_ms)
        payload: The data to send to the webhook

    Returns:
        Response text from the webhook or error message
    """
    import httpx
    import json
    import hashlib
    import hmac

    url = webhook["url"]
    method = webhook["method"].upper()
    timeout_ms = webhook.get("timeout_ms", 30000)
    secret = webhook.get("secret")

    # Prepare headers
    headers = dict(webhook.get("headers", {}))
    headers["Content-Type"] = "application/json"

    # Sign payload if secret is configured
    if secret:
        payload_bytes = json.dumps(payload).encode("utf-8")
        signature = hmac.new(
            secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    logger.info(f"Triggering webhook '{webhook['name']}' to {url} with payload {payload}")

    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=payload)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=payload)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=payload)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, json=payload)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                return f"Unsupported HTTP method: {method}"

            response.raise_for_status()

            logger.info(f"Webhook '{webhook['name']}' succeeded with status {response.status_code}")

            # Try to parse as JSON, otherwise return text
            try:
                result = response.json()
                if isinstance(result, dict):
                    return json.dumps(result, indent=2)
                return str(result)
            except json.JSONDecodeError:
                return response.text or f"Webhook succeeded (status {response.status_code})"

    except httpx.TimeoutException:
        error_msg = f"Webhook '{webhook['name']}' timed out after {timeout_ms}ms"
        logger.error(error_msg)
        return error_msg
    except httpx.HTTPStatusError as e:
        error_msg = f"Webhook '{webhook['name']}' failed with status {e.response.status_code}: {e.response.text}"
        logger.error(error_msg)
        return error_msg
    except Exception as e:
        error_msg = f"Webhook '{webhook['name']}' failed: {str(e)}"
        logger.error(error_msg)
        return error_msg


def create_webhook_tool(webhook: dict):
    """
    Create a LiveKit function_tool from a webhook definition.

    The tool accepts dynamic keyword arguments which are sent as the JSON payload
    to the webhook URL.

    Args:
        webhook: Webhook definition dict

    Returns:
        A function_tool that can be registered with the Agent
    """
    from livekit.agents import function_tool

    # Create a unique function for this webhook to capture the webhook definition
    async def webhook_handler(**kwargs) -> str:
        """Execute the webhook with the provided parameters."""
        return await execute_webhook(webhook, kwargs)

    # Set the function name and docstring dynamically
    webhook_handler.__name__ = webhook["name"].lower().replace(" ", "_").replace("-", "_")
    webhook_handler.__doc__ = f"""Call the '{webhook['name']}' webhook.

This webhook makes a {webhook['method']} request to an external API.
Pass any relevant parameters as keyword arguments (e.g., name, email, date, etc.).
The parameters will be sent as JSON in the request body.

Returns:
    The response from the external API.
"""

    # Create and return the function_tool
    return function_tool(webhook_handler)


# Prompt suffix for agents with webhooks
WEBHOOK_PROMPT_SUFFIX = """

You have access to external API webhooks that can perform actions like:
- Looking up information in external systems
- Creating or updating records
- Checking availability or status
- Processing requests

When the user asks you to do something that requires external data or actions,
use the appropriate webhook tool. Pass relevant information from the conversation
as parameters to the webhook."""


# =============================================================================
# Redis Heartbeat
# =============================================================================

HEARTBEAT_KEY = "voxnexus:worker:heartbeat"
HEARTBEAT_INTERVAL = 10  # seconds

async def run_heartbeat(redis_url: str):
    """Run the Redis heartbeat loop."""
    import redis.asyncio as aioredis
    import time

    try:
        redis_client = aioredis.from_url(redis_url)
        logger.info(f"Starting heartbeat to Redis at {redis_url}")

        while True:
            try:
                timestamp = int(time.time())
                await redis_client.set(HEARTBEAT_KEY, str(timestamp), ex=30)  # Expire after 30s
                logger.debug(f"Heartbeat sent: {timestamp}")
            except Exception as e:
                logger.warning(f"Heartbeat failed: {e}")

            await asyncio.sleep(HEARTBEAT_INTERVAL)
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")


# =============================================================================
# Health Check Server
# =============================================================================

async def run_health_server(port: int = 8081):
    """Run a simple health check HTTP server."""
    from aiohttp import web

    async def health_handler(request):
        guardian = get_guardian()
        guardian_active = guardian is not None and guardian.is_licensed

        response = {
            "status": "healthy",
            "version": "0.1.0",
            "providers": {
                "llm": llm_registry.list_providers(),
                "stt": stt_registry.list_providers(),
                "tts": tts_registry.list_providers(),
            },
            "guardian_active": guardian_active,
        }

        if guardian_active and guardian:
            response["guardian_features"] = {
                "sentiment_analysis": guardian.config.enable_sentiment,
                "risk_detection": guardian.config.enable_risk_detection,
                "takeover": guardian.config.enable_takeover,
            }
            response["guardian_version"] = getattr(guardian, "__version__", "1.0.0")

        return web.json_response(response)

    async def providers_handler(request):
        factory = AgentFactory()
        return web.json_response(factory.list_available_providers())

    app = web.Application()
    app.router.add_get("/health", health_handler)
    app.router.add_get("/providers", providers_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()

    logger.info(f"Health server running on http://0.0.0.0:{port}")
    return runner


# =============================================================================
# LiveKit Worker Integration
# =============================================================================

from livekit.agents import AutoSubscribe, JobContext
from livekit.agents.worker import AgentServer
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, silero
import livekit.rtc

# Default system prompt for the agent
DEFAULT_SYSTEM_PROMPT = os.getenv(
    "AGENT_SYSTEM_PROMPT",
    """You are Nexus, a helpful and witty AI assistant for VoxNexus.
You are brief, professional, and friendly. Keep responses concise (1-3 sentences when possible).
Be helpful and proactive. Use a warm, conversational tone.
If asked about VoxNexus, explain it's an open-source AI voice agent platform."""
)

# Knowledge base augmented prompt
KB_SYSTEM_PROMPT_SUFFIX = """

You have access to a knowledge base with uploaded documents.
When users ask questions that might be answered by the knowledge base, use the search_knowledge_base function to find relevant information.
Always cite the source document when providing information from the knowledge base."""

# Visual Voice prompt suffix
VISUAL_VOICE_PROMPT_SUFFIX = """

You have access to Visual Voice capabilities to show UI components on the user's screen.
Use push_ui to display:
- 'calendar' - When the user needs to select a date or schedule an appointment
- 'form' - When you need to collect structured information (name, email, etc.)
- 'map' - When showing a location or address
- 'confirm' - When you need yes/no confirmation from the user
- 'list' - When presenting multiple options for the user to choose from

After calling push_ui, wait for the user's response before continuing."""


# =============================================================================
# Visual Voice Tool Definition
# =============================================================================

PUSH_UI_TOOL = {
    "type": "function",
    "function": {
        "name": "push_ui",
        "description": "Display a visual UI component on the user's screen. Use this to collect dates, forms, show locations, or present choices.",
        "parameters": {
            "type": "object",
            "properties": {
                "component": {
                    "type": "string",
                    "enum": ["calendar", "form", "map", "confirm", "list"],
                    "description": "The type of component to display",
                },
                "props": {
                    "type": "object",
                    "description": "Properties for the component. For calendar: {title}. For form: {title, description, fields: [{name, label, type, required}]}. For map: {title, address}. For confirm: {title, message}. For list: {title, items: [{id, label, description}]}",
                },
            },
            "required": ["component", "props"],
        },
    },
}


# Global room reference for push_ui
_current_room = None


async def execute_push_ui(component: str, props: dict) -> str:
    """
    Push a visual UI component to the user's screen via LiveKit data channel.

    Args:
        component: Type of component (calendar, form, map, confirm, list)
        props: Properties/configuration for the component

    Returns:
        Confirmation message
    """
    global _current_room

    if not _current_room:
        return "Visual UI not available - no active room connection."

    import json
    import uuid

    message = {
        "type": "show_component",
        "component": component,
        "props": props,
        "id": str(uuid.uuid4()),
    }

    try:
        # Publish data to the "visual_ui" topic
        await _current_room.local_participant.publish_data(
            json.dumps(message).encode("utf-8"),
            topic="visual_ui",
        )

        logger.info(f"Pushed visual UI: {component}")
        return f"Displayed {component} component on user's screen. Wait for their response."
    except Exception as e:
        logger.error(f"Failed to push visual UI: {e}")
        return f"Failed to display UI: {str(e)}"


async def check_agent_has_knowledge(agent_id: str) -> bool:
    """Check if an agent has any knowledge documents."""
    try:
        import asyncpg
        conn = await asyncpg.connect(get_clean_database_url())
        try:
            result = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM knowledge_documents
                    WHERE agent_config_id = $1 AND status = 'ready'
                )
                """,
                agent_id,
            )
            return result
        finally:
            await conn.close()
    except Exception as e:
        logger.warning(f"Failed to check knowledge base: {e}")
        return False


# Global server instance for the decorator
_livekit_server: AgentServer | None = None


def _get_livekit_server() -> AgentServer:
    """Get or create the LiveKit agent server."""
    global _livekit_server
    if _livekit_server is None:
        _livekit_server = AgentServer(
            ws_url=os.getenv("LIVEKIT_URL"),
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
            port=8082,
        )
    return _livekit_server


async def create_tts_from_config(tts_config: Optional[dict]) -> Any:
    """
    Create a TTS instance based on the agent's TTS configuration.

    Args:
        tts_config: TTS config from database (provider, model, voice_id, etc.)

    Returns:
        TTS instance for the agent
    """
    if not tts_config:
        # Default to OpenAI TTS
        logger.info("No TTS config provided, using default OpenAI TTS")
        return openai.TTS(voice="alloy")

    provider = tts_config.get("provider", "openai")
    voice_id = tts_config.get("voice_id")
    model = tts_config.get("model")

    logger.info(f"Creating TTS: provider={provider}, model={model}, voice_id={voice_id}")

    if provider == "openai":
        voice = voice_id or "alloy"
        return openai.TTS(voice=voice, model=model or "tts-1")

    elif provider == "cartesia":
        from livekit.plugins import cartesia
        return cartesia.TTS(voice=voice_id or "sonic-english")

    elif provider == "elevenlabs":
        from livekit.plugins import elevenlabs
        return elevenlabs.TTS(voice=voice_id or "Rachel", model=model or "eleven_turbo_v2_5")

    elif provider == "voxclone":
        # Use our custom VoxClone TTS for voice cloning
        logger.info(f"Initializing VoxClone TTS with voice_id={voice_id}")
        try:
            config = TTSConfig(
                provider="voxclone",
                model=model or "openvoice-v2",
                voice_id=voice_id or "",
                sample_rate=24000,
            )
            voxclone_tts = VoxCloneTTS(config)

            # VoxClone needs a wrapper to work with LiveKit's TTS interface
            # For now, fall back to OpenAI if reference audio isn't loaded
            if not voxclone_tts.reference_audio:
                logger.warning("VoxClone reference audio not loaded, falling back to OpenAI TTS")
                return openai.TTS(voice="alloy")

            # Return a wrapper that adapts VoxCloneTTS to LiveKit's interface
            return VoxCloneLiveKitAdapter(voxclone_tts)

        except Exception as e:
            logger.error(f"Failed to initialize VoxClone TTS: {e}")
            return openai.TTS(voice="alloy")

    elif provider == "kokoro":
        # Kokoro local TTS
        try:
            config = TTSConfig(
                provider="kokoro",
                model=model or "kokoro-82m",
                voice_id=voice_id or "af_bella",
                sample_rate=24000,
            )
            return KokoroTTS(config)
        except Exception as e:
            logger.error(f"Failed to initialize Kokoro TTS: {e}")
            return openai.TTS(voice="alloy")

    else:
        logger.warning(f"Unknown TTS provider '{provider}', using OpenAI")
        return openai.TTS(voice="alloy")


class VoxCloneLiveKitAdapter:
    """
    Adapter to make VoxCloneTTS work with LiveKit's TTS interface.

    LiveKit expects a TTS object with specific methods. This adapter
    wraps our VoxCloneTTS to provide the expected interface.
    """

    def __init__(self, voxclone_tts: "VoxCloneTTS"):
        self._tts = voxclone_tts
        self._client = None
        # Import TTSCapabilities from livekit
        from livekit.agents.tts import TTSCapabilities
        self._capabilities = TTSCapabilities(streaming=False)
        self._sample_rate = 24000
        self._num_channels = 1

    @property
    def capabilities(self):
        """Return TTS capabilities."""
        return self._capabilities

    @property
    def sample_rate(self) -> int:
        """Return sample rate."""
        return self._sample_rate

    @property
    def num_channels(self) -> int:
        """Return number of channels."""
        return self._num_channels

    async def synthesize(self, text: str) -> Any:
        """Synthesize speech from text."""
        result = await self._tts.synthesize(text)
        return result

    def stream(self):
        """Return a streaming TTS session."""
        return VoxCloneStreamAdapter(self._tts)


class VoxCloneStreamAdapter:
    """Adapter for streaming TTS with VoxClone."""

    def __init__(self, voxclone_tts: "VoxCloneTTS"):
        self._tts = voxclone_tts

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    def push_text(self, text: str):
        """Buffer text for synthesis."""
        self._text_buffer = getattr(self, "_text_buffer", "") + text

    async def flush(self):
        """Synthesize buffered text."""
        text = getattr(self, "_text_buffer", "")
        if text:
            result = await self._tts.synthesize(text)
            self._text_buffer = ""
            return result

    async def aclose(self):
        """Close the stream."""
        pass


async def agent_entrypoint(ctx: JobContext):
    """Entry point for each LiveKit room session."""
    global _current_room
    import os

    # Use the LiveKit job ID which is guaranteed unique per dispatch
    job_id = ctx.job.id if ctx.job else "unknown"
    logger.info(f"Agent dispatched for room: {ctx.room.name}, job_id: {job_id}")

    # Generate agent ID using job ID + task ID for uniqueness
    task_id = id(asyncio.current_task())
    agent_instance_id = f"agent-{job_id}-{task_id}"
    logger.info(f"Agent instance ID: {agent_instance_id}")

    # =========================================================================
    # CLAIM ROOM BEFORE CONNECTING - Critical for preventing duplicates
    # =========================================================================
    claim_api_url = os.getenv("GUARDIAN_API_URL", "http://localhost:3000/api/guardian/events")
    # Extract base URL from guardian events URL
    base_url = claim_api_url.rsplit("/api/", 1)[0]
    claim_url = f"{base_url}/api/worker/claim-room"
    api_key = os.getenv("GUARDIAN_KEY", "")

    claimed = False
    if api_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    claim_url,
                    json={"roomName": ctx.room.name, "agentId": agent_instance_id},
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if response.status_code == 200:
                    result = response.json()
                    if result.get("claimed"):
                        logger.info(f"Successfully claimed room {ctx.room.name}")
                        claimed = True
                    else:
                        existing = result.get("existingAgentId", "unknown")
                        logger.warning(f"Room {ctx.room.name} already claimed by {existing}, NOT CONNECTING")
                        return  # Exit BEFORE connecting
                else:
                    logger.warning(f"Claim API returned {response.status_code}, proceeding anyway")
                    claimed = True  # Assume success if API error, let it connect
        except Exception as e:
            logger.warning(f"Failed to call claim API: {e}, proceeding anyway")
            claimed = True  # Assume success if can't reach API

    if not claimed:
        logger.warning(f"Could not claim room {ctx.room.name}, NOT CONNECTING")
        return

    # NOW connect after successful claim
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Store room reference for Visual Voice
    _current_room = ctx.room

    # =========================================================================
    # Guardian Security Suite Integration
    # =========================================================================
    # Load Guardian in subprocess (it won't be available from main process)
    guardian = load_guardian_plugin()
    guardian_active = False
    human_takeover_active = False
    agent_session: AgentSession | None = None  # Store session reference for takeover
    agent_instance: Agent | None = None  # Store agent reference for session recreation

    if guardian:
        try:
            await guardian.on_room_join(ctx.room)
            guardian_active = True
            logger.info(f"🔐 Guardian monitoring active for room: {ctx.room.name}")
        except Exception as e:
            logger.error(f"Guardian room join failed: {e}")
            guardian = None

    # Set up data channel handler for Guardian commands (takeover, etc.)
    from livekit.rtc import DataPacket

    # Track processed commands to prevent duplicates
    _processed_commands: set[str] = set()

    async def _handle_guardian_command(data_packet: DataPacket):
        nonlocal human_takeover_active, agent_session, agent_instance

        logger.debug(f"[Guardian] Data received - topic: {data_packet.topic}")

        if data_packet.topic != "guardian_command":
            return

        try:
            import json
            command = json.loads(data_packet.data.decode("utf-8"))
            cmd_type = command.get("type")

            # Create unique command ID for deduplication
            cmd_timestamp = command.get("timestamp", "")
            cmd_id = f"{cmd_type}:{cmd_timestamp}"

            if cmd_id in _processed_commands:
                logger.debug(f"[Guardian] Skipping duplicate command: {cmd_id}")
                return
            _processed_commands.add(cmd_id)

            logger.info(f"[Guardian] Processing command: {cmd_type} (id={cmd_id})")

            if cmd_type == "takeover":
                logger.info(f"🔐 Human takeover initiated by {command.get('agent_name', 'unknown')}")
                logger.info(f"[Guardian] agent_session exists: {agent_session is not None}, type: {type(agent_session)}")
                human_takeover_active = True

                if agent_session:
                    # Interrupt any ongoing speech first
                    logger.info("[Guardian] Interrupting agent session...")
                    await agent_session.interrupt()

                    # Announce takeover to the caller BEFORE shutting down
                    logger.info("[Guardian] Announcing takeover to caller...")
                    try:
                        await agent_session.say("Please hold, I'm connecting you to a human agent.")
                        # Brief pause to let the announcement complete
                        await asyncio.sleep(2.0)
                    except Exception as e:
                        logger.warning(f"[Guardian] Announcement failed: {e}")

                    # Completely shut down the agent session
                    logger.info("[Guardian] Shutting down agent session...")
                    agent_session.shutdown()  # Not async
                    agent_session = None

                # CRITICAL: Mute and unpublish all audio tracks to stop the agent
                track_count = len(ctx.room.local_participant.track_publications)
                logger.info(f"[Guardian] Muting and unpublishing {track_count} agent audio tracks...")
                for publication in ctx.room.local_participant.track_publications.values():
                    try:
                        # Mute the track first (sync call, not async)
                        if publication.track:
                            publication.track.mute()
                            logger.info(f"[Guardian] Muted track: {publication.sid}")

                        # Then unpublish using the track SID (async call)
                        await ctx.room.local_participant.unpublish_track(publication.sid)
                        logger.info(f"[Guardian] Unpublished track: {publication.sid}")
                    except Exception as e:
                        logger.error(f"[Guardian] Failed to mute/unpublish track {publication.sid}: {e}")

                logger.info("[Guardian] Agent session terminated - human takeover active")

                if guardian:
                    await guardian.on_human_takeover(command)

                # Notify the room that AI is paused
                await ctx.room.local_participant.publish_data(
                    json.dumps({
                        "type": "guardian_status",
                        "status": "human_active",
                        "agent_name": command.get("agent_name"),
                    }).encode("utf-8"),
                    topic="guardian_status",
                )

                logger.info("[Guardian] Takeover complete - AI fully silenced")

            elif cmd_type == "release":
                logger.info("🔐 Human released control back to AI")
                human_takeover_active = False

                # Session was shut down during takeover - need to recreate
                if agent_session is None and agent_instance is not None:
                    logger.info("[Guardian] Recreating agent session after release...")
                    from livekit.agents.voice import AgentSession
                    agent_session = AgentSession()
                    await agent_session.start(agent_instance, room=ctx.room)
                    await agent_session.say("I'm back. How can I continue to help you?")
                    logger.info("[Guardian] Agent session recreated - AI resumed")
                elif agent_session:
                    # Session still exists (fallback)
                    agent_session.output.set_audio_enabled(True)
                    agent_session.input.set_audio_enabled(True)
                    await agent_session.say("I'm back. How can I continue to help you?")
                    logger.info("[Guardian] Agent re-enabled - AI resumed")
                else:
                    logger.warning("[Guardian] Cannot restore AI - session not available. User should hang up and call back.")

                if guardian:
                    await guardian.on_human_release()

                await ctx.room.local_participant.publish_data(
                    json.dumps({
                        "type": "guardian_status",
                        "status": "ai_active",
                    }).encode("utf-8"),
                    topic="guardian_status",
                )

                logger.info("[Guardian] Release complete")

        except Exception as e:
            logger.error(f"Guardian command handling failed: {e}")

    @ctx.room.on("data_received")
    def on_data_received(data_packet: DataPacket):
        logger.debug(f"[Guardian] on_data_received triggered, topic={data_packet.topic}")
        asyncio.create_task(_handle_guardian_command(data_packet))

    # Get agent config from room metadata
    agent_id = None
    system_prompt = DEFAULT_SYSTEM_PROMPT
    has_knowledge_base = False
    webhooks = []

    # Debug: Log room info
    logger.info(f"Room name: {ctx.room.name}, metadata: {ctx.room.metadata}")

    if ctx.room.metadata:
        try:
            import json
            metadata = json.loads(ctx.room.metadata)
            agent_id = metadata.get("agentId")
            if agent_id:
                logger.info(f"Using agent config: {agent_id}")
                # Check if this agent has a knowledge base
                has_knowledge_base = await check_agent_has_knowledge(agent_id)
                if has_knowledge_base:
                    logger.info(f"Agent {agent_id} has knowledge base enabled")
                    system_prompt = DEFAULT_SYSTEM_PROMPT + KB_SYSTEM_PROMPT_SUFFIX

                # Fetch configured webhooks for this agent
                webhooks = await fetch_agent_webhooks(agent_id)
                if webhooks:
                    logger.info(f"Agent {agent_id} has {len(webhooks)} webhook(s) configured")
                    system_prompt += WEBHOOK_PROMPT_SUFFIX
        except (json.JSONDecodeError, TypeError):
            pass

    # Always add Visual Voice capabilities
    system_prompt += VISUAL_VOICE_PROMPT_SUFFIX

    # VoxEvolve: Add adaptive memory from approved lessons
    if agent_id:
        try:
            lessons = await fetch_approved_lessons(agent_id)
            if lessons:
                adaptive_memory = build_adaptive_memory_suffix(lessons)
                system_prompt += adaptive_memory
                logger.info(f"[VoxEvolve] Added {len(lessons)} lesson(s) to system prompt")
        except Exception as e:
            logger.debug(f"[VoxEvolve] Lessons not available: {e}")

    # Fetch agent's TTS config from database if we have an agent_id
    tts_config = None
    if agent_id:
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT tts_config FROM agent_configs WHERE id = $1",
                    agent_id,
                )
                if row and row["tts_config"]:
                    tts_config = json.loads(row["tts_config"])
                    logger.info(f"Loaded TTS config for agent {agent_id}: {tts_config}")
        except Exception as e:
            logger.error(f"Failed to load TTS config for agent {agent_id}: {e}")

    # Initialize the Voice Agent
    # Use aiapi for LLM if configured, otherwise use OpenAI directly
    ai_api_url = os.getenv("AI_API_URL")
    ai_api_key = os.getenv("AI_API_KEY")
    ai_api_model = os.getenv("AI_API_MODEL", "sonnet")

    if ai_api_url and ai_api_key:
        # Route LLM through aiapi gateway
        logger.info(f"Using aiapi gateway at {ai_api_url} with model {ai_api_model}")
        llm_instance = openai.LLM(
            model=ai_api_model,
            base_url=f"{ai_api_url}/v1",
            api_key=ai_api_key,
        )
    else:
        # Use OpenAI directly
        logger.info("Using OpenAI directly")
        llm_instance = openai.LLM(model="gpt-4o")

    # Define the push_ui tool function for the agent
    from livekit.agents import function_tool

    @function_tool
    async def push_ui(component: str, props: dict) -> str:
        """Display a visual UI component on the user's screen.

        Args:
            component: Type of component - 'calendar', 'form', 'map', 'confirm', or 'list'
            props: Properties for the component (title, fields, items, etc.)

        Returns:
            Confirmation message
        """
        return await execute_push_ui(component, props)

    # Build the tools list
    tools = [push_ui]  # Always include Visual Voice tool

    # Add dynamic webhook tools
    for webhook in webhooks:
        try:
            webhook_tool = create_webhook_tool(webhook)
            tools.append(webhook_tool)
            logger.info(f"Registered webhook tool: {webhook['name']}")
        except Exception as e:
            logger.error(f"Failed to create webhook tool '{webhook['name']}': {e}")

    logger.info(f"Agent initialized with {len(tools)} tool(s)")

    # Create TTS instance based on agent config
    tts_instance = await create_tts_from_config(tts_config)
    logger.info(f"TTS provider: {tts_config.get('provider', 'openai') if tts_config else 'openai (default)'}")

    agent = Agent(
        instructions=system_prompt,
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=llm_instance,
        tts=tts_instance,
        tools=tools,
    )
    agent_instance = agent  # Store reference for session recreation

    # Create and start the agent session
    session = AgentSession()
    agent_session = session  # Store reference for takeover
    await session.start(agent, room=ctx.room)

    # =========================================================================
    # Guardian: Hook into user transcripts for sentiment/risk analysis
    # =========================================================================
    if guardian_active and guardian:
        @session.on("user_input_transcribed")
        def on_user_transcript(event):
            """Analyze user speech for sentiment and risk."""
            if event.is_final and event.transcript.strip():
                asyncio.create_task(_analyze_user_text(event.transcript))

        async def _analyze_user_text(text: str):
            """Async wrapper for Guardian text analysis."""
            try:
                if guardian and guardian.is_licensed:
                    risk_result = await guardian.analyze_text(text, speaker="user")
                    logger.debug(f"[Guardian] Analyzed user text: sentiment={risk_result.sentiment:.2f}, risk={risk_result.level.value}")
            except Exception as e:
                logger.error(f"[Guardian] Failed to analyze text: {e}")

        logger.info("[Guardian] Transcript analysis hook registered")

    # Publish Guardian status to frontend
    if guardian_active:
        import json
        await ctx.room.local_participant.publish_data(
            json.dumps({
                "type": "guardian_status",
                "status": "active",
                "guardian_active": True,
                "features": {
                    "sentiment_analysis": guardian.config.enable_sentiment if guardian else False,
                    "risk_detection": guardian.config.enable_risk_detection if guardian else False,
                    "takeover": guardian.config.enable_takeover if guardian else False,
                },
            }).encode("utf-8"),
            topic="guardian_status",
        )

    # Greet the user
    greeting = "Hello! I'm Nexus, your AI assistant."
    if has_knowledge_base:
        greeting += " I have access to your knowledge base and can answer questions about your documents."
    if webhooks:
        greeting += f" I can also perform actions through {len(webhooks)} connected service{'s' if len(webhooks) > 1 else ''}."
    greeting += " How can I help you today?"
    await session.say(greeting)

    logger.info(
        f"Agent active in room: {ctx.room.name} "
        f"(knowledge_base={has_knowledge_base}, webhooks={len(webhooks)}, "
        f"visual_voice=True, guardian={guardian_active})"
    )

    # =========================================================================
    # Guardian Cleanup on Room Leave
    # =========================================================================
    async def _handle_disconnected():
        logger.info(f"🧹 Running disconnect cleanup for room: {ctx.room.name}")
        # Release room claim
        if claimed and api_key:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.request(
                        "DELETE",
                        claim_url,
                        json={"roomName": ctx.room.name, "agentId": agent_instance_id},
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    logger.info(f"Released room claim for {ctx.room.name}")
            except Exception as e:
                logger.warning(f"Failed to release room claim: {e}")

        if guardian:
            try:
                analytics = await guardian.get_session_analytics()
                logger.info(f"🔐 Guardian session analytics: {analytics}")
                await guardian.on_room_leave()
            except Exception as e:
                logger.error(f"Guardian cleanup failed: {e}")

    @ctx.room.on("disconnected")
    def on_disconnected():
        logger.info(f"🔌 Room disconnected: {ctx.room.name} - starting cleanup")
        # Run cleanup synchronously to ensure it completes before event loop ends
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_handle_disconnected())
            else:
                loop.run_until_complete(_handle_disconnected())
        except Exception as e:
            logger.error(f"Disconnect cleanup scheduling failed: {e}")


def run_livekit_worker():
    """
    Run the LiveKit agent worker using the Voice Agent.

    This connects to LiveKit and handles real-time voice interactions
    using OpenAI for LLM, STT, and TTS.
    """
    server = _get_livekit_server()

    # Register the entrypoint
    server.rtc_session(agent_name="nexus")(agent_entrypoint)

    # Run the server
    async def run_server():
        logger.info("Starting LiveKit Agent Server...")
        # devmode=False means agents only join when explicitly dispatched
        # devmode=True causes auto-join to ANY room, which creates duplicates
        await server.run(devmode=False)

    asyncio.run(run_server())


# =============================================================================
# Main Entry Point
# =============================================================================

async def start_background_services():
    """Start health server and heartbeat in the background."""
    health_port = int(os.getenv("WORKER_HEALTH_PORT", "8081"))
    health_runner = await run_health_server(health_port)

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    heartbeat_task = asyncio.create_task(run_heartbeat(redis_url))

    return health_runner, heartbeat_task


def main():
    """Main entry point for the VoxNexus worker."""
    logger.info("=" * 60)
    logger.info("VoxNexus Voice Agent Worker")
    logger.info("=" * 60)

    # Log available providers
    factory = AgentFactory()
    providers = factory.list_available_providers()
    logger.info(f"Available LLM providers: {', '.join(providers['llm'])}")
    logger.info(f"Available STT providers: {', '.join(providers['stt'])}")
    logger.info(f"Available TTS providers: {', '.join(providers['tts'])}")

    # Load Guardian Security Suite (proprietary plugin - optional)
    load_guardian_plugin()

    # Check for required environment variables
    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_key = os.getenv("LIVEKIT_API_KEY")
    livekit_secret = os.getenv("LIVEKIT_API_SECRET")
    openai_key = os.getenv("OPENAI_API_KEY")

    if not all([livekit_url, livekit_key, livekit_secret]):
        logger.error("Missing LiveKit credentials. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET")
        sys.exit(1)

    # Start background services (health + heartbeat) in a separate thread
    import threading

    def run_background():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(start_background_services())
        loop.run_forever()

    bg_thread = threading.Thread(target=run_background, daemon=True)
    bg_thread.start()
    logger.info("Background services started (health check + heartbeat)")

    if not openai_key:
        logger.warning("=" * 60)
        logger.warning("OPENAI_API_KEY not set!")
        logger.warning("Voice agent will not function without OpenAI API key.")
        logger.warning("Set OPENAI_API_KEY in /var/www/voxnexus/.env and restart.")
        logger.warning("=" * 60)
        logger.info("Running in standby mode (health check active)...")
        # Keep running for health check
        import time
        while True:
            time.sleep(60)
        return

    logger.info(f"LiveKit URL: {livekit_url}")
    logger.info(f"OpenAI API Key: {openai_key[:8]}...")

    # Run the LiveKit worker (blocking call)
    logger.info("Starting LiveKit Voice Agent Worker...")
    run_livekit_worker()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Worker interrupted")
    except Exception as e:
        logger.exception(f"Worker failed: {e}")
        sys.exit(1)
