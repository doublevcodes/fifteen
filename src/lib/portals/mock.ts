import type {
  DelayRepayPortal,
  PortalClaimInput,
  PortalSubmitResult,
  TflProofFetcher,
  TflProofInput,
  TflProofResult,
} from "@/lib/portals/types";
import { mockTflJourneyFarePence } from "@/lib/portals/tfl-fare";
import { formatPounds } from "@/lib/eligibility/dr15";

export class MockDelayRepayPortal implements DelayRepayPortal {
  async submit(input: PortalClaimInput): Promise<PortalSubmitResult> {
    const ref = `MOCK-${input.operator}-${input.journey.runDate.replace(/-/g, "")}-${input.journey.serviceUid.slice(0, 6).toUpperCase()}`;
    console.log(
      `[mock portal] submitted ${input.operator} claim ${ref} delay=${input.journey.delayMinutes}m fare=${input.ticketPricePence} evidence=${Boolean(input.evidenceFile)}`,
    );
    return { ok: true, claimRef: ref };
  }
}

export class MockTflProofFetcher implements TflProofFetcher {
  async fetchJourneyProof(input: TflProofInput): Promise<TflProofResult> {
    // Fare comes from the (mock) TfL journey statement — not the user-entered price.
    const farePence = mockTflJourneyFarePence({
      originCrs: input.originCrs,
      destinationCrs: input.destinationCrs,
      runDate: input.runDate,
    });
    const fareLabel = formatPounds(farePence);
    const summary = [
      `TfL Contactless & Oyster — Journey & payment history`,
      `Date: ${input.runDate}`,
      `From: ${input.originName} (${input.originCrs})`,
      `To: ${input.destinationName} (${input.destinationCrs})`,
      `Journey charge: ${fareLabel}`,
    ].join("\n");

    const pdf = Buffer.from(
      `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 180 >>stream
BT /F1 11 Tf 40 720 Td (TfL Journey charge: ${fareLabel} ${input.originCrs} to ${input.destinationCrs} ${input.runDate}) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
trailer<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF
${summary}
`,
      "utf8",
    );

    console.log(
      `[mock tfl] proof for ${input.originCrs}→${input.destinationCrs} on ${input.runDate} journeyCharge=${farePence}`,
    );

    return {
      ok: true,
      fileBytes: pdf,
      mimeType: "application/pdf",
      farePence,
      matchedJourneySummary: summary,
      tflJourneyId: `mock-${input.runDate}-${input.originCrs}-${input.destinationCrs}`,
    };
  }
}
