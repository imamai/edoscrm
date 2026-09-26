import { cn } from "@/lib/utils";

const CONTROL =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-ink outline-none transition-colors focus:border-brand sm:text-[0.9375rem]";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Field({ label, id, className, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input id={inputId} className={cn(CONTROL, className)} {...props} />
    </div>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>;
}
