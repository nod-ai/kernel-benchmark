import { fetchArtifact } from "./github";

export async function fetchData(runId: string) {
  return fetchArtifact(runId);
}
