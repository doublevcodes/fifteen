import { SiteHeader } from "@/components/site-header";
import { ReportWizard } from "@/components/report-wizard";

export default function ReportPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="mono mb-1 text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          Report
        </p>
        <h1 className="display mb-8 text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
          I was on a delayed train
        </h1>
        <ReportWizard />
      </main>
    </div>
  );
}
