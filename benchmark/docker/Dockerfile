# Syntax allowing for build arguments before FROM
ARG BASE_IMAGE=rocm/pytorch:rocm7.1.1_ubuntu24.04_py3.12_pytorch_release_2.8.0
ARG WAVE_REPO
ARG WAVE_BRANCH
ARG BACKENDS=all
ARG GPU_ARCH

# ============================================================================
# Stage 1: Base - System Dependencies
# ============================================================================
FROM ${BASE_IMAGE} AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV HIP_PLATFORM=amd

# Install essential build tools & python deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    cmake \
    ninja-build \
    gfortran \
    pkg-config \
    wget \
    curl \
    vim \
    ca-certificates \
    # Runtime deps for TheRock components (e.g. compression libs)
    zstd \
    libzstd-dev \
    # Common deps for hipBLASLt build
    libnuma1 \
    libmsgpack-dev \
    libboost-dev \
    libboost-program-options-dev \
    libboost-filesystem-dev \
    libdrm-dev \
    libgtest-dev \
    # Build tools
    make \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# Stage 2: Setup iree-kernel-benchmark with Backend Selection
# ============================================================================
FROM base AS setup

# Pass build args to this stage
ARG WAVE_REPO
ARG WAVE_BRANCH
ARG BACKENDS
ARG GPU_ARCH

# Copy the repository files
COPY . /workspace
WORKDIR /workspace/benchmark

# Install Rust for wave compilation (if needed and wave backend is requested)
RUN if echo "$BACKENDS" | grep -qE '(^|,)(all|wave)(,|$)'; then \
        echo "Installing Rust for Wave backend..."; \
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; \
    else \
        echo "Skipping Rust installation (wave backend not selected)"; \
    fi
ENV PATH="/root/.cargo/bin:${PATH}"

# Validate GPU_ARCH is provided when needed
RUN BACKENDS_VAR="${BACKENDS:-all}"; \
    if [ "$BACKENDS_VAR" = "all" ] || echo "$BACKENDS_VAR" | grep -qE '(^|,)hipblaslt(,|$)'; then \
        if [ -z "$GPU_ARCH" ]; then \
            echo "ERROR: --build-arg GPU_ARCH is required when building with hipBLASLt or all backends."; \
            echo ""; \
            echo "Please specify the GPU architecture for your target hardware:"; \
            echo "  --build-arg GPU_ARCH=gfx950    # For MI325X"; \
            echo "  --build-arg GPU_ARCH=gfx942    # For MI300X/A"; \
            echo "  --build-arg GPU_ARCH=gfx90a    # For MI250X/A"; \
            echo ""; \
            echo "Example: docker build --build-arg GPU_ARCH=gfx950 -t kernel-bench ."; \
            exit 1; \
        fi; \
    fi

# Run backend-aware setup script with conditional arguments based on build args
# Build the setup command dynamically based on provided arguments
RUN SETUP_CMD="bash setup_backends.sh"; \
    if [ -n "$BACKENDS" ]; then \
        SETUP_CMD="$SETUP_CMD --backends=$BACKENDS"; \
    fi; \
    if [ -n "$WAVE_REPO" ] && [ -n "$WAVE_BRANCH" ]; then \
        SETUP_CMD="$SETUP_CMD --wave-repo $WAVE_REPO --wave-branch $WAVE_BRANCH"; \
    fi; \
    if [ -n "$GPU_ARCH" ]; then \
        SETUP_CMD="$SETUP_CMD --gpu-arch $GPU_ARCH"; \
    fi; \
    echo "Running: $SETUP_CMD"; \
    eval "$SETUP_CMD" || echo "Warning: Some backends may have failed to install"

ENV WAVE_CACHE_ON=0

CMD ["/bin/bash"]