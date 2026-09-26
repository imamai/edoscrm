"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { TABLES } from "@/lib/data/tables";

export async function markAllNotificationsRead() {
  const session = await resolveSession();
  if (session.kind !== "ok") return;
  const supabase = await createClient();
  await supabase.from(TABLES.notifications).update({ read_at: new Date().toISOString() }).eq("user_id", session.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
