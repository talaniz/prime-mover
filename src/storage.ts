import { execFileSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import type { Config } from "./config.js";
import { isWithin } from "./config.js";
import { Store } from "./store.js";

export function safeDescendant(mount: string, destination: string): void {
  if (!isWithin(mount, destination))
    throw new Error("Storage destination escapes expected mount");
  let current = mount;
  for (const part of path.relative(mount, destination).split(path.sep)) {
    current = path.join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error("Storage symlink is not allowed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (existsSync(current) && statSync(current).dev !== statSync(mount).dev)
      throw new Error("Storage device changed below mount");
  }
}
/** Read-only preflight: never creates a missing mount or root directory. */
export function checkStorage(config: Config): void {
  try {
    const mount = config.storage.mount;
    if (realpathSync(mount) !== mount) throw new Error("noncanonical mount");
    const data = JSON.parse(
      execFileSync(
        "findmnt",
        ["-J", "-T", mount, "-o", "TARGET,UUID,FSTYPE,OPTIONS"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    ) as {
      filesystems?: {
        target: string;
        uuid: string;
        fstype: string;
        options: string;
      }[];
    };
    const found = data.filesystems?.[0];
    if (
      !found ||
      found.target !== mount ||
      found.uuid !== config.storage.uuid ||
      found.fstype !== "ext4" ||
      !found.options.split(",").includes("rw")
    )
      throw new Error("unexpected filesystem");
    accessSync(mount, constants.X_OK);
    safeDescendant(mount, config.storage.root);
    let writableParent = config.storage.root;
    while (!existsSync(writableParent))
      writableParent = path.dirname(writableParent);
    accessSync(writableParent, constants.W_OK | constants.X_OK);
    safeDescendant(mount, config.metadata.socket);
    safeDescendant(
      mount,
      path.join(config.storage.root, "data", "prime-mover", "jobs.sqlite"),
    );
    for (const suffix of ["-wal", "-shm"])
      safeDescendant(
        mount,
        path.join(
          config.storage.root,
          "data",
          "prime-mover",
          "jobs.sqlite" + suffix,
        ),
      );
  } catch {
    throw new Error(
      "Storage preflight failed: require the configured writable ext4 mount/UUID and paths without symlinks",
    );
  }
}
export function openRuntime(config: Config): Store {
  checkStorage(config);
  const dir = path.join(config.storage.root, "data", "prime-mover");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  checkStorage(config);
  const store = new Store(path.join(dir, "jobs.sqlite"));
  try {
    store.seedProjects(config.projects);
    return store;
  } catch (error) {
    store.close();
    throw error;
  }
}
