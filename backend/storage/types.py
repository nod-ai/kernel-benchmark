from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Literal, Optional, Any
from .repository import create_repository


@dataclass
class BackendSpec:
    """
    Backend specification with version control metadata.
    
    Defines which version of a backend to use for benchmarking.
    """
    id: str  # Unique identifier (e.g., "triton-fav3")
    name: str  # Display name (e.g., "Triton FAV3")
    backend: str  # Base backend type (e.g., "triton")
    remoteRepository: str  # GitHub repo (e.g., "triton-lang/triton")
    branch: str  # Git branch
    commitHash: Optional[str] = None  # Specific commit, or latest if not specified
    isDefault: Optional[bool] = None  # Whether this is the default spec
    parentSpecId: Optional[str] = None  # Reference to parent spec if variant


@dataclass
class WorkflowRunState:
    _id: str
    type: str
    blobName: str
    timestamp: datetime
    status: str
    conclusion: str
    numSteps: int
    steps: list[dict]
    machine: Optional[str] = None
    completed: bool = False
    hasArtifact: bool = False
    triggerId: Optional[str] = None  # Foreign key to RunTrigger


@dataclass
class TuningConfig:
    _id: str
    timestamp: datetime
    run_id: str
    kernel_name: str
    result: dict[str, Any]


# DEPRECATED: BenchChangeStats is no longer used
# This has been replaced by BenchmarkRunStats which stores performance snapshots
# for every run instead of precomputed comparisons.
# @dataclass
# class BenchChangeStats:
#     _id: str
#     runId: str
#     machine: str = "mi325x"
#     old: Optional[dict[str, Any]] = None
#     new: Optional[dict[str, Any]] = None


@dataclass
class BenchmarkRunStats:
    """
    Performance statistics for a single benchmark run.

    Stores aggregated performance metrics for all kernels in a run.
    For tracker runs, trackerId links this to a specific tracker for time-series analysis.
    """

    _id: str  # UUID
    runId: str  # WorkflowRunState._id
    timestamp: datetime
    machine: str
    performance: dict[str, Any]  # machine → kernel_type → backend → stats
    trackerId: Optional[str] = None  # Tracker._id for scheduled runs
    trackerName: Optional[str] = None
    backendSpecs: Optional[list[dict[str, Any]]] = None  # Backend specifications used in this run
    profilingManifest: Optional[dict[str, Any]] = None  # Maps dump keys to rocprof dump info


@dataclass
class KernelTypeDefinition:
    _id: str
    name: str
    displayName: str
    attributes: list[dict]
    description: Optional[str] = None


@dataclass
class KernelConfig:
    _id: str
    name: str
    kernelType: str
    tag: str
    machines: list[str]
    workflow: Literal["none", "e2e", "all"]
    problem: dict[str, Any]


@dataclass
class ChangeAuthor:
    name: str
    profileUrl: str


# @dataclass
# class RepoCommit:
#     _id: str
#     title: str
#     author: ChangeAuthor
#     timestamp: datetime
#     description: Optional[str] = None


@dataclass
class RepoPullRequest:
    _id: str
    url: str
    type: str
    timestamp: datetime
    author: ChangeAuthor
    title: str
    status: str
    commits: int
    repoName: str
    branchName: str
    mappingId: Optional[str] = None
    description: Optional[str] = None
    isMerged: bool = False


@dataclass
class Schedule:
    isInterval: bool
    startDate: str  # MM-DD-YYYY format
    timeOfDay: str  # HH:MM in UTC
    daysOfWeek: Optional[list[str]] = None  # For weekly schedules
    intervalValue: Optional[int] = None  # For interval schedules
    intervalUnit: Optional[Literal["weeks", "months"]] = None  # For interval schedules
    endDate: Optional[str] = None  # MM-DD-YYYY format


@dataclass
class Tracker:
    _id: str
    name: str
    blobName: str
    dashboardName: str
    tags: list[str]
    backends: list[str]  # Kept for backward compatibility
    machine: str
    schedule: Schedule
    branch: str
    isActive: bool = True
    createdAt: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    backendSpecs: Optional[list[dict[str, Any]]] = None  # Backend specifications with full metadata


KernelTypeDb = create_repository(KernelTypeDefinition, "kerneltypes")
"""Repository for kernel types and their respective attributes"""

WorkflowRunDb = create_repository(WorkflowRunState, "workflowrunstates2")
"""Repository for workflow run data with full type safety."""

# DEPRECATED: ChangeStatDb is no longer used - replaced by BenchmarkRunStatsDb
# ChangeStatDb = create_repository(BenchChangeStats, "benchchangestats")

BenchmarkRunStatsDb = create_repository(BenchmarkRunStats, "benchmarkrunstats")
"""Repository for benchmark run performance statistics with full type safety."""

TuningConfigDb = create_repository(TuningConfig, "tuningconfigsnew3")
"""Repository for tuning configuration data with full type safety."""

KernelConfigDb = create_repository(KernelConfig, "kernelconfigs")
"""Repository for benchmarkable kernel configurations with full type safety."""

RepoPullRequestDb = create_repository(RepoPullRequest, "repopullrequests")
"""Repository for repository pull request data with full type safety."""

TrackerDb = create_repository(Tracker, "trackers2")
"""Repository for kernel benchmark trackers with full type safety."""
