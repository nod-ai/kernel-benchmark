import csv
import os
from pathlib import Path
from typing import Optional
import logging


def get_rocprofv3_cmd(dump_path: os.PathLike, kernel_regex: str):
    return [
        "rocprofv3",
        "--kernel-trace",
        "--kernel-include-regex",
        kernel_regex,
        "--att",
        "--att-library-path",
        "/root/rocprof-trace-decoder-ubuntu-22.04-0.1.6-Linux/opt/rocm/lib/",
        "--stats",
        "TRUE",
        "-d",
        f"{dump_path}",
        "--output-format",
        "csv",
        "--",
    ]


def parse_rocprof_us(
    path: Path,
    kernel_regex: str, 
    logger: Optional[logging.Logger] = None
) -> dict:
    try:
        # If path is a directory, find the CSV file
        if path.is_dir():
            kernel_stats_files = list(path.glob("**/*kernel_stats.csv"))
            if not kernel_stats_files:
                raise FileNotFoundError(f"No CSV files found in {path}")
            csv_path = kernel_stats_files[0]
        else:
            csv_path = path
        
        # Validate CSV file exists
        if not csv_path.exists():
            raise FileNotFoundError(f"rocprof3 kernel stats CSV file not found: {csv_path}")
        
        # Parse the CSV file
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Match kernel by name pattern
                if 'Name' in row and (not kernel_regex or kernel_regex in row['Name']):
                    if 'AverageNs' not in row:
                        raise ValueError(f"Found kernel but no 'AverageNs' column")
                    average_ns = float(row['AverageNs'])
                    
                    return {
                        'kernel_name': row['Name'],
                        'mean_duration_us': average_ns / 1000.0,
                        'total_calls': int(row.get('Calls', 1)),
                    }
        
        raise ValueError(f"No kernel matching '{kernel_regex}' found in {csv_path}")
    
    except Exception as e:
        logger.error(f"Error parsing profiling stats: {e}")
        return {}