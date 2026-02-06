# Backend Specification Feature - Quick Start

## Installation & Setup

```bash
cd /home/adkankar/kernel-benchmark/dashboard
npm install
npm run dev
```

## What's Been Implemented

### ✅ Feature Checklist

- [x] **BackendSpec Interface** - Metadata for backend specifications
  - name (e.g., "Triton FAV3")
  - remote repository (e.g., "triton-lang/triton")
  - branch
  - commit hash (optional, uses latest if not specified)

- [x] **Default Backend Specs** - Pre-configured for all backends
  - Triton (triton-lang/triton, main)
  - Wave (amd/wave, main)
  - IREE (iree-org/iree, main)
  - Torch (pytorch/pytorch, main)
  - hipBLASLt (ROCm/hipBLASLt, develop)

- [x] **Variant System** - Allow backend specs to be variants of existing ones
  - Triton FAV3 (variant of default Triton)
  - Triton Dev (variant of default Triton)
  - Wave Experimental (variant of default Wave)
  - IREE Vulkan (variant of default IREE)
  - Easy to add more variants

- [x] **Enhanced UI** - Dropdown system for backend selection
  - Click backend button to enable/disable
  - Dropdown appears for backends with variants
  - Info button shows detailed metadata
  - Defaults to baseline backend for each type

## Quick Usage

### 1. Creating a Tracker with Variants

1. Open the "Add Tracker" modal
2. Click on a backend (e.g., "triton") - it defaults to the baseline
3. If variants exist, a dropdown appears next to the button
4. Select your desired variant from the dropdown
5. Click the info icon (ⓘ) to view full backend details

### 2. Adding Your Own Variants

Edit `src/utils/backendSpecs.ts`:

```typescript
export const VARIANT_BACKEND_SPECS: BackendSpec[] = [
  // Add your variant here
  {
    id: "triton-my-feature",
    name: "Triton (My Feature)",
    backend: "triton",
    remoteRepository: "my-org/triton-fork",
    branch: "feature-branch",
    commitHash: "abc123", // Optional
    parentSpecId: "triton-default",
  },
  // ... existing variants
];
```

## File Structure

```
dashboard/
├── src/
│   ├── types.ts                          # Added BackendSpec interface
│   ├── utils/
│   │   └── backendSpecs.ts              # NEW: Backend spec definitions
│   └── components/
│       └── Modals/
│           ├── AddTrackerModal.tsx       # Updated to use BackendSpec
│           ├── ManualBenchmarkModal.tsx  # Updated to use BackendSpec
│           └── blocks/
│               └── BackendSelector.tsx   # Redesigned with variants UI
├── BACKEND_SPECS.md                      # User documentation
├── IMPLEMENTATION_SUMMARY.md             # Technical details
└── QUICK_START.md                        # This file
```

## API Integration

When a tracker or benchmark is created, both formats are sent:

```json
{
  "backends": ["triton", "wave"],
  "backendSpecs": [
    {
      "id": "triton-fav3",
      "name": "Triton FAV3",
      "backend": "triton",
      "remoteRepository": "triton-lang/triton",
      "branch": "fav3"
    },
    {
      "id": "wave-default",
      "name": "Wave (Default)",
      "backend": "wave",
      "remoteRepository": "amd/wave",
      "branch": "main"
    }
  ]
}
```

## Backward Compatibility

✅ Old trackers with only `backends: ["triton", "wave"]` automatically convert to default backend specs
✅ No breaking changes to existing functionality

## Next Steps

### For Frontend Development
1. Run `npm install` and `npm run dev`
2. Test the new backend selector UI
3. Create trackers with different variants
4. Verify info panels display correctly

### For Backend Integration
1. Update API to accept `backendSpecs` field
2. Use spec metadata for repository cloning
3. Resolve commit hashes when not specified
4. Store spec information with benchmark results

## Documentation

- **BACKEND_SPECS.md** - Comprehensive user guide
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details
- **QUICK_START.md** - This file (getting started guide)

## Questions?

Refer to the documentation files or review:
- `src/utils/backendSpecs.ts` - Spec definitions and utilities
- `src/components/Modals/blocks/BackendSelector.tsx` - UI implementation
