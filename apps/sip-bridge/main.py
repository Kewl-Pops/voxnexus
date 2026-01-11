#!/usr/bin/env python3
"""
=============================================================================
VoxNexus SIP Bridge - Multi-Account SIP Registration Gateway
=============================================================================
Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

This service allows VoxNexus AI agents to register as SIP extensions on
external PBX systems (Asterisk, Cisco, Avaya, etc.) and bridge incoming
calls to LiveKit rooms for AI-powered voice interactions.

Architecture:
- Uses PJSUA2 for SIP stack (compiled from source)
- Each SipDevice from DB becomes a registered softphone
- Incoming calls auto-answer and bridge to LiveKit
- Redis pub/sub for real-time device management
=============================================================================
"""

import os
import sys
import json
import asyncio
import logging
import signal
import threading
import wave
import struct
import tempfile
import time
import httpx
import webrtcvad
from datetime import datetime
from typing import Dict, Optional, Any, List
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

# FastAPI for HTTP API
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn

# Database
import asyncpg

# Redis
import redis.asyncio as aioredis

# LiveKit
from livekit import api as livekit_api

# Logging setup
import structlog

# PJSUA2 - SIP stack (compiled from source in Docker)
try:
    import pjsua2 as pj
    PJSUA_AVAILABLE = True
except ImportError:
    PJSUA_AVAILABLE = False
    pj = None

# =============================================================================
# Configuration
# =============================================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voxnexus:voxnexus_dev@localhost:5432/voxnexus")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
HTTP_PORT = int(os.getenv("SIP_BRIDGE_PORT", "8890"))

# LiveKit configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

# SIP configuration
SIP_LOCAL_PORT_START = int(os.getenv("SIP_LOCAL_PORT_START", "5060"))
SIP_USER_AGENT = os.getenv("SIP_USER_AGENT", "VoxNexus-SIPBridge/1.0")

# AI Service configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")  # Groq for fast STT (whisper-large-v3)
AI_API_URL = os.getenv("AI_API_URL", "http://localhost:7200")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_API_MODEL = os.getenv("AI_API_MODEL", "sonnet")
KOKORO_TTS_URL = os.getenv("KOKORO_TTS_URL", "http://localhost:8880")

# Audio settings
SAMPLE_RATE = 8000  # 8kHz for SIP/telephony
FRAME_DURATION_MS = 20  # 20ms frames
SAMPLES_PER_FRAME = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000)  # 160 samples

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=getattr(logging, LOG_LEVEL),
)

logger = structlog.get_logger("voxnexus.sip-bridge")


# =============================================================================
# Data Models
# =============================================================================

class SipDeviceStatus(str, Enum):
    REGISTERED = "REGISTERED"
    FAILED = "FAILED"
    OFFLINE = "OFFLINE"


@dataclass
class SipDeviceConfig:
    """Configuration for a SIP device/extension."""
    id: str
    agent_config_id: str
    server: str
    username: str
    password: str
    port: int = 5060
    transport: str = "udp"
    display_name: Optional[str] = None
    realm: Optional[str] = None
    outbound_proxy: Optional[str] = None
    greeting_text: str = "Hello, this is your AI assistant. How can I help you today?"


@dataclass
class CallInfo:
    """Information about an active call."""
    call_id: str
    device_id: str
    direction: str
    remote_uri: str
    remote_name: Optional[str]
    livekit_room: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    answered_at: Optional[datetime] = None


# =============================================================================
# AI Voice Conversation Handler
# =============================================================================

