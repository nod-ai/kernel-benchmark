import type {
  RepoPullRequest,
  BenchmarkRun,
  KernelConfig,
  TuningResults,
  KernelTypeDefinition,
  TuningConfig,
  ChangeStats,
  BenchmarkRuntimeConfig,
  KernelSelection,
  RunWithTrigger,
} from "../types";

export async function fetchModifications() {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/pull_requests`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const modifications: RepoPullRequest[] = [];

    for (let obj of data) {
      obj["timestamp"] = new Date(obj["timestamp"]);
      modifications.push(obj as RepoPullRequest);
    }

    modifications.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    console.log("modifications", modifications);

    return modifications;
  } catch (error) {
    throw new Error(`Failed to fetch pull requests: ${error}`);
  }
}

export async function fetchRuns() {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/runs`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const jobs: BenchmarkRun[] = await response.json();
    return jobs;
  } catch (error) {
    throw new Error(`Failed to fetch runs: ${error}`);
  }
}

export async function fetchPerformanceRuns() {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/performances`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const perfs: BenchmarkRun[] = await response.json();
    return perfs;
  } catch (error) {
    throw new Error(`Failed to fetch runs: ${error}`);
  }
}

export async function fetchKernels() {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernels`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const kernelConfigs: KernelConfig[] = await response.json();
  return kernelConfigs;
}

export async function fetchTuningResults() {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/tune/results`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const tuningConfigs: TuningConfig[] = await response.json();
  const tuningResults: TuningResults = {};

  for (let config of tuningConfigs) {
    let name = config.kernelName;
    config.timestamp = new Date(config.timestamp);
    if (config.result["kernel_spec"]) {
      const kernelSpec = config.result["kernel_spec"] as KernelConfig;
      name = kernelSpec.name;
    }
    if (!tuningResults[name]) tuningResults[name] = [config];
    else tuningResults[name].push(config);
  }

  for (let kernelName of Object.keys(tuningResults)) {
    tuningResults[kernelName].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  console.log("Tuning Results", tuningResults);

  return tuningResults;
}

export async function fetchInProgressTuningRuns() {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/tune/runs`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const responseData: { runs: BenchmarkRun[]; kernels: KernelConfig[] } =
    await response.json();
  return responseData;
}

export async function fetchChangeStats() {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/change_stats`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const changeStatList: ChangeStats[] = await response.json();
  const changeStatByRun: Record<string, ChangeStats> = {};
  for (let changeStat of changeStatList) {
    changeStatByRun[changeStat.runId] = changeStat;
  }

  return changeStatByRun;
}

export async function rebase() {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/rebase`,
    {
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  const modifications = data["modifications"] as RepoPullRequest[];
  const performances = data["performances"] as BenchmarkRun[];
  return { modifications, performances };
}

export async function triggerBenchWorkflow(
  pullRequest: RepoPullRequest,
  config: BenchmarkRuntimeConfig
) {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/workflow/pr/trigger`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pr: pullRequest,
        config,
      }),
    }
  );
  if (!response.ok) {
    console.log(response.statusText);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function triggerManualBenchWorkflow(config: {
  name: string;
  machine: string;
  backends: string[];
  kernelSelection: KernelSelection;
}) {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/workflow/manual/trigger`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config,
      }),
    }
  );
  if (!response.ok) {
    console.log(response.statusText);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function cancelWorkflow(runId: string) {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/workflow/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ runId }),
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function triggerTuningWorkflow(kernelIds: string[]) {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/tune`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kernel_ids: kernelIds }),
    }
  );
  if (!response.ok) {
    console.log(response.statusText);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

// Kernel Type Management Functions

export async function fetchKernelTypes(): Promise<KernelTypeDefinition[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernel_types`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const kernelTypes: KernelTypeDefinition[] = await response.json();
    return kernelTypes;
  } catch (error) {
    throw new Error(`Failed to fetch kernel types: ${error}`);
  }
}

