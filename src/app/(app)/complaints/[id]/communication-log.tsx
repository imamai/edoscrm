"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logCommunication } from "./actions";
import { formatDateTime } from "@/lib/utils";
import type { Communication } from "@/lib/data/complaint-extras";

export function CommunicationLog({ complaintId, communications }: { complaintId: string; communications: Communication[] }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [channel, setChannel] = useState("phone");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await logCommunication(complaintId, direction, channel, message);
      if (!result.ok) return setError(result.error);
      setError(null);
      setMessage("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Customer communication</p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <select value={direction} onChange={(e) => setDirection(e.target.value as "outbound" | "inbound")} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="outbound">Sent to complainant</option>
            <option value="inbound">Received from complainant</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="in_person">In person</option>
          </select>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Acknowledgement, update or final response"
          rows={2}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div>
          <button type="submit" disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink disabled:opacity-60">
            {pending ? "Logging…" : "Log communication"}
          </button>
        </div>
      </form>

      {communications.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {communications.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-2.5 text-sm">
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span>
                  {c.direction === "outbound" ? "Sent" : "Received"} · {c.channel}
                </span>
                <span>{formatDateTime(c.created_at)}</span>
              </div>
              <p className="mt-1 text-ink">{c.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
