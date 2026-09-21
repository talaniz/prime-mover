import { createHash } from "node:crypto";
import type { ProjectConfig } from "./config.js";
import type {
  IssueSnapshot,
  LabelEvent,
  ExecutionContract,
} from "./contracts.js";

export interface IntakeDecision {
  authorized: boolean;
  runnable: boolean;
  reason: string | null;
  contract: ExecutionContract | null;
  eventId: string | null;
  hash: string;
}

// Sections inside fenced code are data, never contract headings. Duplicate required
// headings are ambiguous, so a human must reconcile them before execution.
function contractFrom(body: string): ExecutionContract | null {
  const names: Record<string, keyof ExecutionContract> = {
    objective: "objective",
    scope: "scope",
    "acceptance criteria": "acceptance",
    verification: "verification",
  };
  const sections = new Map<keyof ExecutionContract, string[]>();
  let current: keyof ExecutionContract | undefined;
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (delimiter) {
      if (!fence) fence = delimiter;
      else if (delimiter[0] === fence[0] && delimiter.length >= fence.length)
        fence = undefined;
      if (current) sections.get(current)!.push(line);
      continue;
    }
    const heading = !fence && /^ {0,3}#{1,6} +(.+?) *#* *$/.exec(line);
    if (heading) {
      current = names[heading[1]!.trim().toLowerCase()];
      if (current) {
        if (sections.has(current)) return null;
        sections.set(current, []);
      }
    } else if (current) sections.get(current)!.push(line);
  }
  const contract = {} as ExecutionContract;
  for (const name of Object.values(names)) {
    const value = sections.get(name)?.join("\n").trim();
    if (!value || /^(?:todo|tbd|n\/a|none|[-_ .]+)$/i.test(value)) return null;
    contract[name] = value;
  }
  return contract;
}

/** Pure, fail-closed policy. Issue text supplies task data, never authorization. */
export function assessIssue(
  project: ProjectConfig,
  issue: IssueSnapshot,
  events: LabelEvent[],
): IntakeDecision {
  const result: IntakeDecision = {
    authorized: false,
    runnable: false,
    reason: null,
    contract: null,
    eventId: null,
    hash: createHash("sha256")
      .update(JSON.stringify([issue.title, issue.body]))
      .digest("hex"),
  };
  const reject = (reason: string): IntakeDecision => ({ ...result, reason });
  if (
    !project.enabled ||
    issue.repository.toLowerCase() !== project.repository.toLowerCase()
  )
    return reject("repository-not-allowed");
  if (issue.isPullRequest) return reject("not-an-issue");
  if (issue.state !== "open") return reject("issue-closed");
  if (!issue.labels.includes("codex-ready"))
    return reject("authorization-withdrawn");
  const relevant = events.filter((event) => event.label === "codex-ready");
  if (
    !relevant.length ||
    relevant.some(
      (event) =>
        !/^\d+$/.test(event.id) ||
        !Number.isFinite(Date.parse(event.createdAt)),
    )
  )
    return reject("missing-actor-evidence");
  relevant.sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0),
  );
  const latest = relevant.at(-1)!;
  if (
    relevant.some(
      (event) =>
        event.id === latest.id &&
        (event.actor !== latest.actor || event.event !== latest.event),
    )
  )
    return reject("missing-actor-evidence");
  if (latest.event !== "labeled") return reject("authorization-withdrawn");
  if (!latest.actor) return reject("missing-actor-evidence");
  if (
    !project.maintainers.some(
      (name) => name.toLowerCase() === latest.actor.toLowerCase(),
    )
  )
    return reject("unauthorized-label");
  result.authorized = true;
  result.eventId = latest.id;
  result.contract = contractFrom(issue.body);
  result.runnable = result.contract !== null;
  result.reason = result.runnable ? null : "requirements-missing";
  return result;
}
