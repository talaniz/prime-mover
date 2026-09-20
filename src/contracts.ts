/** Stable contracts between the durable coordinator and external adapters. */
export type JobStage = 'discovered' | 'authorized' | 'queued' | 'preparing' | 'implementing' | 'verifying' | 'pr-open' | 'code-review' | 'code-fixes' | 'e2e-review' | 'e2e-fixes' | 'ready' | 'waiting' | 'blocked' | 'cancelled' | 'merged' | 'closed';
export type Role = 'implementation' | 'code-review' | 'e2e-review';
export interface ExecutionContract {objective: string; scope: string; acceptance: string; verification: string}
export interface IssueSnapshot {repository: string; number: number; title: string; body: string; state: 'open' | 'closed'; labels: string[]; updatedAt: string; isPullRequest: boolean}
export interface LabelEvent {id: string; actor: string; label: string; event: 'labeled' | 'unlabeled'; createdAt: string}
export interface Page<T> {items: T[]; next: string | null}
export interface GitHubReader {
  issues(repository: string, cursor?: string): Promise<Page<IssueSnapshot>>;
  issue(repository: string, number: number): Promise<IssueSnapshot>;
  events(repository: string, number: number, cursor?: string): Promise<Page<LabelEvent>>;
}
export interface VerificationResult {argv: string[]; exitCode: number; headSha: string; artifact: string; startedAt: string; completedAt: string}
export interface ReviewEvidence {role: 'code-review' | 'e2e-review'; taskId: string; headSha: string; reportUrl: string; signedOff: boolean}
/** Public projection: deliberately excludes command environments and filesystem paths. */
export interface ProjectMetadata {
  id: string; name: string; repositoryUrl: string; baseBranch: string;
  tracking: 'enabled' | 'paused' | 'blocked'; lastPollAt: string | null;
  queuedJobs: number; activeJob: {id: string; stage: JobStage; issueUrl: string; prUrl: string | null} | null;
  latestOutcome: {stage: JobStage; at: string; issueUrl: string; prUrl: string | null} | null;
  blocker: string | null;
}
export interface MetadataSnapshot {schemaVersion: 1; observedAt: string; freshnessSeconds: number; intakePaused: boolean; projects: ProjectMetadata[]}
