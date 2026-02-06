#!/bin/bash
# Setup script for Triton (fav3_padded) branch

set -e

echo "Installing Triton backend dependencies..."

# Uninstall existing triton if present
if python -c "import triton" &> /dev/null; then
    echo "Uninstalling existing triton..."
    pip uninstall -y triton
fi

echo "Installing triton from source..."
cd /workspace
rm -rf triton
git clone https://github.com/ROCm/triton.git
cd triton
git checkout 45bff12

echo "Applying IglpOpt patch..."
if [ ! -f /workspace/backends/triton_iglpopt.patch ]; then
    echo "Error: triton_iglpopt.patch not found in /workspace/backends/"
    exit 1
fi
git apply /workspace/backends/triton_iglpopt.patch

echo "Applying MFMA F32 16x16x16 patch..."
if [ ! -f /workspace/backends/triton_mfma_f32_16x16x16.patch ]; then
    echo "Error: triton_mfma_f32_16x16x16.patch not found in /workspace/backends/"
    exit 1
fi
git apply /workspace/backends/triton_mfma_f32_16x16x16.patch

pip install -r python/requirements.txt # build-time dependencies
pip install -e .

echo "Triton (fav3_padded) backend setup complete!"
 