import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  const session = await resolveSession();
  if (session.kind !== "anon") redirect("/");

  return <SignupForm />;
}
