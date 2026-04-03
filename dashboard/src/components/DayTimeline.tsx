import { useState, useEffect, useMemo } from "react";
import { Clock, Monitor } from "lucide-react";
import type { ScheduleData } from "../utils/github";

interface TrackerInfo {
  id: string;
  name: string;
  machine: string;
  isActive: boolean;
  schedule: ScheduleData;
  tags: string[];
}

interface ScheduledRun {
  tracker: TrackerInfo;
  hour: number;
  minute: number;
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
];

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const TOTAL_MINUTES = 1440;
const ESTIMATED_DURATION_MINUTES = 120;

function normalizeDay(day: string): string {
  const d = day.trim();
  const title = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
  const abbrevMap: Record<string, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return abbrevMap[title] || title;
}

function parseMMDDYYYY(dateStr: string): Date {
  const [month, day, year] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getScheduledRunsToday(trackers: TrackerInfo[]): ScheduledRun[] {
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const todayDayName = dayNames[todayUTC.getUTCDay()];
  const runs: ScheduledRun[] = [];

  for (const tracker of trackers) {
    if (!tracker.isActive) continue;

    const schedule = tracker.schedule;
    if (!schedule?.timeOfDay) continue;

    const [hour, minute] = schedule.timeOfDay.split(":").map(Number);

    if (schedule.startDate) {
      const startDate = parseMMDDYYYY(schedule.startDate);
      if (todayUTC < startDate) continue;
    }

    if (schedule.endDate) {
      const endDate = parseMMDDYYYY(schedule.endDate);
      if (todayUTC > endDate) continue;
    }

    let runsToday = false;

    if (!schedule.isInterval) {
      const normalizedDays = (schedule.daysOfWeek || []).map(normalizeDay);
      runsToday = normalizedDays.includes(todayDayName);
    } else {
      const startDate = parseMMDDYYYY(schedule.startDate);
      let intervalDays: number;
      if (schedule.intervalUnit === "months") {
        intervalDays = (schedule.intervalValue || 1) * 30;
      } else {
        intervalDays = (schedule.intervalValue || 1) * 7;
      }

      const daysSinceStart = Math.floor(
        (todayUTC.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      runsToday = daysSinceStart >= 0 && daysSinceStart % intervalDays === 0;
    }

    if (runsToday) {
      runs.push({ tracker, hour, minute });
    }
  }

  return runs.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function getNowMinutesUTC(): number {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export default function DayTimeline({
  trackers,
}: {
  trackers: TrackerInfo[];
}) {
  const [nowMinutes, setNowMinutes] = useState(getNowMinutesUTC);

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(getNowMinutesUTC()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const scheduledRuns = useMemo(() => getScheduledRunsToday(trackers), [trackers]);

  const machineGroups = useMemo(() => {
    const groups: Record<string, ScheduledRun[]> = {};
    for (const run of scheduledRuns) {
      const m = run.tracker.machine;
      if (!groups[m]) groups[m] = [];
      groups[m].push(run);
    }
    return groups;
  }, [scheduledRuns]);

  const trackerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let i = 0;
    for (const t of trackers) {
      if (!map[t.id]) {
        map[t.id] = COLORS[i % COLORS.length];
        i++;
      }
    }
    return map;
  }, [trackers]);

  const machines = Object.keys(machineGroups).sort();
  const nowPercent = Math.min(100, Math.max(0, (nowMinutes / TOTAL_MINUTES) * 100));
  const nowHour = Math.floor(nowMinutes / 60);
  const nowMinute = nowMinutes % 60;

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  if (scheduledRuns.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              Today's Schedule
            </h2>
          </div>
          <span className="text-sm text-gray-500">{dateStr} (UTC)</span>
        </div>
        <p className="text-gray-500 text-sm mt-3">
          No active trackers are scheduled to run today.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Today's Schedule
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{dateStr}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {formatTime(nowHour, nowMinute)} UTC
          </span>
        </div>
      </div>

      {/* Machine timelines */}
      <div className="space-y-5">
        {machines.map((machine) => {
          const runs = machineGroups[machine];
          return (
            <div key={machine}>
              {/* Machine label */}
              <div className="flex items-center gap-1.5 mb-2">
                <Monitor className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {machine}
                </span>
              </div>

              {/* Timeline track */}
              <div className="relative h-10 bg-gray-50 rounded-lg border border-gray-100">
                {/* Elapsed portion */}
                <div
                  className="absolute inset-y-0 left-0 bg-gray-100/70 rounded-l-lg"
                  style={{ width: `${nowPercent}%` }}
                />

                {/* Hour gridlines */}
                {HOUR_MARKS.slice(1, -1).map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 w-px bg-gray-200/70"
                    style={{ left: `${(h / 24) * 100}%` }}
                  />
                ))}

                {/* Scheduled run intervals */}
                {runs.map((run, idx) => {
                  const startMin = run.hour * 60 + run.minute;
                  const endMin = startMin + ESTIMATED_DURATION_MINUTES;
                  const startPct = (startMin / TOTAL_MINUTES) * 100;
                  const endPct =
                    (Math.min(endMin, TOTAL_MINUTES) / TOTAL_MINUTES) * 100;
                  const widthPct = endPct - startPct;
                  const color = trackerColorMap[run.tracker.id];

                  const endHour = Math.floor(endMin / 60);
                  const endMinute = endMin % 60;

                  let status: "completed" | "in_progress" | "upcoming";
                  if (endMin <= nowMinutes) status = "completed";
                  else if (startMin <= nowMinutes) status = "in_progress";
                  else status = "upcoming";

                  return (
                    <div
                      key={`${run.tracker.id}-${idx}`}
                      className="absolute top-1 bottom-1 rounded-md group z-10 cursor-default transition-opacity"
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: color,
                        opacity:
                          status === "completed"
                            ? 0.35
                            : status === "in_progress"
                              ? 1
                              : 0.75,
                      }}
                    >
                      {/* In-progress pulsing border */}
                      {status === "in_progress" && (
                        <div
                          className="absolute inset-0 rounded-md border-2 animate-pulse"
                          style={{ borderColor: color }}
                        />
                      )}

                      {/* Label inside bar */}
                      <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                        <span className="text-[10px] font-semibold text-white truncate drop-shadow-sm">
                          {run.tracker.name}
                        </span>
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 min-w-max">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
                          <p className="font-semibold">{run.tracker.name}</p>
                          <p className="text-gray-300 mt-0.5">
                            {formatTime(run.hour, run.minute)} –{" "}
                            {formatTime(endHour, endMinute)} UTC
                            {status === "completed"
                              ? " (completed)"
                              : status === "in_progress"
                                ? " (in progress)"
                                : ""}
                          </p>
                          {run.tracker.tags.length > 0 && (
                            <p className="text-gray-400 mt-1">
                              {run.tracker.tags.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-center -mt-1">
                          <div className="w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Now indicator */}
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${nowPercent}%` }}
                >
                  <div className="absolute inset-y-0 w-0.5 bg-red-500 -translate-x-1/2" />
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-red-500" />
                  </div>
                  <div className="absolute -bottom-px left-1/2 -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-red-500" />
                  </div>
                </div>
              </div>

              {/* Run legend for this machine */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {runs.map((run, idx) => {
                  const startMin = run.hour * 60 + run.minute;
                  const endMin = startMin + ESTIMATED_DURATION_MINUTES;
                  const endHour = Math.floor(endMin / 60);
                  const endMinute = endMin % 60;
                  const color = trackerColorMap[run.tracker.id];
                  const isPast = endMin <= nowMinutes;
                  return (
                    <div
                      key={`legend-${run.tracker.id}-${idx}`}
                      className="flex items-center gap-1.5"
                      style={{ opacity: isPast ? 0.5 : 1 }}
                    >
                      <div
                        className="w-3 h-2 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium text-gray-700">
                        {run.tracker.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(run.hour, run.minute)} –{" "}
                        {formatTime(endHour, endMinute)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared hour labels */}
      <div className="relative h-5 mt-4 mx-0">
        {HOUR_MARKS.map((h) => (
          <span
            key={h}
            className="absolute text-[10px] text-gray-400 -translate-x-1/2 select-none"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h === 24 ? "" : `${h}:00`}
          </span>
        ))}
      </div>
    </div>
  );
}
