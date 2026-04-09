import type { WidgetProps } from "../types/dashboard";
import { isFractionValue } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";

function formatScalar(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number")
    return val % 1 === 0 ? val.toLocaleString() : val.toFixed(2);
  return String(val);
}

export default function StatCardWidget({ config, data }: WidgetProps) {
  const { value = "value", label } = config.mapping;

  const row = data[0];
  const displayValue = row ? resolveField(row, value) : undefined;
  const displayLabel = label && row ? resolveField(row, label) : undefined;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      {isFractionValue(displayValue) ? (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-3xl font-bold text-gray-900">
            {displayValue.numerator}
          </span>
          <hr className="w-full border-t-2 border-gray-400 my-1" />
          <span className="text-3xl font-bold text-gray-900">
            {displayValue.denominator}
          </span>
        </div>
      ) : (
        <span className="text-4xl font-bold text-gray-900">
          {formatScalar(displayValue)}
        </span>
      )}
      {displayLabel && (
        <span className="text-sm text-gray-500">{String(displayLabel)}</span>
      )}
    </div>
  );
}
