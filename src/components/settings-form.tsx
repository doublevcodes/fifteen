"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OPERATOR_LABELS,
  TICKET_TYPE_LABELS,
  type Operator,
  type TicketType,
} from "@/lib/eligibility/dr15";

type Profile = {
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  payoutPreference: string;
  defaultTicketType: string;
  autoSubmitConsent: boolean;
};

const OPERATORS = Object.keys(OPERATOR_LABELS) as Operator[];

export function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    legalName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    phone: "",
    payoutPreference: "bank",
    defaultTicketType: "contactless",
    autoSubmitConsent: false,
  });

  const [operatorCreds, setOperatorCreds] = useState<
    { operator: string; portalEmail: string }[]
  >([]);
  const [opForm, setOpForm] = useState({
    operator: "SOUTHERN" as Operator,
    portalEmail: "",
    password: "",
  });

  const [tflEmail, setTflEmail] = useState<string | null>(null);
  const [tflForm, setTflForm] = useState({ portalEmail: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      if (data.profile) {
        setProfile({
          legalName: data.profile.legalName ?? "",
          addressLine1: data.profile.addressLine1 ?? "",
          addressLine2: data.profile.addressLine2 ?? "",
          city: data.profile.city ?? "",
          postcode: data.profile.postcode ?? "",
          phone: data.profile.phone ?? "",
          payoutPreference: data.profile.payoutPreference ?? "bank",
          defaultTicketType: data.profile.defaultTicketType ?? "contactless",
          autoSubmitConsent: Boolean(data.profile.autoSubmitConsent),
        });
      }
      setOperatorCreds(data.operatorCredentials ?? []);
      setTflEmail(data.tflCredential?.portalEmail ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          legalName: profile.legalName || null,
          addressLine1: profile.addressLine1 || null,
          addressLine2: profile.addressLine2 || null,
          city: profile.city || null,
          postcode: profile.postcode || null,
          phone: profile.phone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveOperatorCred(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "operator", ...opForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage(`${OPERATOR_LABELS[opForm.operator]} portal login saved.`);
      setOpForm((f) => ({ ...f, password: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveTflCred(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "tfl", ...tflForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("TfL contactless login saved.");
      setTflForm((f) => ({ ...f, password: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mono text-sm text-ink-muted">Loading settings…</p>;
  }

  return (
    <div className="space-y-10">
      {(message || error) && (
        <p
          className={`mono text-sm ${error ? "text-rail" : "text-signal"}`}
          role="status"
        >
          {error ?? message}
        </p>
      )}

      <form
        onSubmit={saveProfile}
        className="space-y-4 border border-line bg-[var(--card)] p-6"
      >
        <h2 className="display text-xl font-bold uppercase tracking-wide">
          Claim profile
        </h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={profile.autoSubmitConsent}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                autoSubmitConsent: e.target.checked,
              }))
            }
          />
          <span>
            When I report a delay, automatically fetch TfL journey proof (if
            contactless) and submit the Delay Repay claim to the operator on my
            behalf.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Legal name"
            value={profile.legalName ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, legalName: v }))}
          />
          <Field
            label="Phone"
            value={profile.phone ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <Field
            label="Address"
            value={profile.addressLine1 ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, addressLine1: v }))}
          />
          <Field
            label="City"
            value={profile.city ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, city: v }))}
          />
          <Field
            label="Postcode"
            value={profile.postcode ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, postcode: v }))}
          />
          <label className="block text-sm">
            <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Payout preference
            </span>
            <select
              className="board-input"
              value={profile.payoutPreference}
              onChange={(e) =>
                setProfile((p) => ({ ...p, payoutPreference: e.target.value }))
              }
            >
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="voucher">Voucher</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Default ticket type
            </span>
            <select
              className="board-input"
              value={profile.defaultTicketType}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  defaultTicketType: e.target.value,
                }))
              }
            >
              {(Object.keys(TICKET_TYPE_LABELS) as TicketType[]).map((k) => (
                <option key={k} value={k}>
                  {TICKET_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em]"
        >
          Save profile
        </button>
      </form>

      <form
        onSubmit={saveTflCred}
        className="space-y-4 border border-line bg-[var(--card)] p-6"
      >
        <h2 className="display text-xl font-bold uppercase tracking-wide">
          TfL contactless login
        </h2>
        <p className="text-sm text-ink-muted">
          Used to download journey proof when you submit a contactless claim.
          {tflEmail ? (
            <span className="mono mt-1 block text-signal">
              Saved account: {tflEmail}
            </span>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Email"
            value={tflForm.portalEmail}
            onChange={(v) => setTflForm((f) => ({ ...f, portalEmail: v }))}
          />
          <Field
            label="Password"
            type="password"
            value={tflForm.password}
            onChange={(v) => setTflForm((f) => ({ ...f, password: v }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em]"
        >
          Save TfL login
        </button>
      </form>

      <form
        onSubmit={saveOperatorCred}
        className="space-y-4 border border-line bg-[var(--card)] p-6"
      >
        <h2 className="display text-xl font-bold uppercase tracking-wide">
          Operator Delay Repay logins
        </h2>
        {operatorCreds.length > 0 && (
          <ul className="mono space-y-1 text-xs text-ink-muted">
            {operatorCreds.map((c) => (
              <li key={c.operator}>
                {OPERATOR_LABELS[c.operator as Operator] ?? c.operator}:{" "}
                {c.portalEmail}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Operator
            </span>
            <select
              className="board-input"
              value={opForm.operator}
              onChange={(e) =>
                setOpForm((f) => ({
                  ...f,
                  operator: e.target.value as Operator,
                }))
              }
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Portal email"
            value={opForm.portalEmail}
            onChange={(v) => setOpForm((f) => ({ ...f, portalEmail: v }))}
          />
          <Field
            label="Password"
            type="password"
            value={opForm.password}
            onChange={(v) => setOpForm((f) => ({ ...f, password: v }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em]"
        >
          Save operator login
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      <input
        type={type}
        className="board-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
