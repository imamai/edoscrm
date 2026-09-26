import type { Metadata } from "next";
import { ComplaintForm } from "./complaint-form";

export const metadata: Metadata = { title: "Log a complaint" };

export default function NewComplaintPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">Log a complaint</h1>
      <ComplaintForm />
    </div>
  );
}
