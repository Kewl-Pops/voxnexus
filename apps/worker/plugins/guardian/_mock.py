"""
VoxNexus Guardian Security Suite - Mock Template
=================================================

This is a TEMPLATE/MOCK implementation of the Guardian Security Suite.
Use this as a starting point to develop the proprietary Guardian module.

IMPORTANT: This file should NOT be committed to the public repository.
The actual implementation lives in the private `voxnexus-guardian` package.

To use this mock for local development:
1. Copy this file to your local voxnexus_guardian package
2. Implement the actual logic (VADER, risk keywords, etc.)
3. Add license validation

Copyright (c) 2026 Cothink LLC. All Rights Reserved.
This code is proprietary and confidential.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

# Import the base interface from the open-source engine
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from core.interfaces import (
    BaseGuardian,
    GuardianConfig,
    RiskLevel,
    RiskScore,
)

logger = logging.getLogger("voxnexus.guardian")


# =============================================================================
# License Validation (Replace with real implementation)
# =============================================================================

def validate_license(api_key: Optional[str]) -> bool:
    """
    Validate the Guardian license key.

    TODO: Implement actual license validation:
    - Check against license server
    - Validate signature
    - Check expiration
    - Verify feature entitlements

    For now, accepts any non-empty key for development.
    """
    if not api_key:
        return False

    # Mock validation - replace with real implementation
    # Real implementation should:
    # 1. Decode JWT or license format
    # 2. Verify signature against public key
    # 3. Check expiration date
    # 4. Validate customer ID / domain
    return len(api_key) >= 32


# =============================================================================
# Risk Keywords (The "Secret Sauce")
# =============================================================================

# Base risk keywords - extend with domain-specific terms
RISK_KEYWORDS = {
    "critical": [
        "kill", "hurt", "harm", "lawsuit", "lawyer", "attorney",
        "sue", "legal action", "press charges", "police", "authorities",
    ],
    "high": [
        "furious", "outraged", "disgusted", "hate", "worst",
        "unacceptable", "ridiculous", "incompetent", "fraud", "scam",
        "refund", "cancel", "never again", "complaint", "report",
    ],
    "medium": [
        "frustrated", "annoyed", "disappointed", "upset", "angry",
        "terrible", "awful", "horrible", "unbelievable", "wasting my time",
        "speak to manager", "supervisor", "escalate",
    ],
}


# =============================================================================
# VADER Sentiment Analysis Stub
# =============================================================================

def analyze_sentiment_vader(text: str) -> float:
    """
    Analyze sentiment using VADER (Valence Aware Dictionary and sEntiment Reasoner).

    TODO: Install and use nltk.sentiment.vader:
        from nltk.sentiment.vader import SentimentIntensityAnalyzer
        sia = SentimentIntensityAnalyzer()
        scores = sia.polarity_scores(text)
        return scores['compound']  # -1.0 to 1.0

    For now, returns a simple mock based on keywords.
    """
    text_lower = text.lower()

    # Mock sentiment - replace with VADER
    positive_words = ["thank", "great", "excellent", "perfect", "wonderful", "happy", "pleased"]
    negative_words = ["bad", "terrible", "awful", "hate", "angry", "frustrated", "disappointed"]

    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)

    if pos_count + neg_count == 0:
        return 0.0

    return (pos_count - neg_count) / (pos_count + neg_count)


def detect_risk_keywords(text: str) -> tuple[RiskLevel, list[str], Optional[str]]:
    """
    Detect risk keywords in text.

    Returns:
        Tuple of (risk_level, matched_keywords, category)
    """
    text_lower = text.lower()
    matched = []
    category = None

    # Check critical first
    for keyword in RISK_KEYWORDS["critical"]:
        if keyword in text_lower:
            matched.append(keyword)
            category = "threat" if keyword in ["kill", "hurt", "harm"] else "legal"

    if matched:
        return RiskLevel.CRITICAL, matched, category

    # Check high
    for keyword in RISK_KEYWORDS["high"]:
        if keyword in text_lower:
            matched.append(keyword)
            category = "churn" if keyword in ["refund", "cancel", "never again"] else "escalation"

    if matched:
        return RiskLevel.HIGH, matched, category

    # Check medium
    for keyword in RISK_KEYWORDS["medium"]:
        if keyword in text_lower:
            matched.append(keyword)
            category = "frustration"

    if matched:
        return RiskLevel.MEDIUM, matched, category

    return RiskLevel.LOW, [], None


# =============================================================================
# Guardian Implementation
# =============================================================================

@dataclass
class SessionMetrics:
    """Metrics for a Guardian session."""
    start_time: float = field(default_factory=time.time)
    message_count: int = 0
    user_messages: int = 0
    agent_messages: int = 0
    sentiment_sum: float = 0.0
    risk_events: list[dict] = field(default_factory=list)
    handoff_triggered: bool = False


class Guardian(BaseGuardian):
    """
    Guardian Security Suite - Proprietary Implementation

    Provides real-time sentiment analysis, risk detection, and human
    takeover capabilities for VoxNexus voice conversations.

    This is the "herbs and spices" - the secret sauce that makes
    VoxNexus enterprise-ready.
    """

    def __init__(self, config: GuardianConfig):
        super().__init__(config)
        self._session: Optional[SessionMetrics] = None
        self._human_active = False
        self._license_valid = validate_license(config.api_key)

        if self._license_valid:
            logger.info("Guardian initialized with valid license")
        else:
            logger.warning("Guardian license validation failed")

    @property
    def is_licensed(self) -> bool:
        """Check if Guardian has a valid license."""
        return self._license_valid

    async def on_room_join(self, room: Any) -> None:
        """Called when the agent joins a LiveKit room."""
        if not self.is_licensed:
            raise RuntimeError("Guardian license invalid")

        self._room = room
        self._active = True
        self._session = SessionMetrics()
        self._human_active = False

        logger.info(f"Guardian monitoring started for room: {getattr(room, 'name', 'unknown')}")

        # Optionally push initial alert
        if self.config.alert_webhook:
            await self.push_alert(
                "system",
                "Guardian monitoring started",
                {"room": getattr(room, "name", "unknown")},
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
        logger.info("Guardian monitoring ended")

    async def analyze_text(self, text: str, speaker: str = "user") -> RiskScore:
        """Analyze text for sentiment and risk indicators."""
        if not self._session:
            raise RuntimeError("No active Guardian session")

        # Update session metrics
        self._session.message_count += 1
        if speaker == "user":
            self._session.user_messages += 1
        else:
            self._session.agent_messages += 1

        # Sentiment analysis
        sentiment = 0.0
        if self.config.enable_sentiment:
            sentiment = analyze_sentiment_vader(text)
            self._session.sentiment_sum += sentiment

        # Risk detection
        risk_level = RiskLevel.LOW
        keywords = []
        category = None
        risk_score = 0.0

        if self.config.enable_risk_detection:
            risk_level, keywords, category = detect_risk_keywords(text)

            # Convert risk level to score
            score_map = {
                RiskLevel.LOW: 0.1,
                RiskLevel.MEDIUM: 0.4,
                RiskLevel.HIGH: 0.7,
                RiskLevel.CRITICAL: 0.95,
            }
            risk_score = score_map.get(risk_level, 0.1)

            # Adjust score based on sentiment
            if sentiment < -0.5:
                risk_score = min(1.0, risk_score + 0.2)

            # Log risk events
            if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                event = {
                    "time": time.time(),
                    "text": text[:100],
                    "level": risk_level.value,
                    "keywords": keywords,
                    "category": category,
                    "speaker": speaker,
                }
                self._session.risk_events.append(event)
                logger.warning(f"🚨 Risk event: {risk_level.value} - {keywords}")

                # Push alert for high/critical
                if self.config.alert_webhook:
                    await self.push_alert(
                        "risk",
                        f"Risk detected: {risk_level.value}",
                        event,
                    )

        result = RiskScore(
            level=risk_level,
            score=risk_score,
            sentiment=sentiment,
            keywords=keywords,
            category=category,
            confidence=0.85,  # TODO: Calculate actual confidence
            metadata={
                "speaker": speaker,
                "message_index": self._session.message_count,
            },
        )

        logger.debug(f"Guardian analysis: sentiment={sentiment:.2f}, risk={risk_level.value}")
        return result

    def should_intervene(self, risk: RiskScore) -> bool:
        """Determine if human intervention is needed."""
        if not self.config.enable_takeover:
            return False

        if self._human_active:
            return False  # Human already in control

        # Auto-handoff if risk exceeds threshold
        if risk.score >= self.config.auto_handoff_threshold:
            logger.warning(f"🚨 Auto-handoff triggered: risk={risk.score:.2f}")
            return True

        # Critical risk always triggers
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
        """Initiate handoff to human agent."""
        if not self.is_licensed:
            return False

        if self._session:
            self._session.handoff_triggered = True

        logger.info(f"🔐 Triggering handoff: {reason}")

        # Notify via data channel
        if room:
            import json
            try:
                await room.local_participant.publish_data(
                    json.dumps({
                        "type": "handoff_request",
                        "reason": reason,
                        "metadata": metadata or {},
                        "session_analytics": await self.get_session_analytics(),
                    }).encode("utf-8"),
                    topic="guardian_alert",
                )
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
        """Handle incoming takeover command from human agent."""
        self._human_active = True
        logger.info(f"🔐 Human takeover: {data.get('agent_name', 'unknown')}")

        if self.config.alert_webhook:
            await self.push_alert(
                "takeover",
                "Human agent took control",
                data,
            )

    async def on_human_release(self) -> None:
        """Handle release of control back to AI agent."""
        self._human_active = False
        logger.info("🔐 Control released back to AI")

        if self.config.alert_webhook:
            await self.push_alert(
                "release",
                "Control returned to AI agent",
                {},
            )

    async def get_session_analytics(self) -> dict[str, Any]:
        """Get analytics for the current session."""
        if not self._session:
            return {}

        duration = time.time() - self._session.start_time
        avg_sentiment = (
            self._session.sentiment_sum / self._session.message_count
            if self._session.message_count > 0
            else 0.0
        )

        return {
            "duration_seconds": round(duration, 2),
            "total_messages": self._session.message_count,
            "user_messages": self._session.user_messages,
            "agent_messages": self._session.agent_messages,
            "average_sentiment": round(avg_sentiment, 3),
            "risk_events_count": len(self._session.risk_events),
            "risk_events": self._session.risk_events[-10:],  # Last 10
            "handoff_triggered": self._session.handoff_triggered,
        }

    async def push_alert(
        self,
        alert_type: str,
        message: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """Push an alert to the monitoring dashboard."""
        if not self.config.alert_webhook:
            return

        import httpx

        payload = {
            "type": alert_type,
            "message": message,
            "timestamp": time.time(),
            "metadata": metadata or {},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.config.alert_webhook,
                    json=payload,
                    headers={"X-Guardian-Key": self.config.api_key or ""},
                )
                response.raise_for_status()
                logger.debug(f"Alert pushed: {alert_type}")
        except Exception as e:
            logger.error(f"Failed to push alert: {e}")


# =============================================================================
# Package Export
# =============================================================================

# When this file is moved to voxnexus_guardian/__init__.py,
# uncomment the following:
#
# __all__ = ["Guardian", "GuardianConfig", "RiskScore", "RiskLevel"]
# __version__ = "1.0.0"
