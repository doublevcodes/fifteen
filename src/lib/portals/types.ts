import type { Operator, TicketType } from "@/lib/eligibility/dr15";

export type PortalCredentials = {
  email: string;
  password: string;
};

export type PortalClaimInput = {
  operator: Operator;
  credentials: PortalCredentials | null;
  claimant: {
    legalName: string | null;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    payoutPreference: string;
  };
  journey: {
    originCrs: string;
    originName: string;
    destinationCrs: string;
    destinationName: string;
    serviceUid: string;
    runDate: string;
    scheduledArrival: string;
    actualArrival: string;
    delayMinutes: number;
  };
  ticketType: TicketType;
  ticketPricePence: number;
  compensationAmountPence: number;
  evidenceFile?: {
    bytes: Buffer;
    mimeType: string;
    filename: string;
  } | null;
};

export type PortalSubmitResult = {
  ok: boolean;
  claimRef?: string;
  error?: string;
  needsAttention?: boolean;
};

export interface DelayRepayPortal {
  submit(input: PortalClaimInput): Promise<PortalSubmitResult>;
}

export type TflProofInput = {
  credentials: PortalCredentials;
  runDate: string;
  originCrs: string;
  originName: string;
  destinationCrs: string;
  destinationName: string;
  scheduledArrival: string;
  actualArrival: string;
};

export type TflProofResult = {
  ok: boolean;
  fileBytes?: Buffer;
  mimeType?: string;
  farePence?: number;
  matchedJourneySummary?: string;
  tflJourneyId?: string;
  error?: string;
  retryable?: boolean;
};

export interface TflProofFetcher {
  fetchJourneyProof(input: TflProofInput): Promise<TflProofResult>;
}

export function claimSubmitMode(): "mock" | "live" {
  const mode = process.env.CLAIM_SUBMIT_MODE?.trim().toLowerCase();
  return mode === "live" ? "live" : "mock";
}
