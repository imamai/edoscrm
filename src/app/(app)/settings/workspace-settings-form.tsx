"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { updateWorkspace } from "./actions";
import type { SessionTenant } from "@/lib/data/session";

export function WorkspaceSettingsForm({ tenant, canManage }: { tenant: SessionTenant; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const result = await updateWorkspace(new FormData(event.currentTarget));

    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <Field label="Workspace name" name="name" defaultValue={tenant.name} required disabled={!canManage} />
      <Field label="Timezone" name="timezone" defaultValue={tenant.timezone} required disabled={!canManage} placeholder="Africa/Nairobi" />
      <Field label="Currency" name="currency" defaultValue={tenant.currency} required disabled={!canManage} maxLength={3} placeholder="KES" />

      {error && <FieldError>{error}</FieldError>}
      {saved && <p className="rounded-lg bg-good/10 px-3 py-2 text-sm text-good">Saved.</p>}

      {canManage && (
        <div>
          <Button type="submit" busy={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
