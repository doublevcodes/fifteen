"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PayoutBreakdown } from "@/components/payout-breakdown";
import { StationAutocomplete } from "@/components/station-autocomplete";
import { calculatePayoutSplit } from "@/lib/fees/success-fee";
import {
  TICKET_TYPE_LABELS,
  calculateCompensation,
  formatPounds,
  type TicketType,
} from "@/lib/eligibility/dr15";

type ServiceSummary = {
  uniqueIdentity: string;
  identity: string;
  runDate: string;
  operatorCode: string;
  operatorName: string;
  operator: "SWR" | "SOUTHERN" | "SOUTHEASTERN" | null;
  originCrs: string;
  originName: string;
  destinationCrs: string;
  destinationName: string;
  scheduledTime: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  delayMinutes: number | null;
  atLocationCrs: string;
  atLocationName: string;
};

type ServiceDetail = {
  uniqueIdentity: string;
  identity: string;
  runDate: string;
  operatorCode: string;
  operatorName: string;
  operator: "SWR" | "SOUTHERN" | "SOUTHEASTERN" | null;
  originCrs: string;
  originName: string;
  destinationCrs: string;
  destinationName: string;
  scheduledArrival: string;
  actualArrival: string;
  delayMinutes: number;
  hasActual: boolean;
};

type Step = "search" | "pick" | "ticket" | "saving";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  });
}

function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
  } catch {
    return iso;
  }
}

