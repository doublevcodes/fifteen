import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpenClaimStatus } from "@/lib/claims/status";
import {
  OPERATOR_LABELS,
  formatPounds,
  type Operator,
} from "@/lib/eligibility/dr15";

const COLS =
  "grid w-full grid-cols-[4.75rem_minmax(0,1fr)_2.75rem_7rem] items-baseline gap-x-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_3.25rem_9rem] sm:gap-x-5";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const events = await prisma.delayEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const openEvents = events.filter((e) => isOpenClaimStatus(e.status));
  const unclaimedCount = openEvents.length;
  const unclaimedTotalPence = openEvents.reduce(
    (sum, e) => sum + e.compensationAmountPence,
    0,
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-3 py-8 sm:px-6 sm:py-10">
        <div className="border border-bezel bg-bezel p-2.5 shadow-[var(--shadow)]">
          <div className="overflow-hidden border border-line bg-paper">
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

            <div className="border-b border-line px-4 py-6 sm:px-6">
              <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                Open compensation
              </p>
              <p className="display mt-2 text-4xl font-bold tabular-nums tracking-wide text-ink sm:text-6xl">
                {formatPounds(unclaimedTotalPence)}
              </p>
              <p className="mt-2 max-w-md text-sm text-ink-muted">
                Across {unclaimedCount} open Delay Repay claim
                {unclaimedCount === 1 ? "" : "s"}.
              </p>
            </div>

            <div
              className={`${COLS} border-b border-line bg-paper-2 px-4 py-2 mono text-[9px] uppercase tracking-[0.18em] text-ink-muted sm:px-6 sm:text-[10px]`}
            >
              <span>Date</span>
              <span>Journey</span>
              <span className="text-center">Min</span>
              <span className="text-right">Amount</span>
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
                            {event.evidencePath ? " · evidence" : ""}
                          </span>
                        </span>
                        <span className="mono text-center text-sm tabular-nums text-rail">
                          {event.delayMinutes}
                        </span>
                        <span className="mono text-right text-sm font-medium tabular-nums text-signal sm:text-base">
                          {formatPounds(event.compensationAmountPence)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
