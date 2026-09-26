/**
 * Shown while a page's data resolves. Without this a data-heavy screen was a
 * blank frame until everything arrived, which reads as broken rather than as
 * loading — the difference between a product that feels finished and one that
 * feels like a prototype.
 *
 * Deliberately generic: it mirrors the shape every page here shares (a title,
 * a row of tiles, a table) rather than being tailored per route, which would
 * be more skeletons to keep in sync than it is worth.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-6 w-56 rounded-md bg-border" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="h-10 border-b border-border bg-background" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-0">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="h-3 flex-1 rounded bg-border/70" />
            <div className="h-3 w-16 rounded bg-border/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
