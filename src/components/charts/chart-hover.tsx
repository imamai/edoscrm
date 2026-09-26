"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * What the cursor finds on a chart. Ported near-verbatim from edos-poa
 * (src/components/charts/chart-hover.tsx) — the only chart-interaction layer
 * found across the sibling codebases, hand-rolled rather than a library
 * dependency. Only the theme tokens changed (border-line -> border-border,
 * shadow-card/shadow-pop -> Tailwind's shadow-sm/shadow-md, since EDOSCRM
 * has no custom shadow tokens).
 *
 * Nearest-slot rather than exact hit-testing: a thin line or a short bar is a
 * small target, and on a phone a finger is a large one. Anywhere in a slot's
 * column counts, and dragging a finger across the chart walks the figures.
 */

export interface HoverSlot {
  from: number;
  to: number;
  x: number;
  y: number;
  title: string;
  rows: { label?: string; value: string; color: string }[];
}

export function ChartHover({ slots, mark }: { slots: HoverSlot[]; mark: "point" | "column" }) {
  const [active, setActive] = useState<number | null>(null);
  const slot = active === null ? null : slots[active];

  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const at = ((event.clientX - box.left) / box.width) * 100;
    let index = slots.findIndex((s) => at >= s.from && at < s.to);
    if (index === -1) {
      index = at < (slots[0]?.from ?? 0) ? 0 : slots.length - 1;
    }
    if (index !== active) setActive(index);
  };

  const horizontal = !slot ? "" : slot.x < 18 ? "translate-x-0" : slot.x > 82 ? "-translate-x-full" : "-translate-x-1/2";
  const below = slot ? slot.y < 30 : false;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 cursor-crosshair touch-pan-y"
      onPointerMove={pick}
      onPointerDown={pick}
      onPointerLeave={() => setActive(null)}
    >
      {slot && (
        <>
          {mark === "column" ? (
            <span
              className="pointer-events-none absolute inset-y-0 rounded-sm bg-brand/[0.07] transition-[left,width] duration-100"
              style={{ left: `${slot.from}%`, width: `${slot.to - slot.from}%` }}
            />
          ) : (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink-faint/60"
                style={{ left: `${slot.x}%` }}
              />
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-sm"
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, background: slot.rows[0]?.color }}
              />
            </>
          )}

          <div
            className={cn(
              "pointer-events-none absolute z-10 min-w-32 rounded-lg border border-border bg-surface px-3 py-2 shadow-md",
              horizontal,
              below ? "translate-y-3" : "-translate-y-[calc(100%+0.75rem)]",
            )}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <p className="text-[0.6875rem] font-medium whitespace-nowrap text-ink-faint">{slot.title}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {slot.rows.map((row, i) => (
                <li key={i} className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                  {row.label && <span className="text-ink-faint">{row.label}</span>}
                  <span className="tnum ml-auto pl-2 font-semibold text-ink">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The donut, with the slice under the cursor lifted and its figure in the
 * middle. The legend beside it works the same way, so a thin slice that is
 * hard to land on can be found by name instead.
 */
export function DonutInteractive({
  slices,
  centre,
  label,
  total,
}: {
  slices: { label: string; value: number; valueText: string; color: string; share: string }[];
  centre?: string;
  label: string;
  total?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const current = active === null ? null : slices[active];

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <figure className="relative m-0 shrink-0" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90" onPointerLeave={() => setActive(null)}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="13" />
          {sum > 0 &&
            slices.map((slice, i) => {
              const length = (slice.value / sum) * circumference;
              const gap = slices.length > 1 ? Math.min(1.2, length / 3) : 0;
              const node = (
                <circle
                  key={slice.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={active === i ? 17 : 13}
                  strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                  strokeDashoffset={-offset}
                  className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                  style={{ opacity: active === null || active === i ? 1 : 0.35 }}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              );
              offset += length;
              return node;
            })}
        </svg>
        <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          {current ? (
            <>
              <span className="tnum text-base leading-tight font-semibold text-ink">{current.valueText}</span>
              <span className="line-clamp-1 text-[0.6875rem] text-ink-faint">
                {current.label} · {current.share}
              </span>
            </>
          ) : (
            centre && (
              <>
                <span className="tnum text-base font-semibold text-ink">{centre}</span>
                <span className="text-[0.6875rem] text-ink-faint">total</span>
              </>
            )
          )}
        </figcaption>
      </figure>

      <ul className="flex min-w-0 flex-col gap-0.5" onPointerLeave={() => setActive(null)}>
        {slices.map((slice, i) => (
          <li
            key={slice.label}
            onPointerEnter={() => setActive(i)}
            className={cn(
              "-mx-2 flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
              active === i && "bg-background",
            )}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-faint">{slice.label}</span>
            {active === i && <span className="tnum font-semibold text-ink">{slice.valueText}</span>}
            <span className="tnum text-ink-faint">{slice.share}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
