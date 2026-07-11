"use client";

import {
  CHARITY_RATE,
  COMMISSION_RATE,
  USER_PAYOUT_RATE,
  type PayoutSplit,
} from "@/lib/fees/success-fee";
import { formatPounds } from "@/lib/eligibility/dr15";

/** Compact payout economics: you receive / Fifteen / charity. */
export function PayoutBreakdown({
  split,
  compact,
}: {
  split: PayoutSplit | null;
  compact?: boolean;
}) {
  if (!split || split.compensationAmountPence <= 0) {
    return (
      <p className="text-sm text-ink-muted">
        You keep {Math.round(USER_PAYOUT_RATE * 100)}% of Delay Repay. Fifteen
        keeps {Math.round(COMMISSION_RATE * 100)}%, and{" "}
        {Math.round(CHARITY_RATE * 100)}% goes to charity.
      </p>
    );
  }

  if (compact) {
    return (
      <p className="mono text-[10px] text-ink-muted">
        <span className="text-signal">
          You {formatPounds(split.userPayoutPence)}
        </span>
        {" · "}
        <span>Fifteen {formatPounds(split.commissionPence)}</span>
        {" · "}
        <span>Charity {formatPounds(split.charityPence)}</span>
      </p>
    );
  }

  return (
    <div className="border border-line bg-paper-2 px-4 py-4">
      <p className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        After Fifteen receives Delay Repay
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            You receive ({Math.round(USER_PAYOUT_RATE * 100)}%)
          </dt>
          <dd className="display mt-1 text-2xl font-bold tabular-nums text-signal">
            {formatPounds(split.userPayoutPence)}
          </dd>
        </div>
        <div>
          <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Fifteen keeps ({Math.round(COMMISSION_RATE * 100)}%)
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {formatPounds(split.commissionPence)}
          </dd>
        </div>
        <div>
          <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Charity ({Math.round(CHARITY_RATE * 100)}%)
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {formatPounds(split.charityPence)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-muted">
        Gross Delay Repay {formatPounds(split.compensationAmountPence)}. We
        receive the operator payout, keep{" "}
        {Math.round(COMMISSION_RATE * 100)}%, donate{" "}
        {Math.round(CHARITY_RATE * 100)}% to charity, and pay{" "}
        {Math.round(USER_PAYOUT_RATE * 100)}% to your connected bank.
      </p>
    </div>
  );
}
