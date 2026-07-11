import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="shrink-0 border-b border-line bg-paper/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex w-full max-w-5xl items-center justify-between px-4 sm:px-6 ${
          compact ? "py-2" : "py-3"
        }`}
      >
        <Link
          href="/"
          className="display text-xl font-bold uppercase tracking-[0.14em] text-ink transition hover:text-rail sm:text-2xl"
        >
          Fifteen
        </Link>
        <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mono hidden rounded-sm px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-muted transition hover:bg-paper-2 hover:text-ink sm:inline-block sm:px-3 sm:text-xs"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="mono hidden rounded-sm px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-muted transition hover:bg-paper-2 hover:text-ink sm:inline-block sm:px-3 sm:text-xs"
            >
              Automation
            </Link>
            <Link
              href="/report"
              className="board-btn board-btn-primary mono hidden px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] sm:inline-block sm:px-4 sm:text-xs"
            >
              Report a delay
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 rounded-sm",
                },
              }}
            />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="mono hidden rounded-sm px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-muted transition hover:bg-paper-2 hover:text-ink sm:inline-block sm:px-3 sm:text-xs"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="board-btn board-btn-primary mono hidden px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] sm:inline-block sm:px-4 sm:text-xs"
              >
                Get started
              </button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