export function ReportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");
  const [station, setStation] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState(nowTime);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selected, setSelected] = useState<ServiceSummary | null>(null);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [ticketType, setTicketType] = useState<TicketType>("contactless");
  const [ticketPounds, setTicketPounds] = useState("12.50");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const ticketPricePence = useMemo(() => {
    if (ticketType === "contactless") return 0;
    const n = Number.parseFloat(ticketPounds);
    if (Number.isNaN(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [ticketPounds, ticketType]);

  const payoutPreview = useMemo(() => {
    if (!detail || detail.delayMinutes < 15) return null;
    if (ticketType === "contactless" || ticketPricePence <= 0) return null;
    if (!detail.operator) return null;
    const comp = calculateCompensation({
      operator: detail.operator,
      delayMinutes: detail.delayMinutes,
      ticketPricePence,
      ticketType,
    });
    if (!comp.eligible) return null;
    return calculatePayoutSplit(comp.compensationAmountPence);
  }, [detail, ticketPricePence, ticketType]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        station: station.trim().toUpperCase(),
        date,
        time,
      });
      if (to.trim()) params.set("to", to.trim().toUpperCase());
      const res = await fetch(`/api/rtt/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setServices(data.services ?? []);
      setUsingMock(Boolean(data.mock));
      setStep("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function pickService(service: ServiceSummary) {
    setError(null);
    setLoading(true);
    setSelected(service);
    try {
      const destination =
        to.trim().toUpperCase() ||
        service.destinationCrs ||
        service.atLocationCrs;
      const params = new URLSearchParams({
        uniqueIdentity: service.uniqueIdentity,
        destination,
      });
      const res = await fetch(`/api/rtt/service?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      const svc = data.service as ServiceDetail;
      if (!svc.operator) {
        throw new Error(
          "This operator is outside Fifteen’s scope (SWR, Southern, Southeastern only).",
        );
      }
      setDetail(svc);
      if (svc.delayMinutes < 15) {
        setError(
          `This arrival was only ${svc.delayMinutes} minutes late — Delay Repay starts at 15 minutes.`,
        );
      }
      setStep("ticket");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!detail?.operator) return;
    if (detail.delayMinutes < 15) {
      setError("Delay is under 15 minutes — not eligible.");
      return;
    }
    if (ticketType !== "contactless" && ticketPricePence <= 0) {
      setError("Enter a valid ticket price.");
      return;
    }

    setError(null);
    setLoading(true);
    setStep("saving");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator: detail.operator,
          originCrs: detail.originCrs || selected?.originCrs || station,
          originName: detail.originName || selected?.originName || station,
          destinationCrs: detail.destinationCrs || to,
          destinationName: detail.destinationName || to,
          serviceUid: detail.uniqueIdentity,
          runDate: detail.runDate,
          scheduledArrival: detail.scheduledArrival,
          actualArrival: detail.actualArrival,
          delayMinutes: detail.delayMinutes,
          ticketType,
          ticketPricePence,
        }),
      });
      const raw = await res.text();
      let data: { error?: string; event?: { id: string } } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        throw new Error(
          res.status === 401 || res.status === 404
            ? "Session expired — sign in again and retry."
            : `Could not save claim (HTTP ${res.status}).`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Could not save claim");
      if (!data.event?.id) throw new Error("Claim saved but no id returned");
      router.push(`/claims/${data.event.id}`);
    } catch (err) {
      setStep("ticket");
      setError(err instanceof Error ? err.message : "Could not save claim");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ol className="mono mb-8 flex gap-4 text-[10px] uppercase tracking-[0.18em] text-ink-muted sm:text-xs">
        {(["search", "pick", "ticket"] as const).map((s, i) => (
          <li
            key={s}
            className={
              step === s || (step === "saving" && s === "ticket")
                ? "text-rail"
                : ""
            }
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {usingMock && (
        <p className="mb-4 border border-line bg-[var(--card)] px-4 py-3 text-sm text-ink-muted">
          Using demo train data — set <span className="mono text-rail">RTT_TOKEN</span>{" "}
          or legacy <span className="mono text-rail">RTT_USERNAME</span> /{" "}
          <span className="mono text-rail">RTT_PASSWORD</span> for live Realtime
          Trains.
        </p>
      )}

      {error && (
        <p className="mb-4 border border-rail/40 bg-rail/10 px-4 py-3 text-sm text-rail">
          {error}
        </p>
      )}

      {step === "search" && (
        <form
          onSubmit={runSearch}
          className="space-y-4 border border-line bg-[var(--card)] p-6"
        >
          <h2 className="display text-2xl font-bold uppercase tracking-wide">
            Find your train
          </h2>
          <p className="text-sm text-ink-muted">
            Type a station name and pick from the suggestions. Only SWR,
            Southern, and Southeastern services are shown.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <StationAutocomplete
              label="From"
              crs={station}
              required
              placeholder="e.g. Surbiton"
              onChange={(crs) => setStation(crs)}
            />
            <StationAutocomplete
              label="To"
              crs={to}
              placeholder="e.g. London Waterloo"
              onChange={(crs) => setTo(crs)}
            />
            <label className="block text-sm">
              <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Date
              </span>
              <input
                type="date"
                className="board-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Depart after
              </span>
              <input
                type="time"
                className="board-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !station}
            className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em] disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search trains"}
          </button>
        </form>
      )}

      {step === "pick" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="display text-2xl font-bold uppercase tracking-wide">
              Pick a service
            </h2>
            <button
              type="button"
              onClick={() => setStep("search")}
              className="mono text-xs uppercase tracking-[0.14em] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Change search
            </button>
          </div>
          {services.length === 0 ? (
            <p className="border border-line bg-[var(--card)] px-4 py-6 text-ink-muted">
              No in-scope services found for that search.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Rows highlighted in amber arrived 15+ minutes late at your
                destination — Delay Repay eligible. You keep 75% of
                compensation; Fifteen keeps 20%, and 5% goes to charity.
              </p>
              <div className="border border-bezel bg-bezel p-2.5 shadow-[var(--shadow)]">
                <div className="overflow-hidden border border-line bg-paper">
                  <div className="grid w-full grid-cols-[4.25rem_4.25rem_minmax(0,1fr)_2.5rem_5.5rem] items-baseline gap-x-2 border-b border-line bg-paper-2 px-3 py-2 mono text-[9px] uppercase tracking-[0.18em] text-ink-muted sm:grid-cols-[5rem_5rem_minmax(0,1fr)_3.25rem_7rem] sm:gap-x-4 sm:px-5 sm:text-[10px]">
                    <span>Dep{station ? ` ${station}` : ""}</span>
                    <span>Arr{to ? ` ${to}` : ""}</span>
                    <span>Destination</span>
                    <span className="text-center">Op</span>
                    <span className="text-right">Service</span>
                  </div>
                  <ul>
                    {services.map((svc, i) => {
                      const dep = svc.departureTime ?? svc.scheduledTime;
                      const arr = svc.arrivalTime;
                      const delay = svc.delayMinutes ?? 0;
                      const eligible = delay >= 15;
                      return (
                        <li key={svc.uniqueIdentity}>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => pickService(svc)}
                            className={`grid w-full grid-cols-[4.25rem_4.25rem_minmax(0,1fr)_2.5rem_5.5rem] items-baseline gap-x-2 border-b border-line px-3 py-3 text-left transition hover:bg-paper-2 disabled:opacity-60 sm:grid-cols-[5rem_5rem_minmax(0,1fr)_3.25rem_7rem] sm:gap-x-4 sm:px-5 ${
                              eligible
                                ? "border-l-2 border-l-rail bg-rail/10 hover:bg-rail/15"
                                : i % 2 === 1
                                  ? "bg-[rgba(12,21,32,0.03)]"
                                  : ""
                            }`}
                          >
                            <span className="mono text-base tabular-nums text-ink sm:text-lg">
                              {formatClock(dep)}
                              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.14em] text-ink-muted sm:text-[10px]">
                                Dep
                              </span>
                            </span>
                            <span className="mono text-base tabular-nums text-ink sm:text-lg">
                              {formatClock(arr)}
                              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.14em] text-ink-muted sm:text-[10px]">
                                Arr
                              </span>
                            </span>
                            <span className="display min-w-0 truncate text-base font-semibold uppercase tracking-[0.04em] text-ink sm:text-lg">
                              {svc.destinationName || svc.destinationCrs}
                              <span className="mono mt-0.5 block truncate text-[10px] font-normal normal-case tracking-normal text-ink-muted">
                                from {svc.originName || svc.originCrs}
                                {eligible ? (
                                  <span className="text-rail">
                                    {" "}
                                    · +{delay} min DR15 · you 75% · Fifteen 20%
                                    · charity 5%
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="mono text-center text-[10px] uppercase text-ink-muted">
                              {svc.operatorCode}
                            </span>
                            <span className="mono text-right text-[10px] text-ink-muted sm:text-xs">
                              {svc.identity}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(step === "ticket" || step === "saving") && detail && (
        <form
          onSubmit={saveClaim}
          className="space-y-5 border border-line bg-[var(--card)] p-6"
        >
          <div>
            <h2 className="display text-2xl font-bold uppercase tracking-wide">
              Ticket & claim
            </h2>
            <p className="display mt-2 text-lg font-semibold uppercase tracking-wide text-ink">
              {detail.originName} <span className="text-ink-muted">→</span>{" "}
              {detail.destinationName}
              <span className="mono text-sm font-normal normal-case tracking-normal text-ink-muted">
                {" "}
                · {detail.operatorName}
              </span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Scheduled arrival
                </dt>
                <dd className="mono font-medium tabular-nums">
                  {formatClock(detail.scheduledArrival)}
                </dd>
              </div>
              <div>
                <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Actual arrival
                </dt>
                <dd className="mono font-medium tabular-nums">
                  {formatClock(detail.actualArrival)}
                </dd>
              </div>
              <div>
                <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Delay
                </dt>
                <dd className="font-medium text-rail">
                  {detail.delayMinutes} min
                </dd>
              </div>
              <div>
                <dt className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Actual reported
                </dt>
                <dd className="font-medium">
                  {detail.hasActual ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </div>

          <label className="block text-sm">
            <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Ticket type
            </span>
            <select
              className="board-input"
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as TicketType)}
            >
              {(Object.keys(TICKET_TYPE_LABELS) as TicketType[]).map((key) => (
                <option key={key} value={key}>
                  {TICKET_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          {ticketType === "contactless" ? (
            <p className="border border-line bg-paper-2 px-4 py-3 text-sm text-ink-muted">
              Fare is taken from your TfL journey charge when proof is fetched —
              you don&apos;t enter a ticket price for contactless.
            </p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Ticket price (£)
                  {ticketType.startsWith("season_")
                    ? " — full season cost"
                    : ""}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="board-input"
                  value={ticketPounds}
                  onChange={(e) => setTicketPounds(e.target.value)}
                  required
                />
              </label>
              {ticketPricePence > 0 && (
                <p className="text-sm text-ink-muted">
                  Recorded as {formatPounds(ticketPricePence)}
                </p>
              )}
            </>
          )}

          {payoutPreview ? (
            <PayoutBreakdown split={payoutPreview} />
          ) : ticketType === "contactless" ? (
            <PayoutBreakdown split={null} />
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="board-btn board-btn-ghost mono text-xs uppercase tracking-[0.14em]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || detail.delayMinutes < 15}
              className="board-btn board-btn-signal mono text-xs uppercase tracking-[0.14em] disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Submit claim"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
