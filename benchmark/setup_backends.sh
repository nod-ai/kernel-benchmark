#!/bin/bash

# Backend-aware setup script for iree-kernel-benchmark
# Usage: ./setup_backends.sh [--backends=BACKEND1,BACKEND2,...] [--wave-repo REPO] [--wave-branch BRANCH] [--venv-path PATH] [--gpu-arch ARCH]
# Behavior: If --venv-path is not provided, installs into the current Python environment.

set -e

# Default values
VENV_PATH=""
USE_VENV=false
WAVE_REPO=""
WAVE_BRANCH=""
INSTALL_FROM_SOURCE=false
BACKENDS="all"  # Default to all backends
GPU_ARCH="${GPU_ARCH:-}"  # No default, required for hipblaslt/all backends

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backends=*)
            BACKENDS="${1#*=}"
            shift
            ;;
        --backends)
            BACKENDS="$2"
            shift 2
            ;;
        --wave-repo)
            WAVE_REPO="$2"
            shift 2
            ;;
        --wave-branch)
            WAVE_BRANCH="$2"
            shift 2
            ;;
        --venv-path)
            VENV_PATH="$2"
            USE_VENV=true
            shift 2
            ;;
        --gpu-arch|--gpu_arch)
            GPU_ARCH="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backends BACKENDS    Comma-separated list of backends to install"
            echo "                         Available: wave, torch, triton, iree, hipblaslt"
            echo "                         Default: all"
            echo "  --wave-repo REPO       Wave repository to clone (e.g., iree-org/wave)"
            echo "  --wave-branch BRANCH   Wave branch to checkout"
            echo "  --venv-path PATH       Path for Python virtual environment; if omitted,"
            echo "                         installs into the existing Python environment."
            echo "  --gpu-arch ARCH        GPU architecture for hipBLASLt (REQUIRED for hipblaslt/all)"
            echo "                         Examples: gfx950, gfx942, gfx90a, gfx950;gfx942"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --backends=torch,triton  # No GPU_ARCH needed"
            echo "  $0 --backends=wave --wave-repo=iree-org/wave --wave-branch=main"
            echo "  $0 --backends=hipblaslt --gpu-arch gfx942  # GPU_ARCH required"
            echo "  $0 --backends=all --gpu-arch gfx950  # GPU_ARCH required for all"
            echo "  $0 --backends=triton,iree  # No GPU_ARCH needed"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Validate wave repo and branch arguments
if [[ -n "$WAVE_REPO" && -z "$WAVE_BRANCH" ]] || [[ -z "$WAVE_REPO" && -n "$WAVE_BRANCH" ]]; then
    echo "Error: Both --wave-repo and --wave-branch must be provided together."
    echo "Use --help for usage information."
    exit 1
fi

if [[ -n "$WAVE_REPO" && -n "$WAVE_BRANCH" ]]; then
    INSTALL_FROM_SOURCE=true
fi

echo "Setting up iree-kernel-benchmark environment..."
echo ""



if [[ "$USE_VENV" == "true" ]]; then
    echo "Virtual environment path: $VENV_PATH"
else
    echo "No --venv-path provided. Installing into the current Python environment."
fi
echo ""

# Parse backends
if [[ "$BACKENDS" == "all" ]]; then
    BACKEND_LIST=("wave" "torch" "triton" "iree" "hipblaslt")
    echo "Installing all backends: ${BACKEND_LIST[*]}"
else
    IFS=',' read -ra BACKEND_LIST <<< "$BACKENDS"
    echo "Installing selected backends: ${BACKEND_LIST[*]}"
fi
echo ""

# Validate GPU_ARCH is provided when hipBLASLt is in the backend list
REQUIRES_GPU_ARCH=false
if [[ "$BACKENDS" == "all" ]]; then
    REQUIRES_GPU_ARCH=true
else
    for backend in "${BACKEND_LIST[@]}"; do
        if [[ "$backend" == "hipblaslt" ]]; then
            REQUIRES_GPU_ARCH=true
            break
        fi
    done
fi

if [[ "$REQUIRES_GPU_ARCH" == "true" && -z "$GPU_ARCH" ]]; then
    echo "Error: --gpu-arch is required when installing hipBLASLt backend or all backends."
    echo ""
    echo "Please specify the GPU architecture for your target hardware:"
    echo "  --gpu-arch gfx950    # For MI325X"
    echo "  --gpu-arch gfx942    # For MI300X/A"
    echo "  --gpu-arch gfx90a    # For MI250X/A"
    echo ""
    echo "Example: $0 --backends=hipblaslt --gpu-arch gfx950"
    echo "Use --help for more information."
    exit 1
fi

# Export GPU_ARCH so backend scripts can access it
if [[ -n "$GPU_ARCH" ]]; then
    export GPU_ARCH
    echo "GPU Architecture: $GPU_ARCH"
fi

# Create and activate virtual environment only if requested
if [[ "$USE_VENV" == "true" ]]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_PATH"
    # shellcheck disable=SC1091
    source "$VENV_PATH/bin/activate"
fi

# Upgrade pip
echo "Upgrading pip..."
pip install --no-cache-dir --upgrade pip setuptools wheel pyyaml

