"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * What somebody sees when a page fails.
 *
 * Previously this was the framework's own error screen, which tells a user
 * nothing they can act on and does not look like the product. This says what
 * happened in plain words, offers the two things that actually help — try
 * again, or go somewhere that works — and shows the digest, which is the one
 * detail worth quoting when reporting it.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Goes to the platform's function logs, where an error tracker would pick
    // it up. Without this a failure leaves no server-side trace at all.
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" />
      <h1 className="text-lg font-semibold text-ink">This page didn&rsquo;t load</h1>
      <p className="max-w-md text-sm text-ink-faint">
        Something went wrong on our side, not yours. Nothing you were working on has been lost — trying again usually
        clears it.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
        <Link href="/dashboard" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
          Back to dashboard
        </Link>
      </div>
      {error.digest && <p className="mt-1 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>}
    </div>
  );
}
