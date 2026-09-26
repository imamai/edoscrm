"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCompensation, decideCompensation } from "./actions";
import { formatDate } from "@/lib/utils";
import type { Compensation, CompensationType } from "@/lib/data/complaint-extras";

const STATUS_LABEL: Record<string, string> = { requested: "Requested", approved: "Approved", fulfilled: "Fulfilled", declined: "Declined" };

export function CompensationPanel({
  complaintId,
  compensations,
  canRequest,
  canApprove,
}: {
  complaintId: string;
  compensations: Compensation[];
  canRequest: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<CompensationType>("hamper");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const cents = amount ? Math.round(Number(amount) * 100) : null;
      const result = await requestCompensation(complaintId, type, cents);
      if (!result.ok) return setError(result.error);
      setError(null);
      setAmount("");
      router.refresh();
    });
  }

  function decide(id: string, status: "approved" | "declined" | "fulfilled") {
    startTransition(async () => {
      await decideCompensation(id, complaintId, status);
      router.refresh();
    });
  }

  if (!canRequest && compensations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Compensation</p>

      {canRequest && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as CompensationType)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="hamper">Replacement hamper</option>
            <option value="credit_note">Credit note</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (optional)"
            className="h-9 w-40 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
          />
          <button type="submit" disabled={pending} className="h-9 rounded-lg bg-brand px-3 text-xs font-medium text-brand-ink disabled:opacity-60">
            Request
          </button>
        </form>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {compensations.length === 0 ? (
        <p className="text-sm text-ink-faint">None requested.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {compensations.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
              <div>
                <p className="text-ink">
                  {c.type === "hamper" ? "Replacement hamper" : c.type === "credit_note" ? "Credit note" : "Other"}
                  {c.amount_cents ? ` — KES ${(c.amount_cents / 100).toLocaleString()}` : ""}
                </p>
                <p className="text-xs text-ink-faint">
                  {STATUS_LABEL[c.status]} · {formatDate(c.created_at)}
                </p>
              </div>
              {canApprove && c.status === "requested" && (
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => decide(c.id, "approved")} className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-background">
                    Approve
                  </button>
                  <button type="button" onClick={() => decide(c.id, "declined")} className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-background">
                    Decline
                  </button>
                </div>
              )}
              {canApprove && c.status === "approved" && (
                <button type="button" onClick={() => decide(c.id, "fulfilled")} className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-background">
                  Mark fulfilled
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
