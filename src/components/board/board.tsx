/**
 * The one generic Kanban board (ARCHITECTURE.md §10) — parameterised by an
 * ordered column list and a `columnKey` accessor, so both complaints (grouped
 * by their workflow's current_stage_key) and tasks (grouped by their fixed
 * status set) render through this same component rather than two hand-built
 * boards. No drag-and-drop yet — cards move via an explicit action instead
 * (the same pattern the complaint stepper's "Move to {next stage}" button
 * uses), which is simpler and matches what's already shipped; promoting a
 * card to draggable is a real interaction-design decision worth making on
 * its own, not a default to reach for now.
 */
export function Board<T extends { id: string }>({
  columns,
  items,
  columnKey,
  renderCard,
}: {
  columns: { key: string; label: string }[];
  items: T[];
  columnKey: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => {
        const columnItems = items.filter((item) => columnKey(item) === column.key);
        return (
          <div
            key={column.key}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{column.label}</p>
              <span className="text-xs text-ink-faint">{columnItems.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnItems.length === 0 ? (
                <p className="px-1 text-xs text-ink-faint">Nothing here</p>
              ) : (
                columnItems.map((item) => <div key={item.id}>{renderCard(item)}</div>)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
