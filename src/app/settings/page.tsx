import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings-form";
import { requireDbUser } from "@/lib/auth";

export default async function SettingsPage() {
  await requireDbUser();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
          Settings · Connections
        </p>
        <h1 className="display mt-1 text-3xl font-bold uppercase tracking-[0.1em] text-ink sm:text-4xl">
          Settings
        </h1>

        <div className="mt-6 border border-line bg-[var(--card)] p-5 sm:p-6">
          <p className="mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Auto Delay Repay
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            When you report a delay, Fifteen automatically fetches TfL journey
            proof (if contactless) and submits the Delay Repay claim to the
            operator on your behalf. We receive the operator payout, keep 20%,
            donate 5% to charity, and pay 75% to your connected bank.
          </p>
        </div>

        <div className="mt-8">
          <SettingsForm />
        </div>
      </main>
    </div>
  );
}
