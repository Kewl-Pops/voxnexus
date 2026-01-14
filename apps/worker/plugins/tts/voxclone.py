"""
VoxNexus Voice Cloning TTS Plugin
Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

This plugin integrates the VoxNexus Voice Cloning microservice with the main worker.
It implements the BaseTTS interface and provides zero-shot voice cloning capabilities.
"""

from __future__ import annotations

import os
import asyncio
import base64
import logging
from typing import AsyncIterator, Optional, Any
import io

import httpx

# Import from relative path (this will be available when run via main.py)
try:
    from core.interfaces import BaseTTS, TTSConfig, SynthesisResult, AudioFrame
except ImportError:
    # For development when running directly
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from core.interfaces import BaseTTS, TTSConfig, SynthesisResult, AudioFrame

logger = logging.getLogger("voxnexus.worker.tts.voxclone")


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
            
            # Check if voice_id is a file path
            elif os.path.exists(self.config.voice_id):
                with open(self.config.voice_id, "rb") as f:
                    return f.read()
            
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


# Note: Plugin registration is handled in apps/worker/main.py
# This module provides the standalone VoxCloneTTS class that can be imported
# without circular dependencies. The main.py file contains the @register_plugin
# decorated version for the plugin registry.