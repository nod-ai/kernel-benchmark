# Dashboard

A modern React-based web interface for real-time microkernel performance visualization and management. The dashboard provides interactive performance analysis, kernel configuration management, and automated benchmarking workflows for AMD GPU codegen pipelines.

## Architecture Overview

Built with **React 19**, **TypeScript**, and **Vite**, the dashboard offers a responsive, modern UI for managing and analyzing kernel benchmarks across multiple backends (Wave, IREE, hipBLASLt, Triton, PyTorch).

### Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **UI Styling**: Tailwind CSS 4
- **Charts**: Chart.js with zoom plugin
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Data Processing**: PapaParse (CSV), NumPy-style operations
- **Dashboard Layouts**: react-grid-layout v2 (drag-and-drop widget grids)
- **Formula Engine**: safe-expr-eval (user-defined computed fields)

## Features

### 📊 Interactive Performance Visualization

**Roofline Plot**
- Visualize kernel performance vs theoretical hardware limits
- Interactive point selection for detailed analysis
- Color-coded by backend for easy comparison
- Zoom and pan for detailed exploration

**Performance Comparison Charts**
- **Bar Charts**: Compare average TFLOPs or runtime across backends
- **Bell Curves**: Frequency distribution analysis for performance metrics
- **Historical Trends**: Track performance changes over time

### 🔍 Advanced Filtering

**Multi-dimensional Filters:**
- Kernel type (GEMM, attention, convolution)
- Data types (f16, f32, i8, etc.)
- Problem sizes (M, N, K dimensions)
- Backend implementations
- Custom tags

**Percentile-based Analysis:**
- Focus on top-performing kernels
- Filter outliers for cleaner comparisons
- Adjustable percentile thresholds

### 🧩 Modular Dashboard System

The dashboard includes a fully customizable widget-based view alongside the classic fixed layout. Users can build their own dashboards by adding, configuring, and arranging widgets on a drag-and-drop grid.

**Widget Types:**
- **Pie Chart** -- segment/value breakdown (e.g., kernel pass/fail rates)
- **Bar Chart** -- categorical comparisons (e.g., TFLOPs by backend)
- **Line Chart** -- time-series or sequential data with multi-series support
- **Scatter Plot** -- two-variable correlation with optional color, size, and label dimensions
- **Roofline** -- hardware roofline analysis
- **Stat Card** -- single-number KPIs (e.g., total kernel count, average TFLOPs)
- **Table** -- tabular data with configurable columns
- **Bell Curve** -- performance distribution analysis

**Data Pipeline:**

Each widget defines a transform pipeline that processes raw data client-side. Transforms are applied in sequence:

| Transform | Purpose |
|-----------|---------|
| `filter` | Keep rows matching field/operator/value rules |
| `group_by` | Group rows by one or more fields |
| `aggregate` | Reduce groups via `count`, `sum`, `avg`, `min`, `max`, `geo_mean`, `count_where` |
| `compute` | Add a calculated field using a math expression (powered by `safe-expr-eval`) |
| `pivot` | Flatten grouped rows into a single row with key-prefixed columns (for cross-group ratios) |
| `sort` | Order rows by a field |
| `limit` | Cap the number of output rows |

**Global Filters:**

Dashboard-level filters (single-select, multi-select, range, date range) are auto-applied to all widgets before their transform pipelines run. Individual widgets can opt out via a toggle in the widget editor. Filters can be created, edited, and deleted inline when in edit mode.

**Inline Validation:**

The widget configuration modal provides real-time validation:
- Field names are checked against available data fields (amber warning for unknowns)
- Compute expressions are parsed live (green checkmark or red error message)
- Each widget type shows only its relevant data mapping fields

**Persistence:**

Dashboard configurations are saved to the backend (Azure Table Storage) and keyed by context:
- Tracker dashboards: saved per tracker (slug `tracker-{dashboardName}`)
- Run dashboards: shared default (slug `__default__`)

On page load, the saved config is fetched; if none exists, the built-in default is used.

### 🎯 Kernel Management

