import {
  TIMESERIES_TABS,
  type TimeseriesData,
  type TimeseriesKey,
} from "../../utils/rocprof";
import TimeseriesChart from "./TimeseriesChart";

interface TimeseriesSectionProps {
  timeseriesData: TimeseriesData;
  selectedTab: TimeseriesKey;
  onTabChange: (tab: TimeseriesKey) => void;
  chartKeyPrefix: string;
}

export default function TimeseriesSection({
  timeseriesData,
  selectedTab,
  onTabChange,
  chartKeyPrefix,
}: TimeseriesSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Instruction Time-Series Analysis
      </h2>

      <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-4">
        {TIMESERIES_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab.id === selectedTab
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        {TIMESERIES_TABS.map((tab) =>
          tab.id === selectedTab ? (
            <TimeseriesChart
              key={`${chartKeyPrefix}-${tab.id}`}
              data={timeseriesData[tab.id]}
              title={tab.name}
              yLabel={tab.yLabel}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
