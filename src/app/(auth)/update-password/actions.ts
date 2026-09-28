"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface UpdatePasswordState {
  error: string | null;
}

/**
 * Sets a password for whoever the session belongs to.
 *
 * Both journeys that land here — an invited teammate and a forgotten
 * password — arrive already signed in, because /auth/callback exchanged their
 * emailed token for a session first. So there is nothing to verify here
 * beyond the password itself.
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  form: FormData,
): Promise<UpdatePasswordState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // The app layout sends anyone without a workspace on to /new-workspace.
  redirect("/dashboard");
}
