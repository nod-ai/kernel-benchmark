// Types and processing logic for rocprof trace analysis.
// Ported from the reference rocprof visualizer (example-rocprof-visualizer.html).

// ─── Raw data types (from backend API) ──────────────────────────────────────

export interface RocprofDispatchRaw {
  id: string;
  statsContent: string;
  codeJson: string;
  waves: { name: string; content: string }[];
}

export interface RocprofTraceResponse {
  kernelName: string;
  dispatches: RocprofDispatchRaw[];
}

// ─── Processed data types ───────────────────────────────────────────────────

export interface WaveInstruction {
  time: number;
  stall: number;
  latency: number;
  isa: string;
}

export interface WaveMetrics {
  totalCycles: number;
  preLoopCycles: number;
  mainLoopCycles: number;
  preLoopPct: number;
  mainLoopPct: number;
  postLoopPct: number;
  mfmaCycles: number;
  loopEfficiency: number;
  kernelEfficiency: number;
  bufferLoadPct: number;
  dsReadPct: number;
  dsWritePct: number;
  mfmaPct: number;
  valuPct: number;
  saluPct: number;
  waitPct: number;
  barrierPct: number;
  waitLgkmPct: number;
}

export interface TimeseriesPoint {
  time: number;
  value: number;
}

export interface TimeseriesData {
  mfmaPair: TimeseriesPoint[];
  bufferLoad: TimeseriesPoint[];
  dsRead: TimeseriesPoint[];
  dsWrite: TimeseriesPoint[];
  mfma: TimeseriesPoint[];
  valu: TimeseriesPoint[];
  salu: TimeseriesPoint[];
  wait: TimeseriesPoint[];
  barrier: TimeseriesPoint[];
  waitLgkm: TimeseriesPoint[];
}

export interface WaveResult {
  waveName: string;
  metrics: WaveMetrics;
  timeseriesData: TimeseriesData;
}

export interface DispatchResult {
  id: string;
  mfmaCount: number;
  waves: WaveResult[];
}

// ─── Tab config for the time-series section ─────────────────────────────────

export type TimeseriesKey = keyof TimeseriesData;

export const TIMESERIES_TABS: {
  id: TimeseriesKey;
  name: string;
  yLabel: string;
}[] = [
  { id: "mfmaPair", name: "MFMA Pairs", yLabel: "Exposed Cycles" },
  { id: "bufferLoad", name: "Buffer Load", yLabel: "Latency" },
  { id: "dsRead", name: "DS Read", yLabel: "Issue Time" },
  { id: "dsWrite", name: "DS Write", yLabel: "Issue Time" },
  { id: "mfma", name: "MFMA", yLabel: "Issue Time" },
  { id: "valu", name: "VALU", yLabel: "Issue Time" },
  { id: "salu", name: "SALU", yLabel: "Issue Time" },
  { id: "wait", name: "WAIT (vmcnt)", yLabel: "Issue Time" },
  { id: "barrier", name: "BARRIER", yLabel: "Issue Time" },
  { id: "waitLgkm", name: "WAIT (lgkmcnt)", yLabel: "Issue Time" },
];

// ─── MFMA cycle lookup ──────────────────────────────────────────────────────

export function getMfmaCycles(isa: string): number {
  const s = isa.toLowerCase().trim();
  if (!s.includes("mfma")) return 0;

  // Specific BF16 variants (MI100/MI200)
  if (s.includes("v_mfma_f32_32x32x4_2b_bf16")) return 64;
  if (s.includes("v_mfma_f32_16x16x4_4b_bf16")) return 32;
  if (s.includes("v_mfma_f32_4x4x4_16b_bf16")) return 8;

  // Dimension-based fallback for all data types
  if (s.includes("4x4")) return 8;
  if (s.includes("16x16")) return 16;
  if (s.includes("32x32")) return 32;

  return 0;
}

// ─── CSV parsing ────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseStatsCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].replace(/^\ufeff/, "");
  const headers = parseCSVLine(headerLine).map((h) =>
    h.replace(/^"|"$/g, "").trim()
  );

  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j]?.replace(/^"|"$/g, "").trim() || "";
    });
    data.push(row);
  }

  return data;
}

// ─── Loop detection ─────────────────────────────────────────────────────────

interface LoopRange {
  start: number;
  end: number;
}

interface LoopConfig {
  startLine: number;
  loops: LoopRange[];
}

