# Microkernel Benchmarking Infrastructure

A comprehensive benchmarking and tuning system for GPU kernels across multiple AMD codegen pipelines. This infrastructure provides automated performance evaluation, hyperparameter optimization, and comparative analysis for GEMM, attention, convolution, and other kernel types.

## Quick Start

### Docker Setup

```shell
# Build with all backends (default - GPU_ARCH required)
docker build --network=host \
  --build-arg GPU_ARCH=gfx950 \
  -t kernel-bench:v1 \
  -f docker/Dockerfile .

# Build with specific backends only (GPU_ARCH only required for hipblaslt)
docker build --network=host \
  --build-arg BACKENDS=hipblaslt \
  --build-arg GPU_ARCH=gfx950 \
  -t kernel-bench:minimal \
  -f docker/Dockerfile .

# Build with custom Wave source
docker build --network=host \
  --build-arg BACKENDS=wave \
  --build-arg WAVE_REPO=iree-org/wave \
  --build-arg WAVE_BRANCH=main \
  -t kernel-bench:wave-custom \
  -f docker/Dockerfile .

# Run the container
docker run -it --device=/dev/kfd --device=/dev/dri kernel-bench:v1 /bin/bash
```

### Basic Benchmarking

```shell
# Benchmark GEMM kernels with Wave backend
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave \
    --machine mi325x

# Benchmark attention kernels with IREE backend
python -m kernel_bench.cli.bench \
    --kernel_type attention \
    --backend iree \
    --machine mi325x

# Tune GEMM kernels for optimal performance
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave \
    --machine mi325x \
    --tune \
    --num_trials 100
```

## Architecture Overview

### Core Components

The benchmarking infrastructure is built around several key components that work together to provide comprehensive kernel evaluation:

#### 1. **Benchmark Registry System** (`kernel_bench/core/base.py`)
- **Purpose**: Centralized registry for all supported kernel types and backends
- **Key Classes**: 
  - `BENCHMARKS`: Maps kernel types to backend implementations
  - `CONFIG_CLASSES`: Maps kernel types to their configuration classes
  - `LOAD_PROBLEMS`: Maps kernel types to default problem generators

#### 2. **Abstract Benchmark Framework** (`kernel_bench/core/template.py`)
- **Base Classes**:
  - `KernelBenchmark`: Abstract base for all kernel implementations
  - `IREEKernelBenchmark`: Specialized for IREE-compiled kernels
  - `WaveKernelBenchmark`: Specialized for Wave-compiled kernels
- **Key Features**:
  - Unified interface for compilation, validation, and benchmarking
  - Automatic tuning parameter management
  - Constraint validation and optimization

#### 3. **Benchmark Runner** (`kernel_bench/core/runner.py`)
- **Purpose**: Orchestrates the complete benchmarking workflow
- **Capabilities**:
  - Parallel compilation across multiple CPUs
  - Multi-GPU benchmarking (supports up to 8 GPUs)
  - Automatic result saving to CSV and JSON
  - Numerical validation and error handling

#### 4. **Configuration System** (`kernel_bench/config/`)
- **Base Class**: `OpConfig` - Abstract configuration for all kernels
- **Required Methods**:
  - `get_name()`: Unique identifier for the configuration
  - `get_flops()`: Floating point operations count
  - `get_byte_count()`: Memory bandwidth requirements
- **Registry**: Centralized mapping of kernel types to configurations

### Supported Backends

#### **Wave** - AMD's GPU Kernel Generator
- **Specialization**: `WaveKernelBenchmark`
- **Compilation**: Direct Wave kernel compilation to VMFB
- **Tuning**: Advanced hyperparameter optimization with constraints

#### **IREE** - Machine Learning Compiler Infrastructure  
- **Specialization**: `IREEKernelBenchmark`
- **Compilation**: MLIR → VMFB compilation pipeline
- **Features**: Comprehensive profiling and trace generation

#### **Triton** - GPU Kernel Programming Language
- **Implementation**: Direct Triton kernel benchmarking using torch CUDA events

#### **PyTorch** - Deep Learning Framework
- **Implementation**: Native PyTorch operations benchmarked with torch CUDA events

#### **hipBLASLt** - High-Performance BLAS Library
- **Implementation**: `hipblaslt-bench` using latest rocm-libraries hipblaslt build
- **Note**: Requires GPU architecture specification for compilation

