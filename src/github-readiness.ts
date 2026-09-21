import type { Transport } from "./github.js";
import type { ReviewTarget } from "./reviews.js";
import type { RemoteReadiness } from "./readiness.js";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Readiness response unavailable");
  return value as Record<string, unknown>;
}
export async function readRemoteReadiness(
  transport: Transport,
  repository: string,
  number: number,
  branch: string,
  target: ReviewTarget,
): Promise<RemoteReadiness> {
  if (
    !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(repository) ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !/^[a-f0-9]{40}$/.test(target.head) ||
    !/^[a-f0-9]{40}$/.test(target.base)
  )
    throw new Error("Invalid readiness identity");
  const prefix = `repos/${repository}`;
  const get = async (path: string) => {
    const response = await transport("GET", `${prefix}/${path}`);
    if (response.status !== 200)
      throw new Error("GitHub readiness evidence unavailable");
    return response.body;
  };
  const pull = async () => {
    const p = object(await get(`pulls/${number}`)),
      head = object(p.head),
      base = object(p.base);
    if (
      p.number !== number ||
      head.sha !== target.head ||
      base.sha !== target.base ||
      base.ref !== branch ||
      object(head.repo).full_name !== repository ||
      object(base.repo).full_name !== repository
    )
      throw new Error("Readiness PR head/base changed");
    if (p.state !== "open" || p.mergeable !== true)
      throw new Error(
        "Readiness PR is closed, conflicted or mergeability unavailable",
      );
    return p;
  };
  await pull();
  const base = object(await get(`branches/${encodeURIComponent(branch)}`));
  if (
    object(base.commit).sha !== target.base ||
    typeof base.protected !== "boolean"
  )
    throw new Error("Readiness base branch changed or unavailable");
  const requiredChecks = new Set<string>();
  const requiredApps: { name: string; appId: number }[] = [];
  const requirement = (name: unknown, appId?: unknown) => {
    if (typeof name !== "string" || !name.trim())
      throw new Error("Readiness required checks unavailable");
    requiredChecks.add(name);
    if (appId !== undefined && appId !== null && appId !== -1) {
      if (!Number.isSafeInteger(appId) || Number(appId) < 1)
        throw new Error("Readiness required check app unavailable");
      requiredApps.push({ name, appId: Number(appId) });
    }
  };
  if (base.protected) {
    const protection = await transport(
      "GET",
      `${prefix}/branches/${encodeURIComponent(branch)}/protection/required_status_checks`,
    );
    // A 404 means no classic required-status-check resource, not no ruleset requirements.
    if (protection.status === 200) {
      const body = object(protection.body);
      if (!Array.isArray(body.contexts) || !Array.isArray(body.checks))
        throw new Error("Readiness branch protection unavailable");
      for (const name of body.contexts) requirement(name);
      for (const item of body.checks) {
        const c = object(item);
        requirement(c.context, c.app_id);
      }
    } else if (protection.status !== 404)
      throw new Error("Readiness branch protection unavailable");
    const rules = await get(`rules/branches/${encodeURIComponent(branch)}`);
    if (!Array.isArray(rules))
      throw new Error("Readiness branch rules unavailable");
    for (const value of rules) {
      const rule = object(value);
      if (rule.type !== "required_status_checks") continue;
      const checks = object(rule.parameters).required_status_checks;
      if (!Array.isArray(checks))
        throw new Error("Readiness required rules unavailable");
      for (const value of checks) {
        const c = object(value);
        requirement(c.context, c.integration_id);
      }
    }
  }
  const checks: RemoteReadiness["checks"] = [];
  for (const kind of ["check-runs", "status"] as const) {
    let seen = 0,
      total: number | undefined;
    for (let page = 1; page <= 100; page++) {
      const body = object(
        await get(
          `commits/${target.head}/${kind}?per_page=100&page=${page}${kind === "check-runs" ? "&filter=latest" : ""}`,
        ),
      );
      const items = body[kind === "check-runs" ? "check_runs" : "statuses"];
      if (
        !Array.isArray(items) ||
        !Number.isSafeInteger(body.total_count) ||
        Number(body.total_count) < 0 ||
        (total !== undefined && total !== body.total_count) ||
        (kind === "status" && body.sha !== target.head)
      )
        throw new Error("Readiness check pagination changed or unavailable");
      total = Number(body.total_count);
      seen += items.length;
      if (seen > 1000 || seen > total)
        throw new Error("Readiness checks exceed bounded evidence");
      for (const value of items) {
        const c = object(value),
          isRun = kind === "check-runs";
        const name = isRun ? c.name : c.context;
        if (typeof name !== "string" || (isRun && c.head_sha !== target.head))
          throw new Error("Readiness check identity changed");
        const status = isRun
          ? c.status === "completed"
            ? c.conclusion === "success"
              ? "success"
              : "failure"
            : "pending"
          : c.state === "success"
            ? "success"
            : c.state === "pending"
              ? "pending"
              : "failure";
        const url = isRun ? c.html_url : c.target_url;
        const appId = isRun && c.app ? object(c.app).id : undefined;
        checks.push({
          name,
          head: target.head,
          status,
          url:
            typeof url === "string" && url.startsWith("https://")
              ? url
              : `https://github.com/${repository}/commit/${target.head}`,
          ...(Number.isSafeInteger(appId) ? { appId: Number(appId) } : {}),
        });
      }
      if (seen === total) break;
      if (!items.length || page === 100)
        throw new Error("Readiness check pagination incomplete");
    }
  }
  await pull();
  return {
    ...target,
    observedAt: Date.now(),
    open: true,
    mergeable: true,
    requiredChecks: [...requiredChecks],
    requiredApps,
    checks,
  };
}
