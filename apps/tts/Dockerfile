# =============================================================================
# VoxNexus TTS Service - Dockerfile
# =============================================================================
# Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
#
# Kokoro-82M Text-to-Speech Engine
# Base: Python 3.11 slim with CUDA support for GPU acceleration
# =============================================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    KOKORO_MODEL_DIR=/app/models \
    KOKORO_CACHE_DIR=/app/cache \
    TTS_PORT=8880 \
    TTS_HOST=0.0.0.0

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create directories for models and cache
RUN mkdir -p /app/models /app/cache

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Kokoro model weights during build
# This ensures the container works offline after build
RUN python -c "from kokoro import KPipeline; p = KPipeline(lang_code='a'); print('Model downloaded')" || true

# Copy application code
COPY main.py .

# Create non-root user for security
RUN useradd -m -u 1000 tts && \
    chown -R tts:tts /app
USER tts

# Expose port
EXPOSE 8880

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8880/health || exit 1

# Run the service
CMD ["python", "main.py"]
