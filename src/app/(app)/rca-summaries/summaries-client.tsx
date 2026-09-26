"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileCheck2, Send, Check } from "lucide-react";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import { Card, CardHeader, CardBody, Badge, EmptyState } from "@/components/ui/primitives";
import { FieldError } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import type { RcaSummary } from "@/lib/data/rca-summaries";
import { approveSummaryAction, shareSummaryAction } from "./actions";

type Row = RcaSummary & { case_number: string; title: string };

/**
 * Approved summaries, and sending one out.
 *
 * Three deliberate steps — write, approve, share — because the brief's rule is
 * that only an approved summary leaves the building. Collapsing approval into
 * sharing would make the rule unenforceable by whoever is in a hurry.
 */
export function SummariesClient({
  summaries,
  canApprove,
  canShare,
}: {
  summaries: Row[];
  canApprove: boolean;
  canShare: boolean;
}) {
  const router = useRouter();
  const [sharing, setSharing] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const drafts = summaries.filter((s) => s.status === "draft");
  const approved = summaries.filter((s) => s.status === "approved");

  function approve(row: Row) {
    setError(null);
    startTransition(async () => {
      const result = await approveSummaryAction(row.id);
      if (!result.ok) setError(result.error);
      else {
        setNotice(`${row.case_number} approved — it can now be shared outside the workspace.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FieldError>{error}</FieldError>}
      {notice && !error && <p className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-sm text-good">{notice}</p>}

      <Card>
        <CardHeader
          title={`${drafts.length} awaiting approval`}
          subtitle="A summary can't leave the workspace until somebody in Quality has approved its wording."
        />
        <CardBody className="flex flex-col gap-2">
          {drafts.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              description="Write a summary from a complaint's investigation section, and it appears here for approval."
              icon={<FileCheck2 className="h-7 w-7" />}
            />
          ) : (
            drafts.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/complaints/${s.complaint_id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                      {s.case_number}
                    </Link>
                    <p className="truncate text-sm text-ink">{s.title}</p>
                  </div>
                  <Badge tone="warning">Draft</Badge>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-background p-2.5 text-sm text-ink-faint">{s.summary}</p>
                {canApprove ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => approve(s)}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-dark disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve for sharing
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">Awaiting approval from Quality.</p>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${approved.length} approved`} subtitle="Every send is logged against the summary." />
        <CardBody className="flex flex-col gap-2">
          {approved.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing has been approved yet.</p>
          ) : (
            approved.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/complaints/${s.complaint_id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                      {s.case_number}
                    </Link>
                    <p className="truncate text-sm text-ink">{s.title}</p>
                    {s.approved_at && <p className="text-xs text-ink-faint">Approved {formatDate(s.approved_at)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="good">Approved</Badge>
                    {canShare && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setSharing(s);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Share
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-background p-2.5 text-sm text-ink-faint">{s.summary}</p>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {sharing && (
        <ShareModal
          row={sharing}
          onClose={() => setSharing(null)}
          onDone={(message) => {
            setSharing(null);
            setNotice(message);
            router.refresh();
          }}
          onError={(e) => {
            setError(e);
            setSharing(null);
          }}
        />
      )}
    </div>
  );
}

function ShareModal({
  row,
  onClose,
  onDone,
  onError,
}: {
  row: Row;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      title={`Share the summary for ${row.case_number}`}
      description="Only the approved summary is sent. Internal investigation notes are never included."
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await shareSummaryAction(row.id, recipient, note);
            if (!result.ok) return onError(result.error);
            onDone(`Summary for ${row.case_number} sent to ${recipient.trim()} and logged.`);
          });
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-to" className="text-xs font-medium text-ink-faint">
            Send to
          </label>
          <input
            id="share-to"
            type="email"
            required
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="name@company.co.ke"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-note" className="text-xs font-medium text-ink-faint">
            Covering note (optional)
          </label>
          <textarea
            id="share-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Who asked for this, and in what context"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
        <p className="rounded-lg border border-border bg-background p-2.5 text-xs text-ink-faint">
          The recipient, the note and the time are recorded against this summary, so there is a record of who received it.
        </p>
        <ModalFormActions onCancel={onClose} submitLabel="Send summary" busy={pending} />
      </form>
    </Modal>
  );
}
