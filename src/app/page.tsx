import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";
import {
  boardFromLabel,
  getDelayedTerminusBoard,
} from "@/lib/rtt/board";

export const revalidate = 60;

const COLS =
  "grid w-full grid-cols-[3.25rem_minmax(0,1fr)_2.75rem_2rem_5.5rem] items-baseline gap-x-2 sm:grid-cols-[4rem_minmax(0,1fr)_3.5rem_2.5rem_7rem] sm:gap-x-3";

export default async function HomePage() {
  const board = await getDelayedTerminusBoard();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader compact />
      <main className="relative flex min-h-0 flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl min-h-0 flex-1 grid-cols-1 items-center gap-8 px-5 py-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-8">
          <div className="flex flex-col justify-center">
            <h1
              className="display flex items-baseline text-[clamp(3.25rem,11dvh,7.5rem)] font-bold uppercase leading-[0.85] tracking-[0.06em] text-ink"
              aria-label="Fifteen"
            >
              <span>F</span>
              <span
                className="mx-[0.03em] inline-flex h-[1cap] w-[0.22em] shrink-0 self-baseline"
                aria-hidden
              >
                <svg
                  viewBox="0 0 36 100"
                  className="h-full w-full"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                >
                  <rect x="1" y="0" width="9" height="100" />
                  <rect x="26" y="0" width="9" height="100" />
                  <rect x="0" y="2" width="36" height="9" />
                  <rect x="0" y="20" width="36" height="9" />
                  <rect x="0" y="38" width="36" height="9" />
                  <rect x="0" y="56" width="36" height="9" />
                  <rect x="0" y="74" width="36" height="9" />
                  <rect x="0" y="89" width="36" height="9" />
                </svg>
              </span>
              <span>Fteen</span>
            </h1>
            <p className="display mt-4 max-w-[18ch] text-[clamp(1.15rem,3.2dvh,2.1rem)] font-semibold leading-[1.15] tracking-tight text-ink sm:mt-5">
              Turn your commute into a{" "}
              <span className="text-rail">second income</span>
            </p>
            <div className="mt-5 flex w-full flex-col gap-3 sm:mt-6 sm:w-auto sm:flex-row sm:flex-wrap">
              <Show when="signed-out">
                <div className="w-full sm:w-auto">
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="board-btn board-btn-primary mono w-full px-8 py-4 text-base uppercase tracking-[0.16em] sm:px-6 sm:py-2.5 sm:text-sm"
                    >
                      Start claiming
                    </button>
                  </SignUpButton>
                </div>
                <Link
                  href="/sign-in"
                  className="board-btn board-btn-ghost mono w-full px-8 py-4 text-center text-base uppercase tracking-[0.16em] sm:w-auto sm:px-6 sm:py-2.5 sm:text-sm"
                >
                  Sign in
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="board-btn board-btn-primary mono w-full px-8 py-4 text-center text-base uppercase tracking-[0.16em] sm:w-auto sm:px-6 sm:py-2.5 sm:text-sm"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/report"
                  className="board-btn board-btn-ghost mono w-full px-8 py-4 text-center text-base uppercase tracking-[0.16em] sm:w-auto sm:px-6 sm:py-2.5 sm:text-sm"
                >
                  Report a delay
                </Link>
              </Show>
            </div>
          </div>

          <div className="w-full min-w-0" aria-hidden>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                {boardFromLabel(board.mock)}
              </p>
              <p className="mono text-xs tabular-nums text-ink-muted">
                {board.asOf}
              </p>
            </div>
            <div className="border border-line bg-paper">
              <div
                className={`${COLS} border-b border-line bg-paper-2 px-3 py-1.5 mono text-[8px] uppercase tracking-[0.16em] text-ink-muted sm:px-4 sm:text-[9px]`}
              >
                <span>Dep</span>
                <span>From</span>
                <span className="truncate">To</span>
                <span className="text-center">Plat</span>
                <span className="text-center">Expected</span>
              </div>
              {board.rows.map((row, i) => (
                <div
                  key={row.key}
                  className={`${COLS} border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4 sm:py-3 ${
                    i % 2 === 1 ? "bg-[rgba(12,21,32,0.03)]" : ""
                  }`}
                >
                  <span className="mono text-xs tabular-nums text-ink sm:text-sm">
                    {row.time}
                  </span>
                  <span className="display truncate text-xs font-semibold uppercase tracking-[0.04em] text-ink sm:text-sm">
                    {row.from}
                  </span>
                  <span className="mono truncate text-[9px] uppercase tracking-[0.04em] text-ink-muted sm:text-[10px]">
                    {row.terminus.replace(/^London\s+/i, "")}
                  </span>
                  <span className="mono text-center text-[10px] tabular-nums text-ink-muted">
                    {row.plat}
                  </span>
                  <span className="mono text-center text-[9px] uppercase tracking-[0.06em] text-rail sm:text-[10px]">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
