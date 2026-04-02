# Syntax allowing for build arguments before FROM
ARG BASE_IMAGE=rocm/pytorch:rocm7.1.1_ubuntu24.04_py3.12_pytorch_release_2.8.0
ARG WAVE_REPO=iree-org/wave
ARG WAVE_BRANCH=main
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
    libblas-dev \
    liblapack-dev \
    # Build tools
    make \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install rocprof-trace-decoder for ROCm profiling (extract to /root to match bench_utils.py path)
RUN ROCPROF_VERSION="0.1.6" && \
    ROCPROF_DEB="rocprof-trace-decoder-ubuntu-22.04-${ROCPROF_VERSION}-Linux.deb" && \
    ROCPROF_EXTRACT_DIR="rocprof-trace-decoder-ubuntu-22.04-${ROCPROF_VERSION}-Linux" && \
    ROCPROF_URL="https://github.com/ROCm/rocprof-trace-decoder/releases/download/${ROCPROF_VERSION}/${ROCPROF_DEB}" && \
    echo "Downloading rocprof-trace-decoder ${ROCPROF_VERSION}..." && \
    wget -q "$ROCPROF_URL" -O "/tmp/${ROCPROF_DEB}" && \
    echo "Extracting to /root/${ROCPROF_EXTRACT_DIR}/..." && \
    mkdir -p "/root/${ROCPROF_EXTRACT_DIR}" && \
    dpkg -x "/tmp/${ROCPROF_DEB}" "/root/${ROCPROF_EXTRACT_DIR}" && \
    rm -f "/tmp/${ROCPROF_DEB}" && \
    echo "Successfully extracted rocprof-trace-decoder ${ROCPROF_VERSION}" && \
    ls -la "/root/${ROCPROF_EXTRACT_DIR}/opt/rocm/lib/" 2>/dev/null || echo "Warning: rocprof library not found"

# ============================================================================
# Stage 2: Setup iree-kernel-benchmark with Backend Selection
# ============================================================================
FROM base AS setup

# Pass build args to this stage
ARG WAVE_REPO
ARG WAVE_BRANCH
ARG BACKENDS
ARG GPU_ARCH
ARG ROCM_LIBRARIES_REPO
ARG ROCM_LIBRARIES_BRANCH
ARG BACKEND_SPECS_URL

# Optional rocroller fork (setup_hipblaslt.sh reads these; empty leaves script defaults)
ENV ROCM_LIBRARIES_REPO=${ROCM_LIBRARIES_REPO}
ENV ROCM_LIBRARIES_BRANCH=${ROCM_LIBRARIES_BRANCH}

# Copy the repository files
COPY . /workspace
WORKDIR /workspace

# Download backend specs JSON if URL is provided (for per-backend wave repo/branch overrides)
RUN if [ -n "$BACKEND_SPECS_URL" ]; then \
        curl -sL "$BACKEND_SPECS_URL" -o /workspace/backend_specs.json && \
        echo "Downloaded backend specs to /workspace/backend_specs.json"; \
    fi

# Install Rust for wave compilation (if needed and wave backend is requested)
RUN if echo "$BACKENDS" | grep -qE '(^|,)(all|wave|wave_[^,]*)(,|$)'; then \
        echo "Installing Rust for Wave backend..."; \
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; \
    else \
        echo "Skipping Rust installation (wave backend not selected)"; \
    fi
ENV PATH="/root/.cargo/bin:${PATH}"

# Validate GPU_ARCH is provided when needed
RUN BACKENDS_VAR="${BACKENDS:-all}"; \
    if [ "$BACKENDS_VAR" = "all" ] || echo "$BACKENDS_VAR" | grep -qE '(^|,)(hipblaslt|wave_4wave_rocroller|wave_8wave_rocroller)(,|$)'; then \
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
RUN SETUP_CMD="bash setup.sh"; \
    if [ -n "$BACKENDS" ]; then \
        SETUP_CMD="$SETUP_CMD --backends=$BACKENDS"; \
    fi; \
    # Always include Wave repo/branch if Wave backend is selected (using defaults if not overridden)
    if echo "$BACKENDS" | grep -qE '(^|,)(all|wave|wave_[^,]*)(,|$)'; then \
        SETUP_CMD="$SETUP_CMD --wave-repo $WAVE_REPO --wave-branch $WAVE_BRANCH"; \
    fi; \
    if [ -n "$GPU_ARCH" ]; then \
        SETUP_CMD="$SETUP_CMD --gpu-arch $GPU_ARCH"; \
    fi; \
    if [ -f "/workspace/backend_specs.json" ]; then \
        SETUP_CMD="$SETUP_CMD --backend-specs-file /workspace/backend_specs.json"; \
    fi; \
    SETUP_CMD="$SETUP_CMD --strict"; \
    echo "Running: $SETUP_CMD"; \
    eval "$SETUP_CMD"

# Install standalone compilation scripts for wave rocroller backends
# Copy to all wave installation directories (per-variant and default)
RUN for wave_dir in /workspace/wave /workspace/wave-*; do \
        if [ -d "$wave_dir/wave_lang/kernel/wave/perf" ]; then \
            cp /workspace/scripts/benchmark_mxfp4_4wave.py \
               "$wave_dir/wave_lang/kernel/wave/perf/benchmark_mxfp4_4wave.py" 2>/dev/null && \
            echo "Installed 4-wave script in $wave_dir"; \
            cp /workspace/scripts/benchmark_mxfp4_8wave.py \
               "$wave_dir/wave_lang/kernel/wave/perf/benchmark_mxfp4_8wave.py" 2>/dev/null && \
            echo "Installed 8-wave script in $wave_dir"; \
        fi; \
    done

# Set environment variables for backends
ENV PATH="/workspace/rocm-libraries/projects/hipblaslt/build/clients:/opt/rocm/llvm/bin:${PATH}"
ENV WAVE_CACHE_ON=0

CMD ["/bin/bash"]