### Kernel Types

#### **GEMM (General Matrix Multiplication)**
- **Configurations**: Matrix dimensions (M, N, K), data types (f16, bf16, f8)
- **Backends**: Wave, IREE, Triton, PyTorch, hipBLASLt

#### **Attention Mechanisms**
- **Variants**: 
  - BMNK (Batch, Num_heads, seqlen_M, seqlen_N, head_K)
  - BSHD (Batch, Sequence, Head, Dimension)
  - Extended attention patterns
- **Backends**: Wave, IREE, Triton, PyTorch
- **Features**: Flash attention optimizations, causal masking

#### **Convolution Operations**
- **Configurations**: Input/output channels, kernel sizes, strides, padding
- **Backends**: Wave, IREE, PyTorch
- **Optimizations**: Winograd algorithms, im2col transformations

## Detailed Workflow

### 1. Configuration Loading and Validation

```python
# Load default problem set
configs = LOAD_PROBLEMS["gemm"]("gemm", "wave")

# Load custom problems from JSON
configs = load_configs("custom_problems.json", GemmConfig)

# Validate configurations for backend compatibility
valid_configs = [config for config in configs if validate_config(config, backend)]
```

### 2. Benchmark Creation and Compilation

```python
# Create benchmark instances
benches = [create_benchmark("gemm", "wave", config) for config in configs]

# Parallel compilation (IREE-based kernels)
compilation_results = batch_compile_iree_benches(
    iree_benches, 
    num_cpus=max(1, cpu_count() - 20)
)

# Wave kernel compilation
for wave_bench in wave_benches:
    wave_bench.compile_to_vmfb(mlir_path, vmfb_path)
```

### 3. Numerical Validation

```python
# Validate kernel correctness before benchmarking
validation_results = batch_validate(benches, device="hip")

# Isolated validation to prevent memory issues
validation_result = isolated_validate_numerics(bench, device)
```

### 4. Multi-GPU Benchmarking

```python
# Parallel execution across 8 GPUs
results = batch_benchmark(
    benches, 
    device="hip", 
    num_iterations=50,
    validate_numerics=True
)

# Round-robin GPU assignment
gpu_assignments = [bench_idx % 8 for bench_idx in range(len(benches))]
```

### 5. Performance Analysis and Reporting

```python
# Calculate performance metrics
arithmetic_intensity = flops / byte_count
tflops_per_second = (flops / 1e12) / (runtime_us / 1e6)

# Save results in multiple formats
write_results_to_csv(results, "gemm_wave_results.csv")
write_results_to_json(results, "gemm_wave_results.json")
```

## Hyperparameter Tuning System

### Parameter Definition

```python
class WaveGemmBenchmark(WaveKernelBenchmark):
    def setup_parameters(self):
        # Define tuning parameters with bounds and constraints
        self.block_m = self.add_param("BLOCK_M", [16, 32, 64, 128, 256])
        self.block_n = self.add_param("BLOCK_N", [16, 32, 64, 128, 256])
        self.block_k = self.add_param("BLOCK_K", [16, 32, 64])
        
        # Add constraints between parameters
        self.add_constraint(self.block_m * self.block_n <= 8192, "memory_limit")
```

### Tuning Algorithms

#### **Constrained Random Search**
- **Algorithm**: `ConstrainedRandomTuner`
- **Strategy**: Random sampling within constraint boundaries
- **Use Case**: Initial exploration of parameter space

#### **Multi-Pass Tree Search**
- **Algorithm**: `MultiPassTreeTuner`  
- **Strategy**: Hierarchical search with pruning
- **Use Case**: Systematic optimization for stable convergence

#### **Schedule Optimization**
- **Algorithm**: Hill climbing with schedule validation
- **Target**: Instruction scheduling and resource allocation
- **Features**: Modulo scheduling, initiation interval optimization

### Parallel Tuning Infrastructure

```python
tuner = ParallelTuner(ConstrainedRandomTuner())
tuner.tune_kernels(
    benches=benchmarks,
    tuning_result_path="gemm_tuned_results.json",
    num_iterations=50,
    num_trials=100,
    save_results=True
)
```

## Command Line Interface

### Basic Usage

```shell
python -m kernel_bench.cli.bench \
    --kernel_type <gemm|attention|conv> \
    --backend <wave|iree|triton|torch|hipblaslt> \
    --machine <mi325x|mi300x|mi250x> \
    [options]
```

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--iterations` | Number of benchmark runs per kernel | 50 |
| `--tune` | Enable hyperparameter tuning | False |
| `--num_trials` | Number of tuning iterations | 100 |
| `--validate` | Enable numerical validation | False |
| `--max_kernels` | Limit number of kernels tested | None |
| `--use_tuned` | Load pre-tuned parameters from JSON | None |
| `--dump_dir` | Directory for intermediate files | auto |
| `--tags` | Filter kernels by tags | "all" |

### Advanced Examples

```shell
# Multi-backend comparison
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave,iree,torch \
    --machine mi325x

# Custom problem loading
python -m kernel_bench.cli.bench \
    --kernel_type attention \
    --backend wave \
    --machine mi325x \
    --load_problems custom_attention_problems.json

# Tuning with validation
python -m kernel_bench.cli.bench \
    --kernel_type gemm \
    --backend wave \
    --machine mi325x \
    --tune \
    --validate \
    --num_trials 200
```

## Output Format and Analysis

### CSV Results Format

```csv
machine,kernel_type,backend,tag,name,M,N,K,dtype,mean_microseconds,arithmetic_intensity,tflops,ok
mi325x,gemm,wave,default,2048x2048x2048_f16,2048,2048,2048,f16,125.4,341.3,137.2,true
```

### JSON Results Format

```json
{
  "machine": "mi325x",
  "kernel_type": "gemm", 
  "backend": "wave",
  "problem": {"M": 2048, "N": 2048, "K": 2048, "dtype": "f16"},
  "tuning_config": {"BLOCK_M": 64, "BLOCK_N": 128, "BLOCK_K": 32},
  "mean_microseconds": 125.4,
  "arithmetic_intensity": 341.3,
  "tflops": 137.2,
  "ok": true
}
```

### Tuning Results Format

```json
{
  "config_name": "2048x2048x2048_f16",
  "best_params": {"BLOCK_M": 64, "BLOCK_N": 128, "BLOCK_K": 32},
  "best_performance": 137.2,
  "tuning_history": [/* iteration results */],
  "constraints_satisfied": true
}
```

## File Organization and Paths

### Default Directory Structure

```
workspace/
├── results/
│   ├── csv/gemm/           # CSV benchmark results
│   ├── json/gemm/          # JSON benchmark results  
│   └── tuning/gemm/        # Tuning optimization results
├── artifacts/
│   ├── mlir/gemm/wave/     # Generated MLIR files
│   ├── vmfb/gemm/wave/     # Compiled VMFB binaries
│   └── dumps/wave/         # Debug dumps and traces
```

### Custom Path Configuration

```python
path_config = PathConfig.from_workspace(
    workspace_root=Path("/custom/workspace"),
    dump_root=Path("/custom/dumps")
)
```

## Performance Optimization Features

### Automatic Configuration Reduction
- **Clustering**: K-means clustering to select representative kernels
- **Sampling**: Random sampling with seed control for reproducibility
- **Filtering**: Tag-based filtering for targeted evaluation

### Multi-GPU Scaling
- **Distribution**: Round-robin assignment across 8 GPUs
- **Load Balancing**: Automatic workload distribution
- **Fault Tolerance**: Graceful handling of GPU failures

### Memory Management
- **Isolated Validation**: Separate processes for numerical checks
- **Batch Processing**: Configurable batch sizes for large problem sets
- **Resource Cleanup**: Automatic cleanup of intermediate files

## Error Handling and Debugging

### Compilation Timeouts
```python
# Automatic timeout handling for stuck compilations
with TimeoutContext(60):  # 60 second timeout
    success = bench.compile_to_vmfb(mlir_path, vmfb_path)
```

### Validation Isolation
```python
# Isolated subprocess validation to prevent memory issues
validation_result, error_msg = isolated_validate_numerics(bench, device)
```

### Comprehensive Logging
- **Compilation Errors**: Detailed MLIR/IREE compilation diagnostics
- **Runtime Failures**: GPU execution error reporting
- **Performance Anomalies**: Automatic detection of outlier results
- **Progress Tracking**: Real-time progress bars and status updates
