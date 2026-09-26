"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import { closeComplaint } from "./actions";

/**
 * Closing a case — the brief's §6 closure control, which has two halves.
 *
 * The first is written confirmation of the fix, enforced on the server. The
 * second is that the complainant is informed, which used to be an honour-system
 * line in the confirmation note. Where there is an address on file, the closing
 * message is now written here, sent, and recorded as the closing communication,
 * which is also what the closed-loop KPI counts.
 */
export function ClosureControl({
  complaintId,
  capaVerified,
  reporterEmail,
  reporterName,
}: {
  complaintId: string;
  capaVerified: boolean;
  reporterEmail: string | null;
  reporterName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canReach = Boolean(reporterEmail?.trim());

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await closeComplaint(complaintId, note, outcome);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  if (!capaVerified) {
    return (
      <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-ink-faint">
        This case can close once its CAPA is recorded and verified — that&rsquo;s the brief&rsquo;s closure control (§6): no
        closure without confirmed corrective action.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-dark"
      >
        Close this case
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!pending}
        title="Close this case"
        description="A case is closed when the fix is confirmed in writing and the complainant has been told."
        size="lg"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="closure-note" className="text-sm font-medium text-ink">
              Written confirmation of the fix
            </label>
            <textarea
              id="closure-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was confirmed, by whom, and on what evidence"
              rows={3}
              required
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
            />
            <p className="text-xs text-ink-faint">Stays internal. This is the record for the quality file and the audit trail.</p>
          </div>

          {canReach ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="closure-outcome" className="text-sm font-medium text-ink">
                Message to {reporterName ?? "the complainant"}
              </label>
              <textarea
                id="closure-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What you found, what was done about it, and anything they should know"
                rows={5}
                required
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
              />
              <p className="text-xs text-ink-faint">
                Sent to <span className="font-medium text-ink">{reporterEmail}</span> when you close, and logged as the
                closing communication. Avoid admitting liability or promising an amount — those are separate decisions.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              No email address on file for this complainant, so no closing message can be sent. If you reached them
              another way, record it in the communication log before closing.
            </p>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}
          <ModalFormActions onCancel={() => setOpen(false)} submitLabel="Confirm and close" busy={pending} />
        </form>
      </Modal>
    </>
  );
}
