import { formatDateTime } from "@/lib/utils";
import type { ComplaintEvent } from "@/lib/data/complaints";

function describe(event: ComplaintEvent, stageLabel: Map<string, string>): string {
  switch (event.event_type) {
    case "complaint.created": {
      const stage = event.payload.stage as string | undefined;
      return `Complaint logged${stage ? ` — ${stageLabel.get(stage) ?? stage}` : ""}`;
    }
    case "stage.changed": {
      const from = event.payload.from as string | undefined;
      const to = event.payload.to as string | undefined;
      return `Moved from ${(from && stageLabel.get(from)) ?? from} to ${(to && stageLabel.get(to)) ?? to}`;
    }
    default:
      return event.event_type;
  }
}

export function EventTimeline({
  events,
  stageLabel,
  actorName,
}: {
  events: ComplaintEvent[];
  stageLabel: Map<string, string>;
  /** actor_id -> display name; unknown actors fall back to "Someone". */
  actorName: Map<string, string>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-faint">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
          <p className="text-sm text-ink">{describe(event, stageLabel)}</p>
          <p className="text-xs text-ink-faint">
            {(event.actor_id && actorName.get(event.actor_id)) ?? "Someone"} ·{" "}
            {formatDateTime(event.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
