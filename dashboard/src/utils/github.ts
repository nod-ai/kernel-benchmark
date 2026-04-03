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
  BackendSpec,
} from "../types";

const API_URL = import.meta.env.VITE_BACKEND_SERVER_URL;
const TOKEN_KEY = "auth_token";

/**
 * Centralized fetch wrapper that attaches the auth token and emits
 * an `auth-required` event when the server responds with 401.
 */
async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("auth-required"));
    throw new Error("Authentication required");
  }

  return response;
}

export async function fetchModifications() {
  const response = await apiFetch("/pull_requests");
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
  return modifications;
}

export async function fetchRuns() {
  const response = await apiFetch("/runs");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const jobs: BenchmarkRun[] = await response.json();
  return jobs;
}

export async function fetchPerformanceRuns() {
  const response = await apiFetch("/performances");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const perfs: BenchmarkRun[] = await response.json();
  return perfs;
}

export async function fetchKernels() {
  const response = await apiFetch("/kernels");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const kernelConfigs: KernelConfig[] = await response.json();
  return kernelConfigs;
}

export async function fetchTuningResults() {
  const response = await apiFetch("/tune/results");
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

  return tuningResults;
}

export async function fetchInProgressTuningRuns() {
  const response = await apiFetch("/tune/runs");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const responseData: { runs: BenchmarkRun[]; kernels: KernelConfig[] } =
    await response.json();
  return responseData;
}

export async function fetchChangeStats() {
  const response = await apiFetch("/change_stats");
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
  const response = await apiFetch("/rebase", { method: "POST" });
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
  const response = await apiFetch("/workflow/pr/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pr: pullRequest, config }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function triggerManualBenchWorkflow(config: {
  name: string;
  machine: string;
  backends: string[];
  kernelSelection: KernelSelection;
}) {
  const response = await apiFetch("/workflow/manual/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function cancelWorkflow(runId: string) {
  const response = await apiFetch("/workflow/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

export async function triggerTuningWorkflow(kernelIds: string[]) {
  const response = await apiFetch("/tune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kernel_ids: kernelIds }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

// Kernel Type Management Functions

export async function fetchKernelTypes(): Promise<KernelTypeDefinition[]> {
  const response = await apiFetch("/kernel_types");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
}

export async function addKernelType(
  kernelType: KernelTypeDefinition
): Promise<KernelTypeDefinition> {
  const response = await apiFetch("/kernel_types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kernelType),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function updateKernelType(
  kernelTypeId: string,
  updates: Partial<Omit<KernelTypeDefinition, "_id">>
): Promise<KernelTypeDefinition> {
  const response = await apiFetch(`/kernel_types/${kernelTypeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function deleteKernelType(kernelTypeId: string): Promise<void> {
  const response = await apiFetch(`/kernel_types/${kernelTypeId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }
}

// Kernel Management Functions

export async function addKernels(
  kernelConfigs: Omit<KernelConfig, "_id">[]
): Promise<KernelConfig[]> {
  const response = await apiFetch("/kernels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kernelConfigs),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function updateKernels(
  kernelUpdates: Partial<KernelConfig>[]
): Promise<KernelConfig[]> {
  const response = await apiFetch("/kernels/batch", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kernelUpdates),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function deleteKernels(kernelIds: string[]): Promise<void> {
  const response = await apiFetch("/kernels", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: kernelIds }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
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
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.page_size)
    queryParams.append("page_size", params.page_size.toString());
  if (params.type) queryParams.append("type", params.type);
  if (params.has_artifact !== undefined)
    queryParams.append("has_artifact", params.has_artifact.toString());
  if (params.completed_only !== undefined)
    queryParams.append("completed_only", params.completed_only.toString());

  const qs = queryParams.toString();
  const response = await apiFetch(`/api/runs${qs ? `?${qs}` : ""}`);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data: FetchRunsResponse = await response.json();

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
}

export async function deleteRun(runId: string): Promise<void> {
  const response = await apiFetch(`/api/runs/${runId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }
}

// Tracker types

export interface ScheduleData {
  isInterval: boolean;
  startDate: string;
  timeOfDay: string;
  daysOfWeek?: string[];
  intervalValue?: number;
  intervalUnit?: "weeks" | "months";
  endDate?: string;
}

export interface TrackerData {
  _id?: string;
  name: string;
  blobName: string;
  dashboardName?: string;
  tags: string[];
  backends: string[];
  backendSpecs?: BackendSpec[];
  machine: string;
  schedule: ScheduleData;
  branch: string;
  isActive?: boolean;
  createdAt?: string;
}

export async function fetchTrackers(): Promise<TrackerData[]> {
  const response = await apiFetch("/api/trackers");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
}

export async function createTracker(
  tracker: TrackerData
): Promise<TrackerData> {
  const response = await apiFetch("/api/trackers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tracker),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function updateTracker(
  trackerId: string,
  tracker: Partial<TrackerData>
): Promise<TrackerData> {
  const response = await apiFetch(`/api/trackers/${trackerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tracker),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }

  return response.json();
}

export async function deleteTracker(trackerId: string): Promise<void> {
  const response = await apiFetch(`/api/trackers/${trackerId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }
}

export async function triggerTrackerRun(trackerId: string): Promise<void> {
  const response = await apiFetch(`/api/trackers/${trackerId}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `HTTP error! Status: ${response.status}`
    );
  }
}

export async function fetchTrackerByDashboardName(
  dashboardName: string
): Promise<TrackerData> {
  const response = await apiFetch(
    `/api/trackers/dashboard/${dashboardName}`
  );
  if (!response.ok) {
    throw new Error("Tracker not found");
  }
  return response.json();
}

export async function fetchTrackerRuns(trackerId: string): Promise<any[]> {
  const response = await apiFetch(`/api/trackers/${trackerId}/runs`);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
}

export async function fetchTrackerPerformanceTimeline(
  trackerId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const qs = params.toString();
  const response = await apiFetch(
    `/api/trackers/${trackerId}/performance${qs ? `?${qs}` : ""}`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
}

export async function fetchBranches(): Promise<string[]> {
  const response = await apiFetch("/api/branches");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
}
