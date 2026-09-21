import { randomUUID } from "node:crypto";
import type { Store } from "./store.js";
import type { WorkContext } from "./scheduler.js";
import type { GitHub, Comment } from "./github.js";
interface CommentIntent {
  repository: string;
  pr: number;
  actor: string;
  body: string;
  text: string;
}
/** Coordinator-attributed issue comments, never formal GitHub review approvals. */
export class PrComments {
  constructor(
    private readonly store: Store,
    private readonly github: Pick<GitHub, "identity" | "comments" | "comment">,
    private readonly authorize: (id: string) => Promise<unknown>,
  ) {}
  private async find(input: CommentIntent): Promise<Comment[]> {
    const matches: Comment[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const result = await this.github.comments(
        input.repository,
        input.pr,
        cursor,
      );
      matches.push(
        ...result.items.filter(
          (c) =>
            c.body === input.body &&
            c.actor.toLowerCase() === input.actor.toLowerCase(),
        ),
      );
      if (!result.next) return matches;
      if (seen.has(result.next))
        throw new Error("Review comment pagination requires reconciliation");
      seen.add(result.next);
      cursor = result.next;
    }
    throw new Error("Review comment pagination limit; reconcile");
  }
  async publish(
    context: WorkContext,
    key: string,
    pr: number,
    body: string,
  ): Promise<string> {
    context.assertActive();
    const job = this.store.job(context.lease.jobId)!;
    if (
      !/^[a-z0-9-]{1,100}$/.test(key) ||
      !Number.isSafeInteger(pr) ||
      pr < 1 ||
      (job.prNumber !== null && job.prNumber !== pr) ||
      typeof body !== "string" ||
      !body.trim() ||
      body.length > 50000
    )
      throw new Error("Invalid review comment contract");
    const opKey = `pr-comment:${key}`;
    const previous = this.store.operations(job.id).find((o) => o.key === opKey);
    let input: CommentIntent;
    if (previous) {
      if (previous.kind !== "pr-comment")
        throw new Error("Review comment intent mismatch");
      input = previous.input as CommentIntent;
      if (
        input.repository !== job.repository ||
        input.pr !== pr ||
        input.text !== body
      )
        throw new Error("Review comment intent mismatch");
    } else {
      const actor = await this.github.identity();
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(actor))
        throw new Error("Missing GitHub report author identity");
      input = {
        repository: job.repository,
        pr,
        actor,
        text: body,
        body: `${body}\n\n<!-- prime-mover-comment:${job.id}:${key}:${randomUUID()} -->`,
      };
    }
    const matches = await this.find(input);
    if (matches.length > 1)
      throw new Error(
        "Multiple matching review comments require reconciliation",
      );
    let id = matches[0]?.id;
    if (!id) {
      if (previous)
        throw new Error(
          "Review comment delivery uncertain; reconcile before another POST",
        );
      await this.authorize(job.id);
      context.assertActive();
      this.store.operation(context.lease, opKey, "pr-comment", input);
      id = await this.github.comment(input.repository, pr, input.body);
    }
    if (!/^[1-9]\d*$/.test(id))
      throw new Error("Review comment identity uncertain; reconcile");
    const url = `https://github.com/${input.repository}/pull/${pr}#issuecomment-${id}`;
    this.store.operation(context.lease, opKey, "pr-comment", input);
    this.store.completeOperation(context.lease, opKey, { id, url });
    return url;
  }
}
