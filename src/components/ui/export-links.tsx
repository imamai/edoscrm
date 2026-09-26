import Link from "next/link";

/** CSV first — the most universally-openable format — then Excel, then PDF.
 * Ported from EDOSPMIS's own export-links.tsx. */
export function ExportLinks({ base }: { base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-ink-faint">Download</span>
      <Link href={`${base}${sep}format=csv`} className="font-semibold text-ink hover:text-brand">
        CSV
      </Link>
      <span className="text-ink-faint">&middot;</span>
      <Link href={`${base}${sep}format=xlsx`} className="font-semibold text-ink hover:text-brand">
        Excel
      </Link>
      <span className="text-ink-faint">&middot;</span>
      <Link href={`${base}${sep}format=pdf`} className="font-semibold text-ink hover:text-brand">
        PDF
      </Link>
    </div>
  );
}
