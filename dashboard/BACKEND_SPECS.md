# Backend Specifications

This document describes the backend specification feature in the kernel benchmark dashboard.

## Overview

Backend specifications allow you to define and track different versions, branches, or configurations of backend compilers. Each backend spec includes:

- **Name**: Display name (e.g., "Triton FAV3")
- **Remote Repository**: GitHub repository (e.g., "triton-lang/triton")
- **Branch**: Git branch to use
- **Commit Hash**: Optional specific commit (uses latest from branch if not specified)
- **Parent Spec**: Optional reference to base spec for variants

## Default Backend Specs

The following default backend specifications are provided:

| Backend    | Repository           | Branch    |
|-----------|----------------------|-----------|
| Triton    | triton-lang/triton   | main      |
| Wave      | amd/wave             | main      |
| IREE      | iree-org/iree        | main      |
| Torch     | pytorch/pytorch      | main      |
| hipBLASLt | ROCm/hipBLASLt       | develop   |

## Creating Backend Variants

You can create variants of existing backends to test different branches, commits, or configurations. To add a new variant:

### 1. Add to `backendSpecs.ts`

Edit `src/utils/backendSpecs.ts` and add a new entry to the `VARIANT_BACKEND_SPECS` array:

```typescript
{
  id: "triton-my-feature",
  name: "Triton (My Feature)",
  backend: "triton",
  remoteRepository: "triton-lang/triton",
  branch: "my-feature-branch",
  commitHash: "abc123def456", // Optional: specific commit
  parentSpecId: "triton-default",
}
```

### 2. Use in Dashboard

When creating a tracker or manual benchmark:

1. Select a backend by clicking its button
2. If variants are available, a dropdown will appear
3. Select the desired variant from the dropdown
4. Click the info button (ⓘ) to view detailed backend metadata

## Backend Spec Fields

### Required Fields

- **id**: Unique identifier (e.g., "triton-fav3")
- **name**: Display name shown in UI
- **backend**: Base backend type (must be one of: iree, wave, triton, torch, hipblaslt)
- **remoteRepository**: GitHub repository in format "owner/repo"
- **branch**: Git branch name

### Optional Fields

- **commitHash**: Specific commit hash. If not provided, uses latest from branch
- **isDefault**: Set to true for default backend specs (automatically set for defaults)
- **parentSpecId**: Reference to parent spec ID if this is a variant

## Example Variants

### Triton FAV3
```typescript
{
  id: "triton-fav3",
  name: "Triton FAV3",
  backend: "triton",
  remoteRepository: "triton-lang/triton",
  branch: "fav3",
  parentSpecId: "triton-default",
}
```

### Wave Experimental
```typescript
{
  id: "wave-experimental",
  name: "Wave (Experimental)",
  backend: "wave",
  remoteRepository: "amd/wave",
  branch: "experimental",
  parentSpecId: "wave-default",
}
```

### Custom Triton with Specific Commit
```typescript
{
  id: "triton-custom",
  name: "Triton (Custom Build)",
  backend: "triton",
  remoteRepository: "my-org/triton-fork",
  branch: "custom-optimizations",
  commitHash: "a1b2c3d4e5f6",
  parentSpecId: "triton-default",
}
```

## API Integration

When trackers or benchmarks are created with backend specs, both the old `backends` array and new `backendSpecs` array are sent to the backend API:

```typescript
{
  backends: ["triton", "wave"], // For backward compatibility
  backendSpecs: [
    {
      id: "triton-fav3",
      name: "Triton FAV3",
      backend: "triton",
      remoteRepository: "triton-lang/triton",
      branch: "fav3",
      // ... other fields
    },
    {
      id: "wave-default",
      name: "Wave (Default)",
      backend: "wave",
      remoteRepository: "amd/wave",
      branch: "main",
      // ... other fields
    }
  ]
}
```

The backend API should prioritize `backendSpecs` when available and fall back to `backends` for backward compatibility.

## UI Features

### Backend Selector Component

The `BackendSelector` component provides:

- **Toggle buttons**: Enable/disable each backend type
- **Variant dropdowns**: Select specific backend variants when available
- **Info panel**: View detailed metadata (repository, branch, commit)
- **Visual feedback**: Selected backends are highlighted in orange

### Tracker Creation

When creating a tracker:

1. Select backends from the "Backends" section
2. For backends with variants, choose from the dropdown
3. Click the info icon to review backend details
4. Backend specs are saved with the tracker configuration

### Manual Benchmarks

Same workflow as tracker creation - select backends and their variants before running benchmarks.

## Notes

- **Backward Compatibility**: Existing trackers with string backends are automatically converted to default backend specs
- **Commit Resolution**: If no commit hash is specified, the latest commit from the branch is used at runtime
- **Variant Management**: Variants inherit the base backend type but can use different repos, branches, or commits
