import type http from "node:http";
import { constants, openSync, closeSync, fstatSync } from "node:fs";
import { chmod, lstat, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";

async function refusesConnections(socket: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createConnection(socket);
    const finish = (stale: boolean) => {
      probe.destroy();
      resolve(stale);
    };
    probe.setTimeout(1000, () => finish(false));
    probe.once("connect", () => finish(false));
    probe.once("error", (error: NodeJS.ErrnoException) =>
      finish(error.code === "ECONNREFUSED"),
    );
  });
}

/** Hold a kernel lock across stale-socket reconciliation and the listener lifetime. */
export async function listenMetadata(
  server: http.Server,
  socket: string,
): Promise<void> {
  const fd = openSync(
    `${socket}.lock`,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
    0o600,
  );
  let held = true;
  const release = () => {
    if (held) {
      held = false;
      closeSync(fd);
    }
  };
  try {
    const lock = fstatSync(fd);
    if (
      !lock.isFile() ||
      lock.nlink !== 1 ||
      lock.uid !== process.getuid?.() ||
      lock.mode & 0o077
    )
      throw Error("Metadata lock must be an owner-private regular file");
    // FD 3 shares the parent's open file description. The flock survives this
    // short child process and is released when the parent closes fd or dies.
    execFileSync("/usr/bin/flock", ["--exclusive", "--nonblock", "3"], {
      stdio: ["ignore", "ignore", "ignore", fd],
    });
    let existing;
    try {
      existing = await lstat(socket);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (existing) {
      if (!existing.isSocket() || existing.uid !== process.getuid?.())
        throw Error("Metadata socket path is not an owned socket");
      if (!(await refusesConnections(socket)))
        throw Error("Metadata listener is active or its state is uncertain");
      const current = await lstat(socket);
      if (
        !current.isSocket() ||
        current.dev !== existing.dev ||
        current.ino !== existing.ino
      )
        throw Error("Metadata socket changed during recovery");
      await unlink(socket);
    }
    server.once("close", release);
    await new Promise<void>((resolve, reject) => {
      const failed = (error: Error) => {
        server.off("listening", ready);
        reject(error);
      };
      const ready = () => {
        server.off("error", failed);
        resolve();
      };
      server.once("error", failed);
      server.once("listening", ready);
      server.listen(socket);
    });
    await chmod(socket, 0o600);
  } catch (error) {
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    release();
    throw error;
  }
}
