import { spawn } from "node:child_process";
import type {
  GitHubReader,
  IssueSnapshot,
  LabelEvent,
  Page,
} from "./contracts.js";
export interface Comment {
  id: string;
  body: string;
  actor: string;
}
export interface GitHub extends GitHubReader {
  identity(): Promise<string>;
  comments(
    repository: string,
    issue: number,
    cursor?: string,
  ): Promise<Page<Comment>>;
  comment(repository: string, issue: number, body: string): Promise<string>;
}
export class GitHubFailure extends Error {
  constructor(
    readonly kind:
      | "authentication"
      | "forbidden"
      | "rate-limited"
      | "unavailable"
      | "invalid-response",
    readonly retryAt: number = 0,
  ) {
    super(`GitHub ${kind}`);
  }
}
export interface Response {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
export type Transport = (
  method: string,
  endpoint: string,
  body?: unknown,
) => Promise<Response>;

/** gh owns credentials; neither tokens nor remote error bodies enter diagnostics. */
export const ghTransport: Transport = (method, endpoint, body) =>
  new Promise((resolve, reject) => {
    const args = [
      "api",
      "--hostname",
      "github.com",
      "--include",
      "--method",
      method,
      "-H",
      "Accept: application/vnd.github+json",
      "-H",
      "X-GitHub-Api-Version: 2022-11-28",
      endpoint,
    ];
    if (body !== undefined) args.push("--input", "-");
    const child = spawn("gh", args, { stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let stopped = false;
    const fail = () => {
      if (!stopped) {
        stopped = true;
        child.kill();
        reject(new GitHubFailure("unavailable"));
      }
    };
    const timer = setTimeout(fail, 30000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) fail();
      else chunks.push(chunk);
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (stopped) return;
      stopped = true;
      try {
        const output = Buffer.concat(chunks).toString("utf8");
        const split = /\r?\n\r?\n/.exec(output);
        if (!split || split.index === undefined) throw new Error();
        const lines = output.slice(0, split.index).split(/\r?\n/);
        const status = Number(
          /^HTTP\/\S+ (\d{3})/.exec(lines.shift() ?? "")?.[1],
        );
        if (!status) throw new Error();
        const headers: Record<string, string> = {};
        for (const line of lines) {
          const colon = line.indexOf(":");
          if (colon > 0)
            headers[line.slice(0, colon).toLowerCase()] = line
              .slice(colon + 1)
              .trim();
        }
        const payload = output.slice(split.index + split[0].length);
        // Preserve HTTP failure classification even when the error body is not JSON.
        const value: unknown = status >= 400 ? null : JSON.parse(payload);
        resolve({ status, headers, body: value });
      } catch {
        reject(new GitHubFailure("invalid-response"));
      }
    });
    child.stdin.end(body === undefined ? undefined : JSON.stringify(body));
  });
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GitHubFailure("invalid-response");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new GitHubFailure("invalid-response");
  return value;
}
function identifier(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return String(value);
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  throw new GitHubFailure("invalid-response");
}
function repoPath(repository: string, number?: number): string {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    repository.split("/").some((v) => v === "." || v === "..")
  )
    throw new Error("Invalid repository");
  if (number !== undefined && (!Number.isSafeInteger(number) || number < 1))
    throw new Error("Invalid issue number");
  return `repos/${repository}/issues${number === undefined ? "" : `/${number}`}`;
}
function pageNumber(cursor = "1"): string {
  if (!/^[1-9]\d{0,5}$/.test(cursor))
    throw new Error("Invalid pagination cursor");
  return cursor;
}
function mapIssue(repository: string, raw: unknown): IssueSnapshot {
  const r = record(raw);
  if (
    !Array.isArray(r.labels) ||
    !["open", "closed"].includes(String(r.state)) ||
    !Number.isSafeInteger(r.number) ||
    Number(r.number) < 1
  )
    throw new GitHubFailure("invalid-response");
  return {
    repository,
    number: Number(r.number),
    title: text(r.title),
    body: r.body === null ? "" : text(r.body),
    state: r.state as "open" | "closed",
    labels: r.labels.map((l) =>
      typeof l === "string" ? l : text(record(l).name),
    ),
    updatedAt: text(r.updated_at),
    isPullRequest: r.pull_request !== undefined,
  };
}
export class GitHubClient implements GitHub {
  constructor(private readonly transport: Transport = ghTransport) {}
  private async request(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.transport(method, endpoint, body);
    } catch (error) {
      if (error instanceof GitHubFailure) throw error;
      throw new GitHubFailure("unavailable");
    }
    const { status, headers } = response;
    if (status >= 200 && status < 300) return response;
    if (
      status === 429 ||
      (status === 403 &&
        (headers["retry-after"] !== undefined ||
          headers["x-ratelimit-remaining"] === "0"))
    ) {
      const seconds = Number(headers["retry-after"]);
      const reset = Number(headers["x-ratelimit-reset"]) * 1000;
      const retry =
        Number.isFinite(seconds) && seconds > 0
          ? Date.now() + seconds * 1000
          : Number.isFinite(reset) && reset > Date.now()
            ? reset
            : Date.now() + 60000;
      throw new GitHubFailure("rate-limited", retry);
    }
    throw new GitHubFailure(
      status === 401
        ? "authentication"
        : status === 403
          ? "forbidden"
          : "unavailable",
    );
  }
  private async page<T>(
    endpoint: string,
    map: (value: unknown) => T,
  ): Promise<Page<T>> {
    const response = await this.request("GET", endpoint);
    if (!Array.isArray(response.body))
      throw new GitHubFailure("invalid-response");
    let next: string | null = null;
    for (const link of (response.headers.link ?? "").split(",")) {
      if (!/rel="next"/.test(link)) continue;
      const href = /<([^>]+)>/.exec(link)?.[1];
      if (!href) throw new GitHubFailure("invalid-response");
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        throw new GitHubFailure("invalid-response");
      }
      const current = new URL(endpoint, "https://api.github.com/");
      const candidate = url.searchParams.get("page") ?? "";
      const expected = new URL(current);
      expected.searchParams.set("page", candidate);
      // Only accept GitHub's next page for this exact endpoint/query; never follow URLs.
      if (
        url.origin !== current.origin ||
        url.username ||
        url.password ||
        url.hash ||
        url.pathname !== current.pathname ||
        [...url.searchParams].some(
          ([k, v]) => expected.searchParams.get(k) !== v,
        ) ||
        [...expected.searchParams].some(
          ([k, v]) => url.searchParams.get(k) !== v,
        ) ||
        !/^[1-9]\d{0,5}$/.test(candidate) ||
        Number(candidate) <= Number(current.searchParams.get("page") ?? 1)
      )
        throw new GitHubFailure("invalid-response");
      next = candidate;
    }
    return { items: response.body.map(map), next };
  }
  async identity(): Promise<string> {
    return text(record((await this.request("GET", "user")).body).login);
  }
  async issues(
    repository: string,
    cursor?: string,
  ): Promise<Page<IssueSnapshot>> {
    return this.page(
      `${repoPath(repository)}?state=all&labels=codex-ready&sort=updated&direction=asc&per_page=100&page=${pageNumber(cursor)}`,
      (r) => mapIssue(repository, r),
    );
  }
  async issue(repository: string, number: number): Promise<IssueSnapshot> {
    return mapIssue(
      repository,
      (await this.request("GET", repoPath(repository, number))).body,
    );
  }
  async events(
    repository: string,
    number: number,
    cursor?: string,
  ): Promise<Page<LabelEvent>> {
    const page = await this.page(
      `${repoPath(repository, number)}/events?per_page=100&page=${pageNumber(cursor)}`,
      record,
    );
    return {
      next: page.next,
      items: page.items
        .filter((r) => r.event === "labeled" || r.event === "unlabeled")
        .map((r) => ({
          id: identifier(r.id),
          actor: r.actor === null ? "" : text(record(r.actor).login),
          label: text(record(r.label).name),
          event: r.event as "labeled" | "unlabeled",
          createdAt: text(r.created_at),
        })),
    };
  }
  async comments(
    repository: string,
    number: number,
    cursor?: string,
  ): Promise<Page<Comment>> {
    return this.page(
      `${repoPath(repository, number)}/comments?per_page=100&page=${pageNumber(cursor)}`,
      (raw) => {
        const r = record(raw);
        return {
          id: identifier(r.id),
          body: text(r.body),
          actor: r.user === null ? "" : text(record(r.user).login),
        };
      },
    );
  }
  async comment(
    repository: string,
    number: number,
    body: string,
  ): Promise<string> {
    return identifier(
      record(
        (
          await this.request(
            "POST",
            `${repoPath(repository, number)}/comments`,
            { body },
          )
        ).body,
      ).id,
    );
  }
}