export function findLoopsAndMFMA(
  statsData: Record<string, string>[],
  waves: number
): LoopConfig | null {
  const loops: LoopRange[] = [];
  let inLoop = false;
  let loopStart: number | null = null;
  let prevHitcount: number | null = null;

  for (let idx = 0; idx < statsData.length; idx++) {
    const currentHitcount = parseInt(statsData[idx]["Hitcount"]) || 0;

    if (currentHitcount > waves && !inLoop) {
      inLoop = true;
      loopStart = idx;
      prevHitcount = currentHitcount;
    } else if (currentHitcount === waves && inLoop) {
      inLoop = false;
      if (loopStart !== null && idx - 1 - loopStart > 1) {
        loops.push({ start: loopStart, end: idx - 1 });
      }
      prevHitcount = null;
    } else if (
      inLoop &&
      prevHitcount !== null &&
      currentHitcount !== prevHitcount &&
      currentHitcount > waves &&
      prevHitcount > waves
    ) {
      if (loopStart !== null && idx - 1 - loopStart > 1) {
        loops.push({ start: loopStart, end: idx - 1 });
      }
      loopStart = idx;
      prevHitcount = currentHitcount;
    } else if (inLoop) {
      prevHitcount = currentHitcount;
    }
  }

  if (inLoop && loopStart !== null) {
    loops.push({ start: loopStart, end: statsData.length - 1 });
  }

  const mfmaLoops = loops.filter((loop) => {
    for (let i = loop.start; i <= loop.end; i++) {
      if (statsData[i]["Instruction"]?.toLowerCase().includes("mfma")) {
        return true;
      }
    }
    return false;
  });

  if (mfmaLoops.length === 0) return null;

  return { startLine: mfmaLoops[0].start, loops: mfmaLoops };
}

// ─── Wave / code JSON parsing ───────────────────────────────────────────────

export function parseCodeJson(content: string): Record<number, string> {
  const data = JSON.parse(content);
  const mapping: Record<number, string> = {};
  for (const item of data.code) {
    mapping[item[2]] = item[0];
  }
  return mapping;
}

export function parseWaveJson(
  content: string,
  codeMapping: Record<number, string>
): WaveInstruction[] {
  const data = JSON.parse(content);
  return data.wave.instructions.map(
    (inst: [string, string, string, string, string]) => ({
      time: parseInt(inst[0]),
      stall: parseInt(inst[2]),
      latency: parseInt(inst[3]),
      isa: codeMapping[parseInt(inst[4])] || "",
    })
  );
}

// ─── Analysis helpers ───────────────────────────────────────────────────────

function findLastMFMA(
  waveData: WaveInstruction[]
): { index: number; mfmaCycles: number } | null {
  let lastIndex: number | null = null;
  let mfmaCycles = 0;

  for (let i = 0; i < waveData.length; i++) {
    if (waveData[i].isa.toLowerCase().includes("mfma")) {
      lastIndex = i;
      mfmaCycles += getMfmaCycles(waveData[i].isa);
    }
  }

  return lastIndex !== null ? { index: lastIndex, mfmaCycles } : null;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0
    ? parseFloat(((100 * numerator) / denominator).toFixed(1))
    : 0;
}

export function calculateMetrics(
  waveData: WaveInstruction[],
  start: number,
  end: number,
  mfmaCycles: number
): WaveMetrics {
  const totalCycles = waveData[waveData.length - 1].time - waveData[0].time;
  const preLoopCycles = waveData[start].time - waveData[0].time;
  const mainLoopCycles = waveData[end].time - waveData[start].time;
  const loopCycles = mainLoopCycles;

  const preLoopPct = pct(preLoopCycles, totalCycles);
  const mainLoopPct = pct(mainLoopCycles, totalCycles);
  const postLoopPct = Math.max(
    0,
    parseFloat((100 - preLoopPct - mainLoopPct).toFixed(1))
  );

  const loopData = waveData.slice(start, end + 1);
  const latencies = {
    bufferLoad: 0,
    dsRead: 0,
    dsWrite: 0,
    mfma: 0,
    valu: 0,
    salu: 0,
    wait: 0,
    barrier: 0,
    waitLgkm: 0,
  };

  for (const inst of loopData) {
    const isa = inst.isa.toLowerCase();
    if (isa.includes("buffer_load")) {
      latencies.bufferLoad += inst.latency;
    } else if (isa.startsWith("ds_read")) {
      latencies.dsRead += inst.latency;
    } else if (isa.includes("ds_write")) {
      latencies.dsWrite += inst.latency;
    } else if (isa.includes("mfma")) {
      latencies.mfma += inst.latency;
    } else if (isa.startsWith("v_") && !isa.includes("mfma")) {
      latencies.valu += inst.latency;
    } else if (isa.startsWith("s_waitcnt vmcnt")) {
      latencies.wait += inst.latency;
    } else if (isa.startsWith("s_barrier")) {
      latencies.barrier += inst.latency;
    } else if (isa.startsWith("s_waitcnt lgkmcnt")) {
      latencies.waitLgkm += inst.latency;
    } else if (
      isa.startsWith("s_") &&
      !isa.startsWith("s_waitcnt") &&
      !isa.startsWith("s_barrier")
    ) {
      latencies.salu += inst.latency;
    }
  }

  return {
    totalCycles,
    preLoopCycles,
    mainLoopCycles,
    preLoopPct,
    mainLoopPct,
    postLoopPct,
    mfmaCycles,
    loopEfficiency: pct(mfmaCycles, loopCycles),
    kernelEfficiency: pct(mfmaCycles, totalCycles),
    bufferLoadPct: pct(latencies.bufferLoad, loopCycles),
    dsReadPct: pct(latencies.dsRead, loopCycles),
    dsWritePct: pct(latencies.dsWrite, loopCycles),
    mfmaPct: pct(latencies.mfma, loopCycles),
    valuPct: pct(latencies.valu, loopCycles),
    saluPct: pct(latencies.salu, loopCycles),
    waitPct: pct(latencies.wait, loopCycles),
    barrierPct: pct(latencies.barrier, loopCycles),
    waitLgkmPct: pct(latencies.waitLgkm, loopCycles),
  };
}

