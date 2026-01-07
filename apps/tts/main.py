#!/usr/bin/env python3
# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
# =============================================================================
# VoxNexus Local TTS Service - Kokoro-82M
# =============================================================================

"""
Local Text-to-Speech microservice using Kokoro-82M.

This service provides a cost-effective alternative to cloud TTS APIs
by running the Kokoro neural TTS model locally.

API Endpoints:
    POST /v1/audio/speech - Generate speech from text
    GET /health - Health check
    GET /voices - List available voices
"""

import io
import os
import logging
import hashlib
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("voxnexus.tts")

# =============================================================================
# Configuration
# =============================================================================

MODEL_DIR = Path(os.getenv("KOKORO_MODEL_DIR", "/app/models"))
CACHE_DIR = Path(os.getenv("KOKORO_CACHE_DIR", "/app/cache"))
DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_bella")
SAMPLE_RATE = 24000  # Kokoro outputs 24kHz audio

# Available Kokoro voices
VOICES = {
    # American Female voices
    "af_bella": {"name": "Bella", "gender": "female", "accent": "american"},
    "af_sarah": {"name": "Sarah", "gender": "female", "accent": "american"},
    "af_nicole": {"name": "Nicole", "gender": "female", "accent": "american"},
    "af_sky": {"name": "Sky", "gender": "female", "accent": "american"},
    # American Male voices
    "am_adam": {"name": "Adam", "gender": "male", "accent": "american"},
    "am_michael": {"name": "Michael", "gender": "male", "accent": "american"},
    # British Female voices
    "bf_emma": {"name": "Emma", "gender": "female", "accent": "british"},
    "bf_isabella": {"name": "Isabella", "gender": "female", "accent": "british"},
    # British Male voices
    "bm_george": {"name": "George", "gender": "male", "accent": "british"},
    "bm_lewis": {"name": "Lewis", "gender": "male", "accent": "british"},
}

# =============================================================================
# Kokoro Model Wrapper
# =============================================================================

class KokoroTTS:
    """Wrapper for Kokoro-82M TTS model."""

    def __init__(self):
        self.model = None
        self.voicepack = None
        self._initialized = False

    def initialize(self):
        """Load the Kokoro model and voice pack."""
        if self._initialized:
            return

        try:
            import torch
            from kokoro import KPipeline

            logger.info("Loading Kokoro model...")

            # Initialize the pipeline
            # Kokoro will auto-download model if not present
            self.pipeline = KPipeline(lang_code="a")  # 'a' for American English

            self._initialized = True
            logger.info("Kokoro model loaded successfully")

        except ImportError as e:
            logger.error(f"Failed to import Kokoro: {e}")
            raise RuntimeError(
                "Kokoro not installed. Run: pip install kokoro>=0.8"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Kokoro: {e}")
            raise

    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        speed: float = 1.0,
    ) -> np.ndarray:
        """
        Synthesize speech from text.

        Args:
            text: The text to synthesize
            voice: Voice ID (e.g., "af_bella")
            speed: Speech speed multiplier (0.5-2.0)

        Returns:
            NumPy array of audio samples (float32, 24kHz)
        """
        if not self._initialized:
            self.initialize()

        # Validate voice
        if voice not in VOICES:
            logger.warning(f"Unknown voice '{voice}', using default '{DEFAULT_VOICE}'")
            voice = DEFAULT_VOICE

        try:
            # Generate audio using Kokoro pipeline
            # The pipeline returns a generator of (graphemes, phonemes, audio) tuples
            audio_chunks = []

            for _, _, audio in self.pipeline(text, voice=voice, speed=speed):
                if audio is not None:
                    audio_chunks.append(audio)

            if not audio_chunks:
                raise ValueError("No audio generated")

            # Concatenate all chunks
            audio = np.concatenate(audio_chunks)

            return audio

        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            raise

    def synthesize_stream(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        speed: float = 1.0,
    ):
        """
        Stream synthesized speech chunk by chunk.

        Yields audio chunks as they are generated.
        """
        if not self._initialized:
            self.initialize()

        if voice not in VOICES:
            voice = DEFAULT_VOICE

        try:
            for _, _, audio in self.pipeline(text, voice=voice, speed=speed):
                if audio is not None:
                    yield audio
        except Exception as e:
            logger.error(f"Streaming synthesis failed: {e}")
            raise


