import { readFileSync } from "node:fs";
/** Linux reports reclaimable memory in MemAvailable; swap is not execution headroom. */
export function checkResources(
  probe: () => string = () => readFileSync("/proc/meminfo", "utf8"),
): { availableBytes: number; minimumBytes: number } {
  let raw: string;
  try {
    raw = probe();
  } catch {
    throw new Error("memory-evidence-unavailable");
  }
  const lines = raw
    .split("\n")
    .filter((line) => line.startsWith("MemAvailable:"));
  const match =
    lines.length === 1
      ? /^MemAvailable:\s+([0-9]+)\s+kB\s*$/.exec(lines[0]!)
      : null;
  const availableBytes = match ? Number(match[1]) * 1024 : NaN;
  if (!Number.isSafeInteger(availableBytes) || availableBytes < 0)
    throw new Error("memory-evidence-invalid");
  const minimumBytes = 256 * 1024 * 1024;
  if (availableBytes < minimumBytes)
    throw new Error("memory-reserve-unavailable");
  return { availableBytes, minimumBytes };
}

/** A systemd MemoryMax setting is not an enforced cap without this controller. */
export function requireMemoryController(
  probe: () => string = () =>
    readFileSync("/sys/fs/cgroup/cgroup.controllers", "utf8"),
): void {
  let available = false;
  try {
    available = probe().trim().split(/\s+/).includes("memory");
  } catch {
    /* Fixed diagnostic only. */
  }
  if (!available)
    throw new Error(
      "memory-controller-unavailable: enable kernel memory accounting before unattended service activation",
    );
}