**Add Kernels**
- User-friendly form interface for non-experts
- Engineer-friendly JSON input for batch operations
- Custom kernel type definitions with attribute schemas
- Validation and preview before submission

**Bulk Operations**
- Select multiple kernels for batch operations
- Edit tags and workflows across selections
- Delete kernels in bulk
- Filter and select by multiple criteria

### ⚙️ Tuning Workflows

**Interactive Tuning Interface**
- Select kernels for hyperparameter optimization
- Configure tuning parameters (trials, strategies)
- Monitor in-progress tuning runs
- View tuning results and optimal configurations

**Tuning Results Visualization**
- Compare tuned vs untuned performance
- View optimal hyperparameters per kernel
- Track tuning history and improvements

### 📈 Historical Analysis

**Performance Tracking**
- View benchmark run history
- Track pull request performance impact
- Regression detection and speedup analysis
- Per-PR performance summaries with change statistics

**Run Management**
- Trigger new benchmark runs for specific PRs
- Cancel running workflows
- Filter by machine, kernel selection
- View detailed run status and steps

## Directory Structure

```
dashboard/
├── src/
│   ├── main.tsx              # Application entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── pages/                # Main application pages
│   │   ├── Dashboard.tsx     # Performance visualization (classic + modular)
│   │   ├── CustomDashboard.tsx # Saved custom dashboard viewer
│   │   ├── Tuning.tsx        # Kernel tuning interface
│   │   ├── History.tsx       # Benchmark run history
│   │   └── AddKernels.tsx    # Kernel configuration
│   ├── components/           # Reusable UI components
│   │   ├── Navbar.tsx        # Top navigation bar
│   │   ├── PageContainer.tsx # Page wrapper with loading
│   │   ├── FilterControls.tsx # Filter UI components
│   │   ├── RunStatus.tsx     # Workflow status display
│   │   ├── Plots/            # Chart components
│   │   │   ├── RooflinePlot.tsx
│   │   │   ├── BarPlot.tsx
│   │   │   └── BellPlot.tsx
│   │   ├── Kernels/          # Kernel list components
│   │   │   ├── KernelList.tsx
│   │   │   ├── KernelListItem.tsx
│   │   │   └── KernelView.tsx
│   │   ├── KernelForm/       # Kernel input forms
│   │   │   ├── UserFriendlyKernelForm.tsx
│   │   │   └── EngineerFriendlyKernelForm.tsx
│   │   ├── KernelTypes/      # Kernel type management
│   │   │   ├── KernelTypeDisplay.tsx
│   │   │   └── KernelTypeForm.tsx
│   │   ├── DashboardRenderer.tsx   # Modular dashboard grid + edit chrome
│   │   ├── GlobalFilterBar.tsx     # Dashboard-level filter bar (view + CRUD)
│   │   ├── DashboardEditor/        # Widget editing components
│   │   │   ├── EditToolbar.tsx     # Edit / Save / Discard toolbar
│   │   │   ├── WidgetCatalog.tsx   # "Add widget" type picker
│   │   │   └── WidgetConfigModal.tsx # Widget configuration modal
│   │   └── Modals/           # Modal dialogs
│   │       ├── TuningConfirmationModal.tsx
│   │       ├── BenchmarkConfirmationModal.tsx
│   │       ├── DeleteKernelsModal.tsx
│   │       └── EditKernelsModal.tsx
│   ├── widgets/              # Modular dashboard widget system
│   │   ├── registry.ts       # Maps WidgetType → React component
│   │   ├── defaults.ts       # Built-in default dashboard config
│   │   ├── WidgetRenderer.tsx # Pipeline execution + widget dispatch
│   │   ├── PieChartWidget.tsx
│   │   ├── BarChartWidget.tsx
│   │   ├── LineChartWidget.tsx
│   │   ├── ScatterPlotWidget.tsx
│   │   ├── RooflineWidget.tsx
│   │   ├── StatCardWidget.tsx
│   │   ├── TableWidget.tsx
│   │   └── BellCurveWidget.tsx
│   ├── utils/                # Utility functions
│   │   ├── github.ts         # Centralized backend API calls
│   │   ├── csv.ts            # Artifact data loading
│   │   ├── pipeline.ts       # Widget data transform pipeline
│   │   ├── formula.ts        # Expression parser (safe-expr-eval)
│   │   ├── utils.ts          # General utilities
│   │   ├── color.ts          # Color generation
│   │   └── kernelTypes.ts    # Kernel type utilities
│   ├── hooks/                # Custom React hooks
│   │   ├── useKernelFilters.ts
│   │   ├── useDashboardConfig.ts # Load/save dashboard configs
│   │   └── useGlobalFilters.ts   # Global filter value init
│   ├── contexts/             # React contexts
│   │   ├── AuthContext.tsx   # Authentication state
│   │   └── useModal.ts       # Modal management
│   └── styles/               # Global styles
│       └── globals.scss
├── public/                   # Static assets
├── package.json              # Dependencies
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
└── Dockerfile                # Container configuration
```

