"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import type { Complaint } from "@/lib/data/complaints";
import { updateComplaintDetails } from "./edit-actions";

const control =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none";

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue?: string | null; type?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`edit-${name}`} className="text-xs font-medium text-ink-faint">
        {label}
      </label>
      <input id={`edit-${name}`} name={name} type={type} defaultValue={defaultValue ?? ""} className={control} />
    </div>
  );
}

/**
 * Correcting a complaint.
 *
 * Deliberately limited to the facts of the report — what was wrong, which
 * product, who reported it. Severity, stage, assignment and closure all have
 * their own controls with their own permissions and their own audit entries;
 * folding them in here would let one dialog quietly change decisions as well
 * as data.
 */
export function EditComplaint({ complaint, categories }: { complaint: Complaint; categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateComplaintDetails(complaint.id, formData, reason);
      if (!result.ok) return setError(result.error);
      if ("auditWarning" in result && result.auditWarning) {
        setError(`Saved, but the audit entry failed to record: ${result.auditWarning}`);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-faint hover:border-brand hover:text-brand"
      >
        <Pencil className="h-3.5 w-3.5" />
        Correct details
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!pending}
        title={`Correct ${complaint.case_number}`}
        description="Nothing is deleted. The old and new values are both kept, with your reason, in the audit log."
        size="lg"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title" name="title" defaultValue={complaint.title} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="edit-description" className="text-xs font-medium text-ink-faint">
                Description
              </label>
              <textarea
                id="edit-description"
                name="description"
                defaultValue={complaint.description ?? ""}
                rows={3}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="edit-category" className="text-xs font-medium text-ink-faint">
                Category
              </label>
              <select id="edit-category" name="category" defaultValue={complaint.category ?? ""} className={control}>
                <option value="">Not set</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Product" name="product_name" defaultValue={complaint.product_name} />
            <Field label="SKU" name="sku" defaultValue={complaint.sku} />
            <Field label="Batch number" name="batch_number" defaultValue={complaint.batch_number} />
            <Field label="Production date" name="production_date" type="date" defaultValue={complaint.production_date} />
            <Field label="Expiry date" name="expiry_date" type="date" defaultValue={complaint.expiry_date} />

            <div className="sm:col-span-2">
              <Field label="Purchase details" name="purchase_details" defaultValue={complaint.purchase_details} />
            </div>

            <Field label="Complainant name" name="reporter_name" defaultValue={complaint.reporter_name} />
            <Field label="Email" name="reporter_email" type="email" defaultValue={complaint.reporter_email} />
            <Field label="Phone" name="reporter_phone" defaultValue={complaint.reporter_phone} />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <label htmlFor="edit-reason" className="text-sm font-medium text-ink">
              Why is this being corrected?
            </label>
            <input
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Batch number was mis-keyed on the phone"
              className={control}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          <ModalFormActions onCancel={() => setOpen(false)} submitLabel="Save correction" busy={pending} />
        </form>
      </Modal>
    </>
  );
}
