import { constants } from "node:fs";
import { open } from "node:fs/promises";
export interface ReassessmentRequest {
  requestId: string;
  head: string;
  base: string;
  evidence: string;
}
/** Explicit operator input, never authorization or a replacement review verdict. */
export function reassessmentRequest(value: unknown): ReassessmentRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid reassessment evidence request");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(",") !== "base,evidence,head,requestId" ||
    typeof v.requestId !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(v.requestId) ||
    typeof v.head !== "string" ||
    !/^[a-f0-9]{40}$/.test(v.head) ||
    typeof v.base !== "string" ||
    !/^[a-f0-9]{40}$/.test(v.base) ||
    v.head === v.base ||
    typeof v.evidence !== "string" ||
    !v.evidence.trim() ||
    Buffer.byteLength(v.evidence) > 16384 ||
    /\x00/.test(v.evidence)
  )
    throw new Error("Invalid or oversized reassessment evidence request");
  return {
    requestId: v.requestId,
    head: v.head,
    base: v.base,
    evidence: v.evidence,
  };
}
export async function readReassessment(
  filename: string,
): Promise<ReassessmentRequest> {
  const file = await open(
    filename,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    if (!(await file.stat()).isFile())
      throw new Error("Evidence must be a regular file");
    const buffer = Buffer.alloc(32769);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        size,
        buffer.length - size,
        null,
      );
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > 32768) throw new Error("Evidence file exceeds 32 KiB");
    return reassessmentRequest(
      JSON.parse(buffer.subarray(0, size).toString("utf8")),
    );
  } finally {
    await file.close();
  }
}
