import { useState, useMemo } from "react";
import { Upload, Check, AlertTriangle, Download, FileText } from "lucide-react";
import { validateAttributeValue } from "./AttributeInput";
import type { KernelTypeDefinition } from "../../types";
import type { KernelInputData } from "../../utils/kernelTypes";

interface EngineerFriendlyKernelFormProps {
  kernelType: KernelTypeDefinition;
  onSubmit: (kernels: KernelInputData[]) => void;
}

interface ParsedRow {
  rowNumber: number;
  values: Record<string, string | boolean | number>;
  tag: string;
  errors: string[];
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const convertValue = (
  value: string,
  attributeType: string
): string | boolean | number => {
  const trimmed = value.trim();

  switch (attributeType) {
    case "boolean":
      const lower = trimmed.toLowerCase();
      return (
        lower === "true" || lower === "1" || lower === "yes" || lower === "y"
      );
    case "integer":
      const intValue = parseInt(trimmed);
      return isNaN(intValue) ? trimmed : intValue;
    case "float":
      const floatValue = parseFloat(trimmed);
      return isNaN(floatValue) ? trimmed : floatValue;
    case "string":
    default:
      return trimmed;
  }
};

export default function EngineerFriendlyKernelForm({
  kernelType,
  onSubmit,
}: EngineerFriendlyKernelFormProps) {
  const [inputText, setInputText] = useState<string>("");

  // Generate example CSV format
  const exampleCSV = useMemo(() => {
    const headers = [
      "tag",
      ...kernelType.attributes.map((attr) => attr.name),
    ].join(",");
    const exampleRow = [
      "example-tag",
      ...kernelType.attributes.map((attr) => {
        switch (attr.type) {
          case "integer":
            const intMin = attr.constraints?.min ?? 1;
            const intMax = attr.constraints?.max ?? 100;
            return Math.floor((intMin + intMax) / 2).toString();
          case "float":
            const floatMin = attr.constraints?.min ?? 0.1;
            const floatMax = attr.constraints?.max ?? 1.0;
            return ((floatMin + floatMax) / 2).toFixed(2);
          case "string":
            return attr.constraints?.choices?.[0] ?? "example";
          case "boolean":
            return "true";
          default:
            return "value";
        }
      }),
    ].join(",");

    return `${headers}\n${exampleRow}`;
  }, [kernelType]);

  // Parse and validate input
  const parsedData = useMemo(() => {
    if (!inputText.trim()) {
      return { rows: [], errors: [] };
    }

    const lines = inputText
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    if (lines.length === 0) {
      return { rows: [], errors: [] };
    }

    const errors: string[] = [];
    const rows: ParsedRow[] = [];

    // Parse header line (optional)
    let startIndex = 0;
    const firstLine = parseCSVLine(lines[0]);

    // Check if first line looks like headers
    const expectedHeaders = [
      "tag",
      ...kernelType.attributes.map((attr) => attr.name),
    ];
    const isHeaderLine =
      firstLine.length === expectedHeaders.length &&
      firstLine.every(
        (cell, index) =>
          expectedHeaders[index].toLowerCase() === cell.toLowerCase().trim()
      );

    if (isHeaderLine) {
      startIndex = 1;
    }

    // Parse data lines
    for (let i = startIndex; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];
      const cells = parseCSVLine(line);
      const expectedColumns = kernelType.attributes.length + 1; // +1 for tag

      if (cells.length !== expectedColumns) {
        errors.push(
          `Line ${lineNumber}: Expected ${expectedColumns} values (tag + ${kernelType.attributes.length} attributes), got ${cells.length}`
        );
        continue;
      }

      const tag = cells[0].trim();
      const values: Record<string, string | boolean | number> = {};
      const rowErrors: string[] = [];

      // Validate tag
      if (!tag) {
        rowErrors.push("tag: Tag is required");
      }

      kernelType.attributes.forEach((attr, index) => {
        const rawValue = cells[index + 1]; // +1 because tag is at index 0
        const convertedValue = convertValue(rawValue, attr.type);
        values[attr.name] = convertedValue;

        // Validate the value
        const validation = validateAttributeValue(convertedValue, attr);
        if (!validation.isValid) {
          rowErrors.push(`${attr.name}: ${validation.message}`);
        }
      });

      rows.push({
        rowNumber: lineNumber,
        values,
        tag,
        errors: rowErrors,
      });
    }

    return { rows, errors };
  }, [inputText, kernelType]);

