import Link from "next/link";
import { FileQuestion } from "lucide-react";

/** A case number that no longer exists, or a mistyped link — both land here,
 * and both need a way onward rather than a bare 404. */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <FileQuestion className="h-8 w-8 text-ink-faint" />
      <h1 className="text-lg font-semibold text-ink">We couldn&rsquo;t find that</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        The page or record you asked for doesn&rsquo;t exist, or it belongs to a different workspace.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/complaints" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark">
          All complaints
        </Link>
        <Link href="/dashboard" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
