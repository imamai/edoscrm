import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getComplaint, getComplaintEvents, stageDatesFromEvents } from "@/lib/data/complaints";
import { getWorkflowVersion } from "@/lib/data/workflows";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { EventTimeline } from "@/components/complaints/event-timeline";
import { AdvanceStageButton } from "./advance-stage-button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaint" };

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const complaint = await getComplaint(id);
  if (!complaint || complaint.tenant_id !== session.tenant.id) notFound();

  const [workflow, events, canManage] = await Promise.all([
    getWorkflowVersion(complaint.workflow_version_id),
    getComplaintEvents(complaint.id),
    hasPermission(session.tenant.id, "complaints.manage"),
  ]);
  if (!workflow) notFound();

  const stages = workflow.definition.stages;
  const stageLabel = new Map(stages.map((s) => [s.key, s.label]));
  const currentIndex = stages.findIndex((s) => s.key === complaint.current_stage_key);
  const nextStage = stages[currentIndex + 1];

  const actorIds = [...new Set(events.map((e) => e.actor_id).filter((v): v is string => Boolean(v)))];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const supabase = await createClient();
    const { data: actors } = await supabase.from(TABLES.users).select("id, full_name, email").in("id", actorIds);
    for (const actor of actors ?? []) actorName.set(actor.id, actor.full_name ?? actor.email);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Command-centre header — case identity, severity and where it stands,
          all above the fold before anything else (ARCHITECTURE.md's "what
          happened, who owns it, what's next" philosophy). */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{complaint.case_number}</p>
          <h1 className="text-xl font-semibold text-ink">{complaint.title}</h1>
          <p className="text-sm text-ink-faint">Opened {formatDate(complaint.created_at)}</p>
        </div>
        <SeverityBadge severity={complaint.severity} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <WorkflowStepper
          stages={stages}
          currentKey={complaint.current_stage_key}
          stageDates={stageDatesFromEvents(events)}
        />
      </div>

      {complaint.description && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-faint">{complaint.description}</p>
        </div>
      )}

      {canManage && nextStage && (
        <div className="flex justify-end">
          <AdvanceStageButton complaintId={complaint.id} nextLabel={nextStage.label} />
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
        <EventTimeline events={events} stageLabel={stageLabel} actorName={actorName} />
      </div>
    </div>
  );
}
