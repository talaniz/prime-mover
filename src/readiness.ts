import type { Store } from "./store.js";
import { Reviews, type ReviewTarget } from "./reviews.js";
export interface RemoteReadiness extends ReviewTarget {
  observedAt: number;
  open: boolean;
  mergeable: boolean | null;
  requiredChecks: string[];
  requiredApps?: { name: string; appId: number }[];
  checks: {
    name: string;
    head: string;
    status: "success" | "failure" | "pending";
    url: string;
    appId?: number;
  }[];
}
/** Evaluate fresh evidence; callers must re-read GitHub before each readiness action. */
export function readinessEvidence(
  store: Store,
  id: string,
  remote: RemoteReadiness,
  now = Date.now(),
  requireDelivery = false,
) {
  const job = store.job(id),
    reviews = new Reviews(store),
    target = reviews.current(id);
  if (
    !job ||
    job.cancelRequested ||
    job.blockCode ||
    !target ||
    !remote ||
    remote.head !== target.head ||
    remote.base !== target.base ||
    JSON.stringify(remote.commits) !== JSON.stringify(target.commits)
  )
    throw new Error("Readiness head/base or job state changed");
  if (
    !Number.isSafeInteger(remote.observedAt) ||
    now - remote.observedAt > 30000 ||
    remote.observedAt > now + 1000
  )
    throw new Error("Readiness requires fresh remote evidence");
  if (remote.open !== true || remote.mergeable !== true)
    throw new Error("Readiness requires an open conflict-free PR");
  const code = reviews.requireCodeSignoff(id, target),
    e2e = new Reviews(store, "e2e-review").requireSignoff(id, target);
  const project = store.projects().find((p) => p.id === job.projectId);
  if (
    !project?.enabled ||
    !project.configured ||
    project.blockCode ||
    store.paused()
  )
    throw new Error("Readiness project is unavailable");
  if (
    !Array.isArray(remote.checks) ||
    !Array.isArray(remote.requiredChecks) ||
    remote.requiredChecks.some((c) => typeof c !== "string" || !c.trim()) ||
    remote.checks.length > 1000
  )
    throw new Error("Readiness check evidence is unavailable");
  const names = new Set<string>();
  for (const check of remote.checks) {
    if (
      !check ||
      typeof check.name !== "string" ||
      !check.name.trim() ||
      names.has(check.name) ||
      check.head !== target.head ||
      check.status !== "success" ||
      typeof check.url !== "string" ||
      !check.url.startsWith("https://")
    )
      throw new Error(
        "Readiness requires unambiguous passing current-head checks",
      );
    names.add(check.name);
  }
  if (
    [...project.requiredChecks, ...remote.requiredChecks].some(
      (name) => !names.has(name),
    )
  )
    throw new Error("Readiness is missing required checks");
  if (
    remote.requiredApps !== undefined &&
    (!Array.isArray(remote.requiredApps) ||
      remote.requiredApps.some(
        (r) =>
          !r ||
          typeof r.name !== "string" ||
          !Number.isSafeInteger(r.appId) ||
          !remote.checks.some((c) => c.name === r.name && c.appId === r.appId),
      ))
  )
    throw new Error("Readiness required check app identity is missing");
  const operations = store.operations(id);
  if (job.stage !== "ready") {
    const deadline = (
      operations.find((o) => o.key === "implementation-budget")?.input as
        | { deadline?: number }
        | undefined
    )?.deadline;
    if (!Number.isSafeInteger(deadline) || Number(deadline) <= now)
      throw new Error("Readiness execution budget is exhausted or missing");
  }

  for (const [index, argv] of project.verify.entries()) {
    const record = operations.find(
      (o) =>
        o.key === `verify:${target.head}:${index}` &&
        o.kind === "verification" &&
        o.status === "done",
    );
    const input = record?.input as { argv?: string[] } | undefined;
    const result = record?.result as
      | { result?: { status?: string; exitCode?: number }; artifact?: string }
      | undefined;
    if (
      JSON.stringify(input?.argv) !== JSON.stringify(argv) ||
      result?.result?.status !== "passed" ||
      result.result.exitCode !== 0 ||
      !result.artifact
    )
      throw new Error(
        "Readiness requires configured current-head verification",
      );
  }
  const payload = {
    ...target,
    codeReview: code.reportUrl,
    e2eReview: e2e.reportUrl,
  };
  const notificationKind = `ready:${target.head}:${target.base}`;
  if (requireDelivery) {
    const notification = store
      .notifications(id)
      .find((n) => n.kind === notificationKind);
    if (
      !notification ||
      notification.status !== "done" ||
      !/^[1-9]\d*$/.test(notification.remoteId ?? "") ||
      JSON.stringify(notification.payload) !== JSON.stringify(payload)
    )
      throw new Error("Readiness requires reconciled notification delivery");
  }
  return { target, remote, payload, notificationKind };
}
