import { useState, useEffect } from "react";
import { FaCheck, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import type { KernelTypeAttribute } from "../../types";

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

interface AttributeInputProps {
  attribute: KernelTypeAttribute;
  value: string | boolean | number;
  onChange: (value: string | boolean | number) => void;
  error?: string;
}

// Validation functions for different attribute types
export const validateAttributeValue = (
  value: string | boolean | number,
  attribute: KernelTypeAttribute
): ValidationResult => {
  // Handle required validation
  if (attribute.required && (!value || value === "")) {
    return { isValid: false, message: `${attribute.name} is required` };
  }

  // If not required and empty, it's valid
  if (!attribute.required && (!value || value === "")) {
    return { isValid: true };
  }

  const constraints = attribute.constraints;

  switch (attribute.type) {
    case "integer":
      const intValue =
        typeof value === "number" ? value : parseInt(value as string);
      if (isNaN(intValue)) {
        return { isValid: false, message: "Must be a valid integer" };
      }
      if (constraints?.min !== undefined && intValue < constraints.min) {
        return {
          isValid: false,
          message: `Must be at least ${constraints.min}`,
        };
      }
      if (constraints?.max !== undefined && intValue > constraints.max) {
        return {
          isValid: false,
          message: `Must be at most ${constraints.max}`,
        };
      }
      return { isValid: true };

    case "float":
      const floatValue =
        typeof value === "number" ? value : parseFloat(value as string);
      if (isNaN(floatValue)) {
        return { isValid: false, message: "Must be a valid number" };
      }
      if (constraints?.min !== undefined && floatValue < constraints.min) {
        return {
          isValid: false,
          message: `Must be at least ${constraints.min}`,
        };
      }
      if (constraints?.max !== undefined && floatValue > constraints.max) {
        return {
          isValid: false,
          message: `Must be at most ${constraints.max}`,
        };
      }
      return { isValid: true };

    case "string":
      if (constraints?.choices && constraints.choices.length > 0) {
        if (!constraints.choices.includes(value as string)) {
          return {
            isValid: false,
            message: `Must be one of: ${constraints.choices.join(", ")}`,
          };
        }
      }
      return { isValid: true };

    case "boolean":
      return { isValid: true }; // Boolean values are always valid

    default:
      return { isValid: false, message: "Unknown attribute type" };
  }
};

export default function AttributeInput({
  attribute,
  value,
  onChange,
  error,
}: AttributeInputProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
  });

  useEffect(() => {
    const result = validateAttributeValue(value, attribute);
    setValidation(result);
  }, [value, attribute]);

  const hasError = !validation.isValid || !!error;
  const showSuccess = validation.isValid && value !== "" && !error;

  const getInputClassName = () => {
    const baseClasses =
      "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";
    if (hasError) {
      return baseClasses + " border-red-300 bg-red-50";
    } else if (showSuccess) {
      return baseClasses + " border-green-300 bg-green-50";
    } else {
      return baseClasses + " border-gray-300";
    }
  };

  const renderInput = () => {
    const inputClassName = getInputClassName();

    switch (attribute.type) {
      case "integer":
        return (
          <input
            type="number"
            step="1"
            value={value === "" ? "" : (value as number | string)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                onChange("");
              } else {
                const parsed = parseInt(val);
                onChange(isNaN(parsed) ? val : parsed);
              }
            }}
            placeholder={
              attribute.constraints?.min !== undefined &&
              attribute.constraints?.max !== undefined
                ? `${attribute.constraints.min} - ${attribute.constraints.max}`
                : "Enter integer"
            }
            className={inputClassName}
          />
        );

      case "float":
        return (
          <input
            type="number"
            step="any"
            value={value === "" ? "" : (value as number | string)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                onChange("");
              } else {
                const parsed = parseFloat(val);
                onChange(isNaN(parsed) ? val : parsed);
              }
            }}
            placeholder={
              attribute.constraints?.min !== undefined &&
              attribute.constraints?.max !== undefined
                ? `${attribute.constraints.min} - ${attribute.constraints.max}`
                : "Enter number"
            }
            className={inputClassName}
          />
        );

      case "string":
        if (
          attribute.constraints?.choices &&
          attribute.constraints.choices.length > 0
        ) {
          return (
            <select
              value={value as string}
              onChange={(e) => onChange(e.target.value)}
              className={inputClassName}
            >
              <option value="">Select {attribute.name}</option>
              {attribute.constraints.choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          );
        } else {
          return (
            <input
              type="text"
              value={value as string}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Enter ${attribute.name.toLowerCase()}`}
              className={inputClassName}
            />
          );
        }

      case "boolean":
        return (
          <div className="flex items-center space-x-3">
            <label className="flex items-center">
              <input
                type="radio"
                name={`${attribute.name}-bool`}
                checked={value === true}
                onChange={() => onChange(true)}
                className="mr-2"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={`${attribute.name}-bool`}
                checked={value === false}
                onChange={() => onChange(false)}
                className="mr-2"
              />
              <span>No</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  // Create tooltip content for description and constraints
  const getTooltipContent = () => {
    const parts = [];

    if (attribute.description) {
      parts.push(attribute.description);
    }

    if (attribute.constraints) {
      if (attribute.type === "string" && attribute.constraints.choices) {
        parts.push(`Choices: ${attribute.constraints.choices.join(", ")}`);
      }
      if (attribute.type === "integer" || attribute.type === "float") {
        if (
          attribute.constraints.min !== undefined &&
          attribute.constraints.max !== undefined
        ) {
          parts.push(
            `Range: ${attribute.constraints.min} - ${attribute.constraints.max}`
          );
        } else if (attribute.constraints.min !== undefined) {
          parts.push(`Min: ${attribute.constraints.min}`);
        } else if (attribute.constraints.max !== undefined) {
          parts.push(`Max: ${attribute.constraints.max}`);
        }
      }
    }

    return parts.join(" • ");
  };

  const tooltipContent = getTooltipContent();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <div className="flex items-center gap-2">
          <span>{attribute.name}</span>
          {attribute.required && (
            <span className="text-red-500 text-xs">*</span>
          )}
          {tooltipContent && (
            <div className="relative group">
              <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap max-w-xs z-10">
                {tooltipContent}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          )}
          {showSuccess && <FaCheck className="text-green-500 text-xs" />}
          {hasError && (
            <FaExclamationTriangle className="text-red-500 text-xs" />
          )}
        </div>
      </label>

      {renderInput()}

      {(validation.message || error) && (
        <div className="text-xs text-red-600">
          {error || validation.message}
        </div>
      )}
    </div>
  );
}
