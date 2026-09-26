"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutButton({ className, icon }: { className?: string; icon?: React.ReactNode }) {
  const router = useRouter();

  async function onClick() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-2", className)}>
      {icon}
      Sign out
    </button>
  );
}
