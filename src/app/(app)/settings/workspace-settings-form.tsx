"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { LogoUpload } from "./logo-upload";
import { updateWorkspace } from "./actions";
import type { SessionTenant } from "@/lib/data/session";

export function WorkspaceSettingsForm({ tenant, canManage }: { tenant: SessionTenant; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [accentColor, setAccentColor] = useState(tenant.branding.accent_color ?? "#1d3557");

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

      <LogoUpload tenantId={tenant.id} currentUrl={tenant.branding.logo_url ?? null} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="accent_color" className="text-sm font-medium text-ink">
          Accent color
        </label>
        <div className="flex items-center gap-2">
          <input
            id="accent_color"
            type="color"
            name="accent_color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            disabled={!canManage}
            className="h-9 w-14 cursor-pointer rounded-md border border-border bg-surface p-1 disabled:opacity-60"
          />
          <span className="tnum text-sm text-ink-faint">{accentColor}</span>
        </div>
        <p className="text-xs text-ink-faint">Tints buttons and links. The sidebar stays EDOS CRM's navy.</p>
      </div>

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
