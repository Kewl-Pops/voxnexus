# =============================================================================
# VoxNexus SIP Bridge - Dockerfile
# =============================================================================
# This builds PJSIP from source for Python bindings (pjsua2)
# Base: Python 3.11 on Debian Bookworm (slim)
# =============================================================================

FROM python:3.11-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libssl-dev \
    libasound2-dev \
    libopus-dev \
    libspeex-dev \
    libspeexdsp-dev \
    swig \
    python3-dev \
    wget \
    ca-certificates \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory for build
WORKDIR /build

# Clone PJPROJECT (specific stable version)
ARG PJSIP_VERSION=2.14.1
RUN git clone --depth 1 --branch ${PJSIP_VERSION} https://github.com/pjsip/pjproject.git

WORKDIR /build/pjproject

# Configure PJSIP (audio only, no video, no webrtc)
RUN ./configure \
    --enable-shared \
    --disable-video \
    --disable-libwebrtc \
    --disable-v4l2 \
    --disable-ffmpeg \
    --disable-openh264 \
    --disable-libyuv \
    --with-external-opus \
    --with-external-speex \
    CFLAGS="-fPIC" \
    CXXFLAGS="-fPIC"

# Build PJSIP
RUN make dep && make -j$(nproc)

# Install PJSIP
RUN make install

# Build Python bindings
WORKDIR /build/pjproject/pjsip-apps/src/swig
RUN make python

# Install Python bindings
WORKDIR /build/pjproject/pjsip-apps/src/swig/python
RUN python3 setup.py install

# =============================================================================
# Runtime Stage
# =============================================================================
FROM python:3.11-slim-bookworm

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2 \
    libopus0 \
    libspeex1 \
    libspeexdsp1 \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy PJSIP libraries from builder
COPY --from=builder /usr/local/lib/libpj*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libpjsua*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libpjnath*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libpjmedia*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libpjlib-util*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libpjsip*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libresample*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libsrtp*.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libwebrtc*.so* /usr/local/lib/

# Copy Python pjsua2 module
COPY --from=builder /usr/local/lib/python3.11/site-packages/pjsua2* /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/lib/python3.11/site-packages/_pjsua2* /usr/local/lib/python3.11/site-packages/

# Update library cache
RUN ldconfig

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8890/health')" || exit 1

# Expose ports
# 8890: HTTP API/Health
# 5060-5080: SIP UDP/TCP (range for multiple registrations)
EXPOSE 8890
EXPOSE 5060-5080/udp
EXPOSE 5060-5080/tcp

# Run the SIP bridge
CMD ["python", "main.py"]
