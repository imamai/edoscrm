import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";

export default async function RootPage() {
  const session = await resolveSession();

  if (session.kind === "anon") redirect("/login");
  if (session.kind === "no_tenant") redirect("/new-workspace");
  redirect("/dashboard");
}
