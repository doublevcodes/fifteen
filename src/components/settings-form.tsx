"use client";

import { useCallback, useEffect, useState } from "react";
import { OPERATOR_LABELS, type Operator } from "@/lib/eligibility/dr15";

type Profile = {
  bankAccountName: string | null;
  bankSortCode: string | null;
  bankAccountNumberLast4: string | null;
  mollieCustomerId: string | null;
  bankConnectedAt: string | null;
};

const OPERATORS = Object.keys(OPERATOR_LABELS) as Operator[];

export function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectingBank, setConnectingBank] = useState(false);

  const [profile, setProfile] = useState<Profile>({
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumberLast4: null,
    mollieCustomerId: null,
    bankConnectedAt: null,
  });

  const [bankForm, setBankForm] = useState({
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
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
        const sortDigits = String(data.profile.bankSortCode ?? "").replace(
          /\D/g,
          "",
        );
        setProfile({
          bankAccountName: data.profile.bankAccountName ?? "",
          bankSortCode: sortDigits || null,
          bankAccountNumberLast4: data.profile.bankAccountNumberLast4 ?? null,
          mollieCustomerId: data.profile.mollieCustomerId ?? null,
          bankConnectedAt: data.profile.bankConnectedAt ?? null,
        });
        setBankForm({
          bankAccountName: data.profile.bankAccountName ?? "",
          bankSortCode: sortDigits,
          bankAccountNumber: "",
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

  async function connectBank(e: React.FormEvent) {
    e.preventDefault();
    setConnectingBank(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        bankAccountName: bankForm.bankAccountName.trim(),
        bankSortCode: bankForm.bankSortCode.replace(/\D/g, ""),
        bankAccountNumber: bankForm.bankAccountNumber.replace(/\D/g, ""),
      };
      const res = await fetch("/api/mollie/bank-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bank connect failed");
      setMessage(
        data.paidOutCount > 0
          ? `Bank connected via Mollie. Paid out ${data.paidOutCount} pending claim${data.paidOutCount === 1 ? "" : "s"}.`
          : "Bank connected via Mollie.",
      );
      setBankForm((f) => ({ ...f, bankAccountNumber: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bank connect failed");
    } finally {
      setConnectingBank(false);
    }
  }

  async function saveOperatorCred(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
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
    setMessage(null);
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
        onSubmit={connectBank}
        className="space-y-4 border border-line bg-[var(--card)] p-6"
      >
        <h2 className="display text-xl font-bold uppercase tracking-wide">
          Payout bank (Mollie)
        </h2>
        <p className="text-sm text-ink-muted">
          Connect the UK bank account where Fifteen should send your 80% share
          after we receive Delay Repay.
        </p>
        {profile.mollieCustomerId ? (
          <p className="mono text-xs text-signal">
            Connected
            {profile.bankAccountNumberLast4
              ? ` · ****${profile.bankAccountNumberLast4}`
              : ""}
            {profile.bankConnectedAt
              ? ` · ${new Date(profile.bankConnectedAt).toLocaleDateString("en-GB")}`
              : ""}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Account name"
            value={bankForm.bankAccountName}
            onChange={(v) =>
              setBankForm((f) => ({ ...f, bankAccountName: v }))
            }
            required
            autoComplete="name"
          />
          <Field
            label="Sort code (6 digits)"
            value={bankForm.bankSortCode}
            onChange={(v) =>
              setBankForm((f) => ({
                ...f,
                bankSortCode: v.replace(/\D/g, "").slice(0, 6),
              }))
            }
            inputMode="numeric"
            required
            autoComplete="off"
          />
          <Field
            label="Account number (8 digits)"
            value={bankForm.bankAccountNumber}
            onChange={(v) =>
              setBankForm((f) => ({
                ...f,
                bankAccountNumber: v.replace(/\D/g, "").slice(0, 8),
              }))
            }
            inputMode="numeric"
            required
            autoComplete="off"
            placeholder={
              profile.bankAccountNumberLast4
                ? `••••${profile.bankAccountNumberLast4}`
                : undefined
            }
          />
        </div>
        <button
          type="submit"
          disabled={connectingBank}
          className="board-btn board-btn-primary mono text-xs uppercase tracking-[0.14em] disabled:opacity-60"
        >
          {connectingBank
            ? "Connecting…"
            : profile.mollieCustomerId
              ? "Update bank via Mollie"
              : "Connect bank via Mollie"}
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
  required,
  inputMode,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  placeholder?: string;
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
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </label>
  );
}
