import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The one back control every sub-page uses, so "up" looks and lands the same
 * everywhere. Deliberately a real link to the parent screen rather than
 * `history.back()`: cases and reports are opened cold from emails,
 * notifications and shared links, where there is no history to go back to and
 * a browser-back button would either do nothing or throw the viewer out of
 * the app entirely.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1 text-sm font-semibold text-ink-faint transition-colors hover:text-brand"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