class AIConversationHandler:
    """
    Handles AI voice conversation for a SIP call.
    Uses WebRTC VAD for natural turn-taking detection.
    """

    def __init__(self, call: 'VoxNexusCall', call_audio_media, loop: asyncio.AbstractEventLoop, device_config: SipDeviceConfig, db_pool):
        self.call = call
        self.call_audio_media = call_audio_media
        self.loop = loop
        self.device_config = device_config
        self.db_pool = db_pool
        self.running = False
        self.conversation_history: List[dict] = []
        self.recorder: Optional[pj.AudioMediaRecorder] = None
        self.player: Optional[pj.AudioMediaPlayer] = None
        self.temp_dir = Path(tempfile.mkdtemp(prefix="voxnexus_"))

        # VAD settings for natural conversation
        self.vad = webrtcvad.Vad(3)  # Aggressiveness 0-3 (3 = most aggressive, faster detection)
        self.speech_detected = False
        self.silence_frames = 0
        self.speech_frames = 0
        self.last_file_position = 0

        # Timing thresholds (in frames, 20ms each at 8kHz)
        self.silence_threshold_frames = 20  # 0.4 seconds of silence to trigger processing
        self.min_speech_frames = 10  # Minimum 0.2 seconds of speech required

        # Greeting and system prompt will be fetched fresh from database
        self.greeting_text = device_config.greeting_text
        self.system_prompt = ""  # Will be loaded from agent config

        # Conversation tracking for metrics
        self.conversation_id: Optional[str] = None
        self.call_start_time: Optional[datetime] = None

    async def _fetch_agent_config_from_db(self) -> tuple[str, str]:
        """Fetch the latest greeting and system prompt from database."""
        greeting = self.greeting_text
        system_prompt = """You are a friendly AI phone assistant.
IMPORTANT: Keep ALL responses under 2 sentences. This is a phone call - be extremely brief.
- Maximum 20 words per response
- No lists, no technical details
- Just answer directly and concisely"""

        try:
            async with self.db_pool.acquire() as conn:
                # Get greeting from sip_devices
                row = await conn.fetchrow(
                    "SELECT greeting_text FROM sip_devices WHERE id = $1",
                    self.device_config.id
                )
                if row and row['greeting_text']:
                    greeting = row['greeting_text']

                # Get system prompt from agent_configs
                agent_row = await conn.fetchrow(
                    """SELECT ac.name, ac.system_prompt
                       FROM agent_configs ac
                       JOIN sip_devices sd ON sd.agent_config_id = ac.id
                       WHERE sd.id = $1""",
                    self.device_config.id
                )
                if agent_row and agent_row['system_prompt']:
                    # Append phone-specific instructions to the agent's system prompt
                    system_prompt = agent_row['system_prompt'] + """

PHONE CALL INSTRUCTIONS:
- Keep ALL responses under 2 sentences. This is a phone call.
- Maximum 25 words per response.
- Be concise and conversational."""
                    logger.info("loaded_agent_config", agent_name=agent_row['name'])

        except Exception as e:
            logger.error("fetch_agent_config_failed", error=str(e))

        return greeting, system_prompt

    async def _create_conversation(self):
        """Create a conversation record in the database."""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    INSERT INTO conversations (id, agent_config_id, session_id, status, started_at, metadata)
                    VALUES (gen_random_uuid(), $1, $2, 'active', NOW(), $3)
                    RETURNING id
                """,
                    self.device_config.agent_config_id,
                    self.call.call_info.call_id if self.call.call_info else None,
                    json.dumps({
                        "channel": "sip",
                        "device_id": self.device_config.id,
                        "remote_uri": self.call.call_info.remote_uri if self.call.call_info else None
                    })
                )
                self.conversation_id = str(row['id'])
                logger.info("conversation_created", conversation_id=self.conversation_id)
        except Exception as e:
            logger.error("create_conversation_failed", error=str(e))

    async def _end_conversation(self):
        """Mark conversation as completed in database."""
        if not self.conversation_id:
            return

        try:
            duration_seconds = None
            if self.call_start_time:
                duration_seconds = int((datetime.utcnow() - self.call_start_time).total_seconds())

            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE conversations
                    SET status = 'completed', ended_at = NOW(),
                        metadata = metadata || $2
                    WHERE id = $1
                """,
                    self.conversation_id,
                    json.dumps({"duration_seconds": duration_seconds, "message_count": len(self.conversation_history)})
                )
                logger.info("conversation_ended", conversation_id=self.conversation_id, duration=duration_seconds)
        except Exception as e:
            logger.error("end_conversation_failed", error=str(e))

    async def _save_message(self, role: str, content: str):
        """Save a message to the conversation."""
        if not self.conversation_id:
            return

        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO messages (id, conversation_id, role, content, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, NOW())
                """,
                    self.conversation_id,
                    role,
                    content
                )
        except Exception as e:
            logger.error("save_message_failed", error=str(e), role=role)

    async def start(self):
        """Start the conversation handler."""
        self.running = True
        self.call_start_time = datetime.utcnow()

        # Fetch greeting and system prompt fresh from database
        self.greeting_text, self.system_prompt = await self._fetch_agent_config_from_db()

        # Create conversation record in database
        await self._create_conversation()

        logger.info(
            "ai_conversation_started",
            call_id=self.call.call_info.call_id if self.call.call_info else "unknown",
            conversation_id=self.conversation_id,
            greeting=self.greeting_text[:50] + "...",
            system_prompt_length=len(self.system_prompt)
        )

        # Play greeting
        await self._speak_response(self.greeting_text)

        # Start conversation loop
        asyncio.create_task(self._conversation_loop())

    async def stop(self):
        """Stop the conversation handler."""
        self.running = False
        await self._stop_recording()

        # End conversation in database
        await self._end_conversation()

        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        except Exception:
            pass
        logger.info("ai_conversation_stopped", conversation_id=self.conversation_id)

    async def _start_recording(self):
        """Start recording audio from the call."""
        try:
            self.record_file = self.temp_dir / f"recording_{int(time.time() * 1000)}.wav"
            self.recorder = pj.AudioMediaRecorder()
            self.recorder.createRecorder(str(self.record_file))
            self.call_audio_media.startTransmit(self.recorder)

            # Reset VAD state
            self.speech_detected = False
            self.silence_frames = 0
            self.speech_frames = 0
            self.last_file_position = 44  # Skip WAV header

            logger.info("recording_started", file=str(self.record_file))
        except Exception as e:
            logger.error("recording_start_failed", error=str(e))

    async def _stop_recording(self):
        """Stop recording."""
        if self.recorder:
            try:
                self.call_audio_media.stopTransmit(self.recorder)
                del self.recorder
                self.recorder = None
            except Exception as e:
                logger.error("recording_stop_failed", error=str(e))

    def _check_vad(self) -> bool:
        """Check audio file for voice activity, return True if user finished speaking."""
        if not self.record_file or not self.record_file.exists():
            return False

        try:
            file_size = self.record_file.stat().st_size
            if file_size <= self.last_file_position + 320:  # Need at least one frame
                return False

            with open(self.record_file, 'rb') as f:
                f.seek(self.last_file_position)
                new_audio = f.read()
                self.last_file_position = file_size

            # Process 20ms frames (320 bytes at 8kHz 16-bit mono)
            frame_size = 320
            for i in range(0, len(new_audio) - frame_size, frame_size):
                frame = new_audio[i:i + frame_size]
                try:
                    is_speech = self.vad.is_speech(frame, 8000)
                except Exception:
                    continue

                if is_speech:
                    self.speech_detected = True
                    self.speech_frames += 1
                    self.silence_frames = 0
                else:
                    if self.speech_detected:
                        self.silence_frames += 1

            # User finished speaking: had enough speech + now silent
            if (self.speech_detected and
                self.speech_frames >= self.min_speech_frames and
                self.silence_frames >= self.silence_threshold_frames):
                logger.info(
                    "end_of_speech_detected",
                    speech_frames=self.speech_frames,
                    silence_frames=self.silence_frames
                )
                return True

        except Exception as e:
            logger.error("vad_check_error", error=str(e))

        return False

    async def _conversation_loop(self):
        """Main conversation loop with VAD-based turn detection."""
        await self._start_recording()
        logger.info("listening_for_speech", message="Ready for conversation")

        while self.running:
            try:
                # Check VAD every 100ms for responsive detection
                if self._check_vad():
                    # User finished speaking, process immediately
                    await self._process_turn()

                await asyncio.sleep(0.05)  # 50ms polling for faster response

            except Exception as e:
                logger.error("conversation_loop_error", error=str(e))
                await asyncio.sleep(0.5)

    async def _process_turn(self):
        """Process one turn of conversation: STT -> LLM -> TTS -> Play."""
        turn_start = time.time()
        logger.info("processing_turn")

        # Stop current recording
        await self._stop_recording()

        # Get transcription
        transcript = await self._transcribe_audio(self.record_file)
        if not transcript or len(transcript.strip()) < 2:
            logger.info("empty_transcript", message="No speech detected")
            await self._start_recording()
            return

        logger.info("transcript_received", text=transcript)

        # Save user message to database
        await self._save_message("user", transcript)

        # Get AI response
        response = await self._get_ai_response(transcript)
        if not response:
            response = "I'm sorry, I didn't catch that. Could you please repeat?"

        logger.info("ai_response", text=response)

        # Save assistant response to database
        await self._save_message("assistant", response)

        # Generate TTS and play
        await self._speak_response(response)

        turn_latency_ms = int((time.time() - turn_start) * 1000)
        logger.info("turn_complete", total_latency_ms=turn_latency_ms)

        # Start recording again for next turn
        await self._start_recording()

    async def _transcribe_audio(self, audio_file: Path) -> Optional[str]:
        """Transcribe audio using Groq (fast) or OpenAI Whisper API."""
        # Prefer Groq for STT - it's ~5x faster than OpenAI
        if GROQ_API_KEY:
            return await self._transcribe_with_groq(audio_file)
        elif OPENAI_API_KEY:
            return await self._transcribe_with_openai(audio_file)
        else:
            logger.warning("no_stt_key", message="No STT API key configured")
            return None

    async def _transcribe_with_groq(self, audio_file: Path) -> Optional[str]:
        """Fast STT using Groq's Whisper (whisper-large-v3-turbo)."""
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=10.0) as client:
                with open(audio_file, 'rb') as f:
                    files = {'file': ('audio.wav', f, 'audio/wav')}
                    data = {'model': 'whisper-large-v3-turbo', 'language': 'en'}

                    response = await client.post(
                        'https://api.groq.com/openai/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {GROQ_API_KEY}'},
                        files=files,
                        data=data
                    )

                    latency_ms = int((time.time() - start_time) * 1000)
                    if response.status_code == 200:
                        result = response.json()
                        logger.info("stt_response_time", latency_ms=latency_ms, provider="groq")
                        return result.get('text', '')
                    else:
                        logger.error("stt_failed", status=response.status_code, body=response.text[:200], provider="groq")
                        return None
        except Exception as e:
            logger.error("stt_error", error=str(e), provider="groq")
            return None

    async def _transcribe_with_openai(self, audio_file: Path) -> Optional[str]:
        """STT using OpenAI Whisper API."""
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=10.0) as client:
                with open(audio_file, 'rb') as f:
                    files = {'file': ('audio.wav', f, 'audio/wav')}
                    data = {'model': 'whisper-1', 'language': 'en'}

                    response = await client.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {OPENAI_API_KEY}'},
                        files=files,
                        data=data
                    )

                    latency_ms = int((time.time() - start_time) * 1000)
                    if response.status_code == 200:
                        result = response.json()
                        logger.info("stt_response_time", latency_ms=latency_ms, provider="openai")
                        return result.get('text', '')
                    else:
                        logger.error("stt_failed", status=response.status_code, body=response.text, provider="openai")
                        return None

        except Exception as e:
            logger.error("stt_error", error=str(e), provider="openai")
            return None

    async def _get_ai_response(self, user_message: str) -> Optional[str]:
        """Get AI response from OpenAI (fast, low latency)."""
        # Add user message to history
        self.conversation_history.append({"role": "user", "content": user_message})

        # Build messages with system prompt
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.conversation_history[-6:])  # Keep last 6 turns for speed

        if not OPENAI_API_KEY:
            logger.warning("no_openai_key_configured")
            return "I'm sorry, the AI service is not configured."

        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Use OpenAI directly with gpt-4o-mini for fastest response
                response = await client.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {OPENAI_API_KEY}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'model': 'gpt-4o-mini',
                        'messages': messages,
                        'max_tokens': 100,  # Short but complete responses
                        'temperature': 0.7
                    }
                )

                latency_ms = int((time.time() - start_time) * 1000)
                logger.info("llm_response_time", latency_ms=latency_ms)

                if response.status_code == 200:
                    result = response.json()
                    assistant_message = result['choices'][0]['message']['content']
                    self.conversation_history.append({"role": "assistant", "content": assistant_message})
                    return assistant_message
                else:
                    logger.error("llm_failed", status=response.status_code, body=response.text[:200])
                    return None

        except Exception as e:
            logger.error("llm_error", error=str(e))
            return None

    async def _speak_response(self, text: str):
        """Generate TTS and play through the call."""
        try:
            # Truncate long responses but keep sentences complete
            if len(text) > 180:
                # Try to cut at sentence boundary
                cut_text = text[:180]
                last_period = cut_text.rfind('.')
                last_question = cut_text.rfind('?')
                last_exclaim = cut_text.rfind('!')
                best_cut = max(last_period, last_question, last_exclaim)
                if best_cut > 80:
                    text = cut_text[:best_cut + 1]
                else:
                    text = cut_text + "..."

            # Generate TTS audio using OpenAI (faster than Kokoro)
            tts_file = self.temp_dir / f"response_{int(time.time())}.mp3"

            tts_start = time.time()
            logger.info("tts_request_start", text_length=len(text), provider="openai")

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={
                        'Authorization': f'Bearer {OPENAI_API_KEY}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'model': 'tts-1',
                        'input': text,
                        'voice': 'nova',
                        'response_format': 'mp3',
                        'speed': 1.15  # Slightly faster speech
                    }
                )

                tts_latency_ms = int((time.time() - tts_start) * 1000)
                logger.info("tts_response", status=response.status_code, content_length=len(response.content), latency_ms=tts_latency_ms)

                if response.status_code == 200 and len(response.content) > 500:
                    # Save the audio
                    with open(tts_file, 'wb') as f:
                        f.write(response.content)

                    logger.info("tts_file_saved", file=str(tts_file), size=tts_file.stat().st_size)

                    # Convert MP3 to 8kHz WAV for SIP using ffmpeg (faster than sox for mp3)
                    tts_8k_file = self.temp_dir / f"response_8k_{int(time.time())}.wav"

                    import subprocess
                    result = subprocess.run([
                        'ffmpeg', '-y', '-i', str(tts_file),
                        '-ar', '8000', '-ac', '1', '-acodec', 'pcm_s16le',
                        str(tts_8k_file)
                    ], capture_output=True, timeout=10)

                    if result.returncode == 0 and tts_8k_file.exists():
                        logger.info("audio_conversion_success", file=str(tts_8k_file))
                        play_file = tts_8k_file
                    else:
                        logger.error("audio_conversion_failed", stderr=result.stderr.decode()[:200])
                        # Try playing original if conversion fails
                        play_file = tts_file

                    # Play the audio
                    await self._play_audio(str(play_file))

                else:
                    logger.error("tts_failed", status=response.status_code, content_length=len(response.content))

        except Exception as e:
            logger.error("speak_error", error=str(e), error_type=type(e).__name__)

    async def _play_audio(self, audio_file: str):
        """Play audio file through the SIP call."""
        try:
            self.player = pj.AudioMediaPlayer()
            self.player.createPlayer(audio_file, pj.PJMEDIA_FILE_NO_LOOP)
            self.player.startTransmit(self.call_audio_media)

            # Wait for playback to finish (estimate based on file duration)
            try:
                with wave.open(audio_file, 'rb') as wf:
                    duration = wf.getnframes() / wf.getframerate()
                    await asyncio.sleep(duration + 0.5)
            except Exception:
                await asyncio.sleep(3)  # Default wait

            # Stop and cleanup
            self.player.stopTransmit(self.call_audio_media)
            del self.player
            self.player = None

            logger.info("audio_played", file=audio_file)

        except Exception as e:
            logger.error("play_audio_error", error=str(e))


