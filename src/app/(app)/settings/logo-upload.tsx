"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setTenantLogo } from "./actions";

const BUCKET = "edoscrm-branding";
const MAX_BYTES = 2 * 1024 * 1024;

/** Same pattern as EDOSPMIS's logo-upload.tsx: the browser uploads straight
 * to Storage, a fixed per-tenant filename (upsert:true) so re-uploading
 * replaces rather than accumulates, then a server action just records the
 * resulting public URL. */
export function LogoUpload({ tenantId, currentUrl }: { tenantId: string; currentUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Logo must be a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Keep the logo under 2MB.");
      return;
    }
    setUploading(true);
    setError(null);

    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${tenantId}/logo.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const bustedUrl = `${data.publicUrl}?v=${Date.now()}`;

    startTransition(async () => {
      const result = await setTenantLogo(bustedUrl);
      setUploading(false);
      if (result.error) return setError(result.error);
      setPreview(bustedUrl);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">Logo</label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Tenant logo" className="h-full w-full object-contain" />
          ) : (
            <ImageUp className="h-5 w-5 text-ink-faint" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="w-fit cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand">
            {uploading ? "Uploading…" : preview ? "Change logo" : "Upload logo"}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onFileChange} disabled={uploading} className="hidden" />
          </label>
          <p className="text-xs text-ink-faint">PNG or JPEG, up to 2MB.</p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
