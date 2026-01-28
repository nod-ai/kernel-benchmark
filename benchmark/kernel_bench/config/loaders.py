"""
Configuration loaders for kernel benchmarks.

This module provides utilities for loading problem sets from various sources
(CSV files, JSON files, programmatic generators).
"""

import json
import csv
from pathlib import Path
from typing import List, Tuple, Type, Any, Optional
from dataclass_wizard import fromdict

from kernel_bench.core.base import CONFIG_CLASSES
from kernel_bench.config.base import OpConfig


def load_configs_from_json(json_path: Path) -> dict:
    """
    Load configurations from a JSON file.

    Args:
        json_path: Path to JSON file

    Returns:
        Dictionary with:
            - "kernel_types": List of unique kernel types found
            - "configs": List of (tag, config) tuples
    """
    with open(json_path, "r") as f:
        data = json.load(f)

    configs = []
    kernel_types = set()
    for item in data:
        if not isinstance(item, dict):
            raise ValueError(f"Invalid config format in JSON: {item}")
        else:
            tag = item.get("tag", "default")
            kernel_type = item["kernelType"]
            kernel_types.add(kernel_type)
            config = fromdict(CONFIG_CLASSES[kernel_type], item["problem"])
            configs.append((tag, config))

    return {
        "kernel_types": list(kernel_types),
        "configs": configs
    }


def load_configs(file_path: Path) -> dict:
    """
    Load configurations from a file (auto-detects format).

    Args:
        file_path: Path to configuration file

    Returns:
        Dictionary with:
            - "kernel_types": List of unique kernel types found
            - "configs": List of (tag, config) tuples
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {file_path}")

    if file_path.suffix == ".json":
        return load_configs_from_json(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path.suffix}")


def save_configs_to_json(
    configs: List[Tuple[str, OpConfig]],
    json_path: Path,
) -> None:
    """
    Save configurations to a JSON file.

    Args:
        configs: List of (tag, config) tuples
        json_path: Output path for JSON file
    """
    data = []
    for tag, config in configs:
        config_dict = config.to_dict()
        config_dict["tag"] = tag
        data.append(config_dict)

    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)
