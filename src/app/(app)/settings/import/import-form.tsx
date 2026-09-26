"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { importComplaints, type ImportState } from "./actions";

const initial: ImportState = { error: null, imported: null, skipped: 0 };

export function ImportForm() {
  const [state, action, pending] = useActionState(importComplaints, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium text-ink">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium"
        />
      </div>
      {state.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state.imported !== null && (
        <p className="rounded-lg bg-good/10 px-3 py-2 text-sm text-good">
          Imported {state.imported} complaint{state.imported === 1 ? "" : "s"}
          {state.skipped > 0 ? `, skipped ${state.skipped} row(s) with no title or a numbering error` : ""}.
        </p>
      )}
      <div>
        <Button type="submit" busy={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </div>
    </form>
  );
}
