# Prime Mover

The planned durable workflow engine behind DOOM Control Room.

You set the objective. Prime Mover moves the pieces.

## Status

Repository initialized. The workflow worker is not implemented or running yet. No GitHub polling, agent execution, notifications, or automatic merges are enabled by this repository.

## Intended workflow

1. Discover GitHub issues explicitly authorized for execution, initially using a `codex-ready` label applied by an authorized repository maintainer.
2. Persist and claim each job in SQLite, preventing duplicate execution.
3. Create an isolated Git worktree and use the existing Codex app server to implement the issue's acceptance criteria.
4. Verify the change and create a pull request.
5. Obtain independent code review, handle findings, and obtain sign-off on the current head commit.
6. Obtain separate end-to-end review, handle findings, and revalidate both reviews after fixes.
7. Notify the owner when the PR is ready for their merge approval. Never merge automatically.

Start with one implementation job at a time and GitHub polling rather than a public webhook receiver. Persist task identifiers, stage transitions, reviewed commit SHAs, and notification state. Recovery must inspect existing jobs and app-server tasks before taking further action. Missing verification or an exhausted retry budget must result in a visible blocked state, not success.

## Development storage on the Pi

The initial checkout is on the USB volume mounted at `/media/talaniz/postgresdata`:

```text
codex-work/
  repos/prime-mover/       # this Git checkout
  worktrees/              # future isolated job worktrees
  data/prime-mover/       # future SQLite databases and runtime state
```

`/home/palpatine/prime-mover` is a convenience symlink to this checkout. Runtime databases belong outside repository clones; the data directory is currently empty. The existing DOOM checkout and PostgreSQL/n8n directories have not been moved.

The drive is a roughly 30 GB USB flash device with a local ext4 filesystem. A temporary SQLite WAL database passed concurrent-reader, transaction-visibility, and integrity checks during initialization; the test database was removed. This is a functional check, not an endurance or power-loss test.

The mount currently uses the existing desktop-managed path and has no `/etc/fstab` entry. Before unattended worker deployment, configure and verify persistent mounting by filesystem UUID, startup dependencies, and database backups. Workers must refuse to start if the expected filesystem is missing or read-only; never silently create runtime state on the Pi's root filesystem at a missing mount path.

## Development and verification

No application runtime, dependency manager, database schema, or build/test commands have been selected yet. Future implementation PRs must add runnable tests and document their actual commands. Follow `AGENTS.md` and the user's global PR review workflow.

Current repository checks:

```sh
git status --short --branch
git remote -v
git diff --check
```

Credentials, environment-specific configuration, databases and their WAL/SHM sidecars must never be committed. GitHub authentication belongs to the local credential manager; Codex authentication stays with the existing app server.

## Execution harness

Start with [harness/README.md](harness/README.md) for the eight ordered build contracts,
test-first commit workflow, execution log, independent reviews, and release notes.
The application milestone has not started; this harness is preparation only.