# =============================================================================
# PJSUA2 Callbacks
# =============================================================================

if PJSUA_AVAILABLE:

    class VoxNexusCall(pj.Call):
        """
        Handles a single SIP call.
        Auto-answers incoming calls and bridges to AI conversation.
        """

        def __init__(self, acc: 'VoxNexusSoftphone', call_id: int = pj.PJSUA_INVALID_ID):
            super().__init__(acc, call_id)
            self.account = acc
            self.call_info: Optional[CallInfo] = None
            self.media_connected = False
            self.ai_handler: Optional[AIConversationHandler] = None
            self.call_audio_media = None

        def onCallState(self, prm: pj.OnCallStateParam):
            """Called when call state changes."""
            ci = self.getInfo()
            logger.info(
                "call_state_changed",
                device_id=self.account.device_config.id,
                call_id=ci.callIdString,
                state=ci.stateText,
                remote_uri=ci.remoteUri
            )

            if ci.state == pj.PJSIP_INV_STATE_DISCONNECTED:
                logger.info(
                    "call_disconnected",
                    device_id=self.account.device_config.id,
                    call_id=ci.callIdString,
                    last_status=ci.lastStatusCode
                )
                # Stop AI conversation handler
                if self.ai_handler:
                    asyncio.run_coroutine_threadsafe(
                        self.ai_handler.stop(),
                        self.account.manager.loop
                    )
                    self.ai_handler = None

                # Notify manager of call end
                if self.account.manager:
                    asyncio.run_coroutine_threadsafe(
                        self.account.manager.on_call_ended(self),
                        self.account.manager.loop
                    )

        def onCallMediaState(self, prm: pj.OnCallMediaStateParam):
            """Called when media state changes - this is where we bridge audio."""
            ci = self.getInfo()

            for i, mi in enumerate(ci.media):
                if mi.type == pj.PJMEDIA_TYPE_AUDIO and \
                   mi.status == pj.PJSUA_CALL_MEDIA_ACTIVE:

                    self.media_connected = True
                    logger.info(
                        "audio_connected",
                        device_id=self.account.device_config.id,
                        call_id=ci.callIdString,
                        remote_uri=ci.remoteUri,
                        media_index=i
                    )

                    # Get the audio media from the call
                    try:
                        self.call_audio_media = self.getAudioMedia(i)
                    except Exception as e:
                        logger.error("get_audio_media_failed", error=str(e))
                        return

                    # Start AI conversation handler (greeting is fetched fresh from DB)
                    if self.account.manager and self.call_audio_media:
                        try:
                            self.ai_handler = AIConversationHandler(
                                self,
                                self.call_audio_media,
                                self.account.manager.loop,
                                self.account.device_config,
                                self.account.manager.db_pool  # Pass db_pool for fresh greeting fetch
                            )
                            asyncio.run_coroutine_threadsafe(
                                self.ai_handler.start(),
                                self.account.manager.loop
                            )
                            logger.info(
                                "ai_handler_started",
                                device_id=self.account.device_config.id,
                                greeting=self.account.device_config.greeting_text[:30] + "..."
                            )
                        except Exception as e:
                            logger.error(
                                "ai_handler_start_failed",
                                error=str(e)
                            )

                    if self.account.manager:
                        asyncio.run_coroutine_threadsafe(
                            self.account.manager.on_media_active(self),
                            self.account.manager.loop
                        )


    class VoxNexusSoftphone(pj.Account):
        """
        Represents a single SIP softphone/extension.
        Handles registration and incoming calls for one agent.
        """

        def __init__(self, device_config: SipDeviceConfig, manager: 'SipBridgeManager'):
            super().__init__()
            self.device_config = device_config
            self.manager = manager
            self.current_call: Optional[VoxNexusCall] = None
            self.is_registered = False

        def onRegState(self, prm: pj.OnRegStateParam):
            """Called when registration state changes."""
            ai = self.getInfo()

            if ai.regIsActive:
                self.is_registered = True
                logger.info(
                    "sip_registered",
                    device_id=self.device_config.id,
                    server=self.device_config.server,
                    username=self.device_config.username,
                    expires=ai.regExpiresSec
                )
                # Update DB status
                if self.manager:
                    asyncio.run_coroutine_threadsafe(
                        self.manager.update_device_status(
                            self.device_config.id,
                            SipDeviceStatus.REGISTERED
                        ),
                        self.manager.loop
                    )
            else:
                self.is_registered = False
                error_msg = f"Registration failed: {prm.code} - {prm.reason}"
                logger.error(
                    "sip_registration_failed",
                    device_id=self.device_config.id,
                    server=self.device_config.server,
                    code=prm.code,
                    reason=prm.reason
                )
                # Update DB status with error
                if self.manager:
                    asyncio.run_coroutine_threadsafe(
                        self.manager.update_device_status(
                            self.device_config.id,
                            SipDeviceStatus.FAILED,
                            error_msg
                        ),
                        self.manager.loop
                    )

        def onIncomingCall(self, prm: pj.OnIncomingCallParam):
            """Called when receiving an incoming call - auto-answer."""
            call = VoxNexusCall(self, prm.callId)
            ci = call.getInfo()

            logger.info(
                "incoming_call",
                device_id=self.device_config.id,
                call_id=ci.callIdString,
                remote_uri=ci.remoteUri,
                remote_name=ci.remoteContact
            )

            # Store call info
            call.call_info = CallInfo(
                call_id=ci.callIdString,
                device_id=self.device_config.id,
                direction="inbound",
                remote_uri=ci.remoteUri,
                remote_name=ci.remoteContact or None,
                livekit_room=f"sip-bridge-{self.device_config.id}"
            )

            self.current_call = call

            # Notify manager of incoming call
            if self.manager:
                asyncio.run_coroutine_threadsafe(
                    self.manager.on_incoming_call(call),
                    self.manager.loop
                )

            # Auto-answer with 200 OK
            call_prm = pj.CallOpParam()
            call_prm.statusCode = 200  # OK

            try:
                call.answer(call_prm)
                logger.info(
                    "call_answered",
                    device_id=self.device_config.id,
                    call_id=ci.callIdString
                )
            except Exception as e:
                logger.error(
                    "call_answer_failed",
                    device_id=self.device_config.id,
                    call_id=ci.callIdString,
                    error=str(e)
                )


