import type { BackendSpec } from "../types";

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
    remoteRepository: "iree-org/wave",
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
    remoteRepository: "ROCm/pytorch",
    branch: "develop",
    isDefault: true,
  },
  hipblaslt: {
    id: "hipblaslt-default",
    name: "hipBLASLt (Default)",
    backend: "hipblaslt",
    remoteRepository: "ROCm/rocm-libraries",
    branch: "develop",
    isDefault: true,
  },
};

// Example variant backend specs (can be extended by users)
// When parentSpecId is specified, remoteRepository and branch are inherited from parent
export const VARIANT_BACKEND_SPECS: BackendSpec[] = [
  {
    id: "triton-fav3",
    name: "Triton FAV3",
    backend: "triton",
    parentSpecId: "triton-default", // Inherits remoteRepository and branch from triton-default
    branch: "fav3", // Override branch (uses triton-lang/triton @ fav3)
  },
  {
    id: "wave-experimental",
    name: "Wave Experimental",
    backend: "wave",
    parentSpecId: "wave-default", // Inherits remoteRepository and branch from wave-default
    branch: "experimental", // Override just the branch
  },
  // Example: Variant that inherits everything and only changes the commit
  {
    id: "triton-pinned",
    name: "Triton (Pinned v2.1)",
    backend: "triton",
    parentSpecId: "triton-default", // Inherits repo and branch
    commitHash: "abc123def456", // Use a specific commit
  },
  {
    id: "wave-4wave-reduce-reg-pres",
    name: "Wave 4-wave (reduce_reg_pres)",
    backend: "wave",
    backendParam: "wave_4wave",
    remoteRepository: "panditsa/wave",
    branch: "reduce_reg_pres",
    parentSpecId: "wave-default",
  },
  {
    id: "wave-4wave-baseline",
    name: "Wave 4-wave (baseline)",
    backend: "wave",
    backendParam: "wave_4wave_rocroller",
    remoteRepository: "iree-org/wave",
    branch: "main",
    parentSpecId: "wave-default",
  },
  {
    id: "wave-4wave-rocroller",
    name: "Wave 4-wave (rocroller)",
    backend: "wave",
    backendParam: "wave_4wave_rocroller",
    remoteRepository: "panditsa/wave",
    branch: "4waveasm-256x192x256",
    parentSpecId: "wave-default",
  },
  {
    id: "wave-8wave-rocroller",
    name: "Wave 8-wave (rocroller)",
    backend: "wave",
    backendParam: "wave_8wave_rocroller",
    remoteRepository: "adedespirlet/wave",
    branch: "8wavepingpong",
    parentSpecId: "wave-default",
  },
];

// Helper function to resolve a spec with its parent's properties
function resolveSpecWithParent(spec: BackendSpec): BackendSpec {
  if (!spec.parentSpecId) {
    return spec;
  }

  // Find parent spec
  const parentSpec = getBackendSpecById(spec.parentSpecId);
  if (!parentSpec) {
    console.warn(`Parent spec ${spec.parentSpecId} not found for ${spec.id}`);
    return spec;
  }

  // Inherit remoteRepository and branch from parent if not specified
  return {
    ...spec,
    remoteRepository: spec.remoteRepository || parentSpec.remoteRepository,
    branch: spec.branch || parentSpec.branch,
  };
}

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

  // Add variants (resolved with parent properties)
  VARIANT_BACKEND_SPECS.forEach((spec) => {
    if (!specsByType[spec.backend]) {
      specsByType[spec.backend] = [];
    }
    const resolvedSpec = resolveSpecWithParent(spec);
    specsByType[spec.backend].push(resolvedSpec);
  });

  return specsByType;
}

// Get a backend spec by ID (resolved with parent properties)
export function getBackendSpecById(id: string): BackendSpec | undefined {
  const allSpecs = [
    ...Object.values(DEFAULT_BACKEND_SPECS),
    ...VARIANT_BACKEND_SPECS,
  ];
  const spec = allSpecs.find((spec) => spec.id === id);
  if (!spec) return undefined;
  
  // Don't resolve here to avoid infinite recursion in resolveSpecWithParent
  return spec;
}

// Get a fully resolved backend spec by ID (with parent properties inherited)
export function getResolvedBackendSpecById(id: string): BackendSpec | undefined {
  const spec = getBackendSpecById(id);
  if (!spec) return undefined;
  return resolveSpecWithParent(spec);
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
