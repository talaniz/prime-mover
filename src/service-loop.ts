import { setTimeout as delay } from "node:timers/promises";
export async function serviceLoop(
  cycle: () => Promise<boolean>,
  options: {
    intervalMs: number;
    maxConsecutiveFailures: number;
    maxCycles?: number;
    signal: AbortSignal;
  },
): Promise<{ cycles: number; stopped: boolean }> {
  for (const value of [
    options.intervalMs,
    options.maxConsecutiveFailures,
    options.maxCycles ?? 1,
  ])
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error("Invalid service limits");
  let cycles = 0,
    failures = 0;
  while (
    !options.signal.aborted &&
    (options.maxCycles === undefined || cycles < options.maxCycles)
  ) {
    let passed = false;
    try {
      passed = await cycle();
    } catch {
      /* Never reflect provider exception text. */
    }
    cycles++;
    failures = passed ? 0 : failures + 1;
    if (options.signal.aborted) break;
    if (failures >= options.maxConsecutiveFailures)
      throw new Error("service-cycle-failure-limit");
    if (options.maxCycles !== undefined && cycles >= options.maxCycles) break;
    try {
      await delay(options.intervalMs, undefined, { signal: options.signal });
    } catch {
      if (!options.signal.aborted) throw new Error("service-wait-failed");
    }
  }
  return { cycles, stopped: options.signal.aborted };
}
