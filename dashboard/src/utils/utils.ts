import type { Kernel } from "../types";

export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

export const KERNEL_DIMS: Record<string, string[]> = {
  gemm: ["M", "N", "K", "transpose", "dtype"],
  attention: ["B", "M", "N", "K1", "K2", "dtype"],
  conv: ["B", "H", "W", "C", "P", "Q", "F", "S", "dtype"],
};

export function getTimeStringRelative(time: Date | string) {
  time = new Date(time);
  const currentTime = new Date();

  const diffSeconds = (currentTime.getTime() - time.getTime()) / 1000;
  if (diffSeconds < 0) {
    return "Future";
  }

  if (diffSeconds < 60) {
    return `${Math.floor(diffSeconds)} seconds ago`;
  }

  const diffMinutes = diffSeconds / 60;
  if (diffMinutes < 60) {
    return `${Math.floor(diffMinutes)} minutes ago`;
  }

  const diffHours = diffMinutes / 60;
  if (diffHours < 24) {
    return `${Math.floor(diffHours)} hours ago`;
  }

  const diffDays = diffHours / 24;
  if (diffDays < 7) {
    return `${Math.floor(diffDays)} days ago`;
  }

  return time.toLocaleDateString();
}

export function hashKernel(kernel: Kernel): string {
  return (
    `${kernel.kernelType}_` +
    KERNEL_DIMS[kernel.kernelType]
      .filter((dimName) => dimName !== "dtype")
      .map((dimName) => `${dimName}${kernel.shape[dimName]}`)
      .join("_")
      .concat(`_${kernel.dtype}`)
  );
}

export function getCommonKernels(kernels: Kernel[]): Kernel[] {
  const backendShapes: Record<string, Set<string>> = {};
  for (const kernel of kernels) {
    const kernelHash = hashKernel(kernel);
    if (!backendShapes[kernel.backend])
      backendShapes[kernel.backend] = new Set<string>();
    backendShapes[kernel.backend].add(kernelHash);
  }

  const commonShapes =
    kernels.length > 0
      ? Object.values(backendShapes).reduce(
          (prev, curr) => new Set([...prev].filter((hash) => curr.has(hash)))
        )
      : new Set<string>();

  return kernels.filter((k) => commonShapes.has(hashKernel(k)));
}

export function filterKernelsByPercentile(
  kernels: Kernel[],
  percentile: number
): Kernel[] {
  // Group kernels by backend
  const kernelsByBackend = kernels.reduce(
    (acc, kernel) => {
      if (!acc[kernel.backend]) {
        acc[kernel.backend] = [];
      }
      acc[kernel.backend].push(kernel);
      return acc;
    },
    {} as Record<string, Kernel[]>
  );

  // Filter each backend's kernels
  const filteredKernels: Kernel[] = [];

  for (const backend in kernelsByBackend) {
    const backendKernels = kernelsByBackend[backend];

    // Sort by meanMicroseconds in ascending order (lower is better performance)
    const sortedKernels = [...backendKernels].sort(
      (a, b) => a.meanMicroseconds - b.meanMicroseconds
    );

    // Calculate the cutoff index for the given percentile
    // For percentile 0.95, we want to keep the top 95% performers (lowest 95% times)
    const cutoffIndex = Math.floor(sortedKernels.length * percentile);

    // Take kernels up to the cutoff index
    const topPerformers = sortedKernels.slice(0, cutoffIndex);

    filteredKernels.push(...topPerformers);
  }

  return filteredKernels;
}

/**
 * Simplifies a name for use in URLs by converting to lowercase,
 * replacing spaces and special characters with underscores,
 * and removing any characters that aren't letters, numbers, or underscores.
 */
export function simplifyNameForUrl(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, "_") // Replace any non-alphanumeric (except underscore) with underscore
    .replace(/_+/g, "_") // Replace multiple consecutive underscores with single underscore
    .replace(/^_+|_+$/g, ""); // Remove leading and trailing underscores
}

/**
 * Converts a date from YYYY-MM-DD format to MM-DD-YYYY format
 */
export function toMMDDYYYY(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${month}-${day}-${year}`;
}

/**
 * Converts a date from MM-DD-YYYY format to YYYY-MM-DD format
 */
export function toYYYYMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const [month, day, year] = dateStr.split("-");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a MM-DD-YYYY date string for display
 */
export function formatMMDDYYYY(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(toYYYYMMDD(dateStr));
  return date.toLocaleDateString();
}

/**
 * Formats elapsed time from a start date to now in a human-readable format
 */
export function formatElapsedTime(startTime: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000); // seconds
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