## Pages

### 🏠 Dashboard (`/dashboard/:runId`, `/dashboard/tracker/:name`)

**Purpose**: Visualize and compare kernel performance for a specific benchmark run or tracker.

The page offers two switchable views:

**Classic View** -- Fixed layout with curated visualizations:
- **Roofline Plot**: Performance vs arithmetic intensity
- **Backend Comparison**: Bar/bell chart comparisons
- **Kernel Details**: Click any point to see detailed specs
- **Same-Shape Analysis**: Compare implementations of identical problems
- **Filters**: Narrow down by type, dtype, backend, tags

**Modular View** -- User-customizable widget grid:
- Drag-and-drop layout editing via `react-grid-layout`
- Add/remove/configure widgets from a catalog of 8 types
- Define per-widget transform pipelines (filter → group → aggregate → compute → pivot → sort → limit)
- Dashboard-level global filters auto-applied to all widgets
- Inline validation for field names and computed expressions
- Configs persist per context (tracker dashboards save independently)
- `safe-expr-eval` formula engine for user-defined computed fields

**Use Cases:**
- Identify performance bottlenecks
- Compare backend efficiency
- Build custom KPI views per tracker
- Compute cross-backend ratios (via pivot + compute transforms)
- Validate regression fixes

### 🎯 Tuning (`/tune`)

**Purpose**: Select kernels for hyperparameter optimization and monitor tuning runs.

**Key Features:**
- **Kernel Selection**: Multi-select with filters (type, dtype, tag)
- **Tuning Status**: See tuned vs untuned kernels
- **Batch Operations**: Tune multiple kernels simultaneously
- **In-Progress Monitoring**: Real-time status of running tuning workflows
- **Results Display**: View tuning configurations and improvements

**Use Cases:**
- Optimize new kernel implementations
- Re-tune after compiler changes
- Validate tuning parameters
- Track tuning improvements

### 📜 History (`/history`)

**Purpose**: Track performance across pull requests and detect regressions.

**Key Features:**
- **PR Timeline**: Chronological list of tracked PRs
- **Run Status**: See benchmark completion and results
- **Change Statistics**: Speedup/regression metrics per PR
- **Run Triggering**: Dispatch new benchmarks for specific PRs
- **Rebase**: Update PR list from GitHub

**Use Cases:**
- Monitor PR performance impact
- Detect performance regressions
- Validate optimization work
- Track historical trends

### ➕ Add Kernels (`/add`)

**Purpose**: Configure new kernels for benchmarking and create custom kernel types.

**Key Features:**
- **Kernel Type Selection**: Choose from existing types or create new
- **Dual Input Modes**:
  - **User-Friendly**: Form-based input with validation
  - **Engineer-Friendly**: JSON/CSV batch input
- **Kernel Type Management**: Create, edit, delete type definitions
- **Attribute Schemas**: Define custom attributes per kernel type
- **Batch Addition**: Add multiple kernels at once

**Use Cases:**
- Add new kernel implementations
- Create custom kernel types
- Bulk import kernel configurations
- Define problem size ranges

## Getting Started

### Prerequisites

