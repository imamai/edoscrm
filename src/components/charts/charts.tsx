import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartHover, DonutInteractive, type HoverSlot } from "./chart-hover";

/**
 * Charts, ported near-verbatim from edos-poa (src/components/charts/charts.tsx)
 * — drawn on the server as SVG, no charting library, nothing to download, and
 * they print. Every label is HTML, not SVG text, so it stays legible at 11px
 * regardless of how the plot itself scales on a phone.
 *
 * Adapted only where EDOSCRM's tokens differ from edos-poa's: border-line ->
 * border-border, shadow-card/shadow-pop -> Tailwind's shadow-sm/shadow-md
 * (EDOSCRM has no custom shadow tokens), text-ink-soft collapsed to
 * text-ink-faint (EDOSCRM has two ink levels, not three), and the palette
 * reads EDOSCRM's own semantic tokens instead of edos-poa's -soft variants.
 */

export const CHART = {
  primary: "var(--color-brand)",
  secondary: "var(--color-warning)",
  danger: "var(--color-danger)",
  soft: "color-mix(in srgb, var(--color-brand) 55%, white)",
  grid: "var(--color-border)",
  series: ["#12233b", "#b45309", "#1d4ed8", "#7c3aed", "#5b82b8", "#16803c", "#0f766e", "#be185d"],
} as const;

export function compact(value: number): string {
  const v = Math.abs(value);
  if (v >= 1_000_000) return `${(value / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

/** For counts: whole numbers only, so a scale of 0–2 does not read "0, 1, 1, 2, 2". */
export function wholeNumber(value: number): string {
  return Number.isInteger(Math.round(value * 1000) / 1000) ? String(Math.round(value)) : "";
}

function exact(format: (v: number) => string, value: number): string {
  return Math.round(value).toLocaleString();
}

function scale(max: number, ticks = 4) {
  if (!(max > 0)) return { top: ticks, values: Array.from({ length: ticks + 1 }, (_, i) => i) };
  const rough = max / ticks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * power).find((s) => s >= rough) ?? rough;
  const top = step * ticks;
  return { top, values: Array.from({ length: ticks + 1 }, (_, i) => step * i) };
}

// ── The card every chart sits in ────────────────────────────────────────────

export function ChartCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-brand/30 hover:shadow-md",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <Link href={action.href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-dark hover:underline">
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="flex-1 px-4 py-4">{children}</div>
    </section>
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-48 items-center justify-center text-center text-sm text-ink-faint">{children}</p>;
}

// ── The frame shared by every x/y chart ─────────────────────────────────────

function Frame({
  top,
  ticks,
  format,
  labels,
  label,
  children,
  hover,
  height = "h-48",
}: {
  hover?: React.ReactNode;
  top: number;
  ticks: number[];
  format: (v: number) => string;
  labels: { text: string; at: number }[];
  label: string;
  children: React.ReactNode;
  height?: string;
}) {
  return (
    <figure className="m-0" role="img" aria-label={label}>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className={cn("relative w-11", height)} aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className="tnum absolute right-0 -translate-y-1/2 text-[0.6875rem] text-ink-faint"
              style={{ top: `${100 - (t / top) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>

        <div className={cn("relative", height)}>
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${100 - (t / top) * 100}%` }}
            />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {children}
          </svg>
          {hover}
        </div>

        <span />
        <div className="relative mt-1.5 h-4" aria-hidden="true">
          {labels.map((l, i) => (
            <span
              key={`${l.text}-${i}`}
              className={cn(
                "absolute text-[0.6875rem] whitespace-nowrap text-ink-faint",
                l.at <= 2 ? "translate-x-0" : l.at >= 98 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${l.at}%` }}
            >
              {l.text}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

function thin<T>(items: T[], max: number): number[] {
  if (items.length <= max) return items.map((_, i) => i);
  const every = Math.ceil(items.length / max);
  const picked = items.map((_, i) => i).filter((i) => i % every === 0);
  if (picked[picked.length - 1] !== items.length - 1) picked.push(items.length - 1);
  return picked;
}

// ── Area ────────────────────────────────────────────────────────────────────

export interface Point {
  label: string;
  value: number;
}

