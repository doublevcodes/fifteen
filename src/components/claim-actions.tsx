"use client";

import { useState } from "react";
import {
  OPERATOR_CLAIM_URLS,
  type Operator,
} from "@/lib/eligibility/dr15";
import { isAttentionStatus } from "@/lib/claims/status";

export function ClaimActions({
  id,
  summary,
  status,
  operator,
  portalClaimRef,
  submitError,
  evidencePath,
}: {
  id: string;
  summary: string;
  status: string;
  operator: Operator;
  portalClaimRef?: string | null;
  submitError?: string | null;
  evidencePath?: string | null;
}) {
  const [current, setCurrent] = useState(status);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setSaving(true);
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "copied" }),
      });
      if (res.ok) setCurrent("copied");
    } finally {
      setSaving(false);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function markSubmitted() {
    setSaving(true);
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (res.ok) setCurrent("submitted");
    } finally {
      setSaving(false);
    }
  }

  async function retryAutoSubmit() {
    setSaving(true);
    setRetryMsg(null);
    try {
      const res = await fetch(`/api/claims/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      setCurrent("detected");
      setRetryMsg(`Workflow started (${data.runId})`);
    } catch (err) {
      setRetryMsg(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copySummary}
          disabled={saving}
          className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em] disabled:opacity-60"
        >
          {copied ? "Copied" : "Copy claim summary"}
        </button>
        <a
          href={OPERATOR_CLAIM_URLS[operator]}
          target="_blank"
          rel="noreferrer"
          className="board-btn board-btn-ghost mono text-xs uppercase tracking-[0.14em]"
        >
          Open operator claim page
        </a>
        {evidencePath && (
          <a
            href={`/api/claims/${id}/evidence`}
            className="board-btn board-btn-ghost mono text-xs uppercase tracking-[0.14em]"
          >
            Download TfL evidence
          </a>
        )}
        {(isAttentionStatus(current) ||
          current === "unclaimed" ||
          current === "copied" ||
          current === "eligible" ||
          current === "detected") && (
          <button
            type="button"
            onClick={retryAutoSubmit}
            disabled={saving}
            className="board-btn mono border border-rail/40 bg-rail/10 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-rail disabled:opacity-60"
          >
            Retry auto-submit
          </button>
        )}
        {current !== "submitted" && (
          <button
            type="button"
            onClick={markSubmitted}
            disabled={saving}
            className="board-btn mono border border-signal/40 bg-signal/10 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-signal disabled:opacity-60"
          >
            Mark as submitted
          </button>
        )}
      </div>
      <p className="mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Status: {current}
        {portalClaimRef ? ` · Ref: ${portalClaimRef}` : ""}
      </p>
      {submitError && (
        <p className="mono text-xs text-rail" role="alert">
          {submitError}
        </p>
      )}
      {retryMsg && (
        <p className="mono text-xs text-ink-muted" role="status">
          {retryMsg}
        </p>
      )}
    </div>
  );
}
