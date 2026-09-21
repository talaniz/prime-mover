import type { Store, Lease } from "./store.js";
export interface ReviewTarget {
  head: string;
  base: string;
  commits: string[];
}
export interface Finding {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  file: string;
  line: number;
  observed: string;
  expected: string;
  acceptance: string;
  verification: string;
}
export interface ReviewReport {
  head: string;
  base: string;
  commits: string[];
  taskId: string;
  turnId: string;
  reportUrl: string;
  verdict: "sign-off" | "changes-requested" | "blocked";
  checks: string[];
  limitations: string[];
  findings: Finding[];
  resolutions: {
    findingId: string;
    decision: "resolved" | "accepted-disposition" | "disputed";
    reason: string;
  }[];
}
export interface Disposition {
  findingId: string;
  decision: "accepted" | "rejected" | "deferred";
  reason: string;
  replyUrl: string;
  acceptance: string;
  verification: string;
}
function bounded(
  value: unknown,
  name: string,
  max = 4000,
): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    value.includes("\0")
  )
    throw new Error(`Missing or invalid review ${name}`);
}
function targetValid(target: ReviewTarget): void {
  if (
    !target ||
    !/^[a-f0-9]{40}$/.test(target.head) ||
    !/^[a-f0-9]{40}$/.test(target.base) ||
    !Array.isArray(target.commits) ||
    !target.commits.length ||
    target.commits.length > 1000 ||
    target.commits.some((c) => !/^[a-f0-9]{40}$/.test(c)) ||
    new Set(target.commits).size !== target.commits.length ||
    target.commits.at(-1) !== target.head ||
    target.commits.includes(target.base)
  )
    throw new Error("Invalid review head/base/commit coverage");
}
function equalTarget(a: ReviewTarget, b: ReviewTarget): boolean {
  return (
    a.head === b.head &&
    a.base === b.base &&
    JSON.stringify(a.commits) === JSON.stringify(b.commits)
  );
}
/** Immutable review records use the same fenced, append-only-intent durability as execution. */
export class Reviews {
  constructor(private readonly store: Store) {}
  private records<T>(id: string, kind: string): T[] {
    return this.store
      .operations(id)
      .filter((o) => o.kind === kind && o.status === "done")
      .map((o) => o.result as T);
  }
  private revision(id: string): string | undefined {
    return this.store
      .operations(id)
      .filter((o) => o.kind === "review-head" && o.status === "done")
      .at(-1)?.key;
  }
  current(id: string): ReviewTarget | undefined {
    return this.records<ReviewTarget>(id, "review-head").at(-1);
  }
  bind(lease: Lease, target: ReviewTarget): void {
    this.store.assertWorker(lease);
    targetValid(target);
    const current = this.current(lease.jobId);
    if (current && equalTarget(current, target)) return;
    const ops = this.store
      .operations(lease.jobId)
      .filter((o) => o.kind === "review-head");
    const pending = ops.find((o) => o.status === "pending");
    const key = pending?.key ?? `review-head:${ops.length + 1}`;
    this.store.operation(lease, key, "review-head", target);
    this.store.completeOperation(lease, key, target);
  }
  private url(id: string, value: string): void {
    bounded(value, "public report evidence", 1000);
    const job = this.store.job(id)!;
    const prefix = `https://github.com/${job.repository}/pull/`;
    if (
      !value.startsWith(prefix) ||
      !/^[1-9]\d*#issuecomment-[1-9]\d*$/.test(value.slice(prefix.length)) ||
      (job.prNumber !== null && !value.startsWith(`${prefix}${job.prNumber}#`))
    )
      throw new Error(
        "Review evidence must identify a comment on the owned PR",
      );
  }
  private resolved(
    id: string,
    report: Pick<ReviewReport, "resolutions">,
  ): void {
    const findings = new Map(
      this.records<ReviewReport>(id, "code-review-report")
        .flatMap((r) => r.findings)
        .map((f) => [f.id, f]),
    );
    const triage = new Map(
      this.records<Disposition>(id, "review-disposition").map((d) => [
        d.findingId,
        d,
      ]),
    );
    for (const key of findings.keys()) {
      const disposition = triage.get(key);
      const resolution = report.resolutions.find((r) => r.findingId === key);
      if (
        !disposition ||
        !resolution ||
        resolution.decision === "disputed" ||
        (disposition.decision === "accepted"
          ? resolution.decision !== "resolved"
          : resolution.decision !== "accepted-disposition")
      )
        throw new Error(
          "Unresolved or disputed review finding prevents sign-off",
        );
    }
  }
  validate(lease: Lease, report: Omit<ReviewReport, "reportUrl">): void {
    this.store.assertWorker(lease);
    targetValid(report);
    const current = this.current(lease.jobId);
    if (!current || !equalTarget(current, report))
      throw new Error("Review head/base/commit coverage is stale");
    bounded(report.taskId, "task identity", 200);
    bounded(report.turnId, "turn identity", 200);
    const implementationTasks = this.store
      .operations(lease.jobId)
      .filter(
        (o) =>
          o.kind === "thread-start" &&
          !o.key.startsWith("code-review-") &&
          !o.key.startsWith("e2e-review-"),
      )
      .map((o) => (o.result as { threadId?: string } | null)?.threadId);
    if (implementationTasks.includes(report.taskId))
      throw new Error("Review must be independent of implementation");
    const operations = this.store.operations(lease.jobId);
    if (
      !operations.some(
        (o) =>
          o.kind === "thread-start" &&
          o.key.startsWith("code-review-") &&
          o.status === "done" &&
          (o.result as { threadId?: string }).threadId === report.taskId &&
          (o.input as { role?: string }).role === "code-review",
      ) ||
      !operations.some(
        (o) =>
          o.kind === "turn-start" &&
          o.key.startsWith("code-review-") &&
          o.status === "done" &&
          (o.input as { threadId?: string }).threadId === report.taskId &&
          (o.result as { turnId?: string }).turnId === report.turnId,
      )
    )
      throw new Error(
        "Independent review role, task and turn must match recorded owned identities",
      );
    if (
      !["sign-off", "changes-requested", "blocked"].includes(report.verdict) ||
      !Array.isArray(report.checks) ||
      !Array.isArray(report.limitations) ||
      !Array.isArray(report.findings) ||
      !Array.isArray(report.resolutions) ||
      report.findings.length > 100 ||
      report.resolutions.length > 1000
    )
      throw new Error("Invalid review evidence schema");
    for (const check of report.checks) bounded(check, "check evidence");
    for (const limitation of report.limitations)
      bounded(limitation, "limitation");
    const ids = new Set<string>();
    for (const finding of report.findings) {
      bounded(finding.id, "finding identity", 100);
      if (
        !/^[a-zA-Z0-9_-]+$/.test(finding.id) ||
        ids.has(finding.id) ||
        !["P0", "P1", "P2", "P3"].includes(finding.severity) ||
        !Number.isSafeInteger(finding.line) ||
        finding.line < 1
      )
        throw new Error("Invalid review finding");
      ids.add(finding.id);
      for (const key of [
        "file",
        "observed",
        "expected",
        "acceptance",
        "verification",
      ] as const)
        bounded(finding[key], key);
    }
    const resolutionIds = new Set<string>();
    for (const resolution of report.resolutions) {
      bounded(resolution.findingId, "resolution identity", 100);
      bounded(resolution.reason, "resolution evidence");
      if (
        resolutionIds.has(resolution.findingId) ||
        !["resolved", "accepted-disposition", "disputed"].includes(
          resolution.decision,
        )
      )
        throw new Error("Invalid review resolution");
      resolutionIds.add(resolution.findingId);
    }
    if (report.verdict === "sign-off") {
      if (
        !report.checks.length ||
        report.findings.length ||
        report.limitations.length
      )
        throw new Error(
          "Sign-off requires checks and no findings or missing review evidence",
        );
      this.resolved(lease.jobId, report);
    }
  }
  record(lease: Lease, report: ReviewReport): void {
    this.validate(lease, report);
    this.url(lease.jobId, report.reportUrl);
    const key = `code-review-report:${report.taskId}:${report.turnId}`;
    const evidence = { ...report, targetRevision: this.revision(lease.jobId) };
    this.store.operation(lease, key, "code-review-report", evidence);
    this.store.completeOperation(lease, key, evidence);
  }
  reserveCorrection(lease: Lease, key: string, limit: number): number {
    this.store.assertWorker(lease);
    if (!/^[a-z0-9-]{1,100}$/.test(key))
      throw new Error("Invalid correction identity");
    const dispositions = new Map(
      this.records<Disposition>(lease.jobId, "review-disposition").map((d) => [
        d.findingId,
        d,
      ]),
    );
    const latest = this.records<ReviewReport>(
      lease.jobId,
      "code-review-report",
    ).at(-1);
    const accepted =
      latest?.findings
        .map((f) => dispositions.get(f.id))
        .filter((d): d is Disposition => d?.decision === "accepted") ?? [];
    if (!accepted.length)
      throw new Error(
        "Correction requires accepted findings with verification contracts",
      );
    const input = { targetRevision: this.revision(lease.jobId), accepted };
    const opKey = `review-correction:${key}`;
    const previous = this.store
      .operations(lease.jobId)
      .find((o) => o.key === opKey);
    if (previous) {
      if (
        previous.status !== "done" ||
        JSON.stringify(previous.input) !== JSON.stringify(input)
      )
        throw new Error("Correction intent needs reconciliation");
      return (previous.result as { cycle: number }).cycle;
    }
    // A crash between budget charge and intent is conservatively over-counted,
    // never reset or allowed to run an unbudgeted correction.
    const cycle = this.store.consumeBudget(lease, "review-corrections", limit);
    this.store.operation(lease, opKey, "review-correction", input);
    this.store.completeOperation(lease, opKey, { cycle });
    return cycle;
  }
  triage(lease: Lease, disposition: Disposition): void {
    this.store.assertWorker(lease);
    bounded(disposition.reason, "disposition rationale");
    this.url(lease.jobId, disposition.replyUrl);
    if (
      !["accepted", "rejected", "deferred"].includes(disposition.decision) ||
      !this.records<ReviewReport>(lease.jobId, "code-review-report").some((r) =>
        r.findings.some((f) => f.id === disposition.findingId),
      )
    )
      throw new Error("Unknown review finding or disposition");
    if (disposition.decision === "accepted") {
      bounded(disposition.acceptance, "accepted finding acceptance contract");
      bounded(
        disposition.verification,
        "accepted finding verification contract",
      );
    }
    const records = this.store
      .operations(lease.jobId)
      .filter((o) => o.kind === "review-disposition");
    const last = records.at(-1);
    if (last && JSON.stringify(last.input) === JSON.stringify(disposition)) {
      this.store.completeOperation(lease, last.key, disposition);
      return;
    }
    const key = `review-disposition:${records.length + 1}`;
    this.store.operation(lease, key, "review-disposition", disposition);
    this.store.completeOperation(lease, key, disposition);
  }
  requireCodeSignoff(id: string, target: ReviewTarget): ReviewReport {
    targetValid(target);
    const current = this.current(id);
    const report = this.records<ReviewReport & { targetRevision: string }>(
      id,
      "code-review-report",
    ).at(-1);
    if (
      !current ||
      !equalTarget(current, target) ||
      !report ||
      !equalTarget(report, target) ||
      report.targetRevision !== this.revision(id) ||
      report.verdict !== "sign-off"
    )
      throw new Error(
        "Current-head independent code-review sign-off is required",
      );
    this.resolved(id, report);
    return report;
  }
}
