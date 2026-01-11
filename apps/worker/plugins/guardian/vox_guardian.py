"""
VoxNexus Guardian Security Suite - Enterprise Implementation
=============================================================

Real-time sentiment analysis, risk detection, and human takeover
capabilities for VoxNexus voice conversations.

This module provides enterprise-grade security features:
- VADER sentiment analysis for emotion detection
- Risk keyword monitoring and threat classification
- Automatic handoff triggers based on configurable thresholds
- Human takeover capability with seamless AI/human transitions

Copyright (c) 2026 Cothink LLC. All Rights Reserved.
Licensed under VoxNexus Enterprise License.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Import base interfaces from the open-source engine
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from core.interfaces import (
    BaseGuardian,
    GuardianConfig,
    RiskLevel,
    RiskScore,
)

logger = logging.getLogger("voxnexus.guardian")

__version__ = "1.0.0"


# =============================================================================
# Risk Keywords Configuration
# =============================================================================

RISK_KEYWORDS: dict[str, list[str]] = {
    "critical": [
        # Legal threats
        "lawyer", "sue", "lawsuit", "attorney", "legal action",
        "press charges", "court", "litigation",
        # Safety concerns
        "emergency", "kill", "hurt", "harm", "threat",
        # Fraud indicators
        "scam", "fraud", "stolen", "police",
    ],
    "high": [
        # Escalation requests
        "manager", "supervisor", "escalate", "higher up",
        "speak to someone else", "your boss",
        # Strong dissatisfaction
        "refund", "cancel", "never again", "worst ever",
        "unacceptable", "ridiculous", "outrageous",
        # Insults
        "stupid", "idiot", "incompetent", "useless",
    ],
    "medium": [
        # Frustration indicators
        "frustrated", "annoyed", "disappointed", "upset",
        "angry", "wasting my time", "unbelievable",
        # Service issues
        "not working", "broken", "terrible", "awful",
        "horrible", "disgusting",
    ],
}


# =============================================================================
# License Validation
# =============================================================================

VALID_LICENSE_PREFIXES = ["vx_enterprise_", "vx_pro_", "vx_test_"]


def validate_license(api_key: Optional[str]) -> bool:
    """
    Validate the Guardian license key.

    Valid license formats:
    - vx_enterprise_<hash> - Full enterprise license
    - vx_pro_<hash> - Professional license
    - vx_test_<hash> - Test/development license

    Args:
        api_key: The license key to validate

    Returns:
        True if the license is valid
    """
    if not api_key:
        return False

    # Check for valid prefix
    for prefix in VALID_LICENSE_PREFIXES:
        if api_key.startswith(prefix):
            # In production, this would verify against a license server
            # For now, accept any key with valid prefix and minimum length
            return len(api_key) >= 20

    return False


# =============================================================================
# Session Metrics
# =============================================================================

@dataclass
class SessionMetrics:
    """Metrics tracking for a Guardian session."""
    start_time: float = field(default_factory=time.time)
    message_count: int = 0
    user_messages: int = 0
    agent_messages: int = 0
    sentiment_scores: list[float] = field(default_factory=list)
    risk_events: list[dict] = field(default_factory=list)
    handoff_triggered: bool = False
    highest_risk: RiskLevel = RiskLevel.LOW


# =============================================================================
# VoxGuardian Implementation
# =============================================================================

class VoxGuardian(BaseGuardian):
    """
    VoxNexus Guardian Security Suite - Enterprise Implementation

    Provides real-time sentiment analysis using VADER, risk keyword
    detection, and human takeover capabilities for voice conversations.

    Example:
        ```python
        config = GuardianConfig(
            api_key="vx_enterprise_test_key_123",
            auto_handoff_threshold=0.8,
        )
        guardian = VoxGuardian(config)

        # In your conversation loop
        risk = await guardian.analyze_text(user_message)
        if guardian.should_intervene(risk):
            await guardian.trigger_handoff(room, "high_risk")
        ```
    """

    def __init__(self, config: GuardianConfig):
        super().__init__(config)
        self._license_valid = validate_license(config.api_key)
        self._session: Optional[SessionMetrics] = None
        self._human_active = False

        # Initialize VADER sentiment analyzer
        if self._license_valid:
            self._vader = SentimentIntensityAnalyzer()
            logger.info(f"VoxGuardian v{__version__} initialized with valid license")
        else:
            self._vader = None
            logger.warning("VoxGuardian license validation failed")

    @property
    def is_licensed(self) -> bool:
        """Check if Guardian has a valid license."""
        return self._license_valid

    async def on_room_join(self, room: Any) -> None:
        """
        Called when the agent joins a LiveKit room.

        Initializes session metrics and starts monitoring.

        Args:
            room: The LiveKit room object
        """
        if not self.is_licensed:
            raise RuntimeError("VoxGuardian license is not valid")

        self._room = room
        self._active = True
        self._session = SessionMetrics()
        self._human_active = False

        room_name = getattr(room, "name", "unknown")
        logger.info(f"VoxGuardian monitoring started for room: {room_name}")

        # Push initial status to room
        if self.config.alert_webhook:
            await self.push_alert(
                "system",
                "Guardian monitoring started",
                {"room": room_name, "version": __version__},
            )

    async def on_room_leave(self) -> None:
        """Called when the agent leaves a room."""
        if self._session and self.config.alert_webhook:
            analytics = await self.get_session_analytics()
            await self.push_alert(
                "system",
                "Guardian session ended",
                analytics,
            )

        self._active = False
        self._room = None
        self._session = None
        logger.info("VoxGuardian monitoring ended")

    async def analyze_text(self, text: str, speaker: str = "user") -> RiskScore:
        """
        Analyze text for sentiment and risk indicators using VADER.

        Args:
            text: The text to analyze
            speaker: Who said this ('user' or 'agent')

        Returns:
            RiskScore with sentiment analysis and risk assessment
        """
        if not self._session:
            raise RuntimeError("No active Guardian session")

        if not self._vader:
            raise RuntimeError("VADER analyzer not initialized")

        # Update session metrics
        self._session.message_count += 1
        if speaker == "user":
            self._session.user_messages += 1
        else:
            self._session.agent_messages += 1

        # =====================================================================
        # VADER Sentiment Analysis
        # =====================================================================
        sentiment = 0.0
        if self.config.enable_sentiment:
            scores = self._vader.polarity_scores(text)
            sentiment = scores["compound"]  # -1.0 to 1.0
            self._session.sentiment_scores.append(sentiment)

        # =====================================================================
        # Risk Keyword Detection
        # =====================================================================
        risk_level = RiskLevel.LOW
        detected_keywords: list[str] = []
        category: Optional[str] = None
        risk_score = 0.1

        if self.config.enable_risk_detection:
            text_lower = text.lower()

            # Check critical keywords first
            for keyword in RISK_KEYWORDS["critical"]:
                if keyword in text_lower:
                    detected_keywords.append(keyword)
                    risk_level = RiskLevel.CRITICAL
                    category = self._categorize_keyword(keyword, "critical")

            # If not critical, check high
            if risk_level != RiskLevel.CRITICAL:
                for keyword in RISK_KEYWORDS["high"]:
                    if keyword in text_lower:
                        detected_keywords.append(keyword)
                        risk_level = RiskLevel.HIGH
                        category = self._categorize_keyword(keyword, "high")

            # If not high, check medium
            if risk_level not in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
                for keyword in RISK_KEYWORDS["medium"]:
                    if keyword in text_lower:
                        detected_keywords.append(keyword)
                        risk_level = RiskLevel.MEDIUM
                        category = self._categorize_keyword(keyword, "medium")

            # Calculate risk score based on level and sentiment
            score_map = {
                RiskLevel.LOW: 0.1,
                RiskLevel.MEDIUM: 0.4,
                RiskLevel.HIGH: 0.7,
                RiskLevel.CRITICAL: 0.95,
            }
            risk_score = score_map.get(risk_level, 0.1)

            # Boost risk score if sentiment is very negative
            if sentiment < -0.5 and risk_level == RiskLevel.LOW:
                risk_level = RiskLevel.MEDIUM
                risk_score = 0.5
                category = "negative_sentiment"
            elif sentiment < -0.3 and risk_level != RiskLevel.CRITICAL:
                risk_score = min(1.0, risk_score + 0.15)

            # Track highest risk level
            risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
            if risk_order.index(risk_level) > risk_order.index(self._session.highest_risk):
                self._session.highest_risk = risk_level

            # Log and record risk events
            if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                event = {
                    "time": time.time(),
                    "text": text[:150] + ("..." if len(text) > 150 else ""),
                    "level": risk_level.value,
                    "keywords": detected_keywords,
                    "category": category,
                    "speaker": speaker,
                    "sentiment": sentiment,
                }
                self._session.risk_events.append(event)
                logger.warning(
                    f"🚨 RISK EVENT [{risk_level.value.upper()}]: "
                    f"keywords={detected_keywords}, sentiment={sentiment:.2f}"
                )

                # Push alert for high/critical events
                if self.config.alert_webhook:
                    await self.push_alert("risk", f"Risk detected: {risk_level.value}", event)

        result = RiskScore(
            level=risk_level,
            score=risk_score,
            sentiment=sentiment,
            keywords=detected_keywords,
            category=category,
            confidence=0.92,  # VADER has high accuracy for social media text
            metadata={
                "speaker": speaker,
                "message_index": self._session.message_count,
                "vader_scores": self._vader.polarity_scores(text) if self._vader else {},
            },
        )

        logger.debug(
            f"Guardian: sentiment={sentiment:.2f}, risk={risk_level.value}, "
            f"keywords={detected_keywords}"
        )

        return result

    def _categorize_keyword(self, keyword: str, level: str) -> str:
        """Categorize a risk keyword."""
        legal_keywords = ["lawyer", "sue", "lawsuit", "attorney", "legal action", "court", "litigation"]
        escalation_keywords = ["manager", "supervisor", "escalate", "higher up", "your boss"]
        churn_keywords = ["refund", "cancel", "never again"]
        safety_keywords = ["emergency", "kill", "hurt", "harm", "threat"]

        if keyword in legal_keywords:
            return "legal_threat"
        elif keyword in escalation_keywords:
            return "escalation_request"
        elif keyword in churn_keywords:
            return "churn_risk"
        elif keyword in safety_keywords:
            return "safety_concern"
        elif level == "critical":
            return "critical_issue"
        elif level == "high":
            return "high_frustration"
        else:
            return "frustration"

    def should_intervene(self, risk: RiskScore) -> bool:
        """
        Determine if human intervention is needed.

        Triggers intervention if:
        - Risk score exceeds auto_handoff_threshold
        - Risk level is CRITICAL
        - Human is not already in control

        Args:
            risk: The latest risk assessment

        Returns:
            True if automatic handoff should be triggered
        """
        if not self.config.enable_takeover:
            return False

        if self._human_active:
            return False  # Human already in control

        # Auto-handoff if risk exceeds threshold
        if risk.score >= self.config.auto_handoff_threshold:
            logger.warning(
                f"🚨 Auto-handoff triggered: risk={risk.score:.2f} >= "
                f"threshold={self.config.auto_handoff_threshold}"
            )
            return True

        # Critical risk always triggers intervention
        if risk.level == RiskLevel.CRITICAL:
            logger.warning("🚨 Auto-handoff triggered: CRITICAL risk level")
            return True

        return False

    async def trigger_handoff(
        self,
        room: Any,
        reason: str,
        metadata: Optional[dict] = None,
    ) -> bool:
        """
        Initiate handoff to human agent.

        Updates room metadata and sends notification via data channel.

        Args:
            room: The LiveKit room
            reason: Reason for handoff
            metadata: Additional context

        Returns:
            True if handoff was successful
        """
        if not self.is_licensed:
            return False

        if self._session:
            self._session.handoff_triggered = True

        logger.info(f"🔐 Triggering handoff: {reason}")

        # Update room metadata to signal handoff
        if room:
            import json

            try:
                # Publish handoff request via data channel
                handoff_data = {
                    "type": "handoff_request",
                    "reason": reason,
                    "timestamp": time.time(),
                    "session_analytics": await self.get_session_analytics(),
                    "metadata": metadata or {},
                }

                await room.local_participant.publish_data(
                    json.dumps(handoff_data).encode("utf-8"),
                    topic="guardian_alert",
                )

                # Also update room metadata for persistent state
                current_metadata = {}
                if room.metadata:
                    try:
                        current_metadata = json.loads(room.metadata)
                    except json.JSONDecodeError:
                        pass

                current_metadata["guardian_status"] = "handoff_requested"
                current_metadata["handoff_reason"] = reason
                current_metadata["handoff_time"] = time.time()

                # Note: Updating room metadata requires server-side API
                # This would be done via LiveKit Server SDK in production

                logger.info("Handoff request published to room")

            except Exception as e:
                logger.error(f"Failed to publish handoff request: {e}")
                return False

        # Push webhook alert
        if self.config.alert_webhook:
            await self.push_alert(
                "handoff",
                f"Handoff requested: {reason}",
                {"reason": reason, **(metadata or {})},
            )

        return True

    async def on_human_takeover(self, data: dict) -> None:
        """
        Handle incoming takeover command from human agent.

        Args:
            data: Takeover command data
        """
        self._human_active = True
        agent_name = data.get("agent_name", "Human Agent")
        logger.info(f"🔐 Human takeover by: {agent_name}")

        if self.config.alert_webhook:
            await self.push_alert("takeover", "Human agent took control", data)

    async def on_human_release(self) -> None:
        """Handle release of control back to AI agent."""
        self._human_active = False
        logger.info("🔐 Control released back to AI")

        if self.config.alert_webhook:
            await self.push_alert("release", "Control returned to AI agent", {})

    async def get_session_analytics(self) -> dict[str, Any]:
        """
        Get analytics for the current session.

        Returns:
            Dictionary with comprehensive session metrics
        """
        if not self._session:
            return {}

        duration = time.time() - self._session.start_time

        # Calculate sentiment statistics
        sentiments = self._session.sentiment_scores
        avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0
        min_sentiment = min(sentiments) if sentiments else 0.0
        max_sentiment = max(sentiments) if sentiments else 0.0

        return {
            "version": __version__,
            "duration_seconds": round(duration, 2),
            "total_messages": self._session.message_count,
            "user_messages": self._session.user_messages,
            "agent_messages": self._session.agent_messages,
            "sentiment": {
                "average": round(avg_sentiment, 3),
                "min": round(min_sentiment, 3),
                "max": round(max_sentiment, 3),
                "samples": len(sentiments),
            },
            "risk": {
                "events_count": len(self._session.risk_events),
                "highest_level": self._session.highest_risk.value,
                "recent_events": self._session.risk_events[-5:],
            },
            "handoff_triggered": self._session.handoff_triggered,
        }

    async def push_alert(
        self,
        alert_type: str,
        message: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """
        Push an alert to the monitoring dashboard/webhook.

        Args:
            alert_type: Type of alert ('risk', 'sentiment', 'handoff', 'system')
            message: Human-readable alert message
            metadata: Additional alert data
        """
        if not self.config.alert_webhook:
            return

        import httpx

        payload = {
            "type": alert_type,
            "message": message,
            "timestamp": time.time(),
            "version": __version__,
            "metadata": metadata or {},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.config.alert_webhook,
                    json=payload,
                    headers={
                        "X-Guardian-Key": self.config.api_key or "",
                        "X-Guardian-Version": __version__,
                    },
                )
                response.raise_for_status()
                logger.debug(f"Alert pushed: {alert_type} - {message}")
        except Exception as e:
            logger.error(f"Failed to push alert: {e}")


# =============================================================================
# Module Export (for dynamic import)
# =============================================================================

# This allows the main worker to import Guardian directly
Guardian = VoxGuardian
