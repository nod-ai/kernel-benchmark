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

echo "Building hipBLASLt from source..."
echo "Repository: $ROCM_LIBRARIES_REPO"
echo "Branch: $ROCM_LIBRARIES_BRANCH"
echo "GPU Architecture: $GPU_ARCH"

# Create build directory
BUILD_DIR="/workspace"
mkdir -p "$BUILD_DIR"
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

echo "Installing hipBLASLt (this may take a while)..."
./install.sh -dc -a $GPU_ARCH

# Source code preserved in $BUILD_DIR for reference/debugging
echo "ROCm libraries source preserved in: $BUILD_DIR"
echo "Note: PATH will be set in Dockerfile ENV for persistent access"

echo "hipBLASLt backend setup complete!"