export function AreaChart({
  points,
  format = wholeNumber,
  color = CHART.primary,
  label,
}: {
  points: Point[];
  format?: (v: number) => string;
  color?: string;
  label: string;
}) {
  const { top, values } = scale(Math.max(...points.map((p) => p.value), 0));
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * 100 : 50);
  const y = (v: number) => 100 - (v / top) * 100;
  const clampY = (v: number) => Math.min(100, Math.max(0, v));

  let line = `M${x(0)},${y(points[0]?.value ?? 0)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = x(i) + (x(i + 1) - x(Math.max(0, i - 1))) / 6;
    const c1y = clampY(y(p1.value) + (y(p2.value) - y(p0.value)) / 6);
    const c2x = x(i + 1) - (x(Math.min(points.length - 1, i + 2)) - x(i)) / 6;
    const c2y = clampY(y(p2.value) - (y(p3.value) - y(p1.value)) / 6);
    line += ` C${c1x},${c1y} ${c2x},${c2y} ${x(i + 1)},${y(p2.value)}`;
  }
  const area = `${line} L${x(points.length - 1)},100 L${x(0)},100 Z`;
  const gradient = `area-${label.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;

  const slots: HoverSlot[] = points.map((p, i) => ({
    from: i === 0 ? 0 : (x(i - 1) + x(i)) / 2,
    to: i === points.length - 1 ? 100.01 : (x(i) + x(i + 1)) / 2,
    x: x(i),
    y: y(p.value),
    title: p.label,
    rows: [{ value: exact(format, p.value), color }],
  }));

  return (
    <Frame
      top={top}
      ticks={values}
      format={format}
      label={label}
      labels={thin(points, 7).map((i) => ({ text: points[i].label, at: x(i) }))}
      hover={<ChartHover slots={slots} mark="point" />}
    >
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradient})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </Frame>
  );
}

// ── Bars ────────────────────────────────────────────────────────────────────

export interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({
  bars,
  format = wholeNumber,
  label,
  color = CHART.primary,
}: {
  bars: Bar[];
  format?: (v: number) => string;
  label: string;
  color?: string;
}) {
  const { top, values } = scale(Math.max(...bars.map((b) => b.value), 0));
  const slot = 100 / Math.max(1, bars.length);
  const width = Math.min(slot * 0.62, 14);

  return (
    <Frame
      top={top}
      ticks={values}
      format={format}
      label={label}
      labels={thin(bars, 8).map((i) => ({ text: bars[i].label, at: slot * i + slot / 2 }))}
      hover={
        <ChartHover
          mark="column"
          slots={bars.map((b, i) => ({
            from: slot * i,
            to: slot * (i + 1),
            x: slot * i + slot / 2,
            y: 100 - (b.value / top) * 100,
            title: b.label,
            rows: [{ value: exact(format, b.value), color: b.color ?? color }],
          }))}
        />
      }
    >
      {bars.map((b, i) => {
        const h = (b.value / top) * 100;
        return <rect key={`${b.label}-${i}`} x={slot * i + (slot - width) / 2} y={100 - h} width={width} height={h} rx="0.6" fill={b.color ?? color} />;
      })}
    </Frame>
  );
}

/** Two series side by side per group, with a legend underneath. */
export function GroupedBarChart({
  groups,
  series,
  format = wholeNumber,
  label,
}: {
  groups: { label: string; values: number[] }[];
  series: { name: string; color: string }[];
  format?: (v: number) => string;
  label: string;
}) {
  const max = Math.max(0, ...groups.flatMap((g) => g.values));
  const { top, values } = scale(max);
  const slot = 100 / Math.max(1, groups.length);
  const inner = slot * 0.7;
  const barWidth = inner / series.length;

  return (
    <div>
      <Frame
        top={top}
        ticks={values}
        format={format}
        label={label}
        labels={groups.map((g, i) => ({ text: g.label, at: slot * i + slot / 2 }))}
        hover={
          <ChartHover
            mark="column"
            slots={groups.map((g, i) => ({
              from: slot * i,
              to: slot * (i + 1),
              x: slot * i + slot / 2,
              y: 100 - (Math.max(0, ...g.values) / top) * 100,
              title: g.label,
              rows: g.values.map((v, si) => ({ label: series[si]?.name, value: exact(format, v), color: series[si]?.color ?? CHART.primary })),
            }))}
          />
        }
      >
        {groups.map((g, gi) =>
          g.values.map((v, si) => {
            const h = (v / top) * 100;
            return (
              <rect
                key={`${gi}-${si}`}
                x={slot * gi + (slot - inner) / 2 + barWidth * si + barWidth * 0.08}
                y={100 - h}
                width={barWidth * 0.84}
                height={h}
                rx="0.6"
                fill={series[si]?.color}
              />
            );
          }),
        )}
      </Frame>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} className="mt-3 justify-center" />
    </div>
  );
}

// ── Donut ───────────────────────────────────────────────────────────────────

export function Legend({ items, className }: { items: { label: string; color: string; value?: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-faint">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
          <span>{item.label}</span>
          {item.value && <span className="tnum text-ink-faint">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DonutChart({
  slices,
  total,
  centre,
  format = wholeNumber,
  label,
}: {
  slices: { label: string; value: number; color: string }[];
  total?: number;
  centre?: string;
  format?: (v: number) => string;
  label: string;
}) {
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0);
  return (
    <DonutInteractive
      label={label}
      centre={centre}
      total={total}
      slices={slices.map((slice) => ({
        label: slice.label,
        value: slice.value,
        color: slice.color,
        valueText: exact(format, slice.value),
        share: sum ? `${Math.round((slice.value / sum) * 100)}%` : "—",
      }))}
    />
  );
}
