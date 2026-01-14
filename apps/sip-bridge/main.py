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
from livekit import rtc as livekit_rtc

# Guardian integration - sentiment analysis
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

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
# Guardian Bridge - Real-time monitoring for SIP calls
# =============================================================================

# Risk keywords for Guardian detection
RISK_KEYWORDS = {
    "critical": ["lawsuit", "sue", "attorney", "lawyer", "legal action", "kill", "die", "threat"],
    "high": ["cancel", "refund", "report", "complaint", "angry", "furious", "unacceptable"],
    "medium": ["frustrated", "disappointed", "upset", "problem", "issue", "wrong", "bad"],
}

class GuardianBridge:
    """
    Bridge between SIP calls and the Guardian dashboard.

    Publishes real-time events to Redis for dashboard visibility.
    Listens for takeover commands to mute the local AI.
    """

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.analyzer = SentimentIntensityAnalyzer()
        self.sessions: Dict[str, dict] = {}  # conversation_id -> session data
        self._takeover_listener_task: Optional[asyncio.Task] = None
        self._takeover_callbacks: Dict[str, callable] = {}  # conversation_id -> callback
        self._device_callbacks: Dict[str, callable] = {}  # device_id -> callback (fallback)

    async def start_takeover_listener(self):
        """Start listening for takeover commands from the dashboard."""
        self._takeover_listener_task = asyncio.create_task(self._listen_for_takeovers())
        logger.info("guardian_takeover_listener_started")

    async def stop_takeover_listener(self):
        """Stop the takeover listener."""
        if self._takeover_listener_task:
            self._takeover_listener_task.cancel()
            try:
                await self._takeover_listener_task
            except asyncio.CancelledError:
                pass

    async def _listen_for_takeovers(self):
        """Listen for takeover commands on Redis channel."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("guardian:takeover")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                conversation_id = data.get("conversation_id")
                command = data.get("command", "takeover")

                logger.info("guardian_command_received",
                           conversation_id=conversation_id,
                           command=command)

                # Implement Redis lock to prevent race conditions on takeover
                lock_key = f"guardian:takeover_lock:{conversation_id}"
                lock_acquired = await self.redis.set(lock_key, "1", nx=True, ex=30)
                
                if not lock_acquired:
                    logger.warning("takeover_locked_by_another_process",
                                 conversation_id=conversation_id)
                    continue  # Skip execution - another process has the lock

                callback = None

                # First try exact conversation_id match
                if conversation_id and conversation_id in self._takeover_callbacks:
                    callback = self._takeover_callbacks[conversation_id]
                    logger.debug("takeover_matched_by_conversation_id", conversation_id=conversation_id)

                # If no match, check if there's an active call on any device
                # This handles the case where the worker's session ID differs from SIP bridge's conversation ID
                if callback is None and self._device_callbacks:
                    # Use the first (and typically only) active device callback
                    # In practice, there's usually one active call per SIP bridge instance
                    for device_id, device_callback in self._device_callbacks.items():
                        logger.info("takeover_fallback_to_device",
                                   conversation_id=conversation_id,
                                   device_id=device_id)
                        callback = device_callback
                        break  # Use the first active device

                try:
                    if callback:
                        if command == "takeover":
                            await callback(mute=True)
                        elif command == "release":
                            await callback(mute=False)
                    else:
                        logger.warning("takeover_no_callback_found",
                                      conversation_id=conversation_id,
                                      registered_callbacks=list(self._takeover_callbacks.keys()),
                                      registered_devices=list(self._device_callbacks.keys()))
                finally:
                    # CRITICAL: Always release the Redis lock after callback completes
                    # Use delete (not del) for better atomicity
                    await self.redis.delete(lock_key)
                    logger.debug("takeover_lock_released", conversation_id=conversation_id)

            except Exception as e:
                logger.error("guardian_command_error", error=str(e))

    def register_takeover_callback(self, conversation_id: str, callback: callable, device_id: str = None):
        """Register a callback for takeover commands."""
        self._takeover_callbacks[conversation_id] = callback
        if device_id:
            self._device_callbacks[device_id] = callback

    def unregister_takeover_callback(self, conversation_id: str, device_id: str = None):
        """Unregister a takeover callback."""
        self._takeover_callbacks.pop(conversation_id, None)
        if device_id:
            self._device_callbacks.pop(device_id, None)

    async def publish_event(self, event_type: str, data: dict):
        """Publish an event to the guardian:events Redis channel."""
        event = {
            "type": event_type,
            "timestamp": time.time(),
            **data
        }
        try:
            await self.redis.publish("guardian:events", json.dumps(event))
            logger.debug("guardian_event_published", event_type=event_type)
        except Exception as e:
            logger.error("guardian_publish_failed", error=str(e))

    def analyze_sentiment(self, text: str) -> dict:
        """Analyze sentiment using VADER."""
        scores = self.analyzer.polarity_scores(text)
        return {
            "compound": scores["compound"],
            "positive": scores["pos"],
            "negative": scores["neg"],
            "neutral": scores["neu"],
        }

    def detect_risk_keywords(self, text: str) -> tuple[str, list]:
        """Detect risk keywords in text. Returns (risk_level, keywords_found)."""
        text_lower = text.lower()

        for level in ["critical", "high", "medium"]:
            found = [kw for kw in RISK_KEYWORDS[level] if kw in text_lower]
            if found:
                return level.upper(), found  # UPPERCASE to match Prisma enum

        return "LOW", []  # UPPERCASE to match Prisma enum

    async def on_session_start(self, conversation_id: str, device_id: str, room_name: str,
                               remote_uri: str = "", agent_name: str = "AI Agent"):
        """Called when a call/conversation starts."""
        self.sessions[conversation_id] = {
            "device_id": device_id,
            "room_name": room_name,
            "remote_uri": remote_uri,
            "agent_name": agent_name,
            "start_time": time.time(),
            "message_count": 0,
            "avg_sentiment": 0.0,
            "max_risk_level": "LOW",  # Initialize as UPPERCASE to match Prisma enum
            "human_active": False,
        }

        await self.publish_event("session_start", {
            "sessionId": conversation_id,
            "roomName": room_name,
            "deviceId": device_id,
            "remoteUri": remote_uri,
            "agentName": agent_name,
        })

        logger.info("guardian_session_started",
                   conversation_id=conversation_id,
                   room_name=room_name)

    async def on_transcript(self, conversation_id: str, text: str, speaker: str = "user"):
        """Called when a transcript is received."""
        if conversation_id not in self.sessions:
            return

        session = self.sessions[conversation_id]
        session["message_count"] += 1

        # Analyze sentiment
        sentiment = self.analyze_sentiment(text)
        compound = sentiment["compound"]

        # Update running average
        n = session["message_count"]
        session["avg_sentiment"] = ((session["avg_sentiment"] * (n - 1)) + compound) / n

        # Detect risk keywords
        risk_level, keywords = self.detect_risk_keywords(text)
        
        # Ensure session max risk level is uppercase for comparison
        current_max = session["max_risk_level"].upper()
        
        # Update max risk level if new level is higher
        risk_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        if risk_order.index(risk_level) > risk_order.index(current_max):
            session["max_risk_level"] = risk_level  # Store in uppercase

        # Always publish sentiment update
        await self.publish_event("sentiment_update", {
            "sessionId": conversation_id,
            "sentiment": compound,
            "avgSentiment": session["avg_sentiment"],
            "messageCount": session["message_count"],
            "speaker": speaker,
            "text": text[:100],  # Truncate for privacy
        })

        # Publish risk event if keywords found
        if risk_level != "low":
            await self.publish_event("risk_detected", {
                "sessionId": conversation_id,
                "level": risk_level.upper(),
                "keywords": keywords,
                "sentiment": compound,
                "text": text[:200],
                "category": "keyword_match",
            })

            logger.warning("guardian_risk_detected",
                          conversation_id=conversation_id,
                          level=risk_level,
                          keywords=keywords)

    async def on_takeover(self, conversation_id: str, operator_name: str = "Operator"):
        """Called when a human operator takes over."""
        if conversation_id in self.sessions:
            self.sessions[conversation_id]["human_active"] = True

        await self.publish_event("takeover", {
            "sessionId": conversation_id,
            "operatorName": operator_name,
        })

        logger.info("guardian_takeover", conversation_id=conversation_id)

    async def on_release(self, conversation_id: str):
        """Called when control is released back to AI."""
        if conversation_id in self.sessions:
            self.sessions[conversation_id]["human_active"] = False

        await self.publish_event("release", {
            "sessionId": conversation_id,
        })

        logger.info("guardian_release", conversation_id=conversation_id)

    async def on_session_end(self, conversation_id: str, device_id: str = None):
        """Called when a call/conversation ends."""
        session = self.sessions.pop(conversation_id, None)
        
        # CRITICAL: Clean up any orphaned Redis locks when session ends
        lock_key = f"guardian:takeover_lock:{conversation_id}"
        await self.redis.delete(lock_key)

        await self.publish_event("session_end", {
            "sessionId": conversation_id,
            "duration": time.time() - session["start_time"] if session else 0,
            "messageCount": session["message_count"] if session else 0,
            "avgSentiment": session["avg_sentiment"] if session else 0,
            "maxRiskLevel": session["max_risk_level"] if session else "LOW",
        })

        self.unregister_takeover_callback(conversation_id, device_id=device_id)
        logger.info("guardian_session_ended", conversation_id=conversation_id)


# Global Guardian instance (initialized in app lifespan)
guardian: Optional[GuardianBridge] = None


# =============================================================================
# LiveKit Audio Bridge - bridges SIP audio to LiveKit for operator takeover
# =============================================================================

class LiveKitAudioBridge:
    """
    Bridges audio between PJSUA2 (SIP) and LiveKit (WebRTC).

    When an operator takes over a call:
    - Caller's audio (from PJSUA2) is published to the LiveKit room
    - Operator's audio (from LiveKit) is played to the caller via PJSUA2
    """

    SAMPLE_RATE = 48000  # LiveKit standard
    NUM_CHANNELS = 1
    FRAME_DURATION_MS = 20  # 20ms frames
    SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_DURATION_MS // 1000  # 960 samples

    def __init__(self, room_name: str, conversation_id: str):
        self.room_name = room_name
        self.conversation_id = conversation_id
        self.room: Optional[livekit_rtc.Room] = None
        self.audio_source: Optional[livekit_rtc.AudioSource] = None
        self.local_track: Optional[livekit_rtc.LocalAudioTrack] = None
        self.connected = False
        self._audio_task: Optional[asyncio.Task] = None
        self._incoming_audio_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._running = False
        self._track_ready = False  # Flag to indicate track is ready for audio frames

        logger.info("livekit_audio_bridge_created",
                   room_name=room_name,
                   conversation_id=conversation_id)

    async def connect(self) -> bool:
        """Connect to the LiveKit room and start publishing audio."""
        if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            logger.error("livekit_not_configured")
            return False

        try:
            # Generate access token for the SIP bridge participant
            token = livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            token.with_identity(f"sip-bridge-{self.conversation_id[:8]}")
            token.with_name("Caller (SIP)")
            token.with_grants(livekit_api.VideoGrants(
                room_join=True,
                room=self.room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            ))
            jwt_token = token.to_jwt()

            # Create and connect to room
            self.room = livekit_rtc.Room()

            # Set up event handlers before connecting
            @self.room.on("track_subscribed")
            def on_track_sub(track, publication, participant):
                logger.info("livekit_track_subscribed_event",
                           participant=participant.identity,
                           track_kind=str(track.kind),
                           room=self.room_name)
                if track.kind == livekit_rtc.TrackKind.KIND_AUDIO:
                    asyncio.create_task(self._process_incoming_audio(track))

            @self.room.on("participant_connected")
            def on_participant(participant):
                logger.info("livekit_participant_joined",
                           participant=participant.identity,
                           room=self.room_name)

            @self.room.on("disconnected")
            def on_disconnect():
                self._on_disconnected()

            logger.info("livekit_connecting", room=self.room_name)

            # Set _running BEFORE connecting, so track_subscribed handler doesn't exit early
            self._running = True

            await self.room.connect(LIVEKIT_URL, jwt_token)

            logger.info("livekit_connected", room=self.room_name)

            # Create audio source for publishing caller audio
            self.audio_source = livekit_rtc.AudioSource(
                sample_rate=self.SAMPLE_RATE,
                num_channels=self.NUM_CHANNELS
            )

            # Create and publish local audio track
            self.local_track = livekit_rtc.LocalAudioTrack.create_audio_track(
                "caller-audio",
                self.audio_source
            )

            publication = await self.room.local_participant.publish_track(self.local_track)

            logger.info("livekit_audio_track_published", room=self.room_name, track_sid=publication.sid if publication else "unknown")

            # Wait a moment for track to be ready
            await asyncio.sleep(0.5)

            self.connected = True
            self._track_ready = True  # Flag to indicate track is ready for frames
            return True

        except Exception as e:
            self._running = False  # Reset if connection failed
            logger.error("livekit_connect_failed", error=str(e), room=self.room_name)
            return False

    async def disconnect(self):
        """Disconnect from LiveKit room."""
        self._running = False
        self._track_ready = False  # Stop sending frames immediately

        if self._audio_task:
            self._audio_task.cancel()
            try:
                await self._audio_task
            except asyncio.CancelledError:
                pass

        if self.room:
            await self.room.disconnect()
            self.room = None

        self.connected = False
        logger.info("livekit_disconnected", room=self.room_name)

    async def send_audio(self, audio_data: bytes, sample_rate: int = 16000):
        """
        Send audio data from PJSUA2 to LiveKit.
        Resamples from PJSUA2's sample rate to LiveKit's 48kHz.
        """
        if not self.connected or not self.audio_source or not self._track_ready:
            return

        try:
            import numpy as np

            # Convert bytes to numpy array (16-bit PCM)
            samples = np.frombuffer(audio_data, dtype=np.int16)

            # Resample if needed (PJSUA2 typically uses 8kHz or 16kHz)
            if sample_rate != self.SAMPLE_RATE:
                # Simple linear resampling
                ratio = self.SAMPLE_RATE / sample_rate
                new_length = int(len(samples) * ratio)
                indices = np.linspace(0, len(samples) - 1, new_length)
                samples = np.interp(indices, np.arange(len(samples)), samples).astype(np.int16)

            # Create audio frame and send
            frame = livekit_rtc.AudioFrame(
                data=samples.tobytes(),
                sample_rate=self.SAMPLE_RATE,
                num_channels=self.NUM_CHANNELS,
                samples_per_channel=len(samples)
            )

            await self.audio_source.capture_frame(frame)

        except Exception as e:
            logger.debug("livekit_send_audio_error", error=str(e))

    def get_incoming_audio_nowait(self) -> Optional[bytes]:
        """
        Get incoming audio from LiveKit (operator's voice) without blocking.
        Returns audio data as 16-bit PCM at 8kHz for PJSUA2, or None if queue empty.
        """
        try:
            return self._incoming_audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def get_incoming_audio(self) -> Optional[bytes]:
        """
        Get incoming audio from LiveKit (operator's voice).
        Returns audio data as 16-bit PCM at 8kHz for PJSUA2.
        """
        try:
            audio_data = await asyncio.wait_for(
                self._incoming_audio_queue.get(),
                timeout=0.05  # Reduced timeout
            )
            return audio_data
        except asyncio.TimeoutError:
            return None

    def _on_track_subscribed(self, track: livekit_rtc.Track,
                              publication: livekit_rtc.RemoteTrackPublication,
                              participant: livekit_rtc.RemoteParticipant):
        """Handle incoming audio track subscription."""
        if track.kind == livekit_rtc.TrackKind.KIND_AUDIO:
            logger.info("livekit_audio_track_subscribed",
                       participant=participant.identity,
                       room=self.room_name)

            # Start processing incoming audio
            asyncio.create_task(self._process_incoming_audio(track))

    async def _process_incoming_audio(self, track: livekit_rtc.Track):
        """Process incoming audio from a subscribed track."""
        logger.info("livekit_processing_incoming_audio_started", room=self.room_name)
        frame_count = 0

        try:
            audio_stream = livekit_rtc.AudioStream(track)

            async for event in audio_stream:
                if not self._running:
                    break

                frame_count += 1

                try:
                    import numpy as np

                    # AudioStream yields AudioFrameEvent objects, not raw frames
                    # The frame is accessible via event.frame
                    frame = event.frame

                    if frame_count == 1 or frame_count % 100 == 0:
                        logger.info("livekit_incoming_audio_frame",
                                   room=self.room_name,
                                   frame_count=frame_count,
                                   sample_rate=frame.sample_rate,
                                   samples_per_channel=frame.samples_per_channel,
                                   num_channels=frame.num_channels)

                    # Get audio data from frame
                    samples = np.frombuffer(frame.data, dtype=np.int16).astype(np.float32)

                    # Proper downsampling from 48kHz to 8kHz with anti-aliasing
                    if frame.sample_rate != 8000:
                        downsample_factor = frame.sample_rate // 8000  # 6 for 48kHz

                        # Anti-aliasing: apply moving average filter before decimation
                        # This acts as a simple low-pass filter to prevent aliasing
                        if downsample_factor > 1:
                            # Pad to make length divisible by factor
                            pad_len = (downsample_factor - len(samples) % downsample_factor) % downsample_factor
                            if pad_len > 0:
                                samples = np.pad(samples, (0, pad_len), mode='constant')

                            # Reshape and average (box filter anti-aliasing)
                            samples = samples.reshape(-1, downsample_factor).mean(axis=1)

                    # Convert back to int16
                    samples = np.clip(samples, -32768, 32767).astype(np.int16)

                    # Queue the audio for playback
                    try:
                        self._incoming_audio_queue.put_nowait(samples.tobytes())
                    except asyncio.QueueFull:
                        pass  # Drop frames if queue is full

                except Exception as e:
                    logger.debug("livekit_process_audio_error", error=str(e))

        except Exception as e:
            logger.error("livekit_audio_stream_error", error=str(e))
        finally:
            logger.info("livekit_processing_incoming_audio_ended",
                       room=self.room_name,
                       total_frames=frame_count)

    def _on_disconnected(self):
        """Handle disconnection from LiveKit."""
        logger.info("livekit_room_disconnected", room=self.room_name)
        self.connected = False
        self._running = False


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
    agent_config_id: str  # Agent ID for TTS/LLM config lookup
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
        # TTS config from agent - None means use default OpenAI
        self.tts_config: Optional[dict] = None
        self.system_prompt = ""  # Will be loaded from agent config

        # Conversation tracking for metrics
        self.conversation_id: Optional[str] = None
        self.call_start_time: Optional[datetime] = None

        # Guardian takeover state - when True, AI is muted and human is speaking
        self.muted = False

        # LiveKit audio bridge for operator takeover
        self.livekit_bridge: Optional[LiveKitAudioBridge] = None
        self._bridge_audio_task: Optional[asyncio.Task] = None

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

                # Get system prompt and TTS config from agent_configs
                agent_row = await conn.fetchrow(
                    """SELECT ac.name, ac.system_prompt, ac.tts_config
                       FROM agent_configs ac
                       JOIN sip_devices sd ON sd.agent_config_id = ac.id
                       WHERE sd.id = $1""",
                    self.device_config.id
                )
                if agent_row:
                    if agent_row['system_prompt']:
                        # Append phone-specific instructions to the agent's system prompt
                        system_prompt = agent_row['system_prompt'] + """

PHONE CALL INSTRUCTIONS:
- Keep ALL responses under 2 sentences. This is a phone call.
- Maximum 25 words per response.
- Be concise and conversational."""

                    # Load TTS config if present
                    if agent_row['tts_config']:
                        try:
                            self.tts_config = json.loads(agent_row['tts_config']) if isinstance(agent_row['tts_config'], str) else agent_row['tts_config']
                            logger.info("loaded_tts_config", provider=self.tts_config.get('provider'), voice_id=self.tts_config.get('voice_id'))
                        except (json.JSONDecodeError, TypeError) as e:
                            logger.error("tts_config_parse_error", error=str(e))

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

    async def _handle_takeover(self, mute: bool):
        """Handle takeover/release commands from Guardian dashboard."""
        # Prevent duplicate takeover commands
        if mute and self.muted and self.livekit_bridge:
            logger.debug("takeover_already_active", conversation_id=self.conversation_id)
            return

        self.muted = mute
        if mute:
            logger.info("ai_muted_by_operator", conversation_id=self.conversation_id)
            # Stop any ongoing playback
            await self._stop_playback()

            # Play takeover announcement directly to caller (not via LiveKit)
            await self._speak_response("A human operator is joining the call. Please hold.")

            # Clean up any existing bridge first
            if self.livekit_bridge:
                await self.livekit_bridge.disconnect()
                self.livekit_bridge = None

            # Start LiveKit audio bridge for operator to speak with caller
            room_name = f"sip-bridge-{self.device_config.id}"
            self.livekit_bridge = LiveKitAudioBridge(room_name, self.conversation_id)
            connected = await self.livekit_bridge.connect()

            if connected:
                logger.info("livekit_bridge_started", conversation_id=self.conversation_id)
                # Start audio bridging task
                self._bridge_audio_task = asyncio.create_task(self._run_audio_bridge())
            else:
                logger.error("livekit_bridge_failed_to_connect", conversation_id=self.conversation_id)
                self.livekit_bridge = None
        else:
            logger.info("ai_unmuted_by_operator", conversation_id=self.conversation_id)

            # Stop audio bridge with proper cleanup
            if self._bridge_audio_task:
                self._bridge_audio_task.cancel()
                try:
                    await asyncio.wait_for(self._bridge_audio_task, timeout=2.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    logger.warning("audio_bridge_task_force_terminated")
                finally:
                    self._bridge_audio_task = None

            if self.livekit_bridge:
                await self.livekit_bridge.disconnect()
                self.livekit_bridge = None
                logger.info("livekit_bridge_stopped", conversation_id=self.conversation_id)

    async def _run_audio_bridge(self):
        """
        Run the audio bridge loop - streams audio between PJSUA2 and LiveKit.
        """
        logger.info("audio_bridge_loop_started", conversation_id=self.conversation_id)

        # Create a dedicated recorder for bridging
        bridge_recorder: Optional[pj.AudioMediaRecorder] = None
        bridge_record_file = self.temp_dir / "bridge_audio.wav"
        last_read_position = 44  # Skip WAV header

        # Buffer for accumulating operator audio
        operator_audio_buffer = bytearray()
        buffer_threshold = 8000 * 2 * 0.2  # 200ms of audio at 8kHz, 16-bit mono = 3200 bytes
        last_play_time = time.time()

        try:
            # Start recording for the bridge
            bridge_recorder = pj.AudioMediaRecorder()
            bridge_recorder.createRecorder(str(bridge_record_file))
            self.call_audio_media.startTransmit(bridge_recorder)
            logger.info("bridge_recording_started")

            loop_count = 0
            while self.muted and self.running:
                loop_count += 1

                # Check if task was cancelled (handles graceful shutdown)
                if asyncio.current_task().cancelled():
                    logger.info("audio_bridge_task_cancelled_during_loop")
                    break

                # ===== CALLER → OPERATOR (PJSUA2 → LiveKit) =====
                # Read new audio data from the recording file and send to LiveKit
                if bridge_record_file.exists():
                    file_size = bridge_record_file.stat().st_size
                    if file_size > last_read_position:
                        with open(bridge_record_file, 'rb') as f:
                            f.seek(last_read_position)
                            audio_chunk = f.read(file_size - last_read_position)
                            last_read_position = file_size

                            if audio_chunk and self.livekit_bridge:
                                # Send to LiveKit (16kHz mono PCM from PJSUA2 conference bridge)
                                await self.livekit_bridge.send_audio(audio_chunk, sample_rate=16000)

                # ===== OPERATOR → CALLER (LiveKit → PJSUA2) =====
                # Drain the queue into buffer (non-blocking)
                if self.livekit_bridge:
                    drained = 0
                    while True:
                        incoming_audio = self.livekit_bridge.get_incoming_audio_nowait()
                        if incoming_audio:
                            operator_audio_buffer.extend(incoming_audio)
                            drained += 1
                        else:
                            break

                    if loop_count == 1 or loop_count % 100 == 0:
                        logger.info("audio_bridge_loop_status",
                                   loop_count=loop_count,
                                   buffer_size=len(operator_audio_buffer),
                                   drained_this_loop=drained,
                                   queue_size=self.livekit_bridge._incoming_audio_queue.qsize())

                # Play accumulated audio when we have enough or after timeout
                current_time = time.time()
                should_play = (
                    len(operator_audio_buffer) >= buffer_threshold or
                    (len(operator_audio_buffer) > 0 and current_time - last_play_time > 0.15)
                )

                if should_play and len(operator_audio_buffer) > 320:  # At least 20ms
                    # Take the buffered audio
                    audio_to_play = bytes(operator_audio_buffer)
                    operator_audio_buffer.clear()
                    last_play_time = current_time

                    logger.info("bridge_playing_operator_audio",
                               audio_len=len(audio_to_play),
                               conversation_id=self.conversation_id)

                    # Play the buffered audio to caller (don't await - let it play async)
                    await self._play_bridge_audio(audio_to_play)

                await asyncio.sleep(0.01)  # 10ms loop for faster response

        except asyncio.CancelledError:
            logger.info("audio_bridge_loop_cancelled")
        except Exception as e:
            logger.error("audio_bridge_loop_error", error=str(e))
        finally:
            # Cleanup bridge recorder
            if bridge_recorder:
                try:
                    self.call_audio_media.stopTransmit(bridge_recorder)
                    del bridge_recorder
                except Exception:
                    pass

            # Remove temp file
            try:
                if bridge_record_file.exists():
                    bridge_record_file.unlink()
            except Exception:
                pass

            logger.info("audio_bridge_loop_ended", conversation_id=self.conversation_id)

    async def _play_bridge_audio(self, audio_data: bytes):
        """Play incoming bridge audio to the caller."""
        if not audio_data or len(audio_data) < 320:  # At least 20ms of audio
            return

        try:
            # Create temp WAV file with the audio data (8kHz, mono, 16-bit)
            temp_wav = self.temp_dir / f"bridge_play_{int(time.time() * 1000000)}.wav"

            with wave.open(str(temp_wav), 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(8000)  # 8kHz for SIP/PJSUA2
                wf.writeframes(audio_data)

            # Play the audio
            player = pj.AudioMediaPlayer()
            player.createPlayer(str(temp_wav), pj.PJMEDIA_FILE_NO_LOOP)
            player.startTransmit(self.call_audio_media)

            # Calculate duration and wait
            duration = len(audio_data) / (8000 * 2)  # 8kHz, 16-bit
            await asyncio.sleep(duration)

            # Cleanup
            player.stopTransmit(self.call_audio_media)
            del player

            # Remove temp file
            try:
                temp_wav.unlink()
            except Exception:
                pass

        except Exception as e:
            logger.debug("play_bridge_audio_error", error=str(e))

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

        # Register with Guardian for dashboard visibility and takeover
        if guardian and self.conversation_id:
            room_name = f"sip-bridge-{self.device_config.id}"
            remote_uri = self.call.call_info.remote_uri if self.call.call_info else ""
            await guardian.on_session_start(
                conversation_id=self.conversation_id,
                device_id=self.device_config.id,
                room_name=room_name,
                remote_uri=remote_uri,
                agent_name="SIP AI Agent"
            )
            # Register takeover callback (by both conversation_id and device_id)
            guardian.register_takeover_callback(
                self.conversation_id,
                self._handle_takeover,
                device_id=self.device_config.id
            )

        # Play greeting
        await self._speak_response(self.greeting_text)

        # Start conversation loop
        asyncio.create_task(self._conversation_loop())

    async def stop(self):
        """Stop the conversation handler."""
        self.running = False
        await self._stop_recording()

        # Stop audio bridge if active
        if self._bridge_audio_task:
            self._bridge_audio_task.cancel()
            try:
                await self._bridge_audio_task
            except asyncio.CancelledError:
                pass
            self._bridge_audio_task = None

        if self.livekit_bridge:
            await self.livekit_bridge.disconnect()
            self.livekit_bridge = None

        # Notify Guardian of session end
        if guardian and self.conversation_id:
            await guardian.on_session_end(self.conversation_id, device_id=self.device_config.id)

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

    async def _stop_playback(self):
        """Stop any current audio playback (used for takeover)."""
        if self.player:
            try:
                self.player.stopTransmit(self.call_audio_media)
                del self.player
                self.player = None
                logger.info("playback_stopped_for_takeover")
            except Exception as e:
                logger.error("playback_stop_failed", error=str(e))

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

        # Send transcript to Guardian for sentiment analysis (always, even if muted)
        if guardian and self.conversation_id:
            await guardian.on_transcript(self.conversation_id, transcript, speaker="user")

        # Save user message to database
        await self._save_message("user", transcript)

        # If muted (human takeover), don't process AI response
        if self.muted:
            logger.info("ai_muted_skipping_response", conversation_id=self.conversation_id)
            await self._start_recording()
            return

        # Get AI response
        response = await self._get_ai_response(transcript)
        if not response:
            response = "I'm sorry, I didn't catch that. Could you please repeat?"

        logger.info("ai_response", text=response)

        # Send AI response to Guardian too
        if guardian and self.conversation_id:
            await guardian.on_transcript(self.conversation_id, response, speaker="assistant")

        # Save assistant response to database
        await self._save_message("assistant", response)

        # Check again if muted before speaking (might have changed during AI processing)
        if self.muted:
            logger.info("ai_muted_skipping_tts", conversation_id=self.conversation_id)
            await self._start_recording()
            return

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

            tts_start = time.time()

            # Check if voxclone is configured
            if self.tts_config and self.tts_config.get('provider') == 'voxclone':
                audio_data = await self._tts_voxclone(text)
            else:
                audio_data = await self._tts_openai(text)

            if audio_data:
                tts_latency_ms = int((time.time() - tts_start) * 1000)
                logger.info("tts_complete", latency_ms=tts_latency_ms, provider=self.tts_config.get('provider') if self.tts_config else 'openai')

                # Save the audio
                tts_file = self.temp_dir / f"response_{int(time.time())}.wav"
                with open(tts_file, 'wb') as f:
                    f.write(audio_data)

                logger.info("tts_file_saved", file=str(tts_file), size=tts_file.stat().st_size)

                # Convert to 8kHz WAV for SIP
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
                    play_file = tts_file

                # Play the audio
                await self._play_audio(str(play_file))

        except Exception as e:
            logger.error("speak_error", error=str(e), error_type=type(e).__name__)

    async def _tts_openai(self, text: str) -> Optional[bytes]:
        """Generate TTS using OpenAI."""
        logger.info("tts_request_start", text_length=len(text), provider="openai")
        try:
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
                        'response_format': 'wav',
                        'speed': 1.15
                    }
                )

                if response.status_code == 200 and len(response.content) > 500:
                    return response.content
                else:
                    logger.error("tts_openai_failed", status=response.status_code)
                    return None
        except Exception as e:
            logger.error("tts_openai_error", error=str(e))
            return None

    async def _tts_voxclone(self, text: str) -> Optional[bytes]:
        """Generate TTS using VoxClone voice cloning service."""
        voice_id = self.tts_config.get('voice_id') if self.tts_config else None
        if not voice_id:
            logger.warning("voxclone_no_voice_id, falling back to openai")
            return await self._tts_openai(text)

        logger.info("tts_request_start", text_length=len(text), provider="voxclone", voice_id=voice_id)

        # Look up the voice profile to get the reference audio path
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT reference_audio_url FROM voice_profiles WHERE id = $1",
                    voice_id
                )
                if not row:
                    logger.error("voxclone_voice_not_found", voice_id=voice_id)
                    return await self._tts_openai(text)

                reference_audio_url = row['reference_audio_url']
                # Convert URL path to file path
                reference_audio_path = f"/var/www/voxnexus/apps/web/public{reference_audio_url}"

                if not Path(reference_audio_path).exists():
                    logger.error("voxclone_reference_audio_missing", path=reference_audio_path)
                    return await self._tts_openai(text)

        except Exception as e:
            logger.error("voxclone_db_error", error=str(e))
            return await self._tts_openai(text)

        # Call voxclone service
        voxclone_url = os.getenv("VOXCLONE_API_URL", "http://localhost:8002")
        license_key = os.getenv("VOXNEXUS_LICENSE_KEY", "")
        try:
            import base64
            import subprocess
            import tempfile

            # Check if we need to convert the audio (browser records WebM)
            # Convert to proper WAV format using ffmpeg
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_wav:
                tmp_wav_path = tmp_wav.name

            convert_result = subprocess.run([
                'ffmpeg', '-y', '-i', reference_audio_path,
                '-ar', '24000', '-ac', '1', '-acodec', 'pcm_s16le',
                tmp_wav_path
            ], capture_output=True, timeout=10)

            if convert_result.returncode == 0:
                audio_path_to_use = tmp_wav_path
                logger.info("reference_audio_converted", original=reference_audio_path)
            else:
                # Use original if conversion fails
                audio_path_to_use = reference_audio_path
                logger.warning("reference_audio_conversion_failed", stderr=convert_result.stderr.decode()[:100])

            # Read and base64 encode the reference audio
            with open(audio_path_to_use, 'rb') as f:
                audio_bytes = f.read()
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

            # Clean up temp file
            if audio_path_to_use != reference_audio_path:
                try:
                    os.unlink(tmp_wav_path)
                except:
                    pass

            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    'Content-Type': 'application/json',
                    'X-VoxNexus-License': license_key
                } if license_key else {'Content-Type': 'application/json'}

                response = await client.post(
                    f"{voxclone_url}/v1/clone",
                    json={
                        'text': text,
                        'reference_audio_base64': audio_base64,
                        'speed': 1.0,
                        'sample_rate': 24000
                    },
                    headers=headers
                )

                if response.status_code == 200:
                    # Response is JSON with base64 audio
                    result = response.json()
                    if 'audio_base64' in result:
                        audio_data = base64.b64decode(result['audio_base64'])
                        logger.info("voxclone_success", content_length=len(audio_data))
                        return audio_data
                    else:
                        logger.error("voxclone_no_audio_in_response")
                        return await self._tts_openai(text)
                else:
                    logger.error("voxclone_failed", status=response.status_code, body=response.text[:200])
                    return await self._tts_openai(text)

        except Exception as e:
            logger.error("voxclone_error", error=str(e))
            return await self._tts_openai(text)

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
                agent_config_id=self.device_config.agent_config_id,
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
            # Use the new LiveKitAPI interface (v1.1.0+)
            lk_url = LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")
            lk = livekit_api.LiveKitAPI(
                url=lk_url,
                api_key=LIVEKIT_API_KEY,
                api_secret=LIVEKIT_API_SECRET
            )

            await lk.room.create_room(
                livekit_api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,
                    max_participants=10,
                    metadata=json.dumps({
                        "type": "sip-bridge",
                        "agentId": call_info.agent_config_id,  # For worker TTS/LLM config
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
                await lk.agent_dispatch.create_dispatch(
                    livekit_api.CreateAgentDispatchRequest(
                        room=room_name,
                        agent_name="nexus",
                        metadata=json.dumps({"source": "sip-bridge", "call_id": call_info.call_id})
                    )
                )
                logger.info("agent_dispatched", room=room_name)
            except Exception as e:
                logger.warning("agent_dispatch_failed", room=room_name, error=str(e))
            finally:
                await lk.aclose()

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
    global guardian

    # Startup
    await manager.initialize()
    await manager.load_devices_from_db()

    # Initialize Guardian with the manager's Redis connection
    guardian = GuardianBridge(manager.redis)
    await guardian.start_takeover_listener()
    logger.info("guardian_bridge_initialized")

    # Start Redis listener in background
    asyncio.create_task(manager.listen_redis_events())

    yield

    # Shutdown
    if guardian:
        await guardian.stop_takeover_listener()
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
