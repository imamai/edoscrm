import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { modelAvailable } from "@/lib/ai/llm";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "edos.ai" };

export default async function AssistantPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
        <Sparkles className="h-5 w-5 text-brand" />
        edos.ai
      </h1>
      {!modelAvailable() && (
        <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          No model is configured for this workspace yet, so edos.ai can&rsquo;t answer questions right now — the{" "}
          <Link href="/reports" className="underline">
            Reports
          </Link>{" "}
          and{" "}
          <Link href="/analytics" className="underline">
            Analytics
          </Link>{" "}
          screens cover the same data in the meantime.
        </p>
      )}
      <AssistantChat tenantName={session.tenant.name} />
    </div>
  );
}
