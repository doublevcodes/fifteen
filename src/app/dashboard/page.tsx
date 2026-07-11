import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpenClaimStatus } from "@/lib/claims/status";
import { calculatePayoutSplit } from "@/lib/fees/success-fee";
import {
  OPERATOR_LABELS,
  formatPounds,
  type Operator,
} from "@/lib/eligibility/dr15";

/** Fixed 5-column board row — keep Gross | Fee side by side (no wrap). */
const COLS =
  "grid w-full grid-cols-[4.75rem_minmax(0,1fr)_2.75rem_4.75rem_4.75rem] items-center gap-x-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_3.25rem_5.5rem_5.5rem] sm:gap-x-5";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const events = await prisma.delayEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { successFee: true },
  });

  const payoutStatuses = new Set([
    "paid_out",
    "awaiting_funds",
    "ready",
    "failed",
  ]);
  const payoutEvents = events.filter(
    (e) =>
      e.status === "submitted" &&
      e.successFee &&
      payoutStatuses.has(e.successFee.status),
  );
  const paidOutPence = payoutEvents
    .filter((e) => e.successFee!.status === "paid_out")
    .reduce((sum, e) => sum + e.successFee!.userPayoutPence, 0);
  const pendingPayoutPence = payoutEvents
    .filter((e) => e.successFee!.status !== "paid_out")
    .reduce((sum, e) => sum + e.successFee!.userPayoutPence, 0);
  const totalEarnedPence = paidOutPence + pendingPayoutPence;
  const charityPence = payoutEvents.reduce(
    (sum, e) => sum + e.successFee!.charityPence,
    0,
  );
  const paidOutCount = payoutEvents.filter(
    (e) => e.successFee!.status === "paid_out",
  ).length;
  const pendingCount = payoutEvents.length - paidOutCount;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-3 py-8 sm:px-6 sm:py-10">
        <div className="border border-bezel bg-bezel p-2.5 shadow-[var(--shadow)]">
          <div className="overflow-x-auto border border-line bg-paper">
            <div className="min-w-[36rem]">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                    Dashboard · Claims
                  </p>
                  <h1 className="display mt-1 text-3xl font-bold uppercase tracking-[0.1em] text-ink sm:text-4xl">
                    Your claims
                  </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/settings"
                    className="board-btn board-btn-ghost mono text-[10px] uppercase tracking-[0.16em] sm:text-xs"
                  >
                    Automation
                  </Link>
                  <Link
                    href="/report"
                    className="board-btn board-btn-primary mono text-[10px] uppercase tracking-[0.16em] sm:text-xs"
                  >
                    Report a delay
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-4 py-6 sm:px-6">
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                    Refunds · paid &amp; pending
                  </p>
                  <p className="display mt-2 text-4xl font-bold tabular-nums tracking-wide text-ink sm:text-6xl">
                    {formatPounds(totalEarnedPence)}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-ink-muted">
                    {formatPounds(paidOutPence)} paid
                    {paidOutCount > 0 ? ` (${paidOutCount})` : ""}
                    {" · "}
                    {formatPounds(pendingPayoutPence)} pending
                    {pendingCount > 0 ? ` (${pendingCount})` : ""}
                    . Your 80% share after Fifteen’s fee.
                  </p>
                </div>
                <div className="text-right">
                  <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                    Donated to charity
                  </p>
                  <p className="display mt-2 text-3xl font-bold tabular-nums tracking-wide text-ink sm:text-4xl">
                    {formatPounds(charityPence)}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    25% of Fifteen’s fee from these refunds.
                  </p>
                </div>
              </div>

              <div
                className={`${COLS} border-b border-line bg-paper-2 px-4 py-2 mono text-[9px] uppercase tracking-[0.18em] text-ink-muted sm:px-6 sm:text-[10px]`}
              >
                <span>Date</span>
                <span>Journey</span>
                <span className="text-center">Min</span>
                <span className="text-right">Gross</span>
                <span className="text-right">Fee</span>
              </div>

              {events.length === 0 ? (
                <div className="px-4 py-12 text-center sm:px-6">
                  <p className="text-ink-muted">No delays reported yet.</p>
                  <Link
                    href="/report"
                    className="mono mt-4 inline-block text-[10px] uppercase tracking-[0.16em] text-rail underline-offset-4 hover:underline"
                  >
                    Report your first delay
                  </Link>
                </div>
              ) : (
                <ul>
                  {events.map((event, i) => {
                    const isOpen = isOpenClaimStatus(event.status);
                    const needsAttention =
                      event.status === "needs_attention" ||
                      event.status === "failed";
                    const split = calculatePayoutSplit(
                      event.compensationAmountPence,
                    );
                    const feePence =
                      event.successFee?.totalFeePence ?? split.platformFeePence;
                    return (
                      <li key={event.id}>
                        <Link
                          href={`/claims/${event.id}`}
                          className={`${COLS} border-b border-line px-4 py-3 transition hover:bg-paper-2 sm:px-6 ${
                            i % 2 === 1 ? "bg-[rgba(12,21,32,0.03)]" : ""
                          }`}
                        >
                          <span className="mono text-xs tabular-nums text-ink-muted sm:text-sm">
                            {event.runDate.slice(5)}
                          </span>
                          <span className="min-w-0">
                            <span className="display block truncate text-base font-semibold uppercase tracking-[0.04em] text-ink sm:text-lg">
                              {event.originName} → {event.destinationName}
                            </span>
                            <span className="mono mt-0.5 block text-[10px] text-ink-muted">
                              {OPERATOR_LABELS[event.operator as Operator] ??
                                event.operator}{" "}
                              ·{" "}
                              <span
                                className={
                                  needsAttention
                                    ? "text-rail delayed-pulse"
                                    : isOpen
                                      ? "text-rail"
                                      : "text-signal"
                                }
                              >
                                {event.status}
                              </span>
                              {event.portalClaimRef
                                ? ` · ${event.portalClaimRef}`
                                : ""}
                            </span>
                          </span>
                          <span className="mono text-center text-sm tabular-nums text-rail">
                            {event.delayMinutes}
                          </span>
                          <span className="mono text-right text-sm font-medium tabular-nums text-ink sm:text-base">
                            {formatPounds(event.compensationAmountPence)}
                          </span>
                          <span className="mono text-right text-sm font-medium tabular-nums text-ink-muted sm:text-base">
                            {formatPounds(feePence)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
