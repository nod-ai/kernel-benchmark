#!/bin/bash

# Script to run benchmarks in a Docker container
# Usage: ./docker/run_bench.sh --image <image_tag> --machine <machine> --backends <selected_backend> --kernel-types <selected_kernel> --problems-url <problems_url> [--tuned-configs-url <tuned_config_url>] -o <output_dir>

set -e

# Default values
IMAGE=""
MACHINE=""
BACKENDS="all"
KERNEL_TYPES="all"
PROBLEMS_URL=""
TUNED_CONFIGS_URL=""
OUTPUT_DIR=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            IMAGE="$2"
            shift 2
            ;;
        --machine)
            MACHINE="$2"
            shift 2
            ;;
        --backends)
            BACKENDS="$2"
            shift 2
            ;;
        --kernel-types)
            KERNEL_TYPES="$2"
            shift 2
            ;;
        --problems-url)
            PROBLEMS_URL="$2"
            shift 2
            ;;
        --tuned-configs-url)
            TUNED_CONFIGS_URL="$2"
            shift 2
            ;;
        -o)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --image <image_tag> --machine <machine> --backends <selected_backend> --kernel-types <selected_kernel> --problems-url <problems_url> [--tuned-configs-url <tuned_config_url>] -o <output_dir>"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$IMAGE" ]; then
    echo "Error: --image is required"
    exit 1
fi

if [ -z "$MACHINE" ]; then
    echo "Error: --machine is required"
    exit 1
fi

if [ -z "$PROBLEMS_URL" ]; then
    echo "Error: --problems-url is required"
    exit 1
fi

if [ -z "$OUTPUT_DIR" ]; then
    echo "Error: -o (output directory) is required"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Get absolute path for output directory
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd)

echo "=========================================="
echo "Benchmark Configuration"
echo "=========================================="
echo "Image:        $IMAGE"
echo "Machine:      $MACHINE"
echo "Backends:     $BACKENDS"
echo "Kernel Types: $KERNEL_TYPES"
echo "Problems URL: $PROBLEMS_URL"
if [ -n "$TUNED_CONFIGS_URL" ]; then
    echo "Tuned Configs: $TUNED_CONFIGS_URL"
fi
echo "Output Dir:   $OUTPUT_DIR"
echo "=========================================="
echo ""

# Build the docker run command
DOCKER_CMD="docker run --rm \
    --device=/dev/kfd \
    --device=/dev/dri \
    --ipc=host \
    --group-add video \
    --cap-add=SYS_PTRACE \
    --security-opt seccomp=unconfined \
    -e WAVE_CACHE_ON=0 \
    -v \"$OUTPUT_DIR:/data\" \
    -w /workspace/benchmark \
    $IMAGE \
    bash -c '"

# Build the bash command to run inside container
BASH_CMD="set -e && "

# Download problems
echo "Step 1: Downloading problems from URL..."
BASH_CMD+="curl -o /data/problems.json \"$PROBLEMS_URL\" && "
BASH_CMD+="python -m json.tool /data/problems.json > /dev/null || { echo 'Error: Invalid JSON format in problems.json'; exit 1; } && "

# Download tuned configs if provided
if [ -n "$TUNED_CONFIGS_URL" ]; then
    echo "Step 2: Downloading tuned configurations from URL..."
    BASH_CMD+="curl -o /data/tuned_config.json \"$TUNED_CONFIGS_URL\" && "
    BASH_CMD+="python -m json.tool /data/tuned_config.json > /dev/null || { echo 'Error: Invalid JSON format in tuned_config.json'; exit 1; } && "
    TUNED_ARG="--use_tuned=/data/tuned_config.json"
else
    echo "Step 2: Skipping tuned configurations (none provided)..."
    TUNED_ARG=""
fi

# Run benchmarks
echo "Step 3: Running benchmarks..."
BASH_CMD+="python3 -m kernel_bench.cli.bench \
    --backend=$BACKENDS \
    --kernel_type=$KERNEL_TYPES \
    --load_problems=/data/problems.json \
    $TUNED_ARG \
    --machine=${MACHINE}x && "

# Copy results to output directory
echo "Step 4: Copying results to output directory..."
BASH_CMD+="mkdir -p /data/results && "
BASH_CMD+="if [ -d results/json ]; then cp -r results/json/* /data/results/ 2>/dev/null || true; fi && "
BASH_CMD+="echo 'Benchmark completed successfully!'"

# Close the bash -c command
DOCKER_CMD+="$BASH_CMD'\""

# Execute the command
echo ""
echo "Executing benchmark..."
echo "=========================================="
eval $DOCKER_CMD

# Check if results were generated
if [ -d "$OUTPUT_DIR/results" ] && [ "$(ls -A "$OUTPUT_DIR/results" 2>/dev/null)" ]; then
    echo ""
    echo "=========================================="
    echo "Benchmark completed successfully!"
    echo "Results saved to: $OUTPUT_DIR/results"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "Warning: No results found in output directory"
    echo "=========================================="
    exit 1
fi
