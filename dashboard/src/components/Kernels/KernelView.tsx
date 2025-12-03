import type { Kernel } from "../../types";
import { Settings, Play, BarChart3, Zap } from "lucide-react";
import { getBackendColor } from "../../utils/color";
import { KERNEL_DIMS, toTitleCase } from "../../utils/utils";

interface ShapeSelectorProps {
  selectedKernel: Kernel;
  kernels: Kernel[];
  setSelected: (kernelId: string | null) => void;
  dimensions: string[];
}

function ShapeSelector({
  dimensions,
  kernels,
  setSelected,
  selectedKernel,
}: ShapeSelectorProps) {
  const selection = dimensions.map((dimension) => ({
    name: dimension,
    value: selectedKernel.shape[dimension],
  }));

  const uniqueElements = (array: any[]) => {
    return Array.from(new Set(array));
  };

  const filterKernels = (dimName: string) => {
    let filteredKernels = kernels;

    for (let dim of selection) {
      if (dim.name === dimName) {
        return filteredKernels;
      }
      filteredKernels = filteredKernels.filter(
        (kernel) => kernel.shape[dim.name] === dim.value
      );
    }

    return [];
  };

  const filterDim = (dimName: string) => {
    return uniqueElements(
      filterKernels(dimName).map((kernel) =>
        dimName === "dtype" ? kernel.dtype : kernel.shape[dimName]
      )
    );
  };

  const setDim = (dimName: string, dimValue: any) => {
    let filteredKernels = filterKernels(dimName);
    filteredKernels = filteredKernels.filter((kernel) =>
      dimName === "dtype"
        ? kernel.dtype === dimValue
        : kernel.shape[dimName] === parseInt(dimValue)
    );
    if (filteredKernels.length > 0) setSelected(filteredKernels[0].id);
    else setSelected(null);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {selection.map((dim) => (
        <div key={dim.name} className="flex items-center gap-2">
          <label className="font-medium text-gray-600 text-sm">
            {toTitleCase(dim.name)}:
          </label>
          <select
            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm min-w-[80px]"
            value={selectedKernel.shape[dim.name]}
            onChange={(e) => {
              setDim(dim.name, e.currentTarget.value);
            }}
          >
            {filterDim(dim.name).map((dimValue) => (
              <option key={dimValue} value={dimValue}>
                {dimValue}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

interface KernelViewProps {
  selectedKernel: Kernel;
  kernels: Kernel[];
  setSelected: (kernelId: string | null) => void;
  sameShapeKernels: Kernel[];
}

export default function KernelView({
  selectedKernel,
  kernels,
  setSelected,
  sameShapeKernels,
}: KernelViewProps) {
  // Find the best and worst performing kernels (highest and lowest TFLOP/s)
  const bestPerformingKernel = sameShapeKernels.reduce((best, current) =>
    current.tflops > best.tflops ? current : best
  );

  const worstPerformingKernel = sameShapeKernels.reduce((worst, current) =>
    current.tflops < worst.tflops ? current : worst
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-500" />
        <h2 className="text-xl font-semibold text-gray-800">
          Selected Kernel Details
        </h2>
      </div>

      {/* Kernel Configuration Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-700">Configuration</h3>
        </div>

        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600 text-sm">Type:</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {toTitleCase(selectedKernel.kernelType)}
            </span>
          </div>

          <ShapeSelector
            dimensions={KERNEL_DIMS[selectedKernel.kernelType]}
            kernels={kernels.filter(
              (k) => k.kernelType === selectedKernel.kernelType
            )}
            setSelected={setSelected}
            selectedKernel={selectedKernel}
          />

          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium">
            <Play className="w-4 h-4" />
            Tune Kernel
          </button>
        </div>
      </div>

      {/* Performance Metrics Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            Performance Metrics by Backend
          </h3>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Backend
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      Arithmetic Intensity
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Mean Time (μs)
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    TFLOP/s
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sameShapeKernels.map((k, index) => {
                  const isBestPerforming = k.id === bestPerformingKernel.id;
                  const isWorstPerforming =
                    k.id === worstPerformingKernel.id &&
                    sameShapeKernels.length > 1;
                  return (
                    <tr
                      key={k.id}
                      className={`transition-colors ${
                        isBestPerforming
                          ? "bg-green-50 hover:bg-green-100 border-l-4 border-green-500"
                          : isWorstPerforming
                            ? "bg-red-50 hover:bg-red-100 border-l-4 border-red-500"
                            : index % 2 === 0
                              ? "bg-white hover:bg-gray-50"
                              : "bg-gray-50/50 hover:bg-gray-100"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: getBackendColor(k.backend)
                                .lighten(0.4)
                                .hex(),
                              color: getBackendColor(k.backend)
                                .darken(0.3)
                                .hex(),
                            }}
                          >
                            {k.backend}
                          </span>
                          {isBestPerforming && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Best
                            </span>
                          )}
                          {isWorstPerforming && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Worst
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                        {k.arithmeticIntensity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                        {k.meanMicroseconds.toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-mono ${
                          isBestPerforming
                            ? "text-green-700 font-bold"
                            : isWorstPerforming
                              ? "text-red-700 font-bold"
                              : "text-gray-700 font-semibold"
                        }`}
                      >
                        {k.tflops.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
