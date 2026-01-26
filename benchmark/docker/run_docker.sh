#!/bin/bash

# Script to build and run the kernel-bench Docker container interactively
# Usage: ./docker/run_docker.sh --machine <MACHINE> [--backends <backends>] [--wave-repo <repo>] [--wave-branch <branch>]

set -e

# Default values
IMAGE_TAG="kernel-bench:latest"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build the Docker image using build_docker.sh
"$SCRIPT_DIR/build_docker.sh" "$@" -t "$IMAGE_TAG"

# Run the container with required device access
echo ""
echo "Starting Docker container interactively..."
docker run -it \
    --device=/dev/kfd \
    --device=/dev/dri \
    --ipc=host \
    --group-add video \
    --cap-add=SYS_PTRACE \
    --security-opt seccomp=unconfined \
    -e WAVE_CACHE_ON=0 \
    -w /workspace/benchmark \
    "$IMAGE_TAG" \
    /bin/bash
