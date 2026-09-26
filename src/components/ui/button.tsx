import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  busy?: boolean;
};

export function Button({ variant = "primary", busy, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand text-brand-ink hover:opacity-90",
        variant === "ghost" && "border border-border text-ink hover:bg-surface",
        className,
      )}
      disabled={disabled || busy}
      {...props}
    >
      {children}
    </button>
  );
}
