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

    if [[ -n "$WAVE_BUILD_WAVEASM" ]]; then
        echo "Building WaveASM with LLVM from source..."
        LLVM_COMMIT="${WAVEASM_LLVM_COMMIT:-d783723a584a1cab30c3a92ca247abb3401fc6da}"
        WAVE_ROOT="$(pwd)"
        WAVEASM_OK=0

        (
            set -e

            # Step 1: Clone LLVM (sparse checkout for speed)
            echo "Cloning LLVM (sparse checkout, commit $LLVM_COMMIT)..."
            git clone --filter=blob:none --no-checkout https://github.com/llvm/llvm-project.git
            cd llvm-project
            git sparse-checkout init --cone
            git sparse-checkout set llvm mlir cmake clang lld third-party
            git checkout "$LLVM_COMMIT"

            # Step 2: Build LLVM with MLIR, Clang, LLD
            echo "Building LLVM with MLIR support (this will take a while)..."
            mkdir -p build && cd build
            cmake -GNinja ../llvm \
                -DLLVM_ENABLE_PROJECTS="mlir;clang;lld" \
                -DLLVM_TARGETS_TO_BUILD="host;AMDGPU" \
                -DCMAKE_BUILD_TYPE=Release \
                -DLLVM_ENABLE_ASSERTIONS=ON \
                -DLLVM_INCLUDE_TESTS=OFF \
                -DLLVM_INCLUDE_BENCHMARKS=OFF \
                -DLLVM_INCLUDE_EXAMPLES=OFF \
                -DLLVM_INCLUDE_DOCS=OFF \
                -DMLIR_INCLUDE_TESTS=OFF
            ninja
            LLVM_BUILD_DIR="$(pwd)"
            echo "LLVM build complete: $LLVM_BUILD_DIR"

            # Step 3: Build WaveASM against the LLVM build
            cd "$WAVE_ROOT/waveasm"
            echo "Building WaveASM..."
            cmake -GNinja -Bbuild -S . \
                -DMLIR_DIR="$LLVM_BUILD_DIR/lib/cmake/mlir"
            cmake --build build
            echo "WaveASM build complete."
        ) && WAVEASM_OK=1

        cd "$WAVE_ROOT"

        if [[ "$WAVEASM_OK" -eq 1 ]]; then
            echo "Installing Wave with WaveASM support..."
            WAVE_WAVEASM_DIR="$WAVE_ROOT/waveasm/build" pip install -e .
            echo "Wave installed with WaveASM support."
        else
            echo "WARNING: WaveASM build failed. Installing Wave without WaveASM..."
            pip install -e .
            echo "Wave installed (without WaveASM)."
        fi
    else
        pip install -e .
    fi
    cd ..
else
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

    echo "Cloning wave repository..."
    if [[ -d "wave" ]]; then
        echo "Removing existing wave directory..."
        rm -rf wave
    fi

    git clone "https://github.com/iree-org/wave.git"
    cd wave
    git checkout main

    echo "Installing wave dependencies..."
    pip install -r requirements-iree-pinned.txt
    pip install -e .
    cd ..
fi

echo "Wave backend setup complete!"
