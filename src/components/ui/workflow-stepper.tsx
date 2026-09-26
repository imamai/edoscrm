import { Check } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { WorkflowStageDef } from "@/lib/data/workflows";

/**
 * The reusable chevron workflow stepper — ported from EDOSPMIS
 * (components/app/workflow-stepper.tsx), the only chevron/clip-path stepper
 * component found across the sibling codebases (edos-poa and edospoa-posv1
 * only use ChevronRight/ChevronLeft as plain icons — breadcrumbs, disclosure
 * toggles — not a stage progress component; see ARCHITECTURE.md §14).
 *
 * Reads its stage labels from the complaint's own pinned workflow version —
 * never hard-coded strings — so a future tenant-defined workflow with
 * different stages renders correctly without a component change. Each step
 * is drawn as a connected chevron (CSS clip-path), not a pill, and overlaps
 * its neighbor slightly so the chain reads as one continuous path.
 */
export function WorkflowStepper({
  stages,
  currentKey,
  stageDates,
}: {
  stages: WorkflowStageDef[];
  currentKey: string;
  /** stage_key -> ISO date the stage was entered, for a "reached {date}" caption. */
  stageDates?: Record<string, string>;
}) {
  const currentIndex = stages.findIndex((s) => s.key === currentKey);

  return (
    <div className="scroll-slim flex items-stretch overflow-x-auto">
      {stages.map((stage, i) => {
        const isDone = currentIndex >= 0 && i < currentIndex;
        const isCurrent = stage.key === currentKey;
        const isFirst = i === 0;
        const isLast = i === stages.length - 1;
        const reachedAt = stageDates?.[stage.key];

        const clipPath = isFirst
          ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
          : isLast
            ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)"
            : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";

        return (
          <div
            key={stage.key}
            style={{ clipPath }}
            className={cn(
              "flex min-h-[2.75rem] min-w-[7rem] shrink-0 flex-col items-center justify-center gap-0.5 px-5 py-1 text-center whitespace-nowrap",
              !isFirst && "-ml-3.5",
              isDone && "bg-good text-white",
              isCurrent && "bg-brand text-white",
              !isDone && !isCurrent && "border border-border bg-background text-ink-faint",
            )}
          >
            <span className="flex items-center gap-1 text-xs font-semibold">
              {isDone && <Check className="h-3 w-3 shrink-0" />}
              {stage.label}
            </span>
            {isDone && reachedAt && <span className="text-[10px] opacity-80">reached {formatDate(reachedAt)}</span>}
            {isCurrent && <span className="text-[10px] opacity-85">in progress</span>}
          </div>
        );
      })}
    </div>
  );
}
