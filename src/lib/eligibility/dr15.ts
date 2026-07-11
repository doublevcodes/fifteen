export type Operator = "SWR" | "SOUTHERN" | "SOUTHEASTERN";

export type TicketType =
  | "single"
  | "return"
  | "contactless"
  | "season_weekly"
  | "season_flexi"
  | "season_monthly"
  | "season_quarterly"
  | "season_annual";

export type CompensationTier =
  | "none"
  | "15-29"
  | "30-59"
  | "60-119"
  | "120+";

export type CompensationInput = {
  operator: Operator;
  delayMinutes: number;
  ticketPricePence: number;
  ticketType: TicketType;
};

export type CompensationResult = {
  eligible: boolean;
  tier: CompensationTier;
  compensationAmountPence: number;
  journeyRatePence: number | null;
  percentOfBase: number;
};

const SEASON_DIVISORS: Record<
  Exclude<TicketType, "single" | "return" | "contactless">,
  number
> = {
  season_weekly: 10,
  season_flexi: 16,
  season_monthly: 40,
  season_quarterly: 120,
  season_annual: 464,
};

const SUPPORTED_OPERATORS: ReadonlySet<Operator> = new Set([
  "SWR",
  "SOUTHERN",
  "SOUTHEASTERN",
]);

function tierForDelay(delayMinutes: number): CompensationTier {
  if (delayMinutes < 15) return "none";
  if (delayMinutes < 30) return "15-29";
  if (delayMinutes < 60) return "30-59";
  if (delayMinutes < 120) return "60-119";
  return "120+";
}

function roundPence(value: number): number {
  return Math.round(value);
}

/**
 * DR15 compensation shared by SWR, Southern, and Southeastern.
 *
 * Single: 25% / 50% / 100% / 100% of ticket
 * Return: 12.5% / 25% / 50% / 100% of ticket
 * Season: 25% / 50% / 100% of journey rate; 120+ = return journey rate (2×)
 */
export function calculateCompensation(
  input: CompensationInput,
): CompensationResult {
  const { delayMinutes, ticketPricePence, ticketType, operator } = input;

  if (!SUPPORTED_OPERATORS.has(operator)) {
    return {
      eligible: false,
      tier: "none",
      compensationAmountPence: 0,
      journeyRatePence: null,
      percentOfBase: 0,
    };
  }

  if (!Number.isFinite(ticketPricePence) || ticketPricePence <= 0) {
    return {
      eligible: false,
      tier: "none",
      compensationAmountPence: 0,
      journeyRatePence: null,
      percentOfBase: 0,
    };
  }

  const tier = tierForDelay(delayMinutes);
  if (tier === "none") {
    return {
      eligible: false,
      tier,
      compensationAmountPence: 0,
      journeyRatePence: null,
      percentOfBase: 0,
    };
  }

  // Contactless PAYG uses the same bands as a single ticket, with base =
  // the TfL-charged fare for that journey.
  if (ticketType === "single" || ticketType === "contactless") {
    const percent =
      tier === "15-29" ? 0.25 : tier === "30-59" ? 0.5 : 1;
    const amount = roundPence(ticketPricePence * percent);
    return {
      eligible: true,
      tier,
      compensationAmountPence: Math.min(amount, ticketPricePence),
      journeyRatePence: null,
      percentOfBase: percent,
    };
  }

  if (ticketType === "return") {
    const percent =
      tier === "15-29"
        ? 0.125
        : tier === "30-59"
          ? 0.25
          : tier === "60-119"
            ? 0.5
            : 1;
    const amount = roundPence(ticketPricePence * percent);
    return {
      eligible: true,
      tier,
      compensationAmountPence: Math.min(amount, ticketPricePence),
      journeyRatePence: null,
      percentOfBase: percent,
    };
  }

  const divisor = SEASON_DIVISORS[ticketType];
  const journeyRatePence = ticketPricePence / divisor;
  // 15–29 / 30–59 / 60–119 = % of single journey rate;
  // 120+ = full return journey rate (2 × journey rate)
  const multiplier =
    tier === "15-29"
      ? 0.25
      : tier === "30-59"
        ? 0.5
        : tier === "60-119"
          ? 1
          : 2;
  const amount = roundPence(journeyRatePence * multiplier);
  const cap = roundPence(journeyRatePence * 2);

  return {
    eligible: true,
    tier,
    compensationAmountPence: Math.min(amount, cap),
    journeyRatePence: roundPence(journeyRatePence),
    percentOfBase: multiplier,
  };
}

export function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  single: "Single",
  return: "Return",
  contactless: "Contactless (PAYG)",
  season_weekly: "Season (weekly)",
  season_flexi: "Season (flexi)",
  season_monthly: "Season (monthly)",
  season_quarterly: "Season (quarterly)",
  season_annual: "Season (annual)",
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  SWR: "South Western Railway",
  SOUTHERN: "Southern",
  SOUTHEASTERN: "Southeastern",
};

/** Marketing / help pages */
export const OPERATOR_CLAIM_URLS: Record<Operator, string> = {
  SWR: "https://delayrepay.southwesternrailway.com/",
  SOUTHERN: "https://delayrepay.southernrailway.com/",
  SOUTHEASTERN: "https://delayrepay.southeasternrailway.co.uk/",
};

/** White-label Delay Repay portal roots used by browser automation */
export const OPERATOR_PORTAL_URLS: Record<Operator, string> = {
  SWR: "https://delayrepay.southwesternrailway.com/",
  SOUTHERN: "https://delayrepay.southernrailway.com/",
  SOUTHEASTERN: "https://delayrepay.southeasternrailway.co.uk/",
};

/** ATOC operator codes used by Realtime Trains / Network Rail */
export const ATOC_TO_OPERATOR: Record<string, Operator> = {
  SW: "SWR",
  SN: "SOUTHERN",
  SE: "SOUTHEASTERN",
};

export function operatorFromAtoc(code: string | null | undefined): Operator | null {
  if (!code) return null;
  return ATOC_TO_OPERATOR[code.toUpperCase()] ?? null;
}
