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
        WAVE_ROOT="$(pwd)"

        LLVM_SHA_FILE="$WAVE_ROOT/water/llvm-sha.txt"
        if [[ -f "$LLVM_SHA_FILE" ]]; then
            DEFAULT_LLVM_COMMIT=$(cat "$LLVM_SHA_FILE" | tr -d '[:space:]')
            echo "Read LLVM commit from water/llvm-sha.txt: $DEFAULT_LLVM_COMMIT"
        else
            DEFAULT_LLVM_COMMIT="d783723a584a1cab30c3a92ca247abb3401fc6da"
            echo "Warning: water/llvm-sha.txt not found, using fallback LLVM commit"
        fi
        LLVM_COMMIT="${WAVEASM_LLVM_COMMIT:-$DEFAULT_LLVM_COMMIT}"
        WAVEASM_OK=0

        # Build LLVM + WaveASM in a subshell; track success via a marker file
        # (bash disables set -e inside subshells used in conditionals, so we
        #  use an explicit exit trap instead)
        WAVEASM_MARKER="/tmp/.waveasm_build_ok"
        rm -f "$WAVEASM_MARKER"

        (
            set -e

            # Step 1: Clone LLVM (sparse checkout for speed)
            echo "Cloning LLVM (sparse checkout, commit $LLVM_COMMIT)..."
            git clone --filter=blob:none --no-checkout https://github.com/llvm/llvm-project.git
            cd llvm-project
            git sparse-checkout init --cone
            git sparse-checkout set llvm mlir cmake clang lld third-party
            git checkout "$LLVM_COMMIT"

            # Step 2: Build LLVM with MLIR, clang, and lld (needed for WaveASM)
            echo "Building LLVM with MLIR support (this will take a while)..."
            LLVM_INSTALL_DIR="$(pwd)/install"
            mkdir -p build && cd build
            cmake -GNinja ../llvm \
                -DLLVM_ENABLE_PROJECTS="mlir;clang;lld" \
                -DLLVM_TARGETS_TO_BUILD="host;AMDGPU" \
                -DCMAKE_BUILD_TYPE=Release \
                -DCMAKE_INSTALL_PREFIX="$LLVM_INSTALL_DIR" \
                -DLLVM_ENABLE_ASSERTIONS=ON \
                -DLLVM_INCLUDE_TESTS=OFF \
                -DLLVM_INCLUDE_BENCHMARKS=OFF \
                -DLLVM_INCLUDE_EXAMPLES=OFF \
                -DLLVM_INCLUDE_DOCS=OFF \
                -DMLIR_INCLUDE_TESTS=OFF
            ninja -j$(nproc)
            echo "Installing LLVM to $LLVM_INSTALL_DIR..."
            ninja install
            echo "LLVM build and install complete: $LLVM_INSTALL_DIR"

            # Step 3: Build WaveASM against the installed LLVM
            cd "$WAVE_ROOT/waveasm"
            echo "Building WaveASM..."
            # MLIR cmake config may be under lib/ or lib64/ depending on platform
            if [[ -d "$LLVM_INSTALL_DIR/lib64/cmake/mlir" ]]; then
                MLIR_CMAKE_DIR="$LLVM_INSTALL_DIR/lib64/cmake/mlir"
            elif [[ -d "$LLVM_INSTALL_DIR/lib/cmake/mlir" ]]; then
                MLIR_CMAKE_DIR="$LLVM_INSTALL_DIR/lib/cmake/mlir"
            else
                echo "ERROR: Could not find MLIRConfig.cmake in install dir"
                find "$LLVM_INSTALL_DIR" -name "MLIRConfig.cmake" 2>/dev/null || true
                exit 1
            fi
            echo "Using MLIR cmake dir: $MLIR_CMAKE_DIR"
            cmake -GNinja -Bbuild -S . \
                -DMLIR_DIR="$MLIR_CMAKE_DIR"
            cmake --build build --target check-waveasm -j"$(nproc)"

            WAT_BIN="$WAVE_ROOT/waveasm/build/bin/waveasm-translate"
            if [[ ! -x "$WAT_BIN" ]]; then
                echo "waveasm-translate not at $WAT_BIN; searching build tree..."
                _found="$(find "$WAVE_ROOT/waveasm/build" -name waveasm-translate -type f 2>/dev/null | head -1 || true)"
                if [[ -n "$_found" && -x "$_found" ]]; then
                    mkdir -p "$WAVE_ROOT/waveasm/build/bin"
                    cp -f "$_found" "$WAT_BIN"
                    chmod +x "$WAT_BIN"
                    echo "Staged waveasm-translate into build/bin from $_found"
                else
                    echo "ERROR: waveasm-translate missing after build (WaveASM unusable)."
                    find "$WAVE_ROOT/waveasm/build" -maxdepth 4 -type f 2>/dev/null | head -50 || true
                    exit 1
                fi
            fi
            echo "WaveASM build complete ($WAT_BIN)."

            # Signal success only if the tool exists (pip checks WAVE_WAVEASM_DIR/bin/waveasm-translate)
            touch "$WAVEASM_MARKER"
        ) 2>&1 || true

        cd "$WAVE_ROOT"

        # Unset WAVE_BUILD_WAVEASM so pip install doesn't try to build WaveASM itself
        unset WAVE_BUILD_WAVEASM

        if [[ -f "$WAVEASM_MARKER" ]]; then
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
