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

git clone --recursive https://github.com/ROCm/aiter.git
cd aiter
python setup.py develop
cd ..

echo "Triton (aiter) backend setup complete!"
