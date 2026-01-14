#!/bin/bash
# =============================================================================
# VoxNexus Voice Cloning - Model Downloader
# =============================================================================
# Downloads OpenVoice V2 checkpoints from HuggingFace
#
# Usage:
#   ./scripts/download_models.sh
#
# Models downloaded:
#   - OpenVoice V2 Converter (tone color conversion) - 131MB
#   - Base Speaker Embedding (English default) - ~2KB
#   - MeloTTS English (for TTS generation) - 207MB
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHECKPOINT_DIR="$PROJECT_ROOT/apps/cloning-node/checkpoints"

echo "============================================="
echo "VoxNexus Voice Cloning - Model Downloader"
echo "============================================="
echo ""
echo "Checkpoint directory: $CHECKPOINT_DIR"
echo ""

# Create checkpoint directories
mkdir -p "$CHECKPOINT_DIR/converter"
mkdir -p "$CHECKPOINT_DIR/base_speakers/EN/melo"

# =============================================================================
# Download OpenVoice V2 Converter
# =============================================================================
echo "[1/4] Downloading OpenVoice V2 Converter (~131MB)..."
cd "$CHECKPOINT_DIR/converter"

if [ ! -f "checkpoint.pth" ] || [ $(stat -c%s "checkpoint.pth" 2>/dev/null || echo 0) -lt 1000000 ]; then
    echo "  -> checkpoint.pth"
    curl -L -o checkpoint.pth "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/checkpoint.pth?download=true"
else
    echo "  -> checkpoint.pth (already exists, $(du -h checkpoint.pth | cut -f1))"
fi

if [ ! -f "config.json" ] || [ $(stat -c%s "config.json" 2>/dev/null || echo 0) -lt 100 ]; then
    echo "  -> config.json"
    curl -L -o config.json "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/config.json?download=true"
else
    echo "  -> config.json (already exists)"
fi

# =============================================================================
# Download Base Speaker Embedding (English Default)
# =============================================================================
echo ""
echo "[2/4] Downloading Base Speaker Embedding (English)..."
cd "$CHECKPOINT_DIR/base_speakers/EN"

if [ ! -f "en_default_se.pth" ] || [ $(stat -c%s "en_default_se.pth" 2>/dev/null || echo 0) -lt 1000 ]; then
    echo "  -> en_default_se.pth (speaker embedding)"
    curl -L -o en_default_se.pth "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/base_speakers/ses/en-default.pth?download=true"
else
    echo "  -> en_default_se.pth (already exists)"
fi

if [ ! -f "en_style_se.pth" ] || [ $(stat -c%s "en_style_se.pth" 2>/dev/null || echo 0) -lt 1000 ]; then
    echo "  -> en_style_se.pth (US accent embedding)"
    curl -L -o en_style_se.pth "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/base_speakers/ses/en-us.pth?download=true"
else
    echo "  -> en_style_se.pth (already exists)"
fi

# =============================================================================
# Download MeloTTS English Model (for base speech generation)
# =============================================================================
echo ""
echo "[3/4] Downloading MeloTTS English Model (~207MB)..."
cd "$CHECKPOINT_DIR/base_speakers/EN/melo"

if [ ! -f "checkpoint.pth" ] || [ $(stat -c%s "checkpoint.pth" 2>/dev/null || echo 0) -lt 100000000 ]; then
    echo "  -> checkpoint.pth (MeloTTS model)"
    curl -L -o checkpoint.pth "https://huggingface.co/myshell-ai/MeloTTS-English/resolve/main/checkpoint.pth?download=true"
else
    echo "  -> checkpoint.pth (already exists, $(du -h checkpoint.pth | cut -f1))"
fi

if [ ! -f "config.json" ] || [ $(stat -c%s "config.json" 2>/dev/null || echo 0) -lt 100 ]; then
    echo "  -> config.json"
    curl -L -o config.json "https://huggingface.co/myshell-ai/MeloTTS-English/resolve/main/config.json?download=true"
else
    echo "  -> config.json (already exists)"
fi

# =============================================================================
# Verify Downloads
# =============================================================================
echo ""
echo "[4/4] Verifying downloads..."

verify_file() {
    local file="$1"
    local min_size="$2"
    local name=$(basename "$file")

    if [ -f "$file" ]; then
        local size=$(stat -c%s "$file" 2>/dev/null || echo 0)
        local human_size=$(du -h "$file" | cut -f1)
        if [ "$size" -ge "$min_size" ]; then
            echo "  ✓ $name ($human_size)"
            return 0
        else
            echo "  ✗ $name - TOO SMALL ($human_size, expected >$min_size bytes)"
            return 1
        fi
    else
        echo "  ✗ $name - MISSING!"
        return 1
    fi
}

ALL_PRESENT=true

verify_file "$CHECKPOINT_DIR/converter/checkpoint.pth" 100000000 || ALL_PRESENT=false
verify_file "$CHECKPOINT_DIR/converter/config.json" 100 || ALL_PRESENT=false
verify_file "$CHECKPOINT_DIR/base_speakers/EN/en_default_se.pth" 1000 || ALL_PRESENT=false
verify_file "$CHECKPOINT_DIR/base_speakers/EN/en_style_se.pth" 1000 || ALL_PRESENT=false
verify_file "$CHECKPOINT_DIR/base_speakers/EN/melo/checkpoint.pth" 100000000 || ALL_PRESENT=false
verify_file "$CHECKPOINT_DIR/base_speakers/EN/melo/config.json" 100 || ALL_PRESENT=false

echo ""
if [ "$ALL_PRESENT" = true ]; then
    echo "============================================="
    echo "✅ All models downloaded successfully!"
    echo "============================================="
    echo ""
    echo "Total size:"
    du -sh "$CHECKPOINT_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Rebuild container: docker compose build cloning-node"
    echo "  2. Start service: docker compose up -d cloning-node"
    echo "  3. Test: curl http://localhost:8002/health"
else
    echo "============================================="
    echo "❌ Some models are missing or corrupted!"
    echo "============================================="
    echo ""
    echo "Try running this script again, or manually download from:"
    echo "  - https://huggingface.co/myshell-ai/OpenVoiceV2"
    echo "  - https://huggingface.co/myshell-ai/MeloTTS-English"
    exit 1
fi
