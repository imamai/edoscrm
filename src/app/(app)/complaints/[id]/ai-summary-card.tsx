"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { summarizeComplaint } from "./ai-actions";

export function AiSummaryCard({ complaintId }: { complaintId: string }) {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    const result = await summarizeComplaint(complaintId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSummary(result.summary);
  }

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-brand" />
          edos.ai
        </h2>
        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={onGenerate} busy={busy}>
          {busy ? "Summarizing…" : summary ? "Regenerate summary" : "Summarize case"}
        </Button>
      </div>

      {error && <FieldError>{error}</FieldError>}

      {summary && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">{summary}</p>
          <p className="text-xs text-ink-faint">
            AI Suggested — edos.ai works from your own records. Check the figures before you act on them.
          </p>
        </div>
      )}

      {!summary && !error && (
        <p className="text-sm text-ink-faint">Get a quick summary of this case from what's recorded so far.</p>
      )}
    </div>
  );
}