# Global TTS instance
tts = KokoroTTS()

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="VoxNexus TTS Service",
    description="Local Text-to-Speech using Kokoro-82M",
    version="0.1.0",
)


class SpeechRequest(BaseModel):
    """Request body for speech synthesis."""

    input: str = Field(..., description="Text to synthesize", max_length=5000)
    voice: str = Field(default=DEFAULT_VOICE, description="Voice ID")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed")
    response_format: str = Field(
        default="pcm",
        description="Audio format: pcm, wav, or mp3",
    )


class VoiceInfo(BaseModel):
    """Voice information."""

    id: str
    name: str
    gender: str
    accent: str


@app.on_event("startup")
async def startup():
    """Initialize model on startup."""
    logger.info("Starting VoxNexus TTS Service...")

    # Create cache directory
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Pre-load model (optional - can defer to first request)
    try:
        tts.initialize()
    except Exception as e:
        logger.warning(f"Model pre-loading failed: {e}. Will retry on first request.")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "model": "kokoro-82m",
        "initialized": tts._initialized,
    })


@app.get("/voices", response_model=list[VoiceInfo])
async def list_voices():
    """List available voices."""
    return [
        VoiceInfo(id=vid, **vinfo)
        for vid, vinfo in VOICES.items()
    ]


@app.post("/v1/audio/speech")
async def create_speech(request: SpeechRequest):
    """
    Generate speech from text.

    Compatible with OpenAI TTS API format for easy migration.
    """
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="Input text is empty")

    try:
        # Generate audio
        audio = tts.synthesize(
            text=request.input,
            voice=request.voice,
            speed=request.speed,
        )

        # Convert to requested format
        if request.response_format == "wav":
            # WAV format
            buffer = io.BytesIO()
            sf.write(buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
            buffer.seek(0)
            return StreamingResponse(
                buffer,
                media_type="audio/wav",
                headers={"Content-Disposition": "attachment; filename=speech.wav"},
            )

        elif request.response_format == "mp3":
            # MP3 format (requires additional processing)
            try:
                import subprocess

                # Convert to WAV first
                wav_buffer = io.BytesIO()
                sf.write(wav_buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
                wav_buffer.seek(0)

                # Use ffmpeg to convert to MP3
                process = subprocess.Popen(
                    ["ffmpeg", "-i", "pipe:0", "-f", "mp3", "-q:a", "2", "pipe:1"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                )
                mp3_data, _ = process.communicate(input=wav_buffer.read())

                return StreamingResponse(
                    io.BytesIO(mp3_data),
                    media_type="audio/mpeg",
                    headers={"Content-Disposition": "attachment; filename=speech.mp3"},
                )
            except Exception:
                logger.warning("MP3 conversion failed, returning WAV")
                buffer = io.BytesIO()
                sf.write(buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
                buffer.seek(0)
                return StreamingResponse(buffer, media_type="audio/wav")

        else:
            # PCM format (raw 16-bit signed integers)
            # Convert float32 [-1, 1] to int16 [-32768, 32767]
            pcm_audio = (audio * 32767).astype(np.int16)
            return StreamingResponse(
                io.BytesIO(pcm_audio.tobytes()),
                media_type="audio/pcm",
                headers={
                    "X-Sample-Rate": str(SAMPLE_RATE),
                    "X-Channels": "1",
                    "X-Bit-Depth": "16",
                },
            )

    except Exception as e:
        logger.error(f"Speech synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/audio/speech/stream")
async def create_speech_stream(request: SpeechRequest):
    """
    Stream speech generation for lower latency.

    Returns PCM audio chunks as they are generated.
    """
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="Input text is empty")

    async def generate():
        try:
            for chunk in tts.synthesize_stream(
                text=request.input,
                voice=request.voice,
                speed=request.speed,
            ):
                # Convert to PCM
                pcm_chunk = (chunk * 32767).astype(np.int16)
                yield pcm_chunk.tobytes()
        except Exception as e:
            logger.error(f"Streaming failed: {e}")

    return StreamingResponse(
        generate(),
        media_type="audio/pcm",
        headers={
            "X-Sample-Rate": str(SAMPLE_RATE),
            "X-Channels": "1",
            "X-Bit-Depth": "16",
        },
    )


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("TTS_PORT", "8880"))
    host = os.getenv("TTS_HOST", "0.0.0.0")

    logger.info(f"Starting TTS server on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )
