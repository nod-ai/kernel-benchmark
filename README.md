# Kernel Benchmark Infrastructure

A centralized infrastructure for microkernel benchmarking and tuning across multiple AMD codegen pipelines including Wave, IREE, hipblaslt, Triton, and PyTorch. This system supports various kernel types including GEMM, attention, convolution, and more.

## Architecture Overview

This repository consists of three main components:

### 1. Benchmarking & Tuning Infrastructure (`benchmark/`)
A streamlined system for performance evaluation and optimization:
- **Kernel Support**: GEMM, attention, convolution kernels
- **Pipeline Integration**: Wave, IREE, hipblaslt, Triton, PyTorch
- **Automated Benchmarking**: Configurable benchmark runs with performance tracking
- **Hyperparameter Tuning**: Systematic optimization of kernel parameters

### 2. Live Dashboard (`dashboard/`)
A React-based web interface for performance visualization and management:
- **Performance Visualization**: Real-time charts and metrics
- **Regression Monitoring**: Track speedups and performance regressions
- **Historical Analysis**: Performance trends over time
- **Kernel Management**: Add new kernels for benchmarking
- **Run Triggering**: Initiate tuning and benchmark runs

### 3. Backend Services (`backend/`)
Server infrastructure that coordinates the entire system:
- **API Server**: REST endpoints for dashboard communication
- **Event Loop**: Asynchronous task processing
- **Webhook Integration**: GitHub integration for automated workflows
- **Database Management**: Performance data storage and retrieval
- **Run Management**: Coordinate benchmark and tuning workflows

## Branch Structure

- **`main`**: Primary development branch for benchmarking & tuning infrastructure
- **`deploy/dashboard`**: Production deployment branch for the dashboard
- **`deploy/backend`**: Production deployment branch for the backend services

## Directory Structure

```
kernel-benchmark/
├── benchmark/           # Benchmarking & tuning infrastructure
│   ├── kernel_bench/   # Core benchmarking framework
│   │   ├── cli/        # Command-line tools
│   │   ├── config/     # Configuration management
│   │   ├── core/       # Base framework components
│   │   ├── kernels/    # Kernel implementations
│   │   ├── tuning/     # Hyperparameter optimization
│   │   └── utils/      # Utility functions
│   └── docker/         # Containerization
├── dashboard/          # React web interface
│   ├── src/           # Frontend source code
│   │   ├── components/ # UI components
│   │   ├── pages/     # Application pages
│   │   └── utils/     # Frontend utilities
│   └── public/        # Static assets
└── backend/           # Server infrastructure
    ├── runs/          # Benchmark run management
    ├── storage/       # Data persistence layer
    ├── webhook/       # GitHub integration
    ├── github_utils/  # GitHub API utilities
    ├── perf/         # Performance analysis
    └── tools/        # Administrative tools
```

## Getting Started Benchmarking

### Prerequisites
- Python 3.12
- Node.js 16+ (for dashboard)
- Docker (optional, for containerized deployment)
- AMD GPU with ROCm support (for kernel execution)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nod-ai/kernel-benchmark.git
   cd kernel-benchmark
   ```

2. **Set up the benchmarking environment**:
   ```bash
   cd benchmark
   docker build --network=host -t kernel-bench:v1 -f docker/Dockerfile .
   docker run -it --device=/dev/kfd --device=/dev/dri  kernel-bench:v1 /bin/bash
   ```

3. **Run benchmarks inside docker**:
   ```bash
   python -m kernel_bench.cli.bench --help
   ```

## Features

### Supported Pipelines
- **Wave**: AMD's GPU kernel generator
- **IREE**: Machine learning compiler infrastructure
- **hipblaslt**: High-performance BLAS library
- **Triton**: GPU kernel programming language
- **PyTorch**: Deep learning framework integration

### Supported Kernel Types
- **GEMM**: General matrix multiplication
- **Attention**: Transformer attention mechanisms
- **Convolution**: Convolutional neural network operations

### Key Capabilities
- Automated performance regression detection
- Historical performance tracking and analysis
- Configurable benchmarking workflows
- Hyperparameter optimization
- Real-time performance monitoring
- GitHub integration for CI/CD workflows

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions and support, please open an issue on GitHub or reach out to Surya Jasper.