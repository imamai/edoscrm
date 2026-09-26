"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { advanceStage } from "./actions";

export function AdvanceStageButton({ complaintId, nextLabel }: { complaintId: string; nextLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const result = await advanceStage(complaintId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={onClick} busy={busy}>
        {busy ? "Moving…" : `Move to ${nextLabel}`}
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
