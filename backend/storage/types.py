from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Literal, Optional, Any
from .repository import create_repository


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
    completed: bool = False
    hasArtifact: bool = False
    mappingId: Optional[str] = None


@dataclass
class TuningConfig:
    _id: str
    timestamp: datetime
    run_id: str
    kernel_name: str
    result: dict[str, Any]


@dataclass
class BenchChangeStats:
    _id: str
    runId: str
    machine: str = "mi325x"
    old: Optional[dict[str, Any]] = None
    new: Optional[dict[str, Any]] = None


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
    blobName: str  # Simplified name for dashboard URL
    tags: list[str]
    backends: list[str]
    machine: str
    schedule: Schedule
    isActive: bool = True
    createdAt: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


KernelTypeDb = create_repository(KernelTypeDefinition, "kerneltypes")
"""Repository for kernel types and their respective attributes"""

WorkflowRunDb = create_repository(WorkflowRunState, "workflowrunstates2")
"""Repository for workflow run data with full type safety."""

ChangeStatDb = create_repository(BenchChangeStats, "benchchangestats")

TuningConfigDb = create_repository(TuningConfig, "tuningconfigsnew3")
"""Repository for tuning configuration data with full type safety."""

KernelConfigDb = create_repository(KernelConfig, "kernelconfigs")
"""Repository for benchmarkable kernel configurations with full type safety."""

RepoPullRequestDb = create_repository(RepoPullRequest, "repopullrequests")
"""Repository for repository pull request data with full type safety."""

TrackerDb = create_repository(Tracker, "trackers2")
"""Repository for kernel benchmark trackers with full type safety."""
