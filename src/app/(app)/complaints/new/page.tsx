import type { Metadata } from "next";
import { modelAvailable } from "@/lib/ai/suggest";
import { BackLink } from "@/components/ui/back-link";
import { ComplaintForm } from "./complaint-form";

export const metadata: Metadata = { title: "Log a complaint" };

export default function NewComplaintPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/complaints" label="Complaints" />
        <h1 className="text-xl font-semibold text-ink">Log a complaint</h1>
      </div>
      <ComplaintForm aiAvailable={modelAvailable()} />
    </div>
  );
}
