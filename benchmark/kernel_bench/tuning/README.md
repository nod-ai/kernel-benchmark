# Hyperparameter Tuning Infrastructure

This module provides a modular, extensible infrastructure for hyperparameter tuning of kernel benchmarks.

## Architecture Overview

The tuning infrastructure is organized into three layers:

### 1. Core Components (`tuning/core/`)

Shared utilities used by all tuning paradigms:

- **`CandidateConfig`**: Immutable, hashable representation of a parameter configuration
- **`ExecutionEngine`**: Handles compilation and benchmarking (single and batch)
- **`RichProgressManager`**: Rich-based progress tracking with hierarchical sub-tasks
- **`TuningHistory`**: Tracks all evaluations with automatic persistence
- **`ResultEvaluator`**: Scoring and comparison logic

### 2. Paradigm Interface (`tuning/hyperparam/paradigm/`)

Base class and concrete implementations:

- **`TuningParadigm`**: Abstract base class with common infrastructure
- **`BayesianTuningParadigm`**: Optuna-based Bayesian optimization (sequential)
- **`ConstrainedRandomTuner`**: Random sampling with constraints (batch)
- **`MultiPassTreeTuner`**: Multi-pass tree-based exploration (batch)

### 3. Orchestration (`tuning/hyperparam/`)

- **`ParallelTuner`**: Manages parallel execution across multiple GPUs
- **`TuningContext`**: Configuration for a tuning run
- **`TuningResult`**: Results of a tuning run

## Creating a New Tuning Paradigm

To create a new tuning paradigm, subclass `TuningParadigm` and implement three required methods:

```python
from typing import Iterator, List
from kernel_bench.tuning.core import CandidateConfig, ExecutionResult
from kernel_bench.tuning.hyperparam.paradigm import TuningParadigm

class MyCustomParadigm(TuningParadigm):
    def __init__(self, custom_param: int = 10):
        super().__init__()
        self.custom_param = custom_param
        self.evaluated_count = 0

    def get_name(self) -> str:
        """Return paradigm name."""
        return "My Custom Tuning Paradigm"

    def generate_candidates(self) -> Iterator[CandidateConfig]:
        """
        Generate candidates to evaluate.

        Can yield:
        - Single CandidateConfig for sequential evaluation
        - List[CandidateConfig] for batch evaluation
        """
        params = self.context.bench.tuning_spec.params()

        while self.evaluated_count < self.context.num_trials:
            # Your candidate generation logic here
            param_values = {...}  # Generate parameter values

            candidate = CandidateConfig(param_values=param_values)
            self.evaluated_count += 1

            yield candidate  # or yield [candidate1, candidate2, ...]

    def should_stop(self) -> bool:
        """Determine if tuning should stop."""
        return self.evaluated_count >= self.context.num_trials
```

### Optional Methods

You can also override these methods for custom behavior:

```python
def setup(self, context: TuningContext, progress: RichProgressManager):
    """Additional initialization (call super().setup() first)."""
    super().setup(context, progress)
    # Your custom setup here

def execute_candidates(self, candidates: List[CandidateConfig]) -> List[ExecutionResult]:
    """Custom execution logic (e.g., progressive benchmarking, custom pruning)."""
    # Your custom execution here
    # Default implementation handles batch/sequential automatically

def update_strategy(self, results: List[ExecutionResult]):
    """Adapt strategy based on results (e.g., for adaptive methods)."""
    # Update internal state based on results
```

## Usage Examples

### Basic Usage with Parallel Tuner

```python
from kernel_bench.tuning import (
    ParallelTuner,
    BayesianTuningParadigm,
    ConstrainedRandomTuner,
)

# Create a tuning paradigm
paradigm = BayesianTuningParadigm(n_startup_trials=20)

# Create parallel tuner
tuner = ParallelTuner(paradigm, num_gpus=8)

# Run tuning
results = tuner.tune_kernels(
    benches=my_benchmarks,
    tuning_result_path="results/tuning/results.json",
    num_iterations=100,
    num_trials=200,
)
```

### Sequential vs Batch Execution

**Sequential (Bayesian):**

```python
def generate_candidates(self) -> Iterator[CandidateConfig]:
    while not self.should_stop():
        candidate = self._generate_next()
        yield candidate  # Single candidate
```

**Batch (Random, Tree):**

```python
def generate_candidates(self) -> Iterator[List[CandidateConfig]]:
    while not self.should_stop():
        batch = self._generate_batch(size=20)
        yield batch  # List of candidates
```

### Progress Tracking

The infrastructure automatically handles progress tracking, but you can create sub-tasks:

```python
def execute_candidates(self, candidates: List[CandidateConfig]) -> List[ExecutionResult]:
    # Create sub-task for custom phase
    with self.progress.create_subtask("Pruning", len(candidates), "red") as pruning:
        pruned = []
        for candidate in candidates:
            if self._should_keep(candidate):
                pruned.append(candidate)
            pruning.step()

    # Use default execution for remaining
    return super().execute_candidates(pruned)
```

### Accessing History and Results

```python
def update_strategy(self, results: List[ExecutionResult]):
    # Get best result so far
    best = self.history.get_best()

    # Get all improvements
    improvements = self.history.get_improvements()

    # Check if current result is improvement
    for result in results:
        if self.evaluator.is_improvement(result):
            speedup = self.evaluator.compute_speedup(result)
            print(f"Found {speedup:.2f}x speedup!")
```

## Design Principles

### 1. Separation of Concerns

- **Execution** (ExecutionEngine) is separate from **strategy** (Paradigm)
- **Progress tracking** is decoupled from business logic
- **History management** is centralized

### 2. Reusability

- Common components (executor, progress, history) shared across paradigms
- No duplicated code for compilation, benchmarking, or logging

### 3. Flexibility

- Sequential paradigms yield single candidates
- Batch paradigms yield lists
- Custom execution patterns via `execute_candidates()` override

### 4. Progress Tracking

- Rich-based with better UI than tqdm
- Hierarchical (main task + subtasks)
- Event-based for multiprocessing compatibility
- Automatic cleanup via context managers

### 5. Extensibility

- New paradigms only implement core logic
- All infrastructure provided automatically
- Optional hooks for customization

## Paradigm Comparison

| Paradigm | Execution Mode | Best For                                   | Customization               |
| -------- | -------------- | ------------------------------------------ | --------------------------- |
| Bayesian | Sequential     | Small search spaces, expensive evaluations | Optuna configuration        |
| Random   | Batch          | Baseline, uniform exploration              | Batch size                  |
| Tree     | Batch          | Structured refinement, multi-pass          | Passes, candidates per pass |

## File Structure

```
tuning/
├── core/                      # Shared infrastructure
│   ├── __init__.py
│   ├── candidate.py          # CandidateConfig
│   ├── executor.py           # ExecutionEngine, ExecutionResult
│   ├── progress.py           # RichProgressManager
│   ├── history.py            # TuningHistory
│   └── evaluator.py          # ResultEvaluator
├── hyperparam/
│   ├── __init__.py
│   ├── parameters.py         # TuningParameter, TuningSpec
│   ├── parallel_tuning.py   # ParallelTuner
│   └── paradigm/
│       ├── __init__.py
│       ├── paradigm.py       # TuningParadigm (base class)
│       ├── bayesian.py       # BayesianTuningParadigm
│       ├── constrained_random.py  # ConstrainedRandomTuner
│       └── tree.py           # MultiPassTreeTuner
└── README.md                 # This file
```