  const downloadTemplate = () => {
    const blob = new Blob([exampleCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kernelType.name}-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = () => {
    const validRows = parsedData.rows.filter((row) => row.errors.length === 0);

    const kernels: KernelInputData[] = validRows.map((row, index) => ({
      id: `kernel-${Date.now()}-${index}`,
      values: row.values,
      tag: row.tag,
      isValid: true,
      errors: {},
    }));

    if (kernels.length > 0) {
      onSubmit(kernels);
      setInputText("");
    }
  };

  const validKernelCount = parsedData.rows.filter(
    (row) => row.errors.length === 0
  ).length;
  const totalRows = parsedData.rows.length;
  const hasErrors =
    parsedData.errors.length > 0 ||
    parsedData.rows.some((row) => row.errors.length > 0);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            Bulk Import Kernels
          </h3>
          <p className="text-gray-600 mt-1">
            Import multiple kernels using CSV format for efficient bulk
            operations.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          <span>Download Template</span>
        </button>
      </div>

      {/* Format Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">
              Expected CSV Format
            </h4>
            <p className="text-blue-800 mb-3">
              Each line should contain values for:{" "}
              <span className="font-mono bg-white px-2 py-1 rounded text-sm">
                tag, {kernelType.attributes.map((attr) => attr.name).join(", ")}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-blue-200 rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
          <pre className="text-gray-800">{exampleCSV}</pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-blue-700">
          <div>• First line can optionally contain headers</div>
          <div>• Boolean values: true/false, 1/0, yes/no, y/n</div>
          <div>• Use quotes for values containing commas</div>
        </div>
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          CSV Data Input
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste your CSV data here...\n\nExample:\n${exampleCSV}`}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
        />
      </div>

      {/* Validation Results */}
      {inputText.trim() && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Validation Results</h4>
            <div className="flex items-center gap-4">
              {hasErrors && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {totalRows - validKernelCount} errors
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {validKernelCount} valid kernels
                </span>
              </div>
            </div>
          </div>

          {/* Parse Errors */}
          {parsedData.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h5 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Parse Errors
              </h5>
              <ul className="text-sm text-red-700 space-y-1">
                {parsedData.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Row Validation Errors */}
          {parsedData.rows.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-2">
              {parsedData.rows
                .filter((row) => row.errors.length > 0)
                .map((row) => (
                  <div
                    key={row.rowNumber}
                    className="p-3 rounded-lg border bg-red-50 border-red-200"
                  >
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-red-800">
                          Row {row.rowNumber}:
                        </span>
                        <span className="text-red-700 ml-1">
                          {row.errors.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {validKernelCount > 0 ? (
              <div className="flex items-center gap-2 text-green-700">
                <div className="p-1 bg-green-100 rounded-full">
                  <Check className="w-4 h-4" />
                </div>
                <span className="font-medium">
                  {validKernelCount} kernel{validKernelCount !== 1 ? "s" : ""}{" "}
                  ready to import
                </span>
              </div>
            ) : inputText.trim() ? (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span>Please fix validation errors before importing</span>
              </div>
            ) : (
              <div className="text-gray-600">
                <span>Paste CSV data above to get started</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={validKernelCount === 0}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            <span>
              Import {validKernelCount} Kernel
              {validKernelCount !== 1 ? "s" : ""}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
