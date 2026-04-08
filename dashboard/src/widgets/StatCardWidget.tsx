import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";

/**
 * Displays a single summary number.
 *
 * mapping.value  -> field holding the number (from an aggregated pipeline)
 * mapping.label  -> optional secondary label
 *
 * If the pipeline returns a single row with the value field, that value is shown.
 * If it returns multiple rows, the first row is used.
 */
export default function StatCardWidget({ config, data }: WidgetProps) {
  const { value = "value", label } = config.mapping;

  const row = data[0];
  const displayValue = row ? resolveField(row, value) : undefined;
  const displayLabel = label && row ? resolveField(row, label) : undefined;

  const formatted =
    displayValue == null
      ? "—"
      : typeof displayValue === "number"
        ? displayValue % 1 === 0
          ? displayValue.toLocaleString()
          : displayValue.toFixed(2)
        : String(displayValue);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-4xl font-bold text-gray-900">{formatted}</span>
      {displayLabel && (
        <span className="text-sm text-gray-500">{String(displayLabel)}</span>
      )}
    </div>
  );
}
