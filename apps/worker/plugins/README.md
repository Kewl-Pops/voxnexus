# VoxNexus Plugin System

This directory contains plugin implementations for the VoxNexus voice agent platform.

## Open Source Plugins

The following plugins are included with the open-source VoxNexus engine:

- `llm/` - LLM provider plugins (OpenAI, Anthropic, Ollama)
- `stt/` - Speech-to-Text plugins (Deepgram, Whisper)
- `tts/` - Text-to-Speech plugins (Cartesia, ElevenLabs, OpenAI, Kokoro)

## Guardian Security Suite (Proprietary)

The **Guardian Security Suite** is a proprietary plugin that provides enterprise-grade
security features for voice conversations:

- **Real-Time Sentiment Analysis** - VADER + custom ML models
- **Risk Detection** - Keyword monitoring and threat classification
- **Human Takeover** - Live agent intervention capability
- **Live Dashboard** - Real-time monitoring and analytics

### Installation

Guardian is distributed as a separate Python package. To install:

```bash
# Contact sales@voxnexus.pro for license and access
pip install voxnexus-guardian --index-url https://pypi.voxnexus.pro/simple/
```

### Configuration

Set the following environment variables:

```bash
# Required - Your Guardian license key
GUARDIAN_KEY=your-license-key

# Optional - Configuration
GUARDIAN_HANDOFF_THRESHOLD=0.8    # Risk score that triggers auto-handoff (0.0-1.0)
GUARDIAN_ALERT_WEBHOOK=https://... # URL to POST alerts to
GUARDIAN_ENABLE_SENTIMENT=true     # Enable sentiment analysis
GUARDIAN_ENABLE_RISK=true          # Enable risk detection
GUARDIAN_ENABLE_TAKEOVER=true      # Enable human takeover
```

### How It Works

The VoxNexus engine automatically detects and loads Guardian at startup:

```
============================================================
VoxNexus Voice Agent Worker
============================================================
Available LLM providers: openai, anthropic, ollama
Available STT providers: deepgram, whisper
Available TTS providers: cartesia, elevenlabs, openai, kokoro
============================================================
🔐 GUARDIAN SECURITY SUITE: ACTIVE
   Real-time sentiment analysis: ENABLED
   Risk detection: ENABLED
   Human takeover: ENABLED
============================================================
```

Without Guardian installed, the engine runs in Open Source Mode:

```
🔓 Guardian Security Suite: NOT DETECTED
   Running in Open Source Mode
   Visit https://voxnexus.pro/guardian for enterprise features
```

### Developing Custom Plugins

To create a custom Guardian implementation, extend the `BaseGuardian` interface:

```python
from core.interfaces import BaseGuardian, GuardianConfig, RiskScore, RiskLevel

class MyGuardian(BaseGuardian):
    @property
    def is_licensed(self) -> bool:
        # Implement license validation
        return self._validate_license(self.config.api_key)

    async def analyze_text(self, text: str, speaker: str = "user") -> RiskScore:
        # Implement sentiment/risk analysis
        return RiskScore(
            level=RiskLevel.LOW,
            score=0.1,
            sentiment=0.5,
        )

    # ... implement other abstract methods
```

See `guardian/_mock.py` for a complete template implementation.

## Plugin Interface

All plugins implement abstract base classes defined in `core/interfaces.py`:

- `BaseLLM` - Large Language Model providers
- `BaseSTT` - Speech-to-Text providers
- `BaseTTS` - Text-to-Speech providers
- `BaseGuardian` - Security monitoring (proprietary)

## Questions?

- Open Source: https://github.com/voxnexus/voxnexus
- Enterprise: sales@voxnexus.pro
- Documentation: https://docs.voxnexus.pro
