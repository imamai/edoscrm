"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A password box you can look at.
 *
 * Typing a password you cannot see, twice, on a phone keyboard, is how people
 * end up locked out of an account they have just created — and the usual
 * response is to pick something short and memorable, which is worse than the
 * typo it avoids. Showing it is the safer thing to offer.
 *
 * Hidden to begin with, because somebody may be setting this up with a
 * colleague beside them. The toggle is a button rather than a checkbox so it
 * never becomes part of the form's data, and its label describes the action
 * rather than the state.
 */
export function PasswordField({
  label,
  hint,
  error,
  required,
  className,
  id,
  name,
  autoComplete = "new-password",
  autoFocus,
  minLength,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  id?: string;
  name: string;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={shown ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          minLength={minLength}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          // Room on the right for the toggle, so a long password never runs
          // underneath it.
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-surface px-3 pr-11 text-base text-ink outline-none transition-colors focus:border-brand sm:text-[0.9375rem]",
            error && "border-danger",
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-faint transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          {shown ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
