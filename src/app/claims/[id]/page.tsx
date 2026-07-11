import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimActions } from "@/components/claim-actions";
import { SiteHeader } from "@/components/site-header";
import { SuccessFeePanel } from "@/components/success-fee-panel";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculatePayoutSplit, calculateSuccessFee } from "@/lib/fees/success-fee";
import { syncSuccessFeeFromMollie } from "@/lib/mollie/create-success-fee-payment";
import {
  OPERATOR_LABELS,
  TICKET_TYPE_LABELS,
  formatPounds,
  type Operator,
  type TicketType,
} from "@/lib/eligibility/dr15";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fee?: string }>;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    });
  } catch {
    return iso;
  }
}

export default async function ClaimPage({ params, searchParams }: Params) {
  const user = await requireDbUser();
  const { id } = await params;
  const { fee: feeParam } = await searchParams;
  let event = await prisma.delayEvent.findFirst({
    where: { id, userId: user.id },
    include: { successFee: true },
  });

  if (!event) notFound();

  const claimProfile = await prisma.claimProfile.findUnique({
    where: { userId: user.id },
    select: { mollieCustomerId: true, bankAccountNumber: true },
  });
  const bankConnected = Boolean(
    claimProfile?.mollieCustomerId && claimProfile.bankAccountNumber,
  );

  if (feeParam === "done" && event.successFee?.molliePaymentId) {
    try {
      await syncSuccessFeeFromMollie(event.id);
      event = await prisma.delayEvent.findFirstOrThrow({
        where: { id, userId: user.id },
        include: { successFee: true },
      });
    } catch (err) {
      console.warn("[claim] Mollie fee sync failed", err);
    }
  }

  const operator = event.operator as Operator;
  const payoutSplit = calculatePayoutSplit(event.compensationAmountPence);
  const feePreview =
    event.successFee ??
    (event.status === "submitted"
      ? {
          id: "preview",
          status: "awaiting_funds",
          ...calculateSuccessFee(event.compensationAmountPence),
          userPayoutPence: payoutSplit.userPayoutPence,
          checkoutUrl: null,
          paidAt: null,
        }
      : null);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href="/dashboard"
          className="mono text-xs uppercase tracking-[0.14em] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          ← Dashboard
        </Link>
        <p className="mono mt-6 text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          Claim
        </p>
        <h1 className="display mt-2 text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
          {formatPounds(
            event.successFee?.userPayoutPence || payoutSplit.userPayoutPence,
          )}{" "}
          to you
        </h1>
        <p className="mono mt-1 text-sm text-ink-muted">
          Gross Delay Repay {formatPounds(event.compensationAmountPence)}
        </p>
        <p className="mt-2 text-ink-muted">
          <span className="display text-lg font-semibold uppercase tracking-wide text-ink">
            {event.originName} <span className="text-ink-muted">→</span>{" "}
            {event.destinationName}
          </span>
          <span className="mono text-sm"> · {OPERATOR_LABELS[operator]}</span>
        </p>

        {feeParam === "done" && event.successFee?.status !== "paid" && (
          <p
            className="mono mt-4 border border-line bg-paper-2 px-4 py-3 text-xs text-ink-muted"
            role="status"
          >
            Returning from Mollie — payment status updates via webhook. Refresh
            shortly if the fee still shows unpaid.
          </p>
        )}

        <dl className="mt-8 grid gap-4 border border-line bg-[var(--card)] p-6 sm:grid-cols-2">
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Journey date
            </dt>
            <dd className="mt-1 font-medium">{event.runDate}</dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Delay band
            </dt>
            <dd className="mt-1 font-medium text-rail">
              {event.delayMinutes} min · {event.compensationTier}
            </dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Scheduled arrival
            </dt>
            <dd className="mono mt-1 text-sm">{formatWhen(event.scheduledArrival)}</dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Actual arrival
            </dt>
            <dd className="mono mt-1 text-sm">{formatWhen(event.actualArrival)}</dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Ticket
            </dt>
            <dd className="mt-1 font-medium">
              {TICKET_TYPE_LABELS[event.ticketType as TicketType] ??
                event.ticketType}{" "}
              · {formatPounds(event.ticketPricePence)}
            </dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Compensation
            </dt>
            <dd className="mt-1 font-medium text-signal">
              {formatPounds(event.compensationAmountPence)}
            </dd>
          </div>
          <div>
            <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Status
            </dt>
            <dd className="mt-1 font-medium">{event.status}</dd>
          </div>
          {event.portalClaimRef ? (
            <div>
              <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Portal claim ref
              </dt>
              <dd className="mono mt-1 text-sm">{event.portalClaimRef}</dd>
            </div>
          ) : null}
          {event.contactlessFarePence != null ? (
            <div>
              <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                TfL journey charge
              </dt>
              <dd className="mt-1 font-medium">
                {formatPounds(event.contactlessFarePence)}
              </dd>
            </div>
          ) : null}
          {event.evidencePath ? (
            <div>
              <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Evidence
              </dt>
              <dd className="mt-1 font-medium text-signal">Attached</dd>
            </div>
          ) : null}
        </dl>

        {feePreview && (
          <SuccessFeePanel
            claimStatus={event.status}
            compensationAmountPence={event.compensationAmountPence}
            bankConnected={bankConnected}
            fee={{
              id: feePreview.id,
              status: feePreview.status,
              commissionPence: feePreview.commissionPence,
              charityPence: feePreview.charityPence,
              totalFeePence: feePreview.totalFeePence,
              userPayoutPence:
                "userPayoutPence" in feePreview
                  ? (feePreview.userPayoutPence as number)
                  : undefined,
              paidAt: feePreview.paidAt,
            }}
          />
        )}

        <section className="mt-8">
          <h2 className="display text-lg font-semibold uppercase tracking-wide">
            Copy-ready summary
          </h2>
          <pre className="mono mt-3 overflow-x-auto whitespace-pre-wrap border border-line bg-paper-2 px-5 py-4 text-sm leading-relaxed text-ink">
            {event.claimSummary}
          </pre>
          <div className="mt-5">
            <ClaimActions
              id={event.id}
              summary={event.claimSummary}
              status={event.status}
              operator={operator}
              portalClaimRef={event.portalClaimRef}
              submitError={event.submitError}
              evidencePath={event.evidencePath}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
