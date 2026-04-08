#!/bin/bash
# Setup script for hipBLASLt backend (with rocroller support for Wave kernels)

set -e

echo "Installing hipBLASLt backend dependencies..."

ROCM_LIBRARIES_REPO="${ROCM_LIBRARIES_REPO:-https://github.com/suryajasper/rocm-libraries.git}"
ROCM_LIBRARIES_BRANCH="${ROCM_LIBRARIES_BRANCH:-wave-mxfp4-testing}"

# Normalize repo to full URL if a short "owner/repo" form was passed
if [[ "$ROCM_LIBRARIES_REPO" != https://* ]]; then
    ROCM_LIBRARIES_REPO="https://github.com/${ROCM_LIBRARIES_REPO}.git"
fi

# GPU_ARCH must be provided by setup.sh
if [[ -z "$GPU_ARCH" ]]; then
    echo "Error: GPU_ARCH environment variable not set"
    echo "This script should be called from setup.sh with --gpu-arch specified"
    exit 1
fi

echo "Building hipBLASLt from source..."
echo "Repository: $ROCM_LIBRARIES_REPO"
echo "Branch: $ROCM_LIBRARIES_BRANCH"
echo "GPU Architecture: $GPU_ARCH"

# Create build directory
BUILD_DIR="/workspace"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Full recursive clone (rocroller requires submodules)
# Skip if already cloned (supports multiple backends sharing the same rocm-libraries)
if [ -d "rocm-libraries" ]; then
    echo "rocm-libraries already exists, skipping clone (reusing existing build)"
    cd rocm-libraries/projects/hipblaslt
else
    echo "Cloning ROCm libraries with rocroller support..."
    git clone --recursive -b "${ROCM_LIBRARIES_BRANCH}" "${ROCM_LIBRARIES_REPO}" rocm-libraries
    cd rocm-libraries/projects/hipblaslt
fi

# Install Python Requirements for Tensile
if [ -f "tensilelite/requirements.txt" ]; then
    echo "Installing Tensile requirements..."
    pip install -r tensilelite/requirements.txt
fi

echo "Configuring hipBLASLt with rocroller (this may take a while)..."
cmake \
    -DCMAKE_INSTALL_PREFIX=${PWD}/install \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    -DCMAKE_CXX_COMPILER=/opt/rocm/bin/amdclang++ \
    -DCMAKE_C_COMPILER=/opt/rocm/bin/amdclang \
    -DCMAKE_PREFIX_PATH=/opt/rocm \
    -S . \
    -B ./build/ \
    -G Ninja \
    -DGPU_TARGETS=$GPU_ARCH \
    -DHIPBLASLT_ENABLE_BLIS=0 \
    -DPython3_EXECUTABLE=$(which python) \
    -DHIPBLASLT_BUILD_SHARED_LIBS=1 \
    -DHIPBLASLT_ENABLE_CLIENT=1 \
    -DHIPBLASLT_ENABLE_DEVICE=1 \
    -DHIPBLASLT_ENABLE_HOST=1 \
    -DHIPBLASLT_ENABLE_ROCROLLER=1

echo "Building hipblaslt-bench..."
ninja -C ./build/ hipblaslt-bench

echo "ROCm libraries source preserved in: $BUILD_DIR/rocm-libraries"
echo "Note: PATH and LD_LIBRARY_PATH will be set in Dockerfile ENV"

echo "hipBLASLt backend setup complete!"
