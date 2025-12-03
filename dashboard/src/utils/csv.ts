import type { Kernel } from "../types";

export async function fetchData(runId: string) {
  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_SERVER_URL}/artifact/${runId}`
  );
  const kernels = (await response.json()) as Kernel[];
  return kernels;
}
