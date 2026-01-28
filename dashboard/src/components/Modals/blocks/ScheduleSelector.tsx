import { Calendar, Clock } from "lucide-react";

type ScheduleType = "weekly" | "interval";
type IntervalUnit = "weeks" | "months";

export interface Schedule {
  isInterval: boolean;
  startDate: string; // YYYY-MM-DD format (HTML date input format, converted to MM-DD-YYYY for backend)
  timeOfDay: string; // HH:MM in UTC
  daysOfWeek?: string[]; // For weekly schedules
  intervalValue?: number; // For interval schedules
  intervalUnit?: IntervalUnit; // For interval schedules
  endDate?: string; // YYYY-MM-DD format (HTML date input format, converted to MM-DD-YYYY for backend)
}

interface ScheduleSelectorProps {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function ScheduleSelector({
  schedule,
  onChange,
  disabled = false,
}: ScheduleSelectorProps) {
  const scheduleType: ScheduleType = schedule.isInterval ? "interval" : "weekly";

  const toggleDay = (day: string) => {
    if (schedule.isInterval) return;

    const daysOfWeek = schedule.daysOfWeek || [];
    const newDaysOfWeek = daysOfWeek.includes(day.toLowerCase())
      ? daysOfWeek.filter((d) => d !== day.toLowerCase())
      : [...daysOfWeek, day.toLowerCase()];

    onChange({
      ...schedule,
      daysOfWeek: newDaysOfWeek,
    });
  };

  const handleScheduleTypeChange = (newType: ScheduleType) => {
    if (newType === "weekly") {
      onChange({
        isInterval: false,
        startDate: schedule.startDate || "",
        timeOfDay: schedule.timeOfDay || "09:00",
        daysOfWeek: [],
        endDate: schedule.endDate,
      });
    } else {
      onChange({
        isInterval: true,
        startDate: schedule.startDate || "",
        timeOfDay: schedule.timeOfDay || "09:00",
        intervalValue: 1,
        intervalUnit: "weeks",
        endDate: schedule.endDate,
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
          <Calendar className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Schedule *</h4>
          <p className="text-sm text-gray-600">
            Configure when to run benchmarks
          </p>
        </div>
      </div>

      {/* Schedule Type Selection */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <label className="flex-1 flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <input
              type="radio"
              name="scheduleType"
              value="weekly"
              checked={scheduleType === "weekly"}
              onChange={(e) =>
                handleScheduleTypeChange(e.target.value as ScheduleType)
              }
              disabled={disabled}
              className="border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-900">
              Weekly on specific days
            </span>
          </label>
          <label className="flex-1 flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <input
              type="radio"
              name="scheduleType"
              value="interval"
              checked={scheduleType === "interval"}
              onChange={(e) =>
                handleScheduleTypeChange(e.target.value as ScheduleType)
              }
              disabled={disabled}
              className="border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-900">
              Every X weeks/months
            </span>
          </label>
        </div>

        {/* Weekly Schedule Options */}
        {scheduleType === "weekly" && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days of Week *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    disabled={disabled}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      (schedule.daysOfWeek || []).includes(day.toLowerCase())
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={schedule.startDate}
                onChange={(e) =>
                  onChange({
                    ...schedule,
                    startDate: e.target.value,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Date when the tracking should begin
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time of Day (UTC) *
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={schedule.timeOfDay}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      timeOfDay: e.target.value,
                    })
                  }
                  disabled={disabled}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-amber-600 mt-1 font-medium">
                ⚠️ Time must be specified in UTC timezone
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={schedule.endDate || ""}
                onChange={(e) =>
                  onChange({
                    ...schedule,
                    endDate: e.target.value || undefined,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Leave blank to run indefinitely
              </p>
            </div>
          </div>
        )}

        {/* Interval Schedule Options */}
        {scheduleType === "interval" && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat Every *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={schedule.intervalValue || 1}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      intervalValue: parseInt(e.target.value) || 1,
                    })
                  }
                  disabled={disabled}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <select
                  value={schedule.intervalUnit || "weeks"}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      intervalUnit: e.target.value as IntervalUnit,
                    })
                  }
                  disabled={disabled}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="weeks">Week(s)</option>
                  <option value="months">Month(s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={schedule.startDate}
                onChange={(e) =>
                  onChange({
                    ...schedule,
                    startDate: e.target.value,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time of Day (UTC) *
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={schedule.timeOfDay}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      timeOfDay: e.target.value,
                    })
                  }
                  disabled={disabled}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-amber-600 mt-1 font-medium">
                ⚠️ Time must be specified in UTC timezone
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={schedule.endDate || ""}
                onChange={(e) =>
                  onChange({
                    ...schedule,
                    endDate: e.target.value || undefined,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Leave blank to run indefinitely
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
