"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's dialog.
 *
 * Consequential actions — closing a case, overriding severity, approving a
 * recall — previously committed on a single click with nothing in between.
 * A dialog is the difference between deciding and slipping.
 *
 * `dismissible={false}` while a server action is in flight, so nobody escapes
 * out of a half-finished submit and is left unsure whether it happened.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  // "Have we hydrated yet" — a portal needs document.body, which does not
  // exist during the server render. useSyncExternalStore answers this without
  // a set-state-in-effect round trip: the server snapshot is false, the client
  // snapshot is true.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep focus inside the dialog: tabbing off the end wraps to the start,
      // so keyboard users can't wander into the page behind it.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    // Focus the panel itself rather than its first control, so a screen reader
    // announces the title before whatever the first field happens to be.
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-lg outline-none sm:rounded-xl",
          size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-faint">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-background hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The Cancel + submit pair every dialog form ends with, so they don't drift. */
export function ModalFormActions({
  onCancel,
  submitLabel,
  busy,
  danger,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
  danger?: boolean;
  cancelLabel?: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-faint hover:text-ink disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60",
          danger ? "bg-danger hover:opacity-90" : "bg-brand hover:bg-brand-dark",
        )}
      >
        {busy ? "Working…" : submitLabel}
      </button>
    </div>
  );
}
