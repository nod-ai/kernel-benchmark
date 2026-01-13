"""Visualization utilities for tuning results and summaries."""

from typing import Any, Dict, List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree
import statistics

from kernel_bench.core.template import KernelBenchmark
from .hyperparam.parameters import IntegerBounds, CategoricalBounds


def display_hyperparameters_table(
    benches: List[KernelBenchmark], console: Optional[Console] = None
):
    """
    Display all exposed hyperparameters before tuning.

    Args:
        benches: List of KernelBenchmark objects
        console: Optional Rich console instance (creates new one if not provided)
    """
    if console is None:
        console = Console()

    # Collect all unique hyperparameters across all benchmarks
    all_params = {}
    for bench in benches:
        if hasattr(bench, "tuning_spec") and bench.tuning_spec:
            for param in bench.tuning_spec.params():
                if param.include_hyperparam and param.name not in all_params:
                    all_params[param.name] = param

    if not all_params:
        console.print("\n[yellow]No hyperparameters found to tune.[/yellow]\n")
        return

    # Create a table for hyperparameters
    table = Table(
        title="Exposed Hyperparameters",
        show_header=True,
        header_style="bold magenta",
    )
    table.add_column("Parameter", style="cyan", width=20)
    table.add_column("Type", style="green", width=12)
    table.add_column("Range", style="yellow")
    table.add_column("Default", style="blue", width=10)

    for name, param in sorted(all_params.items()):
        if isinstance(param.bounds, IntegerBounds):
            param_type = "Integer"
            if param.bounds.exponential:
                range_str = f"{param.bounds.min} to {param.bounds.max} (exp, step={param.bounds.step})"
            else:
                range_str = f"{param.bounds.min} to {param.bounds.max} (step={param.bounds.step})"
        elif isinstance(param.bounds, CategoricalBounds):
            param_type = "Categorical"
            options_str = ", ".join(str(opt) for opt in param.bounds.options[:5])
            if len(param.bounds.options) > 5:
                options_str += f", ... ({len(param.bounds.options)} total)"
            range_str = options_str
        else:
            param_type = "Unknown"
            range_str = "N/A"

        default_val = str(param.value) if param.value is not None else "None"
        table.add_row(name, param_type, range_str, default_val)

    console.print()
    console.print(Panel(table, border_style="bright_blue", padding=(1, 2)))
    console.print()


def display_tuning_summary(results: Dict[str, Any], console: Optional[Console] = None):
    """
    Display detailed summary after tuning completes.

    Args:
        results: Dictionary of tuning results by kernel name
        console: Optional Rich console instance (creates new one if not provided)
    """
    if console is None:
        console = Console()

    if not results:
        console.print("\n[yellow]No tuning results to display.[/yellow]\n")
        return

    # Separate successful and failed kernels
    successful = []
    failed = []

    for name, result in results.items():
        if result.get("improvement", False):
            successful.append((name, result))
        else:
            failed.append(name)

    # Create summary panel
    console.print("\n")
    console.print("=" * 80)
    console.print()

    # Section a: Tree-based breakdown of successful tunings
    if successful:
        tree = Tree(
            "✓ [bold green]Kernels with Speedup[/bold green]",
            guide_style="bright_green",
        )

        for name, result in sorted(
            successful, key=lambda x: x[1].get("speedup", 1.0), reverse=True
        ):
            speedup = result.get("speedup", 1.0)
            improvement_pct = (speedup - 1.0) * 100

            # Create node with kernel name and speedup
            kernel_label = f"[cyan]{name}[/cyan]: [bold green]+{improvement_pct:.1f}%[/bold green] ({speedup:.2f}x)"
            kernel_node = tree.add(kernel_label)

            # Add hyperparameters as sub-nodes
            hyperparams = result.get("hyperparams", {})
            if hyperparams:
                params_text = []
                for param_name, param_value in sorted(hyperparams.items()):
                    params_text.append(
                        f"[yellow]{param_name}[/yellow] = [white]{param_value}[/white]"
                    )

                # Group parameters for better display
                for i in range(0, len(params_text), 3):
                    batch = params_text[i : i + 3]
                    kernel_node.add("  ".join(batch))

        console.print(tree)
        console.print()

    # Section b: List of failed kernels
    if failed:
        console.print("[bold red]✗ Kernels Without Improvements[/bold red]")
        for name in sorted(failed):
            console.print(f"  • [dim]{name}[/dim]")
        console.print()

    # Section c: Statistical summary
    stats_table = Table(
        title="Tuning Statistics",
        show_header=True,
        header_style="bold magenta",
        box=None,
    )
    stats_table.add_column("Metric", style="cyan", width=30)
    stats_table.add_column("Value", style="white", justify="right")

    total_kernels = len(results)
    num_successful = len(successful)
    num_failed = len(failed)

    stats_table.add_row("Total Kernels", str(total_kernels))
    stats_table.add_row("Successfully Tuned", f"[green]{num_successful}[/green]")
    stats_table.add_row("No Improvement Found", f"[red]{num_failed}[/red]")

    if successful:
        speedups = [result.get("speedup", 1.0) for _, result in successful]
        improvement_pcts = [(s - 1.0) * 100 for s in speedups]

        avg_speedup = statistics.mean(improvement_pcts)
        median_speedup = statistics.median(improvement_pcts)
        max_speedup = max(improvement_pcts)

        stats_table.add_row(
            "Average Speedup", f"[bold green]+{avg_speedup:.1f}%[/bold green]"
        )
        stats_table.add_row(
            "Median Speedup", f"[bold green]+{median_speedup:.1f}%[/bold green]"
        )
        stats_table.add_row(
            "Best Speedup", f"[bold green]+{max_speedup:.1f}%[/bold green]"
        )
    else:
        stats_table.add_row("Average Speedup", "[dim]N/A[/dim]")
        stats_table.add_row("Median Speedup", "[dim]N/A[/dim]")

    console.print(Panel(stats_table, border_style="bright_blue", padding=(1, 2)))
    console.print()
    console.print("=" * 80)
    console.print()
