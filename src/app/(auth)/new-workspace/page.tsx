import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { ensureWorkspace } from "@/lib/provision";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = {
  title: "Create your workspace",
  robots: { index: false, follow: false },
};

/**
 * Where a confirmed sign-up link lands, and the one screen that can put a
 * signed-in account into a workspace.
 *
 * Almost nobody sees the form. /auth/callback has just turned the emailed
 * token into a session, which is the first moment `edoscrm_provision_tenant`
 * can run as the person who signed up — so the organisation name they typed
 * on the sign-up form becomes a real tenant here and they go straight on.
 *
 * The form is the fallback for the cases that leave somebody signed in with
 * nowhere to be: an invitation that was never activated, or provisioning that
 * failed the first time. Without it those accounts bounce between /dashboard
 * and /login forever.
 */
export default async function NewWorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureWorkspace(supabase, user);

  const session = await resolveSession();
  if (session.kind === "ok") redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Name your workspace
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        One workspace per organisation — you can invite the rest of your team to
        it once it exists.
      </p>

      <div className="mt-7">
        <WorkspaceForm />
      </div>
    </div>
  );
}
