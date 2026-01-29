#!/usr/bin/env python3
"""
Compare Wave and hipBLASLt GEMM benchmark results and generate a comparison CSV.
"""

import csv
import sys
from pathlib import Path


def main():
    # File paths
    wave_csv = Path("results/csv/gemm/gemm_wave.csv")
    hipblaslt_csv = Path("results/csv/gemm/gemm_hipblaslt.csv")
    output_csv = Path("results/csv/gemm/gemm_comparison.csv")
    
    # Check if input files exist
    if not wave_csv.exists():
        print(f"Error: {wave_csv} not found")
        sys.exit(1)
    if not hipblaslt_csv.exists():
        print(f"Error: {hipblaslt_csv} not found")
        sys.exit(1)
    
    # Read Wave results
    print(f"Reading {wave_csv}...")
    wave_data = {}
    with open(wave_csv, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['name']:  # Skip empty rows
                key = (int(row['M']), int(row['N']), int(row['K']))
                wave_data[key] = {
                    'name': row['name'],
                    'backend': row['backend'],
                    'tag': row['tag'],
                    'transpose': row['transpose'],
                    'dtype': row['dtype'],
                    'mean_us': float(row['mean_microseconds']),
                    'tflops': float(row['tflops']),
                    'arithmetic_intensity': float(row['arithmetic_intensity']),
                    'ok': row['ok']
                }
    
    # Read hipBLASLt results
    print(f"Reading {hipblaslt_csv}...")
    hipblaslt_data = {}
    with open(hipblaslt_csv, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['name']:  # Skip empty rows
                key = (int(row['M']), int(row['N']), int(row['K']))
                hipblaslt_data[key] = {
                    'name': row['name'],
                    'backend': row['backend'],
                    'tag': row['tag'],
                    'transpose': row['transpose'],
                    'dtype': row['dtype'],
                    'mean_us': float(row['mean_microseconds']),
                    'tflops': float(row['tflops']),
                    'arithmetic_intensity': float(row['arithmetic_intensity']),
                    'ok': row['ok']
                }
    
    # Find matching shapes
    matching_shapes = set(wave_data.keys()) & set(hipblaslt_data.keys())
    wave_only = set(wave_data.keys()) - set(hipblaslt_data.keys())
    hipblaslt_only = set(hipblaslt_data.keys()) - set(wave_data.keys())
    
    print(f"\nFound {len(wave_data)} Wave results")
    print(f"Found {len(hipblaslt_data)} hipBLASLt results")
    print(f"Matching shapes: {len(matching_shapes)}")
    if wave_only:
        print(f"Wave-only shapes: {len(wave_only)}")
    if hipblaslt_only:
        print(f"hipBLASLt-only shapes: {len(hipblaslt_only)}")
    
    # Create comparison data
    print(f"\nGenerating comparison data...")
    comparison_rows = []
    
    for shape in sorted(matching_shapes):
        M, N, K = shape
        w = wave_data[shape]
        h = hipblaslt_data[shape]
        
        # Calculate comparison metrics
        speedup = h['mean_us'] / w['mean_us']  # >1 means wave is faster
        
        # Determine winner
        if speedup < 1.0:
            winner = "hipblaslt"
        elif speedup >= 1.0:
            winner = "wave"
        
        row = {
            # Shape information
            'M': M,
            'N': N,
            'K': K,
            'dtype': w['dtype'],
            'tag': w['tag'],
            
            # Wave results
            'wave_mean_us': w['mean_us'],
            'wave_tflops': w['tflops'],
            'wave_arithmetic_intensity': w['arithmetic_intensity'],
            
            # hipBLASLt results
            'hipblaslt_mean_us': h['mean_us'],
            'hipblaslt_tflops': h['tflops'],
            'hipblaslt_arithmetic_intensity': h['arithmetic_intensity'],
            
            # Comparison metrics
            'speedup': speedup,  # Wave time / hipBLASLt time
            'winner': winner,
        }
        
        comparison_rows.append(row)
    
    # Write comparison CSV
    print(f"Writing comparison to {output_csv}...")
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    
    fieldnames = [
        'M', 'N', 'K', 'dtype', 'tag',
        'wave_mean_us', 'wave_tflops', 'wave_arithmetic_intensity',
        'hipblaslt_mean_us', 'hipblaslt_tflops', 'hipblaslt_arithmetic_intensity',
        'speedup', 'winner'
    ]
    
    with open(output_csv, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(comparison_rows)
    
    print(f"\n✓ Comparison CSV created: {output_csv}")
    print(f"  Total rows: {len(comparison_rows)}")
    
    # Print summary statistics
    wave_wins = sum(1 for r in comparison_rows if r['winner'] == 'wave')
    hipblaslt_wins = sum(1 for r in comparison_rows if r['winner'] == 'hipblaslt')
    ties = sum(1 for r in comparison_rows if r['winner'] == 'tie')
    
    print(f"\nSummary:")
    print(f"  Wave wins: {wave_wins} ({100*wave_wins/len(comparison_rows):.1f}%)")
    print(f"  hipBLASLt wins: {hipblaslt_wins} ({100*hipblaslt_wins/len(comparison_rows):.1f}%)")
    print(f"  Ties: {ties} ({100*ties/len(comparison_rows):.1f}%)")
    
    # Average metrics
    avg_speedup = sum(r['speedup'] for r in comparison_rows) / len(comparison_rows)
    avg_wave_tflops = sum(r['wave_tflops'] for r in comparison_rows) / len(comparison_rows)
    avg_hipblaslt_tflops = sum(r['hipblaslt_tflops'] for r in comparison_rows) / len(comparison_rows)
    
    print(f"\nAverage Metrics:")
    print(f"  Average speedup: {avg_speedup:.2f}x")
    print(f"  Average Wave TFLOPS: {avg_wave_tflops:.2f}")
    print(f"  Average hipBLASLt TFLOPS: {avg_hipblaslt_tflops:.2f}")


if __name__ == "__main__":
    main()
