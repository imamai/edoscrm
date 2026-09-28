import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The EDOS CRM mark: a speech bubble with a tick inside it — something
 * somebody said, and something done about it. Drawn rather than imported so
 * it inherits `currentColor` and stays crisp at any size.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <path
        d="M5 9.5A4.5 4.5 0 0 1 9.5 5h13A4.5 4.5 0 0 1 27 9.5v8a4.5 4.5 0 0 1-4.5 4.5H14l-6 5v-5H9.5A4.5 4.5 0 0 1 5 17.5v-8Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M5 9.5A4.5 4.5 0 0 1 9.5 5h13A4.5 4.5 0 0 1 27 9.5v8a4.5 4.5 0 0 1-4.5 4.5H14l-6 5v-5H9.5A4.5 4.5 0 0 1 5 17.5v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m11.8 13.6 2.7 2.7 5.7-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  href = "/",
  tone = "ink",
}: {
  className?: string;
  href?: string | null;
  tone?: "ink" | "light";
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={tone === "light" ? "text-accent" : "text-brand"} />
      <span
        className={cn(
          "font-display text-[1.0625rem] leading-none font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-ink",
        )}
      >
        EDOS<span className={tone === "light" ? "text-accent" : "text-brand"}> CRM</span>
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex" aria-label="EDOS CRM home">
      {inner}
    </Link>
  );
}
