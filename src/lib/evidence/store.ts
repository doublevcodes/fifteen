import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const EVIDENCE_BUCKET = "claim-evidence";

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
  const relativePath = `${input.userId}/${input.delayEventId}-${randomUUID()}.${ext}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(relativePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload evidence: ${error.message}`);
  }

  return {
    relativePath,
    mimeType: input.mimeType,
  };
}

export async function readEvidenceFile(
  relativePath: string,
): Promise<Buffer> {
  // Prevent path traversal / absolute paths
  if (
    !relativePath ||
    relativePath.includes("..") ||
    relativePath.startsWith("/")
  ) {
    throw new Error("Invalid evidence path");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(relativePath);

  if (error || !data) {
    throw new Error(
      `Failed to download evidence: ${error?.message ?? "not found"}`,
    );
  }

  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}
