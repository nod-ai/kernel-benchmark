#!/bin/bash

# Script to build the kernel-bench Docker container
# Usage: ./docker/build_docker.sh --machine <MACHINE> [--backends <backends>] [--wave-repo <repo>] [--wave-branch <branch>] [-t <tag>]

set -e

# Default values
MACHINE=""
GPU_ARCH=""
BACKENDS=""
WAVE_REPO=""
WAVE_BRANCH=""
IMAGE_TAG="kernel-bench:latest"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --machine)
            MACHINE="$2"
            shift 2
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
        -t)
            IMAGE_TAG="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --machine <MACHINE> [--backends <backends>] [--wave-repo <repo>] [--wave-branch <branch>] [-t <tag>]"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$MACHINE" ]; then
    echo "Error: --machine is required"
    echo "Usage: $0 --machine <MACHINE> [--backends <backends>] [--wave-repo <repo>] [--wave-branch <branch>] [-t <tag>]"
    exit 1
fi

# Convert machine name to GPU architecture
case "$MACHINE" in
    mi300)
        GPU_ARCH="gfx942"
        ;;
    mi325)
        GPU_ARCH="gfx942"
        ;;
    mi350)
        GPU_ARCH="gfx950"
        ;;
    mi355)
        GPU_ARCH="gfx950"
        ;;
    *)
        echo "Error: Unknown machine type '$MACHINE'"
        echo "Supported machines: mi300, mi325, mi350, mi355"
        exit 1
        ;;
esac

echo "Machine: $MACHINE -> GPU Architecture: $GPU_ARCH"

# Build docker command with build arguments
BUILD_CMD="docker build --network=host"
BUILD_CMD="$BUILD_CMD --build-arg GPU_ARCH=$GPU_ARCH"

if [ -n "$BACKENDS" ]; then
    BUILD_CMD="$BUILD_CMD --build-arg BACKENDS=$BACKENDS"
fi

if [ -n "$WAVE_REPO" ]; then
    BUILD_CMD="$BUILD_CMD --build-arg WAVE_REPO=$WAVE_REPO"
fi

if [ -n "$WAVE_BRANCH" ]; then
    BUILD_CMD="$BUILD_CMD --build-arg WAVE_BRANCH=$WAVE_BRANCH"
fi

BUILD_CMD="$BUILD_CMD -t $IMAGE_TAG -f docker/Dockerfile ."

# Print the build command for debugging
echo "Building Docker image with tag: $IMAGE_TAG"
echo "Command: $BUILD_CMD"
echo ""

# Execute the build command
eval $BUILD_CMD

echo ""
echo "Docker image built successfully: $IMAGE_TAG"
