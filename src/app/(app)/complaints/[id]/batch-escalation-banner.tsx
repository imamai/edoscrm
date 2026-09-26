import Link from "next/link";
import type { Complaint } from "@/lib/data/complaints";
import type { EscalationResult } from "@/lib/domain/escalation";

const TONE: Record<string, string> = {
  warning: "border-warning/30 bg-warning/10 text-warning",
  escalate_t2: "border-warning/30 bg-warning/10 text-warning",
  mandatory_rca: "border-danger/30 bg-danger/10 text-danger",
  withdrawal_assessment: "border-danger/30 bg-danger/10 text-danger",
};

/** Brief §"Escalation procedures" made visible — the pattern math lives in
 * lib/domain/escalation.ts; this only renders what it found, plus the
 * "related batch complaints" list the brief's Visibility success criterion
 * asks for. */
export function BatchEscalationBanner({ escalation, siblings }: { escalation: EscalationResult; siblings: Complaint[] }) {
  if (escalation.level === "none" && siblings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {escalation.level !== "none" && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${TONE[escalation.level]}`}>{escalation.message}</div>
      )}
      {siblings.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Related batch complaints</p>
          <ul className="flex flex-col gap-1">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link href={`/complaints/${s.id}`} className="text-sm text-brand hover:underline">
                  {s.case_number}
                </Link>
                <span className="text-sm text-ink-faint"> — {s.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
