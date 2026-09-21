import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";
import {
  createReadStream,
  constants,
  lstatSync,
  openSync,
  closeSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export interface BackupReceipt {
  schemaVersion: 2;
  sha256: string;
  jobs: number;
  operations: number;
  events: number;
}
function exists(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
function vacant(file: string): void {
  if ([file, file + "-wal", file + "-shm", file + "-journal"].some(exists))
    throw new Error(
      "Backup/restore destination already exists or has sidecars",
    );
}
function standalone(file: string): void {
  if (!lstatSync(file).isFile())
    throw new Error("Backup must be a regular snapshot file");
  for (const suffix of ["-wal", "-journal"])
    if (exists(file + suffix) && lstatSync(file + suffix).size !== 0)
      throw new Error(
        "Restore requires a standalone consistent backup, not a live database",
      );
}
async function receipt(file: string): Promise<BackupReceipt> {
  standalone(file);
  const db = new DatabaseSync(file, { readOnly: true });
  let jobs: number, operations: number, events: number;
  try {
    db.exec("PRAGMA busy_timeout=5000");
    if (
      db.prepare("PRAGMA user_version").get()?.user_version !== 2 ||
      db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("Backup schema or integrity validation failed");
    for (const table of [
      "settings",
      "projects",
      "jobs",
      "events",
      "attempts",
      "operations",
      "budgets",
      "outbox",
      "intake_polls",
      "intake_acks",
    ])
      db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
    jobs = Number(
      db.prepare("SELECT COUNT(*) AS count FROM jobs").get()!.count,
    );
    operations = Number(
      db.prepare("SELECT COUNT(*) AS count FROM operations").get()!.count,
    );
    events = Number(
      db.prepare("SELECT COUNT(*) AS count FROM events").get()!.count,
    );
  } finally {
    db.close();
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  standalone(file);
  return {
    schemaVersion: 2,
    sha256: hash.digest("hex"),
    jobs,
    operations,
    events,
  };
}
function cleanup(file: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      unlinkSync(file + suffix);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
/** Database-only online snapshot. External workspaces and credentials are not copied. */
export async function backupDatabase(
  db: DatabaseSync,
  file: string,
): Promise<BackupReceipt & { pages: number }> {
  vacant(file);
  closeSync(openSync(file, "wx", 0o600));
  try {
    const deadline = Date.now() + 60000;
    const pages = await sqliteBackup(db, file, {
      rate: 64,
      progress: () => {
        if (Date.now() >= deadline)
          throw new Error("Backup time budget exhausted");
      },
    });
    chmodSync(file, 0o600);
    return { ...(await receipt(file)), pages };
  } catch (error) {
    cleanup(file);
    throw error;
  }
}
/** Restore only to a new isolated filename; never overwrite an active database. */
export async function restoreDatabase(
  source: string,
  destination: string,
): Promise<BackupReceipt> {
  vacant(destination);
  const original = await receipt(source);
  let copied = false;
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    copied = true;
    chmodSync(destination, 0o600);
    const restored = await receipt(destination);
    if (JSON.stringify(restored) !== JSON.stringify(original))
      throw new Error("Backup changed during restore");
    return restored;
  } catch (error) {
    if (copied) cleanup(destination);
    throw error;
  }
}
