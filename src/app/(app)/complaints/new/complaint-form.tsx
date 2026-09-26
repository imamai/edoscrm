"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { COMPLAINT_CATEGORIES } from "@/lib/domain/categories";
import { createComplaint } from "./actions";

export function ComplaintForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await createComplaint(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    router.push(`/complaints/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-ink">What happened</p>
        <Field label="Title" name="title" required autoFocus placeholder="What happened, in a few words" />
        <TextareaField label="Description" name="description" placeholder="Everything known so far — what, when, who reported it" />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Category" name="category" defaultValue="">
            <option value="">Not set</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <SelectField label="Severity" name="severity" defaultValue="T3">
            <option value="T1">T1 — Critical</option>
            <option value="T2">T2 — Major</option>
            <option value="T3">T3 — Minor</option>
          </SelectField>
          <SelectField label="How did this come in?" name="channel" defaultValue="internal">
            <option value="internal">Logged internally</option>
            <option value="phone">Phone call</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="walk_in">Walk-in</option>
          </SelectField>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-ink">Who complained</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Complainant name" name="reporter_name" placeholder="Optional" />
          <Field label="Email" name="reporter_email" type="email" placeholder="Optional" />
          <Field label="Phone" name="reporter_phone" placeholder="Optional" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-ink">Product / batch — fill in whatever is known</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" name="product_name" placeholder="Optional" />
          <Field label="SKU" name="sku" placeholder="Optional" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Batch number" name="batch_number" placeholder="Optional" />
          <Field label="Production date" name="production_date" type="date" />
          <Field label="Expiry date" name="expiry_date" type="date" />
        </div>
        <TextareaField label="Purchase details" name="purchase_details" placeholder="Where and when it was bought, receipt/invoice number — optional" />
      </div>

      {error && <FieldError>{error}</FieldError>}

      <div>
        <Button type="submit" busy={busy}>
          {busy ? "Logging…" : "Log complaint"}
        </Button>
      </div>
    </form>
  );
}
