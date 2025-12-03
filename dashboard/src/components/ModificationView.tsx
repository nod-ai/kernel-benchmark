import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { RepoPullRequest, BenchmarkRun, ChangeStats } from "../types";
import {
  GitPullRequest,
  GitMerge,
  Github,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { getTimeStringRelative } from "../utils/utils";
import { PullRequestRunStatus } from "../components/RunStatus";

interface ModificationViewProps {
  pr: RepoPullRequest;
  runs: Record<string, BenchmarkRun>;
  changeStats: Record<string, ChangeStats>;
}

export default function ModificationView({
  pr,
  runs,
  changeStats,
}: ModificationViewProps) {
  const [isExpanded, setExpanded] = useState<boolean>(false);
  const [isHovering, setHover] = useState<boolean>(false);

  const navigate = useNavigate();

  const isMerge = pr.isMerged;

  const title = pr.title;
  const run = pr.mappingId ? runs[pr.mappingId] : undefined;

  return (
    <div
      id={pr._id}
      key={pr._id}
      className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (run && run.conclusion === "success") {
          navigate(`/dashboard/${run.blobName}`, {
            preventScrollReset: true,
          });
        }
      }}
    >
      {/* Status indicator bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
          isMerge ? "bg-purple-500" : "bg-green-500"
        }`}
      />

      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon with background */}
          <div
            className={`flex-shrink-0 p-2 rounded-lg ${
              isMerge ? "bg-purple-100" : "bg-green-100"
            }`}
          >
            {isMerge ? (
              <GitMerge className="w-5 h-5 text-purple-600" />
            ) : (
              <GitPullRequest className="w-5 h-5 text-green-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-tight">
              {title}
            </h3>

            {/* Author and timestamp */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <img
                  src={pr.author.profileUrl}
                  alt={pr.author.name}
                  className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm"
                />
                <span className="font-medium">{pr.author.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{getTimeStringRelative(pr.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex-shrink-0">
            <PullRequestRunStatus
              run={run}
              pr={pr}
              changeStats={run && changeStats[run._id]}
            />
          </div>
        </div>
      </div>

      {/* Expandable PR Description */}
      {isExpanded && pr.description && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-lg">
            {pr.description}
          </div>
        </div>
      )}

      {/* Hover Menu */}
      {isHovering && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          <a
            href={pr.url}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="View on GitHub"
            onClick={(e) => e.stopPropagation()}
          >
            <Github className="w-4 h-4 text-gray-600 hover:text-gray-900" />
          </a>
          {pr.description && (
            <button
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                setExpanded(!isExpanded);
                e.stopPropagation();
              }}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600 hover:text-gray-900" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600 hover:text-gray-900" />
              )}
            </button>
          )}
          {run && run.conclusion === "success" && (
            <Link
              to={`/dashboard/${run.blobName}`}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="View Dashboard Summary"
              onClick={(e) => e.stopPropagation()}
            >
              <BarChart3 className="w-4 h-4 text-gray-600 hover:text-gray-900" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

interface PerformanceViewProps {
  perf: BenchmarkRun;
}

export function PerformanceView({ perf }: PerformanceViewProps) {
  const navigate = useNavigate();

  const title = "Full Benchmark Run";
  const formattedDate = new Date(perf.timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      id={perf._id}
      key={perf._id}
      className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={() => {
        navigate(`/dashboard/${perf.blobName}`, {
          preventScrollReset: true,
        });
      }}
    >
      {/* Status indicator bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg" />

      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon with background */}
          <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title and badge */}
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Automated
              </span>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{getTimeStringRelative(perf.timestamp)}</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="font-mono text-xs">{formattedDate}</span>
            </div>
          </div>

          {/* Status */}
          {/* <div className="flex-shrink-0">
            <ChangeStatView run={perf} />
          </div> */}
        </div>
      </div>
    </div>
  );
}
