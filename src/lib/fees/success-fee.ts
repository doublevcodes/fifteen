/** Passenger receives 75% of Delay Repay. */
export const USER_PAYOUT_RATE = 0.75;
/** Fifteen keeps 20% of Delay Repay. */
export const COMMISSION_RATE = 0.2;
/** Charity receives 5% of Delay Repay. */
export const CHARITY_RATE = 0.05;
/** Total deducted from compensation (commission + charity). */
export const PLATFORM_FEE_RATE = COMMISSION_RATE + CHARITY_RATE;

export type PayoutSplit = {
  compensationAmountPence: number;
  /** Amount paid out to the passenger after fees. */
  userPayoutPence: number;
  /** Total deducted (Fifteen commission + charity). */
  platformFeePence: number;
  /** Fifteen's net keep (20% of compensation). */
  commissionPence: number;
  /** Charity donation (5% of compensation). */
  charityPence: number;
};

/**
 * Split a Delay Repay amount into user payout (75%), Fifteen (20%), and charity (5%).
 * User payout is the remainder so parts always sum to compensation.
 */
export function calculatePayoutSplit(
  compensationAmountPence: number,
): PayoutSplit {
  const compensation = Math.max(0, Math.round(compensationAmountPence));
  const commissionPence = Math.round(compensation * COMMISSION_RATE);
  const charityPence = Math.round(compensation * CHARITY_RATE);
  const platformFeePence = commissionPence + charityPence;
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

/** Mollie amount string: pence → "X.XX" */
export function penceToMollieAmount(pence: number): string {
  return (Math.max(0, pence) / 100).toFixed(2);
}