- Node.js 16+ (18+ recommended)
- npm or yarn
- Backend API running (see [Backend README](../backend/README.md))

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Configuration

Create a `.env` file (if needed for API URL override):

```bash
VITE_API_URL=http://localhost:3000
```

By default, the app connects to `http://localhost:3000` for the backend API.

### Development

```bash
# Start dev server with hot reload
npm run dev

# The app will be available at http://localhost:5173
```

### Production Build

```bash
# Build optimized production bundle
npm run build

# Output in dist/ directory
```

### Docker Deployment

```bash
# Build Docker image
docker build -t kernel-dashboard .

# Run container
docker run -p 80:80 kernel-dashboard
```

## Configuration

### Vite Configuration

The Vite config includes:
- React SWC plugin for fast refresh
- Tailwind CSS integration
- TypeScript support
- Production optimizations

### Tailwind CSS

Custom theme configuration in `tailwind.config.js`:
- Consistent color palette
- Responsive breakpoints
- Custom utility classes

### TypeScript

Strict mode enabled with:
- Full type checking
- No implicit any
- Strict null checks

## API Integration

The dashboard communicates with the backend via REST API:

### Key API Functions

All backend communication is centralized in `src/utils/github.ts` through an `apiFetch` wrapper that automatically attaches the auth token and emits an `auth-required` event on 401 responses.

```typescript
// Kernel data
const kernels = await fetchKernels();
const runData = await fetchArtifact(runId);

// Benchmarking
await triggerBenchWorkflow(pr, config);
await triggerTuningWorkflow(kernelIds);

// Kernel management
await addKernels(kernelConfigs);
await updateKernels(partialUpdates);

// Dashboard configs
const config = await fetchDashboard("tracker-my-tracker");
const saved = await saveDashboard(config); // creates or updates based on _id
const all = await listDashboards();

// Trackers
const tracker = await fetchTrackerByDashboardName("my-tracker");
const runs = await fetchTrackerRuns(trackerId);
const timeline = await fetchTrackerPerformanceTimeline(trackerId, startDate, endDate);
```

## Data Flow

### Dashboard Page (Classic View)

1. **Load Run Data**: Fetch artifact for specific run
2. **Parse Results**: Extract kernel metrics (TFLOPs, runtime, etc.)
3. **Apply Filters**: User selects type, dtype, backend filters
4. **Compute Common Kernels**: Find kernels present across all backends
5. **Generate Visualizations**: Render roofline and comparison plots
6. **Handle Interactions**: Click to select, zoom to explore

### Dashboard Page (Modular View)

1. **Determine Context**: Derive config slug from URL (tracker or default)
2. **Load Config**: Fetch saved `DashboardConfig` from backend; fall back to built-in default
3. **Load Run Data**: Fetch kernel artifact for the active run
4. **Initialize Global Filters**: Populate filter defaults from data (unique values per field)
5. **Render Widgets**: For each widget in the config:
   - Apply auto-generated global filter rules (unless widget opts out)
   - Execute the widget's transform pipeline (`executePipeline`)
   - Pass transformed data + mapping to the registered widget component
6. **Edit Mode**: Toggle editing to drag/resize widgets, configure transforms, manage filters
7. **Save**: Persist the modified `DashboardConfig` to the backend (keyed by slug)

### Tuning Page

1. **Load Kernels**: Fetch all kernel configurations
2. **Load Tuning Results**: Get existing tuning data
3. **Load In-Progress**: Check for running tuning workflows
4. **Filter Display**: Show filtered kernel list
5. **Selection**: User selects kernels to tune
6. **Trigger**: Upload config as gist, dispatch workflow
7. **Monitor**: Poll for completion and artifact download

### History Page

1. **Load PRs**: Fetch tracked pull requests
2. **Load Runs**: Get benchmark runs mapped to PRs
3. **Load Change Stats**: Fetch performance comparisons
4. **Display Timeline**: Show PRs with run status
5. **Trigger Runs**: Allow on-demand benchmark dispatch
6. **Refresh**: Rebase to sync with GitHub

### Add Kernels Page

