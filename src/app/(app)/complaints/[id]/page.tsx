import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getComplaint, getComplaintEvents, getBatchSiblings, stageDatesFromEvents } from "@/lib/data/complaints";
import { getWorkflowVersion } from "@/lib/data/workflows";
import { getTasksForComplaint } from "@/lib/data/tasks";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { computeBatchEscalation } from "@/lib/domain/escalation";
import { getQualityRecords } from "@/lib/data/investigation";
import { getTenantMembers } from "@/lib/data/members";
import { getAttachments, getCommunications, getCompensations } from "@/lib/data/complaint-extras";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { BackLink } from "@/components/ui/back-link";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { SlaBadge } from "@/components/complaints/sla-badge";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { EventTimeline } from "@/components/complaints/event-timeline";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { AdvanceStageButton } from "./advance-stage-button";
import { AiSummaryCard } from "./ai-summary-card";
import { InvestigationSection } from "./investigation-section";
import { RootCauseSection } from "./root-cause-section";
import { CapaSection } from "./capa-section";
import { AssignmentControl } from "./assignment-control";
import { SeverityOverride } from "./severity-override";
import { PendingInformationToggle } from "./pending-information-toggle";
import { ClosureControl } from "./closure-control";
import { BatchEscalationBanner } from "./batch-escalation-banner";
import { AttachmentsPanel } from "./attachments-panel";
import { CommunicationLog } from "./communication-log";
import { modelAvailable } from "@/lib/ai/suggest";
import { CompensationPanel } from "./compensation-panel";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaint" };

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const complaint = await getComplaint(id);
  if (!complaint || complaint.tenant_id !== session.tenant.id) notFound();

  const [
    workflow,
    events,
    canManage,
    canManageInvestigations,
    canAssign,
    canOverrideSeverity,
    canClose,
    canRequestCompensation,
    canApproveCompensation,
    tasks,
    slaRules,
    quality,
    members,
    attachments,
    communications,
    compensations,
  ] = await Promise.all([
    getWorkflowVersion(complaint.workflow_version_id),
    getComplaintEvents(complaint.id),
    hasPermission(session.tenant.id, "complaints.manage"),
    hasPermission(session.tenant.id, "investigations.manage"),
    hasPermission(session.tenant.id, "complaints.assign"),
    hasPermission(session.tenant.id, "complaints.severity.override"),
    hasPermission(session.tenant.id, "complaints.close"),
    hasPermission(session.tenant.id, "complaints.compensation.request"),
    hasPermission(session.tenant.id, "complaints.compensation.approve"),
    getTasksForComplaint(complaint.id),
    getSlaRules(session.tenant.id),
    getQualityRecords(complaint.id),
    getTenantMembers(session.tenant.id),
    getAttachments(complaint.id),
    getCommunications(complaint.id),
    getCompensations(complaint.id),
  ]);
  if (!workflow) notFound();

  const slaRule = slaRules[complaint.severity];
  const slaStatus = slaRule
    ? computeSlaStatus({
        createdAt: complaint.created_at,
        currentStageKey: complaint.current_stage_key,
        acknowledgementMinutes: slaRule.acknowledgement_minutes,
        rcaMinutes: slaRule.rca_minutes,
      })
    : null;

  const stages = workflow.definition.stages;
  const stageLabel = new Map(stages.map((s) => [s.key, s.label]));
  const currentIndex = stages.findIndex((s) => s.key === complaint.current_stage_key);
  const nextStage = stages[currentIndex + 1];

  const batchSiblings = complaint.sku && complaint.batch_number
    ? await getBatchSiblings(session.tenant.id, complaint.sku, complaint.batch_number, complaint.id)
    : [];
  const escalation = computeBatchEscalation(batchSiblings, complaint.severity);

  const actorIds = [...new Set(events.map((e) => e.actor_id).filter((v): v is string => Boolean(v)))];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const supabase = await createClient();
    const { data: actors } = await supabase.from(TABLES.users).select("id, full_name, email").in("id", actorIds);
    for (const actor of actors ?? []) actorName.set(actor.id, actor.full_name ?? actor.email);
  }

  const productFields = [
    complaint.category && `Category: ${complaint.category}`,
    complaint.product_name && `Product: ${complaint.product_name}`,
    complaint.sku && `SKU: ${complaint.sku}`,
    complaint.batch_number && `Batch: ${complaint.batch_number}`,
    complaint.production_date && `Produced ${formatDate(complaint.production_date)}`,
    complaint.expiry_date && `Expires ${formatDate(complaint.expiry_date)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      {/* Command-centre header — case identity, severity and where it stands,
          pinned while scrolling a long case (ARCHITECTURE.md's "what
          happened, who owns it, what's next" philosophy, kept in view the
          whole way down). -mx-6 cancels <main>'s own p-6 so the bar spans
          edge to edge within the content column; z-30 stays under any
          modal's z-50. */}
      <div className="sticky top-0 z-30 -mx-6 flex flex-col gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <BackLink href="/complaints" label="Complaints" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{complaint.case_number}</p>
            <h1 className="text-xl font-semibold text-ink">{complaint.title}</h1>
            <p className="text-sm text-ink-faint">Opened {formatDate(complaint.created_at)}</p>
            {(complaint.reporter_name || complaint.reporter_email || complaint.reporter_phone) && (
              <p className="text-sm text-ink-faint">
                Reported by {complaint.reporter_name ?? "unknown"}
                {complaint.reporter_email && ` · ${complaint.reporter_email}`}
                {complaint.reporter_phone && ` · ${complaint.reporter_phone}`}
              </p>
            )}
            {productFields.length > 0 && <p className="text-sm text-ink-faint">{productFields.join(" · ")}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={complaint.severity} />
              {slaStatus && <SlaBadge status={slaStatus} />}
            </div>
            <ChannelBadge channel={complaint.source} />
            {canOverrideSeverity && <SeverityOverride complaintId={complaint.id} severity={complaint.severity} />}
          </div>
        </div>

        <PendingInformationToggle complaintId={complaint.id} pending={complaint.pending_information} reason={complaint.pending_information_reason} />
      </div>

      <BatchEscalationBanner escalation={escalation} siblings={batchSiblings} />

      {canAssign && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-ink">Assigned to</p>
          <AssignmentControl complaintId={complaint.id} members={members} assigneeId={complaint.assignee_id} />
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <WorkflowStepper
          stages={stages}
          currentKey={complaint.current_stage_key}
          stageDates={stageDatesFromEvents(events)}
        />
      </div>

      <AiSummaryCard complaintId={complaint.id} />

      {complaint.description && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-faint">{complaint.description}</p>
        </div>
      )}

      {complaint.purchase_details && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Purchase details</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-faint">{complaint.purchase_details}</p>
        </div>
      )}

      {canManage && nextStage && nextStage.key !== "closed" && (
        <div className="flex justify-end">
          <AdvanceStageButton complaintId={complaint.id} nextLabel={nextStage.label} />
        </div>
      )}
      {canClose && nextStage && nextStage.key === "closed" && (
        <div className="flex justify-end">
          <ClosureControl complaintId={complaint.id} capaVerified={quality.capa?.status === "verified"} />
        </div>
      )}

      <InvestigationSection
        complaintId={complaint.id}
        investigation={quality.investigation}
        canManage={canManageInvestigations}
      />
      <RootCauseSection complaintId={complaint.id} rootCause={quality.rootCause} canManage={canManageInvestigations} />
      <CapaSection complaintId={complaint.id} capa={quality.capa} canManage={canManageInvestigations} />

      <CommunicationLog complaintId={complaint.id} communications={communications} aiAvailable={modelAvailable()} />

      <CompensationPanel
        complaintId={complaint.id}
        compensations={compensations}
        canRequest={canRequestCompensation}
        canApprove={canApproveCompensation}
      />

      <AttachmentsPanel tenantId={session.tenant.id} complaintId={complaint.id} attachments={attachments} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Tasks</h2>
          <Link href={`/tasks/new?complaint_id=${complaint.id}`}>
            <Button variant="ghost" className="h-8 px-2 text-xs">
              Add task
            </Button>
          </Link>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-faint">No tasks linked to this complaint yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
        <EventTimeline events={events} stageLabel={stageLabel} actorName={actorName} />
      </div>
    </div>
  );
}
