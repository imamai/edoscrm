"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, FilePlus2, Trash2 } from "lucide-react";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import { Card, CardHeader, CardBody, Badge, EmptyState } from "@/components/ui/primitives";
import { FieldError } from "@/components/ui/field";
import { formatDateTime } from "@/lib/utils";
import type { Severity } from "@/lib/data/complaints";
import { convertInboundEmail, dismissInboundEmail } from "./actions";

export type InboundEmail = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  status: "received" | "converted" | "rejected";
  complaint_id: string | null;
  created_at: string;
};

const control = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none";

export function InboxClient({ emails, categories }: { emails: InboundEmail[]; categories: string[] }) {
  const router = useRouter();
  const [converting, setConverting] = useState<InboundEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const waiting = emails.filter((e) => e.status === "received");
  const handled = emails.filter((e) => e.status !== "received");

  function dismiss(email: InboundEmail) {
    setError(null);
    startTransition(async () => {
      const result = await dismissInboundEmail(email.id);
      if (!result.ok) setError(result.error);
      else {
        setNotice("Dismissed. The message is kept, so there's a record of why it wasn't actioned.");
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
          title={`${waiting.length} waiting`}
          subtitle="Messages that arrived at the complaints inbox. Turn the real ones into cases; dismiss the rest."
        />
        <CardBody className="flex flex-col gap-2">
          {waiting.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              description="Messages forwarded to the complaints address land here for someone to turn into a case."
              icon={<Inbox className="h-7 w-7" />}
            />
          ) : (
            waiting.map((e) => (
              <div key={e.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{e.subject || "(no subject)"}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {e.from_name ? `${e.from_name} · ` : ""}
                      {e.from_email} · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setConverting(e);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-dark"
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      Log as complaint
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(e)}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-faint hover:border-danger hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Not a complaint
                    </button>
                  </div>
                </div>
                {e.body && (
                  <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-2.5 text-sm text-ink-faint">
                    {e.body}
                  </p>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {handled.length > 0 && (
        <Card>
          <CardHeader title="Handled" subtitle="Kept in full — including what was dismissed and by whom." />
          <CardBody className="flex flex-col gap-1.5">
            {handled.slice(0, 50).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{e.subject || "(no subject)"}</p>
                  <p className="truncate text-xs text-ink-faint">{e.from_email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={e.status === "converted" ? "good" : "neutral"}>
                    {e.status === "converted" ? "Logged" : "Not a complaint"}
                  </Badge>
                  {e.complaint_id && (
                    <Link href={`/complaints/${e.complaint_id}`} className="text-xs font-semibold text-brand hover:underline">
                      Open case
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {converting && (
        <ConvertModal
          email={converting}
          categories={categories}
          onClose={() => setConverting(null)}
          onDone={(message) => {
            setConverting(null);
            setNotice(message);
            router.refresh();
          }}
          onError={(e) => {
            setError(e);
            setConverting(null);
          }}
        />
      )}
    </div>
  );
}

function ConvertModal({
  email,
  categories,
  onClose,
  onDone,
  onError,
}: {
  email: InboundEmail;
  categories: string[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  // The subject is usually a decent title, and correcting one is faster than
  // writing one from nothing.
  const [title, setTitle] = useState(email.subject ?? "");
  const [severity, setSeverity] = useState<Severity>("T3");
  const [category, setCategory] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      title="Log this message as a complaint"
      description="The sender becomes a contact, the message becomes the first communication on the case, and they get an acknowledgement."
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await convertInboundEmail(email.id, { title, severity, category: category || null });
            if (!result.ok) return onError(result.error);
            onDone(`Logged as ${result.caseNumber}. ${email.from_email} has been acknowledged.`);
          });
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ib-title" className="text-xs font-medium text-ink-faint">
            Title
          </label>
          <input id="ib-title" value={title} onChange={(e) => setTitle(e.target.value)} required className={control} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ib-severity" className="text-xs font-medium text-ink-faint">
              Severity
            </label>
            <select id="ib-severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={control}>
              <option value="T1">T1 — Critical</option>
              <option value="T2">T2 — Major</option>
              <option value="T3">T3 — Minor</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ib-category" className="text-xs font-medium text-ink-faint">
              Category
            </label>
            <select id="ib-category" value={category} onChange={(e) => setCategory(e.target.value)} className={control}>
              <option value="">Not set</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-2.5">
          <p className="text-xs font-semibold text-ink">From {email.from_name ?? email.from_email}</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-ink-faint">{email.body}</p>
        </div>

        <ModalFormActions onCancel={onClose} submitLabel="Log complaint" busy={pending} />
      </form>
    </Modal>
  );
}