export async function addKernelType(
  kernelType: KernelTypeDefinition
): Promise<KernelTypeDefinition> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernel_types`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kernelType),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const createdKernelType: KernelTypeDefinition = await response.json();
    return createdKernelType;
  } catch (error) {
    throw new Error(`Failed to add kernel type: ${error}`);
  }
}

export async function updateKernelType(
  kernelTypeId: string,
  updates: Partial<Omit<KernelTypeDefinition, "_id">>
): Promise<KernelTypeDefinition> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernel_types/${kernelTypeId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const updatedKernelType: KernelTypeDefinition = await response.json();
    return updatedKernelType;
  } catch (error) {
    throw new Error(`Failed to update kernel type: ${error}`);
  }
}

export async function deleteKernelType(kernelTypeId: string): Promise<void> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernel_types/${kernelTypeId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }
  } catch (error) {
    throw new Error(`Failed to delete kernel type: ${error}`);
  }
}

// Kernel Management Functions

export async function addKernels(
  kernelConfigs: Omit<KernelConfig, "_id">[]
): Promise<KernelConfig[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kernelConfigs),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const createdKernels: KernelConfig[] = await response.json();
    return createdKernels;
  } catch (error) {
    throw new Error(`Failed to add kernels: ${error}`);
  }
}

export async function updateKernels(
  kernelUpdates: Partial<KernelConfig>[]
): Promise<KernelConfig[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernels/batch`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kernelUpdates),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const updatedKernels: KernelConfig[] = await response.json();
    return updatedKernels;
  } catch (error) {
    throw new Error(`Failed to update kernels: ${error}`);
  }
}

export async function deleteKernels(kernelIds: string[]): Promise<void> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/kernels`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: kernelIds }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }
  } catch (error) {
    throw new Error(`Failed to delete kernels: ${error}`);
  }
}

// Run Management Functions

export interface FetchRunsParams {
  page?: number;
  page_size?: number;
  type?: string;
  has_artifact?: boolean;
  completed_only?: boolean;
}

export interface FetchRunsResponse {
  runs: RunWithTrigger[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  ongoing_count: number;
  completed_count: number;
}

export async function fetchAllRuns(
  params: FetchRunsParams = {}
): Promise<FetchRunsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size)
      queryParams.append("page_size", params.page_size.toString());
    if (params.type) queryParams.append("type", params.type);
    if (params.has_artifact !== undefined)
      queryParams.append("has_artifact", params.has_artifact.toString());
    if (params.completed_only !== undefined)
      queryParams.append("completed_only", params.completed_only.toString());

    const url = `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/runs${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: FetchRunsResponse = await response.json();

    // Convert timestamp strings to Date objects for both run and trigger
    data.runs = data.runs.map((item) => ({
      run: item.run
        ? {
            ...item.run,
            timestamp: new Date(item.run.timestamp),
          }
        : null,
      trigger: item.trigger
        ? {
            ...item.trigger,
            timestamp: new Date(item.trigger.timestamp),
            dispatchedAt: item.trigger.dispatchedAt
              ? new Date(item.trigger.dispatchedAt)
              : undefined,
            linkedAt: item.trigger.linkedAt
              ? new Date(item.trigger.linkedAt)
              : undefined,
          }
        : null,
    }));

    return data;
  } catch (error) {
    throw new Error(`Failed to fetch runs: ${error}`);
  }
}

export async function deleteRun(runId: string): Promise<void> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/runs/${runId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }
  } catch (error) {
    throw new Error(`Failed to delete run: ${error}`);
  }
}

// Tracker types
export interface ScheduleData {
  isInterval: boolean;
  startDate: string; // MM-DD-YYYY
  timeOfDay: string; // HH:MM in UTC
  daysOfWeek?: string[]; // For weekly schedules
  intervalValue?: number; // For interval schedules
  intervalUnit?: "weeks" | "months"; // For interval schedules
  endDate?: string; // MM-DD-YYYY
}

export interface TrackerData {
  _id?: string;
  name: string;
  blobName: string;
  tags: string[];
  backends: string[];
  machine: string;
  schedule: ScheduleData;
  isActive?: boolean;
  createdAt?: string;
}

export async function fetchTrackers(): Promise<TrackerData[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: TrackerData[] = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch trackers: ${error}`);
  }
}

export async function createTracker(tracker: TrackerData): Promise<TrackerData> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tracker),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const data: TrackerData = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to create tracker: ${error}`);
  }
}

export async function updateTracker(
  trackerId: string,
  tracker: Partial<TrackerData>
): Promise<TrackerData> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/${trackerId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tracker),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }

    const data: TrackerData = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to update tracker: ${error}`);
  }
}

export async function deleteTracker(trackerId: string): Promise<void> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/${trackerId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }
  } catch (error) {
    throw new Error(`Failed to delete tracker: ${error}`);
  }
}
