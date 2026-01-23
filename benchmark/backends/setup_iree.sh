#!/bin/bash
# Setup script for IREE backend

set -e

echo "Installing IREE backend dependencies..."

# Install IREE dependencies from pre-release links
echo "Installing IREE compiler and runtime..."
pip install --pre --no-cache-dir --find-links https://iree.dev/pip-release-links.html iree-base-compiler iree-base-runtime --upgrade

echo "IREE backend setup complete!"
