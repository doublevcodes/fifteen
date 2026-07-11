/**
 * Extract the journey charge (pence) from TfL journey history / statement text.
 * Prefers explicit charge/fare lines; otherwise the last £ amount in the extract
 * (TfL statements often list journey then charge).
 */
export function parseTflFareFromText(text: string): number | null {
  if (!text.trim()) return null;

  const preferred =
    text.match(
      /(?:journey\s*charge|fare\s*charged|amount\s*charged|pay\s*as\s*you\s*go|charge)[:\s]*£\s*(\d+\.\d{2})/i,
    ) ??
    text.match(/£\s*(\d+\.\d{2})\s*(?:journey\s*charge|fare|charged)/i);

  if (preferred?.[1]) {
    const pence = Math.round(parseFloat(preferred[1]) * 100);
    return pence > 0 ? pence : null;
  }

  const all = [...text.matchAll(/£\s*(\d+\.\d{2})/g)];
  if (all.length === 0) return null;
  const last = all[all.length - 1]?.[1];
  if (!last) return null;
  const pence = Math.round(parseFloat(last) * 100);
  return pence > 0 ? pence : null;
}

export function parseTflFareFromProofBytes(
  bytes: Buffer,
  mimeType?: string | null,
): number | null {
  const text = bytes.toString("utf8");
  // PDF stubs and CSV/text extracts are utf8-readable enough for £ amounts
  const fromText = parseTflFareFromText(text);
  if (fromText != null) return fromText;
  if (mimeType?.includes("pdf")) {
    // Binary PDFs may still contain the fare as literal ASCII
    const ascii = bytes.toString("latin1");
    return parseTflFareFromText(ascii);
  }
  return null;
}

/** Deterministic mock TfL PAYG charge for a journey (pence). */
export function mockTflJourneyFarePence(input: {
  originCrs: string;
  destinationCrs: string;
  runDate: string;
}): number {
  const key = `${input.originCrs}:${input.destinationCrs}:${input.runDate}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  // £2.40 – £12.80 in 10p steps — typical PAYG NR range
  return 240 + (hash % 105) * 10;
}
