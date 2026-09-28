import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};

/**
 * Two journeys land here, both already signed in by /auth/callback: an
 * invited teammate setting their first password, and somebody who asked to
 * reset a forgotten one. The heading follows whichever it is; everything
 * below it is the same job.
 */
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
