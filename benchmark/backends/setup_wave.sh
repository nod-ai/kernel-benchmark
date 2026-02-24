#!/bin/bash
# Setup script for Wave backend

set -e

echo "Installing Wave backend dependencies..."

WAVE_REPO=${1:-""}
WAVE_BRANCH=${2:-""}

if [[ -n "$WAVE_REPO" && -n "$WAVE_BRANCH" ]]; then
    echo "Installing wave from source..."
    echo "Wave repository: $WAVE_REPO"
    echo "Wave branch: $WAVE_BRANCH"
    
    # Check if Rust is installed, install if not
    echo "Checking for Rust installation..."
    if ! command -v rustc &> /dev/null; then
        echo "Rust not found. Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        # shellcheck disable=SC1091
        source "$HOME/.cargo/env"
        echo "Rust installed successfully."
    else
        echo "Rust is already installed."
    fi

    # Install wave from source
    echo "Cloning wave repository..."
    if [[ -d "wave" ]]; then
        echo "Removing existing wave directory..."
        rm -rf wave
    fi

    git clone "https://github.com/$WAVE_REPO.git"
    cd wave
    git checkout "$WAVE_BRANCH"

    echo "Installing wave dependencies..."
    pip install -r requirements-iree-pinned.txt
    pip install -e .
    cd ..
else
    git clone "https://github.com/iree-org/wave.git"
    cd wave
    git checkout main

    echo "Installing wave dependencies..."
    pip install -r requirements-iree-pinned.txt
    pip install -e .
    cd ..
fi

echo "Wave backend setup complete!"
