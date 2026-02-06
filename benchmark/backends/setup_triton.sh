#!/bin/bash
# Setup script for Triton (aiter) backend

set -e

echo "Installing Triton backend dependencies..."

# Install Triton from pip (base dependency)
if ! python -c "import triton" &> /dev/null; then
    echo "Installing triton from pip..."
    pip install triton
fi

# Install ROCm's aiter (Triton fork)
if [[ -d "aiter" ]]; then
    echo "Removing existing aiter directory..."
    rm -rf aiter
fi

git clone https://github.com/ROCm/aiter.git && \
    cd aiter && \
    git checkout cf29be372d2ecd20102cc22b74a64d75f0c99512 && \
    git submodule sync && \
    git submodule update --init --recursive && \
    python setup.py develop

echo "Triton (aiter) backend setup complete!"
