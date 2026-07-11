import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimActions } from "@/components/claim-actions";
import { SiteHeader } from "@/components/site-header";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OPERATOR_LABELS,
  TICKET_TYPE_LABELS,
  formatPounds,
  type Operator,
  type TicketType,
} from "@/lib/eligibility/dr15";

type Params = { params: Promise<{ id: string }> };

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

export default async function ClaimPage({ params }: Params) {
  const user = await requireDbUser();
  const { id } = await params;
  const event = await prisma.delayEvent.findFirst({
    where: { id, userId: user.id },
  });

  if (!event) notFound();

  const operator = event.operator as Operator;

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
          {formatPounds(event.compensationAmountPence)} owed
        </h1>
        <p className="mt-2 text-ink-muted">
          <span className="display text-lg font-semibold uppercase tracking-wide text-ink">
            {event.originName} <span className="text-ink-muted">→</span>{" "}
            {event.destinationName}
          </span>
          <span className="mono text-sm"> · {OPERATOR_LABELS[operator]}</span>
        </p>

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
