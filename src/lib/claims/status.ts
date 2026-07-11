export const CLAIM_STATUSES = [
  "unclaimed",
  "copied",
  "detected",
  "eligible",
  "fetching_proof",
  "submitting",
  "submitted",
  "failed",
  "needs_attention",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const OPEN_CLAIM_STATUSES: ReadonlySet<ClaimStatus> = new Set([
  "unclaimed",
  "copied",
  "detected",
  "eligible",
  "fetching_proof",
  "submitting",
  "needs_attention",
  "failed",
]);

export function isOpenClaimStatus(status: string): boolean {
  return OPEN_CLAIM_STATUSES.has(status as ClaimStatus);
}

export function isAttentionStatus(status: string): boolean {
  return status === "needs_attention" || status === "failed";
}