1. **Load Kernel Types**: Fetch type definitions from backend
2. **Select Type**: User chooses or creates kernel type
3. **Input Kernels**: Form or JSON input
4. **Validate**: Check required fields and formats
5. **Confirm**: Preview kernels before submission
6. **Submit**: Send to backend API
7. **Refresh**: Reload kernel list

## Component Architecture

### Smart Components (Pages)

Pages handle:
- Data fetching and state management
- API calls and error handling
- User interactions and routing
- Complex business logic

### Presentational Components

Components handle:
- UI rendering and styling
- Props-based display logic
- User input and events
- Reusable UI patterns

### Hooks

Custom hooks encapsulate:
- Filter state management (`useKernelFilters`)
- Dashboard config CRUD (`useDashboardConfig`, `useDashboardList`)
- Global filter value initialization (`useGlobalFilters`)
- Modal visibility (`useModal`)
- Authentication state (`useAuth`)

### Contexts

Contexts provide global state:
- `AuthContext`: User authentication status
- Shared across all routes

## Performance Visualization

### Roofline Plot

**Concept**: Plots achieved performance (TFLOPs) vs operational intensity (FLOPs/Byte).

**Implementation**:
- Chart.js scatter plot
- Logarithmic scales on both axes
- Backend-based color coding
- Interactive point selection
- Zoom and pan with `chartjs-plugin-zoom`

**Key Metrics**:
- **X-axis**: Arithmetic Intensity = FLOPs / Bytes Accessed
- **Y-axis**: Achieved Performance (TFLOPs)
- **Roofline**: Theoretical hardware limits

### Bar Comparison Plot

**Purpose**: Compare average performance across backends.

**Features**:
- Grouped bars by backend
- Configurable metric (TFLOPs or runtime)
- Percentile filtering
- Automatic scaling

### Bell Curve Plot

**Purpose**: Show performance distribution across kernels.

**Features**:
- Density estimation
- Multiple backends overlaid
- Median and percentile markers
- Smooth curves

## Kernel Types System

### Type Definition Schema

```typescript
interface KernelTypeDefinition {
  _id: string;
  name: string;              // Internal identifier
  displayName: string;       // UI display name
  description?: string;      // Optional description
  attributes: Attribute[];   // Parameter schema
}

interface Attribute {
  name: string;              // Parameter name (M, N, K, etc.)
  displayName: string;       // UI label
  type: 'number' | 'string' | 'select';
  required: boolean;
  options?: string[];        // For select type
  defaultValue?: any;
}
```

### Example: GEMM Kernel Type

```json
{
  "_id": "gemm-type-uuid",
  "name": "gemm",
  "displayName": "GEMM (Matrix Multiplication)",
  "description": "General Matrix Multiplication kernels",
  "attributes": [
    {
      "name": "M",
      "displayName": "M Dimension",
      "type": "number",
      "required": true
    },
    {
      "name": "N",
      "displayName": "N Dimension",
      "type": "number",
      "required": true
    },
    {
      "name": "K",
      "displayName": "K Dimension",
      "type": "number",
      "required": true
    },
    {
      "name": "dtype",
      "displayName": "Data Type",
      "type": "select",
      "required": true,
      "options": ["f16", "f32", "bf16", "i8"]
    }
  ]
}
```

## Styling and Theming

### Tailwind CSS

Utility-first approach with custom theme:

```scss
// Color palette
$primary: #3B82F6;    // Blue
$success: #10B981;    // Green
$warning: #F59E0B;    // Amber
$danger: #EF4444;     // Red
$gray: #6B7280;       // Gray

// Component classes
.card - Rounded shadow container
.btn - Button styles
.input - Form input styles
```

### Responsive Design

Breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

Mobile-first approach with responsive grids and layouts.

## State Management

### Local Component State

Most state is managed locally with `useState`:
- Filters and selections
- UI state (modals, dropdowns)
- Form inputs

### Shared State

- **AuthContext**: Global authentication state
- **URL Params**: Run IDs and navigation state
- **API Cache**: Fetched data stored in component state

### Data Fetching

