import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Store, Job } from "./store.js";
import type { MetadataSnapshot, ProjectMetadata } from "./contracts.js";

const blockers: Record<string, string> = {
  operator: "Operator action required",
  "requirements-missing":
    "Issue requirements are incomplete; update and reconcile the contract",
  "contract-changed":
    "Issue changed; operator contract reconciliation required",
  "ack-pending":
    "Intake acknowledgment pending; inspect reconciliation state if delayed",
  "github-authentication": "GitHub authentication failed; restore credentials",
  "github-forbidden": "GitHub access denied; verify repository permissions",
  "github-rate-limited":
    "GitHub rate limit reached; intake will retry after backoff",
  "github-unavailable":
    "GitHub result unavailable or uncertain; intake is backing off",
  "github-invalid-response":
    "GitHub evidence is invalid; inspect intake diagnostics",
  "auth-required": "Repository authentication or authorization required",
  "config-missing": "Project configuration needs attention",
  "lease-expired": "Worker lease expired; remote work must be reconciled",
  "approval-required": "Waiting for approval or user input",
  "verification-failed": "Verification failed",
  "external-state-unknown":
    "External result is uncertain; reconciliation required",
  "budget-exhausted": "Execution budget exhausted",
};
function publicBlocker(code: string | null): string | null {
  return code
    ? (blockers[code] ?? "Blocked; inspect local operator diagnostics")
    : null;
}
function link(job: Job): { issueUrl: string; prUrl: string | null } {
  const base = `https://github.com/${job.repository}`;
  return {
    issueUrl: `${base}/issues/${job.issue}`,
    prUrl: job.prNumber ? `${base}/pull/${job.prNumber}` : null,
  };
}
export function metadataSnapshot(
  store: Store,
  freshnessSeconds: number,
  now = Date.now(),
): MetadataSnapshot {
  const view = store.view();
  const jobs = view.jobs;
  const projects: ProjectMetadata[] = view.projects.map((p) => {
    const scoped = jobs.filter((j) => j.projectId === p.id);
    const active = scoped.find(
      (j) => j.leaseOwner !== null || j.activeTurnId !== null,
    );
    const outcome = scoped
      .filter((j) =>
        ["ready", "blocked", "cancelled", "merged", "closed"].includes(j.stage),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const blockCode =
      p.blockCode ??
      (active?.leaseUntil !== null &&
      active?.leaseUntil !== undefined &&
      active.leaseUntil <= now
        ? "lease-expired"
        : (active?.blockCode ?? outcome?.blockCode ?? null));
    return {
      id: p.id,
      name: p.name,
      repositoryUrl: `https://github.com/${p.repository}`,
      baseBranch: p.baseBranch,
      tracking: !p.enabled ? "paused" : blockCode ? "blocked" : "enabled",
      lastPollAt:
        p.lastPollAt === null ? null : new Date(p.lastPollAt).toISOString(),
      pollState:
        p.lastPollAt === null
          ? "never-polled"
          : now - p.lastPollAt > freshnessSeconds * 1000
            ? "stale"
            : "fresh",
      queuedJobs: scoped.filter((j) => j.stage === "queued").length,
      activeJob: active
        ? { id: active.id, stage: active.stage, ...link(active) }
        : null,
      latestOutcome: outcome
        ? {
            stage: outcome.stage,
            at: new Date(outcome.updatedAt).toISOString(),
            ...link(outcome),
          }
        : null,
      blocker: publicBlocker(blockCode),
    };
  });
  return {
    schemaVersion: 1,
    observedAt: new Date(now).toISOString(),
    freshnessSeconds,
    intakePaused: view.intakePaused,
    projects,
  };
}
export function metadataServer(
  store: Store,
  token: string,
  freshnessSeconds: number,
): http.Server {
  if (token.length < 32 || /\s/.test(token))
    throw new Error(
      "Metadata token must contain at least 32 non-whitespace characters",
    );
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  return http.createServer((req, res) => {
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    const actual = createHash("sha256")
      .update(req.headers.authorization ?? "")
      .digest();
    if (!timingSafeEqual(expected, actual)) {
      respond(401, { error: "Unauthorized" });
      return;
    }
    if (req.method !== "GET") {
      respond(405, { error: "Read-only endpoint" });
      return;
    }
    const path = req.url ?? "";
    const match = /^\/v1\/projects(?:\/([a-z][a-z0-9-]{0,63}))?$/.exec(path);
    if (!match) {
      respond(404, { error: "Not found" });
      return;
    }
    try {
      const snapshot = metadataSnapshot(store, freshnessSeconds);
      if (match[1]) {
        snapshot.projects = snapshot.projects.filter((p) => p.id === match[1]);
        if (!snapshot.projects.length) {
          respond(404, { error: "Not found" });
          return;
        }
      }
      respond(200, snapshot);
    } catch {
      respond(503, { error: "Project metadata unavailable" });
    }
  });
}
