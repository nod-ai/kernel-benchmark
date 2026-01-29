"""
CLI for hyperparameter tuning of kernel benchmarks.

This script provides a dedicated interface for tuning kernel configurations
across multiple GPUs using various tuning paradigms.
"""

import os
import argparse
from pathlib import Path

from kernel_bench.config.loaders import load_configs
from kernel_bench.core.runner import BenchmarkRunner
from kernel_bench.core.base import LOAD_PROBLEMS, BENCHMARKS, CONFIG_CLASSES
from kernel_bench.utils.paths import PathConfig
from kernel_bench.utils.print_utils import get_logger
from kernel_bench.tuning import get_paradigm_help, list_paradigms


def create_parser():
    """Create argument parser for tuning CLI."""
    parser = argparse.ArgumentParser(
        description="Hyperparameter tuning for kernel benchmarks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List available tuning paradigms
  python -m kernel_bench.cli.tune --list_paradigms
  
  # Tune GEMM kernels using Bayesian optimization
  python -m kernel_bench.cli.tune \\
      --kernel_type gemm \\
      --backend wave \\
      --machine mi325x \\
      --paradigm bayesian \\
      --num_trials 100
  
  # Tune with grid search on specific problems
  python -m kernel_bench.cli.tune \\
      --kernel_type gemm \\
      --backend wave \\
      --machine mi325x \\
      --paradigm grid \\
      --load_problems problems.csv \\
      --num_trials 150
        """
    )
    
    # Core arguments (not required if listing paradigms)
    parser.add_argument(
        "--kernel_type",
        type=str,
        help="Kernel type (e.g., gemm, attention, conv)",
    )
    parser.add_argument(
        "--backend",
        type=str,
        help="Backend to use (e.g., wave, iree, torch)",
    )
    parser.add_argument(
        "--machine",
        type=str,
        help="Target machine (e.g., mi300x, mi325x)",
    )
    
    # Tuning configuration
    parser.add_argument(
        "--paradigm",
        type=str,
        default="grid",
        help="Tuning paradigm to use (default: grid). Use --list_paradigms to see all available.",
    )
    parser.add_argument(
        "--num_trials",
        type=int,
        default=100,
        help="Number of tuning trials per configuration (default: 100)",
    )
    parser.add_argument(
        "--num_gpus",
        type=int,
        default=None,
        help="Number of GPUs to use for parallel tuning (default: auto-detect)",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=50,
        help="Number of benchmark iterations per trial (default: 50)",
    )
    
    # Problem selection
    parser.add_argument(
        "--load_problems",
        type=str,
        default=None,
        help="Path to custom problem list (CSV file)",
    )
    parser.add_argument(
        "--tags",
        type=str,
        default="all",
        help="Specific tags to tune (comma-separated, default: all)",
    )
    parser.add_argument(
        "--max_kernels",
        type=int,
        default=None,
        help="Maximum number of kernels to tune (random subset)",
    )
    
    # Output configuration
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Custom output path for tuning results (default: auto-generated)",
    )
    parser.add_argument(
        "--title",
        type=str,
        default=None,
        help="Title for this tuning run (used in output filenames)",
    )
    
    # Device configuration
    parser.add_argument(
        "--device",
        type=str,
        default="hip",
        help="IREE device to use (default: hip)",
    )
    parser.add_argument(
        "--dump_dir",
        type=str,
        default=None,
        help="Directory to dump intermediate files",
    )
    
    # Utility flags
    parser.add_argument(
        "--list_paradigms",
        action="store_true",
        help="List all available tuning paradigms and exit",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode with verbose output",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        type=str.upper,
        help="Set the logging level (default: INFO)",
    )
    
    return parser


def main():
    """Main entry point for tuning CLI."""
    # Disable WAVE caching
    os.environ["WAVE_CACHE_ON"] = "0"
    
    parser = create_parser()
    args = parser.parse_args()
    
    # Handle --list_paradigms flag
    if args.list_paradigms:
        print(get_paradigm_help())
        print()
        print("Use --paradigm PARADIGM_NAME to select a specific paradigm.")
        return 0
    
    # Check required arguments (only if not listing paradigms)
    if not args.kernel_type:
        parser.error("--kernel_type is required")
    if not args.backend:
        parser.error("--backend is required")
    if not args.machine:
        parser.error("--machine is required")
    
    # Validate paradigm
    if args.paradigm not in list_paradigms():
        print(f"Error: Unknown paradigm '{args.paradigm}'")
        print()
        print(get_paradigm_help())
        return 1
    
    logger = get_logger()
    logger.info(f"Starting tuning with paradigm: {args.paradigm}")
    
    # Validate kernel type and backend
    if args.kernel_type not in BENCHMARKS:
        logger.error(f"Kernel type '{args.kernel_type}' is not supported")
        logger.info(f"Available kernel types: {list(BENCHMARKS.keys())}")
        return 1
    
    if args.backend not in BENCHMARKS[args.kernel_type]:
        logger.error(
            f"Backend '{args.backend}' is not supported for {args.kernel_type}"
        )
        logger.info(
            f"Available backends: {list(BENCHMARKS[args.kernel_type].keys())}"
        )
        return 1
    
    # Load configurations
    configs = []
    if args.load_problems:
        logger.info(f"Loading problems from {args.load_problems}")
        configs = load_configs(args.load_problems, CONFIG_CLASSES[args.kernel_type])
        if not configs:
            logger.warning("No configurations loaded from file")
            return 1
    else:
        logger.info(f"Loading default {args.kernel_type} problems")
        configs = LOAD_PROBLEMS[args.kernel_type](args.kernel_type, args.backend)
    
    # Filter by tags if specified
    if args.tags != "all":
        tags = args.tags.split(",")
        configs = [(tag, config) for tag, config in configs if tag in tags]
        logger.info(f"Filtered to {len(configs)} configs with tags: {tags}")
    
    if not configs:
        logger.error("No configurations to tune")
        return 1
    
    # Setup paths
    if args.dump_dir:
        path_config = PathConfig.from_workspace(
            workspace_root=Path.cwd(),
            dump_root=Path(args.dump_dir)
        )
    else:
        path_config = PathConfig.default()
    
    # Create benchmark runner
    logger.info(f"Creating benchmark runner for {len(configs)} configurations")
    runner = BenchmarkRunner(
        backend=args.backend,
        kernel_type=args.kernel_type,
        device=args.device,
        machine=args.machine.upper(),
        configs=configs,
        path_config=path_config,
        debug=args.debug,
        num_iterations=args.iterations,
        title=args.title,
        max_kernels=args.max_kernels,
    )
    
    # Run tuning
    logger.info(f"Starting tuning with {args.num_trials} trials per configuration")
    logger.info(f"Using paradigm: {args.paradigm}")
    
    try:
        runner.tune_kernels(
            num_trials=args.num_trials,
            paradigm_name=args.paradigm,
        )
        logger.info("Tuning completed successfully!")
        return 0
    except KeyboardInterrupt:
        logger.warning("Tuning interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Tuning failed: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

