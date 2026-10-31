import { ghTransport, type Transport } from "./github.js";
import type { Store, Job } from "./store.js";
export interface RemoteOutcome {
  repository: string;
  number: number;
  head: string;
  baseBranch: string;
  state: "open" | "closed" | "merged";
  mergedAt: string | null;
  mergeCommit: string | null;
  observedAt: number;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Outcome remote evidence unavailable or invalid");
  return value as Record<string, unknown>;
}
/** Only GitHub reads: terminal state is distinct from permission to execute or merge. */
export async function readRemoteOutcome(
  repository: string,
  number: number,
  transport: Transport = ghTransport,
): Promise<RemoteOutcome> {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !Number.isSafeInteger(number) ||
    number < 1
  )
    throw Error("Invalid outcome identity");
  const response = await transport(
    "GET",
    `repos/${repository}/pulls/${number}`,
  );
  if (response.status !== 200)
    throw Error("Outcome remote evidence unavailable or invalid");
  const p = object(response.body),
    head = object(p.head),
    base = object(p.base);
  if (
    response.status !== 200 ||
    !p ||
    p.number !== number ||
    object(base.repo).full_name !== repository ||
    object(head.repo).full_name !== repository ||
    typeof head.sha !== "string" ||
    !/^[a-f0-9]{40}$/.test(head.sha) ||
    typeof base.ref !== "string" ||
    (p.state !== "open" && p.state !== "closed") ||
    typeof p.merged !== "boolean" ||
    (p.merged && p.state !== "closed")
  )
    throw Error("Outcome remote evidence unavailable or invalid");
  const outcome = {
    repository,
    number,
    head: head.sha,
    baseBranch: base.ref,
    state: p.merged ? "merged" : p.state,
    mergedAt: p.merged_at,
    mergeCommit: p.merged ? p.merge_commit_sha : null,
    observedAt: Date.now(),
  };
  validateOutcome(outcome);
  return outcome;
}
export function validateOutcome(
  value: unknown,
): asserts value is RemoteOutcome {
  const v = value as RemoteOutcome;
  if (
    !v ||
    typeof v.repository !== "string" ||
    !Number.isSafeInteger(v.number) ||
    v.number < 1 ||
    typeof v.head !== "string" ||
    !/^[a-f0-9]{40}$/.test(v.head) ||
    typeof v.baseBranch !== "string" ||
    !["open", "closed", "merged"].includes(v.state) ||
    !Number.isSafeInteger(v.observedAt) ||
    (v.state === "merged"
      ? typeof v.mergedAt !== "string" ||
        !Number.isFinite(Date.parse(v.mergedAt)) ||
        typeof v.mergeCommit !== "string" ||
        !/^[a-f0-9]{40}$/.test(v.mergeCommit)
      : v.mergedAt !== null || v.mergeCommit !== null)
  )
    throw Error("Invalid outcome evidence");
}
export function outcomeCandidate(job: Job): boolean {
  return (
    job.prNumber !== null &&
    (job.stage === "ready" ||
      (job.stage === "blocked" && job.blockCode === "readiness-check-failed"))
  );
}
export async function reconcileOutcomes(
  store: Store,
  apply: boolean,
  transport: Transport = ghTransport,
  id?: string,
) {
  const jobs = id
    ? [store.job(id)].filter((j): j is Job => j !== null)
    : store.jobs().filter(outcomeCandidate);
  if (
    id &&
    (!jobs.length ||
      (!outcomeCandidate(jobs[0]!) &&
        !["merged", "closed"].includes(jobs[0]!.stage)))
  )
    throw Error("Job is not an outcome reconciliation candidate");
  const results = [];
  for (const job of jobs) {
    const remote = await readRemoteOutcome(
      job.repository,
      job.prNumber!,
      transport,
    );
    const outcome = store.reconcileOutcome(job.id, remote, apply);
    results.push({
      jobId: job.id,
      issue: job.issue,
      pr: job.prNumber,
      outcome,
      applied: apply && outcome !== "open",
    });
  }
  return results;
}
