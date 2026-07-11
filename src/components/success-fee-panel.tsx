"use client";

import Link from "next/link";
import { PayoutBreakdown } from "@/components/payout-breakdown";
import { calculatePayoutSplit } from "@/lib/fees/success-fee";

export type SettlementView = {
  id: string;
  status: string;
  commissionPence: number;
  charityPence: number;
  totalFeePence: number;
  userPayoutPence?: number;
  paidAt: string | Date | null;
};

export function SuccessFeePanel({
  fee,
  claimStatus,
  compensationAmountPence,
  bankConnected,
}: {
  fee: SettlementView | null;
  claimStatus: string;
  compensationAmountPence: number;
  bankConnected: boolean;
}) {
  if (claimStatus !== "submitted") return null;

  const split = calculatePayoutSplit(compensationAmountPence);
  const status = fee?.status ?? "awaiting_funds";
  const isPaidOut = status === "paid_out";

  return (
    <section className="mt-8 border border-line bg-[var(--card)] p-6">
      <h2 className="display text-lg font-semibold uppercase tracking-wide">
        Your payout
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Fifteen receives Delay Repay from the operator, keeps 20%, donates 5%
        to charity, and pays 75% to your connected bank automatically.
      </p>

      <div className="mt-4">
        <PayoutBreakdown split={split} />
      </div>

      <p className="mono mt-4 text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Settlement: {status}
        {isPaidOut && fee?.paidAt
          ? ` · ${new Date(fee.paidAt).toLocaleString("en-GB")}`
          : ""}
      </p>

      {isPaidOut ? (
        <p className="mono mt-3 text-xs text-signal" role="status">
          Paid out to your connected bank account.
        </p>
      ) : !bankConnected ? (
        <p className="mono mt-3 text-xs text-rail" role="status">
          Connect your bank in{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Settings
          </Link>{" "}
          to receive this payout automatically.
        </p>
      ) : (
        <p className="mono mt-3 text-xs text-ink-muted" role="status">
          Payout pending — it runs automatically once your bank is ready.
        </p>
      )}
    </section>
  );
}
