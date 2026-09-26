"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageX, Plus, Check, X } from "lucide-react";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import { Card, CardHeader, CardBody, Badge, DataTable, Row, Cell, EmptyState } from "@/components/ui/primitives";
import { FieldError } from "@/components/ui/field";
import { formatDateTime } from "@/lib/utils";
import { ACTION_LABEL, type ProductAction, type ProductActionKind } from "@/lib/domain/product-actions";
import { requestProductAction, decideProductActionAction } from "./actions";

const control = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none";

export type BatchGroup = {
  sku: string;
  batch: string;
  product: string | null;
  complaints: { id: string; case_number: string; title: string }[];
};

const TONE: Record<ProductActionKind, "warning" | "good" | "danger"> = {
  hold: "warning",
  release: "good",
  withdrawal: "danger",
  recall: "danger",
};

export function ProductActionsClient({
  actions,
  batches,
  canRequest,
  canApprove,
  memberName,
}: {
  actions: ProductAction[];
  batches: BatchGroup[];
  canRequest: boolean;
  canApprove: boolean;
  memberName: Record<string, string>;
}) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [deciding, setDeciding] = useState<ProductAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pendingActions = actions.filter((a) => a.status === "requested");
  const decided = actions.filter((a) => a.status !== "requested");

  return (
    <div className="flex flex-col gap-4">
      {error && <FieldError>{error}</FieldError>}
      {notice && !error && <p className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-sm text-good">{notice}</p>}

      <Card>
        <CardHeader
          title={`${pendingActions.length} awaiting a decision`}
          subtitle="Hold, release, withdrawal and recall decisions, with the complaints that prompted them."
          action={
            canRequest && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setRequesting(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark"
              >
                <Plus className="h-4 w-4" />
                Raise an action
              </button>
            )
          }
        />
        <CardBody>
          {pendingActions.length === 0 ? (
            <EmptyState
              title="Nothing is waiting on a decision"
              description="A hold, withdrawal or recall raised against a batch appears here until somebody with the authority decides it."
              icon={<PackageX className="h-7 w-7" />}
            />
          ) : (
            <DataTable header={["Action", "Product / batch", "Why", "Evidence", "Raised", ""]}>
              {pendingActions.map((a) => (
                <Row key={a.id}>
                  <Cell>
                    <Badge tone={TONE[a.action]}>{ACTION_LABEL[a.action]}</Badge>
                  </Cell>
                  <Cell>
                    <p className="font-medium text-ink">{a.product_name ?? a.sku ?? "—"}</p>
                    <p className="font-mono text-xs text-ink-faint">
                      {[a.sku, a.batch_number].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </Cell>
                  <Cell className="max-w-[22rem] text-ink-faint">{a.reason}</Cell>
                  <Cell className="tnum whitespace-nowrap text-ink-faint">
                    {a.complaint_ids.length} {a.complaint_ids.length === 1 ? "complaint" : "complaints"}
                  </Cell>
                  <Cell className="whitespace-nowrap text-ink-faint">
                    {formatDateTime(a.created_at)}
                    {a.requested_by && <span className="block text-xs">{memberName[a.requested_by] ?? "—"}</span>}
                  </Cell>
                  <Cell className="whitespace-nowrap text-right">
                    {canApprove ? (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setDeciding(a);
                        }}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        Decide
                      </button>
                    ) : (
                      <span className="text-xs text-ink-faint">Awaiting Manufacturing</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </CardBody>
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardHeader title="Decided" subtitle="Kept in full — a refused recall matters as much as an approved one." />
          <CardBody>
            <DataTable header={["Action", "Product / batch", "Decision", "Note", "Decided"]}>
              {decided.map((a) => (
                <Row key={a.id}>
                  <Cell>
                    <Badge tone={TONE[a.action]}>{ACTION_LABEL[a.action]}</Badge>
                  </Cell>
                  <Cell className="font-mono text-xs text-ink-faint">{[a.sku, a.batch_number].filter(Boolean).join(" / ") || "—"}</Cell>
                  <Cell>
                    <Badge tone={a.status === "approved" ? "good" : "neutral"}>{a.status}</Badge>
                  </Cell>
                  <Cell className="max-w-[22rem] text-ink-faint">{a.decision_note ?? "—"}</Cell>
                  <Cell className="whitespace-nowrap text-ink-faint">
                    {a.decided_at ? formatDateTime(a.decided_at) : "—"}
                    {a.approved_by && <span className="block text-xs">{memberName[a.approved_by] ?? "—"}</span>}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </CardBody>
        </Card>
      )}

      {requesting && (
        <RequestModal
          batches={batches}
          onClose={() => setRequesting(false)}
          onDone={(message) => {
            setRequesting(false);
            setNotice(message);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      {deciding && (
        <DecideModal
          action={deciding}
          onClose={() => setDeciding(null)}
          onDone={(message) => {
            setDeciding(null);
            setNotice(message);
            router.refresh();
          }}
          onError={(e) => {
            setError(e);
            setDeciding(null);
          }}
        />
      )}
    </div>
  );
}

function RequestModal({
  batches,
  onClose,
  onDone,
  onError,
}: {
  batches: BatchGroup[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [batchKey, setBatchKey] = useState(batches[0] ? `${batches[0].sku}|${batches[0].batch}` : "manual");
  const [action, setAction] = useState<ProductActionKind>("hold");
  const [sku, setSku] = useState("");
  const [batch, setBatch] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = batches.find((b) => `${b.sku}|${b.batch}` === batchKey);

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      title="Raise a product action"
      description="Hold, release, withdraw or recall a batch. The complaints behind it are recorded as the evidence."
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await requestProductAction({
              action,
              sku: selected ? selected.sku : sku.trim() || null,
              batchNumber: selected ? selected.batch : batch.trim() || null,
              productName: selected?.product ?? null,
              reason,
              complaintIds: selected?.complaints.map((c) => c.id) ?? [],
            });
            if (!result.ok) return onError(result.error);
            onDone(
              result.notifiedApprovers > 0
                ? "Raised. The people who can decide it have been notified."
                : "Raised — but nobody in this workspace has permission to decide it yet. Assign the Manufacturing role on Members & roles.",
            );
          });
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-action" className="text-xs font-medium text-ink-faint">
            Action
          </label>
          <select id="pa-action" value={action} onChange={(e) => setAction(e.target.value as ProductActionKind)} className={control}>
            <option value="hold">Hold — stop the batch moving while it is looked at</option>
            <option value="release">Release — clear a batch that was on hold</option>
            <option value="withdrawal">Withdrawal — pull the batch back from trade</option>
            <option value="recall">Recall — pull the batch back from consumers</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-batch" className="text-xs font-medium text-ink-faint">
            Which batch
          </label>
          <select id="pa-batch" value={batchKey} onChange={(e) => setBatchKey(e.target.value)} className={control}>
            {batches.map((b) => (
              <option key={`${b.sku}|${b.batch}`} value={`${b.sku}|${b.batch}`}>
                {b.product ?? b.sku} — {b.sku} / {b.batch} ({b.complaints.length} open complaints)
              </option>
            ))}
            <option value="manual">Another batch…</option>
          </select>
        </div>

        {!selected && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pa-sku" className="text-xs font-medium text-ink-faint">
                SKU
              </label>
              <input id="pa-sku" value={sku} onChange={(e) => setSku(e.target.value)} className={control} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pa-batchno" className="text-xs font-medium text-ink-faint">
                Batch number
              </label>
              <input id="pa-batchno" value={batch} onChange={(e) => setBatch(e.target.value)} className={control} />
            </div>
          </div>
        )}

        {selected && (
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="mb-1.5 text-xs font-semibold text-ink">Evidence — {selected.complaints.length} open complaints</p>
            <ul className="flex flex-col gap-0.5">
              {selected.complaints.slice(0, 6).map((c) => (
                <li key={c.id} className="truncate text-xs text-ink-faint">
                  <span className="font-mono">{c.case_number}</span> — {c.title}
                </li>
              ))}
              {selected.complaints.length > 6 && (
                <li className="text-xs text-ink-faint">and {selected.complaints.length - 6} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-reason" className="text-xs font-medium text-ink-faint">
            Why this is needed
          </label>
          <textarea
            id="pa-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="What the complaints have in common, and what the risk is"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <ModalFormActions onCancel={onClose} submitLabel="Raise for decision" busy={pending} danger={action === "recall" || action === "withdrawal"} />
      </form>
    </Modal>
  );
}

function DecideModal({
  action,
  onClose,
  onDone,
  onError,
}: {
  action: ProductAction;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "declined") {
    startTransition(async () => {
      const result = await decideProductActionAction(action.id, decision, note);
      if (!result.ok) return onError(result.error);
      onDone(`${ACTION_LABEL[action.action]} ${decision}.`);
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      title={`${ACTION_LABEL[action.action]} — ${[action.sku, action.batch_number].filter(Boolean).join(" / ")}`}
      description="Your decision and its reasoning are recorded permanently against this batch."
      size="md"
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-semibold text-ink">Why it was raised</p>
          <p className="mt-1 text-sm text-ink-faint">{action.reason}</p>
          <p className="mt-2 text-xs text-ink-faint">
            Evidence: {action.complaint_ids.length} {action.complaint_ids.length === 1 ? "complaint" : "complaints"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-note" className="text-xs font-medium text-ink-faint">
            Decision note
          </label>
          <textarea
            id="pa-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What you decided and on what basis. Required when declining."
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-faint hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => decide("declined")}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-danger hover:text-danger disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}
