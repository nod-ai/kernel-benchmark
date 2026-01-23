#!/bin/bash
# Setup script for hipBLASLt backend

set -e

echo "Installing hipBLASLt backend dependencies..."

# Configuration
ROCM_LIBRARIES_REPO="${ROCM_LIBRARIES_REPO:-https://github.com/ROCm/rocm-libraries.git}"
ROCM_LIBRARIES_BRANCH="${ROCM_LIBRARIES_BRANCH:-develop}"

# GPU_ARCH must be provided by setup.sh
if [[ -z "$GPU_ARCH" ]]; then
    echo "Error: GPU_ARCH environment variable not set"
    echo "This script should be called from setup.sh with --gpu-arch specified"
    exit 1
fi

# Check if hipBLASLt is already available
if python -c "import ctypes; ctypes.CDLL('/opt/rocm/lib/libhipblaslt.so')" &> /dev/null; then
    echo "hipBLASLt already installed in /opt/rocm/lib/"
    echo "Skipping build from source."
    echo "hipBLASLt backend setup complete!"
    exit 0
fi

echo "Building hipBLASLt from source..."
echo "Repository: $ROCM_LIBRARIES_REPO"
echo "Branch: $ROCM_LIBRARIES_BRANCH"
echo "GPU Architecture: $GPU_ARCH"

# Create build directory
BUILD_DIR=$(mktemp -d)
cd "$BUILD_DIR"

# Clone Monorepo with Sparse Checkout
echo "Cloning ROCm libraries monorepo (sparse checkout)..."
git clone --filter=blob:none --no-checkout -b "${ROCM_LIBRARIES_BRANCH}" "${ROCM_LIBRARIES_REPO}" rocm-libraries
cd rocm-libraries
git sparse-checkout init --cone
git sparse-checkout set projects/hipblaslt shared cmake
git checkout "${ROCM_LIBRARIES_BRANCH}"

cd projects/hipblaslt

# Install Python Requirements for Tensile
if [ -f "tensilelite/requirements.txt" ]; then
    echo "Installing Tensile requirements..."
    pip install -r tensilelite/requirements.txt
fi

# Build & Install hipBLASLt
echo "Building hipBLASLt..."
cmake -B build -S . \
    -D CMAKE_BUILD_TYPE=Release \
    -D CMAKE_CXX_COMPILER=/opt/rocm/llvm/bin/amdclang++ \
    -D CMAKE_C_COMPILER=/opt/rocm/llvm/bin/amdclang \
    -D CMAKE_PREFIX_PATH=/opt/rocm \
    -D GPU_TARGETS="${GPU_ARCH}" \
    -D BUILD_TESTING=OFF \
    -D HIPBLASLT_BUILD_TESTING=OFF \
    -D HIPBLASLT_ENABLE_CLIENT=OFF \
    -D TENSILELITE_LIBRARY_FORMAT=msgpack

echo "Installing hipBLASLt (this may take a while)..."
cmake --build build --parallel $(nproc)

# Clean up build directory
cd /
rm -rf "$BUILD_DIR"

echo "hipBLASLt backend setup complete!"