# Install core project requirements (backend-agnostic dependencies)
echo "Installing core project requirements..."
pip install -r requirements.txt

if [[ -d "aiter" ]]; then
    echo "Removing existing aiter directory..."
    rm -rf aiter
fi

git clone --recursive https://github.com/ROCm/aiter.git
cd aiter
python setup.py develop
cd ..

echo ""
echo "================================"
echo "Installing Backend Dependencies"
echo "================================"
echo ""

# Track which backends succeeded/failed
declare -a SUCCESSFUL_BACKENDS=()
declare -a FAILED_BACKENDS=()

# Install each backend
for backend in "${BACKEND_LIST[@]}"; do
    backend=$(echo "$backend" | xargs)  # Trim whitespace
    
    echo "-----------------------------------"
    echo "Installing backend: $backend"
    echo "-----------------------------------"
    
    case "$backend" in
        wave)
            if [[ ! -f "backends/setup_wave.sh" ]]; then
                echo "Error: setup_wave.sh not found in backends/"
                FAILED_BACKENDS+=("$backend")
                continue
            fi
            
            if [[ "$INSTALL_FROM_SOURCE" == "true" ]]; then
                if bash backends/setup_wave.sh "$WAVE_REPO" "$WAVE_BRANCH"; then
                    SUCCESSFUL_BACKENDS+=("$backend")
                else
                    echo "Warning: Failed to install $backend backend"
                    FAILED_BACKENDS+=("$backend")
                fi
            else
                if bash backends/setup_wave.sh; then
                    SUCCESSFUL_BACKENDS+=("$backend")
                else
                    echo "Warning: Failed to install $backend backend"
                    FAILED_BACKENDS+=("$backend")
                fi
            fi
            ;;
            
        torch)
            if [[ ! -f "backends/setup_torch.sh" ]]; then
                echo "Error: setup_torch.sh not found in backends/"
                FAILED_BACKENDS+=("$backend")
                continue
            fi
            
            if bash backends/setup_torch.sh; then
                SUCCESSFUL_BACKENDS+=("$backend")
            else
                echo "Warning: Failed to install $backend backend"
                FAILED_BACKENDS+=("$backend")
            fi
            ;;
            
        triton)
            if [[ ! -f "backends/setup_triton.sh" ]]; then
                echo "Error: setup_triton.sh not found in backends/"
                FAILED_BACKENDS+=("$backend")
                continue
            fi
            
            if bash backends/setup_triton.sh; then
                SUCCESSFUL_BACKENDS+=("$backend")
            else
                echo "Warning: Failed to install $backend backend"
                FAILED_BACKENDS+=("$backend")
            fi
            ;;
            
        iree)
            if [[ ! -f "backends/setup_iree.sh" ]]; then
                echo "Error: setup_iree.sh not found in backends/"
                FAILED_BACKENDS+=("$backend")
                continue
            fi
            
            if bash backends/setup_iree.sh; then
                SUCCESSFUL_BACKENDS+=("$backend")
            else
                echo "Warning: Failed to install $backend backend"
                FAILED_BACKENDS+=("$backend")
            fi
            ;;
            
        hipblaslt)
            if [[ ! -f "backends/setup_hipblaslt.sh" ]]; then
                echo "Error: setup_hipblaslt.sh not found in backends/"
                FAILED_BACKENDS+=("$backend")
                continue
            fi
            
            if bash backends/setup_hipblaslt.sh; then
                SUCCESSFUL_BACKENDS+=("$backend")
            else
                echo "Warning: Failed to install $backend backend"
                FAILED_BACKENDS+=("$backend")
            fi
            ;;
            
        *)
            echo "Error: Unknown backend '$backend'"
            echo "Available backends: wave, torch, triton, iree, hipblaslt"
            FAILED_BACKENDS+=("$backend")
            ;;
    esac
    
    echo ""
done

echo ""
echo "================================"
echo "Setup Summary"
echo "================================"
echo ""

if [[ ${#SUCCESSFUL_BACKENDS[@]} -gt 0 ]]; then
    echo "✓ Successfully installed backends:"
    for backend in "${SUCCESSFUL_BACKENDS[@]}"; do
        echo "  - $backend"
    done
    echo ""
fi

if [[ ${#FAILED_BACKENDS[@]} -gt 0 ]]; then
    echo "✗ Failed to install backends:"
    for backend in "${FAILED_BACKENDS[@]}"; do
        echo "  - $backend"
    done
    echo ""
    echo "Note: Benchmarks will skip backends that failed to install."
fi

echo "Setup complete!"
echo ""

if [[ "$USE_VENV" == "true" ]]; then
    echo "To activate the environment, run:"
    echo "  source $VENV_PATH/bin/activate"
    echo ""
fi

echo "To run benchmarks, use:"
echo "  python3 -m kernel_bench.cli.bench --backend=all --kernel_type=all --max_kernels=50 --machine=mi325x"
echo ""

if [[ ${#FAILED_BACKENDS[@]} -gt 0 ]]; then
    echo "Warning: Some backends failed to install. The benchmark suite will automatically skip these backends."
    exit 0  # Don't fail the entire setup if some backends fail
fi