export function processInstructionData(
  waveData: WaveInstruction[],
  start: number,
  end: number
): TimeseriesData {
  const loopData = waveData.slice(start, end + 1);

  const result: TimeseriesData = {
    mfmaPair: [],
    bufferLoad: [],
    dsRead: [],
    dsWrite: [],
    mfma: [],
    valu: [],
    salu: [],
    wait: [],
    barrier: [],
    waitLgkm: [],
  };

  // MFMA pair analysis: exposed cycles between consecutive MFMA instructions
  const mfmaIndices: number[] = [];
  loopData.forEach((inst, i) => {
    if (inst.isa.toLowerCase().includes("mfma")) mfmaIndices.push(i);
  });

  for (let i = 0; i < mfmaIndices.length - 1; i++) {
    const curr = loopData[mfmaIndices[i]];
    const next = loopData[mfmaIndices[i + 1]];
    const currMfmaCycles = getMfmaCycles(curr.isa);
    const exposedCycles =
      next.time + next.stall - (curr.time + curr.stall) - currMfmaCycles;
    result.mfmaPair.push({ time: curr.time, value: exposedCycles });
  }

  for (const inst of loopData) {
    const isa = inst.isa.toLowerCase();
    const point: TimeseriesPoint = { time: inst.time, value: inst.latency };

    if (isa.includes("buffer_load")) {
      result.bufferLoad.push(point);
    } else if (isa.startsWith("ds_read")) {
      result.dsRead.push(point);
    } else if (isa.includes("ds_write")) {
      result.dsWrite.push(point);
    } else if (isa.includes("mfma")) {
      result.mfma.push(point);
    } else if (isa.startsWith("v_") && !isa.includes("mfma")) {
      result.valu.push(point);
    } else if (isa.startsWith("s_waitcnt vmcnt")) {
      result.wait.push(point);
    } else if (isa.startsWith("s_barrier")) {
      result.barrier.push(point);
    } else if (isa.startsWith("s_waitcnt lgkmcnt")) {
      result.waitLgkm.push(point);
    } else if (
      isa.startsWith("s_") &&
      !isa.startsWith("s_waitcnt") &&
      !isa.startsWith("s_barrier")
    ) {
      result.salu.push(point);
    }
  }

  return result;
}

// ─── Top-level dispatch analysis ────────────────────────────────────────────

export function analyzeDispatch(raw: RocprofDispatchRaw): DispatchResult {
  const statsData = parseStatsCSV(raw.statsContent);
  const waveCount = raw.waves.length;

  const mfmaCount = statsData.filter((row) =>
    row["Instruction"]?.toLowerCase().includes("mfma")
  ).length;

  const loopConfig = findLoopsAndMFMA(statsData, waveCount);
  if (!loopConfig) {
    return { id: raw.id, mfmaCount, waves: [] };
  }

  const codeMapping = parseCodeJson(raw.codeJson);

  const waves: WaveResult[] = [];
  for (const wave of raw.waves) {
    const waveData = parseWaveJson(wave.content, codeMapping);
    const lastMfmaInfo = findLastMFMA(waveData);
    if (!lastMfmaInfo) continue;

    const start = loopConfig.startLine;
    const end = lastMfmaInfo.index;
    const metrics = calculateMetrics(waveData, start, end, lastMfmaInfo.mfmaCycles);
    const timeseriesData = processInstructionData(waveData, start, end);

    waves.push({ waveName: wave.name, metrics, timeseriesData });
  }

  return { id: raw.id, mfmaCount, waves };
}
