# Testing Guide for Backend Refactoring

This guide provides practical testing procedures based on the README.md examples and your backend changes.

## Table of Contents
1. [Test Individual Backend Setup Scripts](#1-test-individual-backend-setup-scripts)
2. [Test Docker Build with Backend Selection](#2-test-docker-build-with-backend-selection)
3. [Test Benchmarking with Each Backend](#3-test-benchmarking-with-each-backend)
4. [Test Import Guards](#4-test-import-guards)
5. [Test Multi-Backend Comparison](#5-test-multi-backend-comparison)
6. [Verify Setup Script Reports](#6-verify-setup-script-reports)
7. [Test Edge Cases](#7-test-edge-cases)
8. [Quick Smoke Test Script](#8-quick-smoke-test-script)

---

## 1. Test Individual Backend Setup Scripts

```bash
cd benchmark

# Create a virtual environment
python3 -m venv test_venv
source test_venv/bin/activate

# Test individual backends
./setup_backends.sh --backends=torch
./setup_backends.sh --backends=triton
./setup_backends.sh --backends=wave
./setup_backends.sh --backends=iree

# Test hipBLASLt (requires GPU_ARCH)
GPU_ARCH=gfx950 ./setup_backends.sh --backends=hipblaslt

# Test multiple backends
./setup_backends.sh --backends=torch,triton,wave
```

**Expected Results:**
- Each backend installs without errors
- Setup summary shows successful backends
- No ImportError when running benchmarks

---

## 2. Test Docker Build with Backend Selection

### Build with all backends (default)

```bash
# Test with all backends (default)
docker build --network=host \
  --build-arg GPU_ARCH=gfx950 \
  -t kernel-bench:test-all \
  -f docker/Dockerfile .

# Verify the container
docker run -it kernel-bench:test-all /bin/bash
# Inside container, check imports:
python3 -c "import torch; print('✓ torch')"
python3 -c "from wave_lang import *; print('✓ wave')"
python3 -c "import aiter; print('✓ triton/aiter')"
```

### Build with specific backends only

```bash
docker build --network=host \
  --build-arg BACKENDS=torch,wave \
  --build-arg GPU_ARCH=gfx950 \
  -t kernel-bench:test-minimal \
  -f docker/Dockerfile .

# Verify only selected backends are available
docker run -it kernel-bench:test-minimal python3 -c "
from kernel_bench.kernels.gemm import GEMM_BENCH
print('Available backends:', list(GEMM_BENCH['gemm'].keys()))
"
```

### Build with custom Wave source

```bash
docker build --network=host \
  --build-arg BACKENDS=wave,torch \
  --build-arg WAVE_REPO=iree-org/wave \
  --build-arg WAVE_BRANCH=main \
  -t kernel-bench:wave-custom \
  -f docker/Dockerfile .
```

**Expected Results:**
- Docker builds complete successfully
- Only specified backends are available in container
- Image size varies based on backend selection

---

## 3. Test Benchmarking with Each Backend

Based on the README.md examples:

### Test PyTorch backend

```bash
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend torch \
    --machine mi325x \
    --max_kernels 2
```

### Test Wave backend

```bash
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave \
    --machine mi325x \
    --max_kernels 2
```

### Test Triton backend

```bash
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend triton \
    --machine mi325x \
    --max_kernels 2
```

### Test IREE backend

```bash
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend iree \
    --machine mi325x \
    --max_kernels 2
```

### Test hipBLASLt backend

```bash
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend hipblaslt \
    --machine mi325x \
    --max_kernels 2
```

**Expected Results:**
- Each benchmark runs successfully
- Results saved to `results/csv/gemm/` and `results/json/gemm/`
- No ImportError for installed backends

---

## 4. Test Import Guards

Verify that missing backends don't break imports:

```bash
# Test that missing backends don't break imports
python3 -c "
from kernel_bench.kernels.gemm import (
    WaveGemmBenchmark,
    TritonGemmBenchmark,
    TorchGemmBenchmark,
    IreeGemmBenchmark,
    HipblasltGemmBenchmark
)
print('✓ All imports work even with missing backends')
"
```

**Expected Results:**
- No ImportError raised
- Missing backends return None
- System works with partial installations

---

## 5. Test Multi-Backend Comparison

Based on the README.md "Advanced Examples":

```bash
# Compare multiple backends
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave,torch,triton \
    --machine mi325x \
    --max_kernels 5
```

**Expected Results:**
- All specified backends run sequentially
- Separate result files for each backend
- Performance comparison possible

---

## 6. Verify Setup Script Reports

Test that the setup summary shows correct status:

```bash
# Should see success/failure summary at the end
./setup_backends.sh --backends=wave,torch,triton,iree,hipblaslt

# Expected output:
# ===================================
# Backend Setup Summary
# ===================================
# ✓ Successful: torch, triton, wave, iree, hipblaslt
# ✗ Failed: (none)
```

**Expected Results:**
- Summary shows all installed backends
- Failed backends (if any) are clearly listed
- Exit code indicates overall success/failure

---

## 7. Test Edge Cases

### Test with invalid backend

```bash
# Test with invalid backend
./setup_backends.sh --backends=invalid_backend
# Should gracefully fail and report
```

### Test with no backends specified

```bash
# Test with no backends specified
./setup_backends.sh --backends=
# Should show help or error
```

### Test Wave from source

```bash
./setup_backends.sh --backends=wave \
    --wave-repo=iree-org/wave \
    --wave-branch=main
```

**Expected Results:**
- Invalid backends are reported but don't crash
- Empty backend list shows appropriate message
- Custom Wave repository clones successfully

---

## 8. Quick Smoke Test Script

Create `test_backend_changes.sh`:

```bash
#!/bin/bash
# test_backend_changes.sh - Quick smoke test for backend changes

set -e

echo "=== Testing Backend Setup System ==="

# Test 1: Individual backend setup
echo "Test 1: PyTorch backend..."
./setup_backends.sh --backends=torch

# Test 2: Import guards
echo "Test 2: Import guards..."
python3 -c "from kernel_bench.kernels.gemm import TorchGemmBenchmark; print('✓ Imports work')"

# Test 3: Run minimal benchmark
echo "Test 3: Run minimal benchmark..."
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend torch \
    --machine mi325x \
    --max_kernels 1

echo "=== All tests passed! ==="
```

**Run the smoke test:**

```bash
cd benchmark
chmod +x test_backend_changes.sh
./test_backend_changes.sh
```

---

## Testing Checklist

Use this checklist to verify all functionality:

- [ ] Individual backend setup scripts work (`backends/setup_*.sh`)
- [ ] Main setup script works with `--backends` flag
- [ ] Docker builds with `BACKENDS` build arg
- [ ] Docker builds with `GPU_ARCH` for hipBLASLt
- [ ] Import guards prevent ImportError for missing backends
- [ ] Benchmarks run with each installed backend
- [ ] Multi-backend comparison works
- [ ] Setup summary reports correct status
- [ ] Invalid backends handled gracefully
- [ ] Wave can be installed from custom source
- [ ] hipBLASLt builds for specified GPU architecture

---

## Common Testing Scenarios

### Scenario 1: Minimal Installation (Torch only)

```bash
cd benchmark
python3 -m venv venv_minimal
source venv_minimal/bin/activate
./setup_backends.sh --backends=torch

python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend torch \
    --machine mi325x
```

### Scenario 2: Full Installation (All backends)

```bash
cd benchmark
python3 -m venv venv_full
source venv_full/bin/activate
GPU_ARCH=gfx950 ./setup_backends.sh

# Test each backend
for backend in torch triton wave iree hipblaslt; do
    echo "Testing $backend..."
    python -m kernel_bench.cli.bench \
        --kernel_type gemm \
        --backend $backend \
        --machine mi325x \
        --max_kernels 1
done
```

### Scenario 3: Docker Minimal Build

```bash
docker build --network=host \
  --build-arg BACKENDS=torch \
  -t kernel-bench:minimal \
  -f docker/Dockerfile .

docker run -it --device=/dev/kfd --device=/dev/dri \
  kernel-bench:minimal \
  python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend torch \
    --machine mi325x \
    --max_kernels 1
```

---

## Troubleshooting

**Problem**: `AttributeError: module 'aiter' has no attribute 'dtypes'`  
**Solution**: This was the original bug. Ensure `setup_triton.sh` has run completely - it creates the dtypes fix.

**Problem**: hipBLASLt setup fails  
**Solution**: Ensure `GPU_ARCH` environment variable is set (e.g., `GPU_ARCH=gfx950`)

**Problem**: Docker build fails with "GPU_ARCH required"  
**Solution**: Add `--build-arg GPU_ARCH=gfx950` to your docker build command

**Problem**: Import errors after partial installation  
**Solution**: This shouldn't happen with the new import guards. If it does, check that `_get_backend_classes()` is properly catching ImportError.

---

## Success Criteria

Your testing is successful if:

1. ✅ You can install any combination of backends
2. ✅ Missing backends don't cause ImportError
3. ✅ Docker builds work with backend selection
4. ✅ Benchmarks run on installed backends
5. ✅ Setup reports show clear status for each backend
6. ✅ GPU architecture can be specified for hipBLASLt

---

## Next Steps

After successful testing:

1. Run full benchmark suite on your target GPU
2. Compare performance with previous system
3. Update CI/CD workflows with new backend flags
4. Share updated documentation with team

For more details, see:
- `README.md` - Main documentation
- `backends/README.md` - Backend-specific setup details  
- `BACKEND_SETUP.md` - User guide for backend installation
