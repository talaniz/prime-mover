import test from "node:test";
import assert from "node:assert/strict";
import { requireCompatibility } from "../../dist/compatibility.js";
test("matches configured CLI and connected server, rejects unknown/missing/mismatched identities", () => {
  for (const v of ["0.155.1", "0.162.0"])
    assert.doesNotThrow(() =>
      requireCompatibility(v, `codex-cli ${v}`, {
        userAgent: `Codex Desktop/${v} (Linux)`,
      }),
    );
  for (const [config, cli, server] of [
    ["0.162.0", "codex-cli 0.155.1", "0.162.0"],
    ["0.155.1", "codex-cli 0.155.1", "0.162.0"],
    ["9.9.9", "codex-cli 9.9.9", "9.9.9"],
  ])
    assert.throws(() =>
      requireCompatibility(config, cli, { userAgent: `codex/${server}` }),
    );
  for (const reply of [
    null,
    {},
    undefined,
    { userAgent: "untrusted/0.162.0" },
    { userAgent: "codex/0.162.0-unknown" },
  ])
    assert.throws(() =>
      requireCompatibility("0.162.0", "codex-cli 0.162.0", reply),
    );
});
