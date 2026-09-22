import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readReassessment,
  reassessmentRequest,
} from "../../dist/reassessment.js";
const valid = {
  requestId: "approved-context-1",
  head: "a".repeat(40),
  base: "b".repeat(40),
  evidence: "Original check output and approved issue clarification",
};
test("reassessment evidence has explicit bounded fields and a stable request identity", () => {
  assert.deepEqual(reassessmentRequest(valid), valid);
  for (const value of [
    null,
    [],
    {},
    { ...valid, extra: true },
    { ...valid, requestId: "../x" },
    { ...valid, requestId: "a".repeat(65) },
    { ...valid, head: "bad" },
    { ...valid, base: valid.head },
    { ...valid, evidence: " " },
    { ...valid, evidence: "\0" },
    { ...valid, evidence: "é".repeat(8193) },
  ])
    assert.throws(() => reassessmentRequest(value), /request/);
});
test("evidence reader accepts regular JSON and rejects oversized files, directories and symlinks", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "pm-evidence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "evidence.json");
  writeFileSync(file, JSON.stringify(valid));
  assert.deepEqual(await readReassessment(file), valid);
  symlinkSync(file, join(root, "link"));
  await assert.rejects(readReassessment(join(root, "link")));
  await assert.rejects(readReassessment(root), /regular file/);
  writeFileSync(file, " ".repeat(32769));
  await assert.rejects(readReassessment(file), /32 KiB/);
  writeFileSync(file, "not json");
  await assert.rejects(readReassessment(file));
});
