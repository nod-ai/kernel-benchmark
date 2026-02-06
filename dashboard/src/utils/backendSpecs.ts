import { BackendSpec } from "../types";

// Default backend specifications for each supported backend
export const DEFAULT_BACKEND_SPECS: Record<string, BackendSpec> = {
  triton: {
    id: "triton-default",
    name: "Triton (Default)",
    backend: "triton",
    remoteRepository: "triton-lang/triton",
    branch: "main",
    isDefault: true,
  },
  wave: {
    id: "wave-default",
    name: "Wave (Default)",
    backend: "wave",
    remoteRepository: "amd/wave",
    branch: "main",
    isDefault: true,
  },
  iree: {
    id: "iree-default",
    name: "IREE (Default)",
    backend: "iree",
    remoteRepository: "iree-org/iree",
    branch: "main",
    isDefault: true,
  },
  torch: {
    id: "torch-default",
    name: "Torch (Default)",
    backend: "torch",
    remoteRepository: "pytorch/pytorch",
    branch: "main",
    isDefault: true,
  },
  hipblaslt: {
    id: "hipblaslt-default",
    name: "hipBLASLt (Default)",
    backend: "hipblaslt",
    remoteRepository: "ROCm/hipBLASLt",
    branch: "develop",
    isDefault: true,
  },
};

// Example variant backend specs (can be extended by users)
export const VARIANT_BACKEND_SPECS: BackendSpec[] = [
  {
    id: "triton-fav3",
    name: "Triton FAV3",
    backend: "triton",
    remoteRepository: "triton-lang/triton",
    branch: "fav3",
    parentSpecId: "triton-default",
  },
  {
    id: "triton-dev",
    name: "Triton (Dev)",
    backend: "triton",
    remoteRepository: "triton-lang/triton",
    branch: "dev",
    parentSpecId: "triton-default",
  },
  {
    id: "wave-experimental",
    name: "Wave (Experimental)",
    backend: "wave",
    remoteRepository: "amd/wave",
    branch: "experimental",
    parentSpecId: "wave-default",
  },
  {
    id: "iree-vulkan",
    name: "IREE (Vulkan)",
    backend: "iree",
    remoteRepository: "iree-org/iree",
    branch: "vulkan-optimization",
    parentSpecId: "iree-default",
  },
  // Add more variants as needed
];

// Get all backend specs (defaults + variants) organized by backend type
export function getBackendSpecsByType(): Record<string, BackendSpec[]> {
  const specsByType: Record<string, BackendSpec[]> = {};

  // Add defaults
  Object.values(DEFAULT_BACKEND_SPECS).forEach((spec) => {
    if (!specsByType[spec.backend]) {
      specsByType[spec.backend] = [];
    }
    specsByType[spec.backend].push(spec);
  });

  // Add variants
  VARIANT_BACKEND_SPECS.forEach((spec) => {
    if (!specsByType[spec.backend]) {
      specsByType[spec.backend] = [];
    }
    specsByType[spec.backend].push(spec);
  });

  return specsByType;
}

// Get a backend spec by ID
export function getBackendSpecById(id: string): BackendSpec | undefined {
  const allSpecs = [
    ...Object.values(DEFAULT_BACKEND_SPECS),
    ...VARIANT_BACKEND_SPECS,
  ];
  return allSpecs.find((spec) => spec.id === id);
}

// Get the default spec for a backend type
export function getDefaultBackendSpec(backend: string): BackendSpec | undefined {
  return DEFAULT_BACKEND_SPECS[backend];
}

// Create a new variant spec based on an existing spec
export function createVariantSpec(
  baseSpec: BackendSpec,
  overrides: Partial<BackendSpec>
): BackendSpec {
  return {
    ...baseSpec,
    ...overrides,
    id: overrides.id || `${baseSpec.backend}-variant-${Date.now()}`,
    parentSpecId: baseSpec.id,
    isDefault: false,
  };
}
