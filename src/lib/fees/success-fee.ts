/** Platform keeps 20% of Delay Repay; user receives 80%. */
export const PLATFORM_FEE_RATE = 0.2;
/** Of the platform fee, 25% is donated to charity (5% of compensation). */
export const CHARITY_SHARE_OF_FEE = 0.25;

export type PayoutSplit = {
  compensationAmountPence: number;
  /** Amount paid out to the passenger after fees. */
  userPayoutPence: number;
  /** Total kept by Fifteen before charity split (20% of compensation). */
  platformFeePence: number;
  /** Fifteen's net (75% of platform fee). */
  commissionPence: number;
  /** Charity donation (25% of platform fee). */
  charityPence: number;
};

/**
 * Split a Delay Repay amount Fifteen receives into user payout + fee + charity.
 * Charity is 25% of the platform fee (not of the full compensation).
 */
export function calculatePayoutSplit(
  compensationAmountPence: number,
): PayoutSplit {
  const compensation = Math.max(0, Math.round(compensationAmountPence));
  const platformFeePence = Math.round(compensation * PLATFORM_FEE_RATE);
  const charityPence = Math.round(platformFeePence * CHARITY_SHARE_OF_FEE);
  const commissionPence = platformFeePence - charityPence;
  const userPayoutPence = compensation - platformFeePence;
  return {
    compensationAmountPence: compensation,
    userPayoutPence,
    platformFeePence,
    commissionPence,
    charityPence,
  };
}

/** @deprecated Use calculatePayoutSplit — kept for existing call sites during migration. */
export function calculateSuccessFee(compensationAmountPence: number) {
  const split = calculatePayoutSplit(compensationAmountPence);
  return {
    compensationAmountPence: split.compensationAmountPence,
    commissionPence: split.commissionPence,
    charityPence: split.charityPence,
    totalFeePence: split.platformFeePence,
  };
}

export const COMMISSION_RATE = PLATFORM_FEE_RATE * (1 - CHARITY_SHARE_OF_FEE);
export const CHARITY_RATE = PLATFORM_FEE_RATE * CHARITY_SHARE_OF_FEE;

/** Mollie amount string: pence → "X.XX" */
export function penceToMollieAmount(pence: number): string {
  return (Math.max(0, pence) / 100).toFixed(2);
}
