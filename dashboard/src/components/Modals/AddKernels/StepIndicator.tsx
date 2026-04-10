interface StepIndicatorProps {
  steps: { key: string; label: string }[];
  currentIndex: number;
}

export default function StepIndicator({
  steps,
  currentIndex,
}: StepIndicatorProps) {
  return (
    <div className="px-6 pt-2 pb-0">
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                i <= currentIndex
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs ${
                i <= currentIndex
                  ? "text-gray-800 font-medium"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  i < currentIndex ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
