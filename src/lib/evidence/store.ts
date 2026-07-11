import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const EVIDENCE_ROOT = path.join(process.cwd(), "data", "evidence");

export async function saveEvidenceFile(input: {
  userId: string;
  delayEventId: string;
  bytes: Buffer;
  mimeType: string;
  extension?: string;
}): Promise<{ relativePath: string; mimeType: string }> {
  const ext =
    input.extension ??
    (input.mimeType.includes("pdf")
      ? "pdf"
      : input.mimeType.includes("csv")
        ? "csv"
        : "bin");
  const dir = path.join(EVIDENCE_ROOT, input.userId);
  await mkdir(dir, { recursive: true });
  const filename = `${input.delayEventId}-${randomUUID()}.${ext}`;
  const absolute = path.join(dir, filename);
  await writeFile(absolute, input.bytes);
  return {
    relativePath: path.join(input.userId, filename),
    mimeType: input.mimeType,
  };
}

export async function readEvidenceFile(
  relativePath: string,
): Promise<Buffer> {
  const absolute = path.join(EVIDENCE_ROOT, relativePath);
  // Prevent path traversal
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(path.resolve(EVIDENCE_ROOT))) {
    throw new Error("Invalid evidence path");
  }
  return readFile(resolved);
}