# =============================================================================
# SIP Bridge Manager
# =============================================================================

class SipBridgeManager:
    """
    Manages multiple SIP softphones (one per SipDevice).
    Handles registration, call routing, and LiveKit bridging.
    """

    def __init__(self):
        self.endpoint: Optional[pj.Endpoint] = None
        self.softphones: Dict[str, 'VoxNexusSoftphone'] = {}
        self.active_calls: Dict[str, 'VoxNexusCall'] = {}
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis: Optional[aioredis.Redis] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.running = False
        self.pjsip_thread: Optional[threading.Thread] = None

    async def initialize(self):
        """Initialize the SIP bridge manager."""
        self.loop = asyncio.get_event_loop()

        # Initialize database connection
        logger.info("connecting_to_database", url=DATABASE_URL.split("@")[-1])
        self.db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10
        )

        # Initialize Redis connection
        logger.info("connecting_to_redis", url=REDIS_URL)
        self.redis = await aioredis.from_url(REDIS_URL)

        # Initialize PJSUA2 endpoint
        if PJSUA_AVAILABLE:
            await self._init_pjsip()
        else:
            logger.warning("pjsua2_not_available", message="Running in mock mode")

        self.running = True

    async def _init_pjsip(self):
        """Initialize the PJSIP endpoint."""
        logger.info("initializing_pjsip")

        # Create endpoint
        ep_cfg = pj.EpConfig()
        ep_cfg.uaConfig.userAgent = SIP_USER_AGENT
        ep_cfg.uaConfig.maxCalls = 100

        # Logging config
        ep_cfg.logConfig.level = 4
        ep_cfg.logConfig.consoleLevel = 4

        # Media config - disable VAD for cleaner audio
        ep_cfg.medConfig.noVad = True

        self.endpoint = pj.Endpoint()
        self.endpoint.libCreate()
        self.endpoint.libInit(ep_cfg)

        # Create UDP transport
        tp_cfg = pj.TransportConfig()
        tp_cfg.port = SIP_LOCAL_PORT_START

        self.endpoint.transportCreate(pj.PJSIP_TRANSPORT_UDP, tp_cfg)

        # Start the library
        self.endpoint.libStart()

        # Set null sound device for headless server operation
        # This allows audio to flow through network without local sound hardware
        self.endpoint.audDevManager().setNullDev()
        logger.info("null_audio_device_set", message="Using null sound device for headless operation")

        logger.info("pjsip_initialized", port=SIP_LOCAL_PORT_START)

    async def load_devices_from_db(self):
        """Load all SIP devices from database and register them."""
        logger.info("loading_sip_devices")

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    id, agent_config_id, server, username, password,
                    port, transport, display_name, realm, outbound_proxy, greeting_text
                FROM sip_devices
            """)

        logger.info("found_sip_devices", count=len(rows))

        for row in rows:
            config = SipDeviceConfig(
                id=row['id'],
                agent_config_id=row['agent_config_id'],
                server=row['server'],
                username=row['username'],
                password=row['password'],
                port=row['port'] or 5060,
                transport=row['transport'] or 'udp',
                display_name=row['display_name'],
                realm=row['realm'],
                outbound_proxy=row['outbound_proxy'],
                greeting_text=row['greeting_text'] or "Hello, this is your AI assistant. How can I help you today?"
            )
            await self.register_device(config)

    async def register_device(self, config: SipDeviceConfig):
        """Register a SIP device/extension."""
        if not PJSUA_AVAILABLE:
            logger.info(
                "mock_register_device",
                device_id=config.id,
                server=config.server,
                username=config.username
            )
            # Update status in mock mode
            await self.update_device_status(config.id, SipDeviceStatus.REGISTERED)
            return

        logger.info(
            "registering_sip_device",
            device_id=config.id,
            server=config.server,
            username=config.username
        )

        # Create account config
        acc_cfg = pj.AccountConfig()

        # SIP URI
        acc_cfg.idUri = f"sip:{config.username}@{config.server}"

        # Registration URI
        acc_cfg.regConfig.registrarUri = f"sip:{config.server}:{config.port}"
        acc_cfg.regConfig.timeoutSec = 300  # 5 minute registration refresh

        # Authentication
        cred = pj.AuthCredInfo()
        cred.scheme = "digest"
        # Use wildcard realm "*" to match any realm from server's 401 challenge
        cred.realm = config.realm or "*"
        cred.username = config.username
        cred.dataType = 0  # Plain text password
        cred.data = config.password
        acc_cfg.sipConfig.authCreds.append(cred)

        # Display name
        if config.display_name:
            acc_cfg.idUri = f'"{config.display_name}" <sip:{config.username}@{config.server}>'

        # Outbound proxy
        if config.outbound_proxy:
            acc_cfg.sipConfig.proxies.append(f"sip:{config.outbound_proxy}")

        # Create and register the account
        softphone = VoxNexusSoftphone(config, self)
        softphone.create(acc_cfg)

        self.softphones[config.id] = softphone

    async def unregister_device(self, device_id: str):
        """Unregister a SIP device."""
        if device_id in self.softphones:
            softphone = self.softphones[device_id]

            if PJSUA_AVAILABLE:
                softphone.shutdown()

            del self.softphones[device_id]
            await self.update_device_status(device_id, SipDeviceStatus.OFFLINE)

            logger.info("device_unregistered", device_id=device_id)

    async def update_device_status(
        self,
        device_id: str,
        status: SipDeviceStatus,
        error: Optional[str] = None
    ):
        """Update device status in database."""
        async with self.db_pool.acquire() as conn:
            status_value = status.value
            await conn.execute("""
                UPDATE sip_devices
                SET status = $1::sip_device_status,
                    last_error = $2,
                    registered_at = CASE WHEN $1 = 'REGISTERED' THEN NOW() ELSE registered_at END,
                    updated_at = NOW()
                WHERE id = $3
            """, status_value, error, device_id)

    async def on_incoming_call(self, call: 'VoxNexusCall'):
        """Handle incoming call - create LiveKit room and log."""
        if call.call_info is None:
            return

        self.active_calls[call.call_info.call_id] = call

        # Log call to database
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO sip_call_logs
                (id, sip_device_id, call_id, direction, remote_uri, remote_name, livekit_room, status)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'answered')
            """,
                call.call_info.device_id,
                call.call_info.call_id,
                call.call_info.direction,
                call.call_info.remote_uri,
                call.call_info.remote_name,
                call.call_info.livekit_room
            )

        # Create LiveKit room for this call
        if LIVEKIT_URL and LIVEKIT_API_KEY:
            await self._create_livekit_room(call.call_info.livekit_room, call.call_info)

    async def _create_livekit_room(self, room_name: str, call_info: CallInfo):
        """Create a LiveKit room for the SIP call."""
        try:
            room_service = livekit_api.RoomServiceClient(
                LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://"),
                LIVEKIT_API_KEY,
                LIVEKIT_API_SECRET
            )

            await room_service.create_room(
                livekit_api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,
                    max_participants=10,
                    metadata=json.dumps({
                        "type": "sip-bridge",
                        "device_id": call_info.device_id,
                        "call_id": call_info.call_id,
                        "remote_uri": call_info.remote_uri
                    })
                )
            )

            logger.info(
                "livekit_room_created",
                room=room_name,
                call_id=call_info.call_id
            )

            # Dispatch agent to the room
            try:
                dispatch = livekit_api.AgentDispatchClient(
                    LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://"),
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET
                )
                await dispatch.create_dispatch(
                    room_name,
                    "nexus",  # Agent name
                    metadata=json.dumps({"source": "sip-bridge", "call_id": call_info.call_id})
                )
                logger.info("agent_dispatched", room=room_name)
            except Exception as e:
                logger.warning("agent_dispatch_failed", room=room_name, error=str(e))

        except Exception as e:
            logger.error("livekit_room_creation_failed", room=room_name, error=str(e))

    async def on_media_active(self, call: 'VoxNexusCall'):
        """Handle media becoming active - ready for audio bridge."""
        if call.call_info is None:
            return

        logger.info(
            "media_active_ready_for_bridge",
            device_id=call.call_info.device_id,
            call_id=call.call_info.call_id,
            livekit_room=call.call_info.livekit_room,
            message="Audio stream is active. In production, would bridge to LiveKit here."
        )

        # Update call log with answered timestamp
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE sip_call_logs
                SET answered_at = NOW(), status = 'answered'
                WHERE call_id = $1
            """, call.call_info.call_id)

    async def on_call_ended(self, call: 'VoxNexusCall'):
        """Handle call ending."""
        if call.call_info is None:
            return

        if call.call_info.call_id in self.active_calls:
            del self.active_calls[call.call_info.call_id]

        # Update call log
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE sip_call_logs
                SET ended_at = NOW(),
                    status = 'completed',
                    duration_secs = EXTRACT(EPOCH FROM (NOW() - started_at))::int
                WHERE call_id = $1
            """, call.call_info.call_id)

        logger.info(
            "call_ended",
            device_id=call.call_info.device_id,
            call_id=call.call_info.call_id
        )

    async def listen_redis_events(self):
        """Listen for Redis pub/sub events to manage devices dynamically."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("sip-bridge:register", "sip-bridge:unregister")

        logger.info("listening_redis_events")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            channel = message["channel"].decode() if isinstance(message["channel"], bytes) else message["channel"]
            data = json.loads(message["data"])

            if channel == "sip-bridge:register":
                config = SipDeviceConfig(**data)
                await self.register_device(config)
            elif channel == "sip-bridge:unregister":
                await self.unregister_device(data["device_id"])

    async def shutdown(self):
        """Shutdown the SIP bridge."""
        logger.info("shutting_down")
        self.running = False

        # Unregister all softphones
        for device_id in list(self.softphones.keys()):
            await self.unregister_device(device_id)

        # Shutdown PJSIP
        if PJSUA_AVAILABLE and self.endpoint:
            self.endpoint.libDestroy()

        # Close database pool
        if self.db_pool:
            await self.db_pool.close()

        # Close Redis
        if self.redis:
            await self.redis.close()

        logger.info("shutdown_complete")


# =============================================================================
# FastAPI Application
# =============================================================================

manager = SipBridgeManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await manager.initialize()
    await manager.load_devices_from_db()

    # Start Redis listener in background
    asyncio.create_task(manager.listen_redis_events())

    yield

    # Shutdown
    await manager.shutdown()


app = FastAPI(
    title="VoxNexus SIP Bridge",
    description="SIP Registration Gateway for AI Voice Agents",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "sip-bridge",
        "pjsua_available": PJSUA_AVAILABLE,
        "registered_devices": len(manager.softphones),
        "active_calls": len(manager.active_calls)
    }


@app.get("/devices")
async def list_devices():
    """List all registered SIP devices."""
    devices = []
    for device_id, softphone in manager.softphones.items():
        devices.append({
            "id": device_id,
            "server": softphone.device_config.server,
            "username": softphone.device_config.username,
            "registered": softphone.is_registered if PJSUA_AVAILABLE else True
        })
    return {"devices": devices}


@app.get("/calls")
async def list_calls():
    """List active calls."""
    calls = []
    for call_id, call in manager.active_calls.items():
        if call.call_info:
            calls.append({
                "call_id": call_id,
                "device_id": call.call_info.device_id,
                "direction": call.call_info.direction,
                "remote_uri": call.call_info.remote_uri,
                "livekit_room": call.call_info.livekit_room,
                "media_connected": call.media_connected if PJSUA_AVAILABLE else False
            })
    return {"calls": calls}


@app.post("/devices/{device_id}/register")
async def register_device(device_id: str, background_tasks: BackgroundTasks):
    """Trigger re-registration for a device."""
    if device_id in manager.softphones:
        raise HTTPException(400, "Device already registered")

    # Fetch device config from DB
    async with manager.db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, agent_config_id, server, username, password,
                   port, transport, display_name, realm, outbound_proxy
            FROM sip_devices WHERE id = $1
        """, device_id)

    if not row:
        raise HTTPException(404, "Device not found")

    config = SipDeviceConfig(
        id=row['id'],
        agent_config_id=row['agent_config_id'],
        server=row['server'],
        username=row['username'],
        password=row['password'],
        port=row['port'] or 5060,
        transport=row['transport'] or 'udp',
        display_name=row['display_name'],
        realm=row['realm'],
        outbound_proxy=row['outbound_proxy']
    )

    background_tasks.add_task(manager.register_device, config)

    return {"status": "registering", "device_id": device_id}


@app.post("/devices/{device_id}/unregister")
async def unregister_device(device_id: str):
    """Unregister a device."""
    if device_id not in manager.softphones:
        raise HTTPException(404, "Device not registered")

    await manager.unregister_device(device_id)
    return {"status": "unregistered", "device_id": device_id}


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    """Main entry point."""
    logger.info(
        "starting_sip_bridge",
        port=HTTP_PORT,
        pjsua_available=PJSUA_AVAILABLE
    )

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level="info"
    )


if __name__ == "__main__":
    main()
