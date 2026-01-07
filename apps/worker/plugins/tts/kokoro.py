#!/usr/bin/env python3
# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
# =============================================================================
# Kokoro TTS Plugin - Local Text-to-Speech via HTTP
# =============================================================================

"""
Kokoro TTS Plugin for VoxNexus Worker.

This plugin communicates with the local Kokoro TTS microservice
to generate speech without relying on expensive cloud APIs.

Usage:
    Set TTS_PROVIDER=kokoro in your environment or agent config.
    Ensure TTS_URL points to the Kokoro service (default: http://localhost:8880).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, AsyncIterator

import httpx

from core.interfaces import (
    AudioFrame,
    BaseTTS,
    SynthesisResult,
    TTSConfig,
)

logger = logging.getLogger("voxnexus.worker.tts.kokoro")

# =============================================================================
# Configuration
# =============================================================================

DEFAULT_TTS_URL = os.getenv("TTS_URL", "http://localhost:8880")
DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_bella")
DEFAULT_TIMEOUT = 30.0  # seconds
SAMPLE_RATE = 24000  # Kokoro outputs 24kHz


# =============================================================================
# Available Kokoro Voices
# =============================================================================

KOKORO_VOICES = {
    # American Female
    "af_bella": "Bella (American Female)",
    "af_sarah": "Sarah (American Female)",
    "af_nicole": "Nicole (American Female)",
    "af_sky": "Sky (American Female)",
    # American Male
    "am_adam": "Adam (American Male)",
    "am_michael": "Michael (American Male)",
    # British Female
    "bf_emma": "Emma (British Female)",
    "bf_isabella": "Isabella (British Female)",
    # British Male
    "bm_george": "George (British Male)",
    "bm_lewis": "Lewis (British Male)",
}


# =============================================================================
# Kokoro TTS Plugin
# =============================================================================

class KokoroTTS(BaseTTS):
    """
    Kokoro TTS Plugin - Local Text-to-Speech.

    This plugin sends synthesis requests to the local Kokoro TTS
    microservice and returns the generated audio.

    Attributes:
        config: TTS configuration
        base_url: URL of the Kokoro TTS service
        client: HTTP client for making requests
    """

    def __init__(self, config: TTSConfig):
        """
        Initialize the Kokoro TTS plugin.

        Args:
            config: TTS configuration with voice_id, speed, etc.
        """
        super().__init__(config)
        self.base_url = config.base_url or DEFAULT_TTS_URL
        self._client: httpx.AsyncClient | None = None

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "kokoro"

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=DEFAULT_TIMEOUT,
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _get_voice_id(self) -> str:
        """Get the voice ID from config or default."""
        voice = self.config.voice_id or DEFAULT_VOICE
        if voice not in KOKORO_VOICES:
            logger.warning(f"Unknown voice '{voice}', using default '{DEFAULT_VOICE}'")
            return DEFAULT_VOICE
        return voice

    async def synthesize(
        self,
        text: str,
        **kwargs: Any,
    ) -> SynthesisResult:
        """
        Synthesize speech from text.

        Args:
            text: The text to synthesize
            **kwargs: Additional options (ignored)

        Returns:
            SynthesisResult with audio data
        """
        if not text.strip():
            return SynthesisResult(
                audio=b"",
                sample_rate=SAMPLE_RATE,
                format="pcm",
            )

        client = await self._get_client()

        try:
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

            # Calculate duration from PCM data (16-bit, mono)
            duration_ms = len(audio_data) / (SAMPLE_RATE * 2) * 1000

            return SynthesisResult(
                audio=audio_data,
                sample_rate=SAMPLE_RATE,
                duration_ms=duration_ms,
                format="pcm",
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"Kokoro TTS HTTP error: {e.response.status_code}")
            raise RuntimeError(f"TTS request failed: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Kokoro TTS request error: {e}")
            raise RuntimeError(f"TTS service unavailable: {e}")

    async def stream_synthesize(
        self,
        text_stream: AsyncIterator[str],
        **kwargs: Any,
    ) -> AsyncIterator[AudioFrame]:
        """
        Stream synthesize speech from a text stream.

        This buffers text into sentences and synthesizes them
        for lower latency compared to waiting for all text.

        Args:
            text_stream: Async iterator of text chunks
            **kwargs: Additional options

        Yields:
            AudioFrame objects with PCM audio data
        """
        client = await self._get_client()

        # Buffer for accumulating text
        buffer = ""
        sentence_endings = {".": True, "!": True, "?": True, "\n": True}

        async def synthesize_chunk(text: str) -> bytes | None:
            """Synthesize a chunk of text."""
            if not text.strip():
                return None

            try:
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
                return response.content
            except Exception as e:
                logger.error(f"Chunk synthesis failed: {e}")
                return None

        async for chunk in text_stream:
            buffer += chunk

            # Check for sentence endings
            for i, char in enumerate(buffer):
                if char in sentence_endings:
                    # Extract complete sentence
                    sentence = buffer[: i + 1].strip()
                    buffer = buffer[i + 1 :]

                    if sentence:
                        audio = await synthesize_chunk(sentence)
                        if audio:
                            yield AudioFrame(
                                data=audio,
                                sample_rate=SAMPLE_RATE,
                            )
                    break

        # Synthesize remaining buffer
        if buffer.strip():
            audio = await synthesize_chunk(buffer.strip())
            if audio:
                yield AudioFrame(
                    data=audio,
                    sample_rate=SAMPLE_RATE,
                )

    async def stream_synthesize_direct(
        self,
        text: str,
        **kwargs: Any,
    ) -> AsyncIterator[AudioFrame]:
        """
        Stream synthesize a single text directly using the streaming endpoint.

        This uses the TTS service's native streaming for lower latency.

        Args:
            text: The text to synthesize
            **kwargs: Additional options

        Yields:
            AudioFrame objects with PCM audio data
        """
        if not text.strip():
            return

        client = await self._get_client()

        try:
            async with client.stream(
                "POST",
                "/v1/audio/speech/stream",
                json={
                    "input": text,
                    "voice": self._get_voice_id(),
                    "speed": self.config.speed,
                },
            ) as response:
                response.raise_for_status()

                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield AudioFrame(
                            data=chunk,
                            sample_rate=SAMPLE_RATE,
                        )

        except httpx.HTTPStatusError as e:
            logger.error(f"Kokoro TTS streaming error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Kokoro TTS streaming request error: {e}")


# =============================================================================
# Plugin Registration Helper
# =============================================================================

def get_kokoro_voices() -> dict[str, str]:
    """Return available Kokoro voices for UI display."""
    return KOKORO_VOICES.copy()