Polling for real-time updates:
- Runs: Every 10 seconds
- Tuning status: Every 30 seconds
- Pull requests: Every 30 seconds
- Change stats: Every 20 seconds

## Authentication

### Password-Based Auth

1. User enters password on protected routes
2. Backend validates and issues JWT
3. Token stored in HTTP-only cookie
4. Expires after 30 minutes
5. Automatic re-authentication on expiry

### Protected Routes

Currently, most mutation endpoints are protected but commented out for development:

```typescript
// Add @token_required decorator to enable
@app.route("/kernels", methods=["POST"])
@token_required  // Uncomment for production
def add_kernels():
    ...
```

## Development Guide

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `main.tsx`
3. Update navigation in `Navbar.tsx`
4. Implement page layout with `PageContainer`

### Creating a New Component

```typescript
// src/components/YourComponent.tsx
import React from 'react';

interface YourComponentProps {
  data: SomeType;
  onAction: () => void;
}

export default function YourComponent({ 
  data, 
  onAction 
}: YourComponentProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Your component UI */}
    </div>
  );
}
```

### Adding a New API Call

All API calls must go through the centralized `apiFetch` wrapper in `src/utils/github.ts`, which handles auth tokens and 401 detection automatically:

```typescript
// src/utils/github.ts
export async function yourApiCall(param: string): Promise<DataType> {
  const response = await apiFetch("/your-endpoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ param }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json();
}
```

### Creating a New Chart

```typescript
import { Chart } from 'chart.js';
import { useEffect, useRef } from 'react';

export default function YourPlot({ data }: { data: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const chart = new Chart(canvasRef.current, {
      type: 'scatter',
      data: {
        datasets: [{
          data: data.map(d => ({ x: d.x, y: d.y })),
        }]
      },
      options: {
        // Chart options
      }
    });
    
    return () => chart.destroy();
  }, [data]);
  
  return <canvas ref={canvasRef} />;
}
```

## Troubleshooting

### Common Issues

**API Connection Errors:**
- Verify backend is running on port 3000
- Check CORS configuration
- Confirm API URL in environment

**Chart Not Rendering:**
- Check data format matches Chart.js requirements
- Verify canvas ref is properly attached
- Look for console errors

**Filters Not Working:**
- Ensure filter state is properly initialized
- Check filter logic in `useMemo` dependencies
- Verify data has expected fields

**Build Errors:**
- Clear `node_modules` and reinstall
- Check TypeScript errors: `npm run lint`
- Verify all imports are correct

## Performance Optimization

### Code Splitting

Vite automatically splits code by route:
- Each page is a separate chunk
- Lazy loading for optimal performance

### Memoization

Use React hooks to optimize rendering:
```typescript
const filteredData = useMemo(
  () => data.filter(applyFilters),
  [data, filters]
);
```

### Virtualization

For large lists (1000+ items), consider:
- `react-window` for virtual scrolling
- Pagination for kernel lists
- Lazy loading for charts

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads and displays data
- [ ] Filters work correctly
- [ ] Charts are interactive
- [ ] Kernel selection works
- [ ] Tuning workflow triggers successfully
- [ ] Authentication flow works
- [ ] Responsive on mobile devices
- [ ] All modals open and close properly

### Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Deployment

### Static Hosting

After `npm run build`, deploy the `dist/` folder to:
- **Netlify**: Drop folder or connect Git
- **Vercel**: `vercel --prod`
- **GitHub Pages**: Copy to `gh-pages` branch
- **AWS S3**: Upload to S3 bucket with static hosting

### Docker

```dockerfile
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

For production, set:
```bash
VITE_API_URL=https://api.yourdomain.com
```

## Contributing

When contributing:

1. Follow existing code style
2. Use TypeScript strictly
3. Write functional components with hooks
4. Keep components small and focused
5. Document complex logic with comments
6. Test on multiple screen sizes

## Related Documentation

- [Main Project README](../README.md)
- [Backend README](../backend/README.md)
- [Benchmark Infrastructure](../benchmark/README.md)

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: Surya Jasper
