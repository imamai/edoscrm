"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { COMPLAINT_CATEGORIES } from "@/lib/domain/categories";
import { createComplaint, suggestComplaintFromText, type SuggestState } from "./actions";
import type { Severity } from "@/lib/data/complaints";

const initialSuggestion: SuggestState = { error: null, suggestion: null };

export function ComplaintForm({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<Severity>("T3");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [batchNumber, setBatchNumber] = useState("");

  const [suggestion, setSuggestion] = useState<SuggestState>(initialSuggestion);
  const [suggesting, startSuggest] = useTransition();

  function suggestDetails() {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    startSuggest(async () => {
      const result = await suggestComplaintFromText(initialSuggestion, form);
      setSuggestion(result);
    });
  }

  function applySuggestion(s: NonNullable<SuggestState["suggestion"]>) {
    if (s.category && COMPLAINT_CATEGORIES.includes(s.category)) setCategory(s.category);
    if (s.severity) setSeverity(s.severity);
    if (s.product_name) setProductName(s.product_name);
    if (s.sku) setSku(s.sku);
    if (s.batch_number) setBatchNumber(s.batch_number);
    setSuggestion(initialSuggestion);
  }

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
    <form ref={formRef} onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-ink">What happened</p>
        <Field label="Title" name="title" required autoFocus placeholder="What happened, in a few words" />
        <TextareaField label="Description" name="description" placeholder="Everything known so far — what, when, who reported it" />

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-faint uppercase">Describe it in your own words (optional)</p>
            {aiAvailable ? (
              <button
                type="button"
                onClick={suggestDetails}
                disabled={suggesting}
                className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {suggesting ? "Reading…" : "Suggest details with edos.ai"}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-ink-faint">edos.ai not configured</span>
            )}
          </div>
          <textarea
            name="free_text"
            rows={2}
            placeholder="e.g. Customer found a piece of plastic in a 500ml SafeSip bottle, batch B2026-09, said it looked serious"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
          {suggestion.error && <p className="text-xs text-danger">{suggestion.error}</p>}
          {suggestion.suggestion && (
            <div className="flex flex-col gap-2 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2.5">
              <p className="text-xs text-ink-faint">{suggestion.suggestion.reasoning}</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => applySuggestion(suggestion.suggestion!)} className="text-xs font-semibold text-brand hover:underline">
                  Apply to form
                </button>
                <button type="button" onClick={() => setSuggestion(initialSuggestion)} className="text-xs font-semibold text-ink-faint hover:text-ink">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Not set</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <SelectField label="Severity" name="severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
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
          <Field label="Product" name="product_name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Optional" />
          <Field label="SKU" name="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Batch number" name="batch_number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Optional" />
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
