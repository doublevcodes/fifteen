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
          Settings · Automation
        </p>
        <h1 className="display mt-1 text-3xl font-bold uppercase tracking-[0.1em] text-ink sm:text-4xl">
          Auto Delay Repay
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">
          Save your claim details and TOC / TfL logins. When you report a delay,
          Fifteen can fetch contactless proof and submit the claim for you.
        </p>
        <div className="mt-8">
          <SettingsForm />
        </div>
      </main>
    </div>
  );
}
