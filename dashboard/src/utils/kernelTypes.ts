import type { KernelTypeDefinition } from "../types";

export interface KernelInputData {
  id: string;
  values: Record<string, any>;
  tag: string;
  isValid: boolean;
  errors: Record<string, string>;
}

// Helper function to create a new kernel type with generated ID
export function createKernelType(
  data: Omit<KernelTypeDefinition, "_id">
): KernelTypeDefinition {
  return {
    ...data,
    _id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

// Helper function to get a kernel type by its name
export function getKernelTypeByName(
  kernelTypes: KernelTypeDefinition[],
  name: string
): KernelTypeDefinition | undefined {
  return kernelTypes.find((kt) => kt.name === name);
}

// Helper function to validate kernel type data
export function validateKernelTypeData(
  data: Omit<KernelTypeDefinition, "_id">
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name.trim()) {
    errors.push("Name is required");
  }

  if (!data.displayName.trim()) {
    errors.push("Display name is required");
  }

  if (data.attributes.length === 0) {
    errors.push("At least one attribute is required");
  }

  // Validate attribute names are unique
  const attrNames = data.attributes.map((attr) => attr.name.toLowerCase());
  const duplicateNames = attrNames.filter(
    (name, index) => attrNames.indexOf(name) !== index
  );
  if (duplicateNames.length > 0) {
    errors.push(
      `Duplicate attribute names: ${[...new Set(duplicateNames)].join(", ")}`
    );
  }

  // Validate each attribute
  data.attributes.forEach((attr, index) => {
    if (!attr.name.trim()) {
      errors.push(`Attribute ${index + 1}: Name is required`);
    }

    if (attr.constraints) {
      // Validate numeric constraints
      if (
        (attr.type === "integer" || attr.type === "float") &&
        attr.constraints.min !== undefined &&
        attr.constraints.max !== undefined
      ) {
        if (attr.constraints.min > attr.constraints.max) {
          errors.push(
            `Attribute "${attr.name}": Min value cannot be greater than max value`
          );
        }
      }

      // Validate string choices
      if (attr.type === "string" && attr.constraints.choices) {
        const uniqueChoices = [...new Set(attr.constraints.choices)];
        if (uniqueChoices.length !== attr.constraints.choices.length) {
          errors.push(`Attribute "${attr.name}": Duplicate choices found`);
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
