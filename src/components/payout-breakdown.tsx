"use client";

import {
  CHARITY_SHARE_OF_FEE,
  PLATFORM_FEE_RATE,
  type PayoutSplit,
} from "@/lib/fees/success-fee";
import { formatPounds } from "@/lib/eligibility/dr15";

/** Compact payout economics: you receive / we take / charity share of fee. */
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
        You keep {Math.round((1 - PLATFORM_FEE_RATE) * 100)}% of Delay Repay.
        Fifteen takes {Math.round(PLATFORM_FEE_RATE * 100)}%, and{" "}
        {Math.round(CHARITY_SHARE_OF_FEE * 100)}% of that fee goes to charity.
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
        <span>Fee {formatPounds(split.platformFeePence)}</span>
        {" · "}
        <span>
          {Math.round(CHARITY_SHARE_OF_FEE * 100)}% of fee → charity (
          {formatPounds(split.charityPence)})
        </span>
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
            You receive
          </dt>
          <dd className="display mt-1 text-2xl font-bold tabular-nums text-signal">
            {formatPounds(split.userPayoutPence)}
          </dd>
        </div>
        <div>
          <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Fifteen takes
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {formatPounds(split.platformFeePence)}
          </dd>
        </div>
        <div>
          <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Of fee → charity (
            {Math.round(CHARITY_SHARE_OF_FEE * 100)}%)
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {formatPounds(split.charityPence)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-muted">
        Gross Delay Repay {formatPounds(split.compensationAmountPence)}. We
        receive the operator payout, keep{" "}
        {Math.round(PLATFORM_FEE_RATE * 100)}%, and pay the rest to your
        connected bank. {Math.round(CHARITY_SHARE_OF_FEE * 100)}% of our fee
        goes to charity.
      </p>
    </div>
  );
}
