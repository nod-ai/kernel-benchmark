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
git clone -b fav3_padded https://github.com/ROCm/triton
cd triton

# Comment out IglpOpt line in BlockPingpong.cpp
FILE_PATH="./third_party/amd/lib/TritonAMDGPUTransforms/BlockPingpong.cpp"
TARGET_LINE="prependOp(builder.create<ROCDL::IglpOpt>(loc, 10), true);"
if ! grep -qF "$TARGET_LINE" "$FILE_PATH"; then
    echo "Error: Target line not found in $FILE_PATH"
    echo "Expected: $TARGET_LINE"
    exit 1
fi
sed -i "\|$TARGET_LINE|s|^[[:space:]]*|&//|" "$FILE_PATH"

pip install -r python/requirements.txt # build-time dependencies
pip install -e .

echo "Triton (fav3_padded) backend setup complete!"
