"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordAttachment } from "./actions";
import { formatDate } from "@/lib/utils";
import type { Attachment } from "@/lib/data/complaint-extras";

const BUCKET = "edoscrm-attachments";

/**
 * Brief §6 "Attachments" — photos, screenshots, email threads. Upload goes
 * straight from the browser to Supabase Storage (server actions aren't
 * built for binary payloads), scoped `${tenantId}/${complaintId}/...` so
 * the bucket's own RLS policies (migration 0012) can key off the tenant
 * folder. Metadata is then recorded via the normal server action.
 */
export function AttachmentsPanel({
  tenantId,
  complaintId,
  attachments,
}: {
  tenantId: string;
  complaintId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const path = `${tenantId}/${complaintId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    startTransition(async () => {
      const result = await recordAttachment(complaintId, file.name, path, file.type || null);
      setUploading(false);
      if (!result.ok) return setError(result.error);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  async function download(path: string, fileName: string) {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (signError || !data) return setError(signError?.message ?? "Couldn't get a download link.");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = fileName;
    a.click();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Attachments</p>
        <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-brand hover:underline">
          <Paperclip className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Add file"}
          <input ref={inputRef} type="file" onChange={onFileChange} disabled={uploading} className="hidden" />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {attachments.length === 0 ? (
        <p className="text-sm text-ink-faint">No attachments yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <span className="truncate text-ink">{a.file_name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-ink-faint">{formatDate(a.created_at)}</span>
                <button type="button" onClick={() => download(a.storage_path, a.file_name)} aria-label={`Download ${a.file_name}`} className="text-ink-faint hover:text-brand">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
