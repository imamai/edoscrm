"use client";

import { useState, useTransition } from "react";
import { Plus, Undo2, Archive } from "lucide-react";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui/primitives";
import { FieldError } from "@/components/ui/field";
import type { Category, TenantSettings, KpiTarget } from "@/lib/data/settings";
import type { SlaRule } from "@/lib/data/sla";
import type { Severity } from "@/lib/data/complaints";
import { KPI_LABELS, type KpiKey } from "@/lib/domain/kpi-labels";
import {
  saveSlaAction,
  saveThresholdsAction,
  saveOperationsAction,
  saveTargetsAction,
  addCategoryAction,
  setCategoryActiveAction,
} from "./actions";

const control =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none";
const numberControl =
  "h-10 w-20 rounded-lg border border-border bg-surface px-2 text-sm text-ink tnum focus:border-brand focus:outline-none";

/** Deadlines are stored in minutes but nobody thinks in minutes. */
function toHours(minutes: number | null): string {
  return minutes == null ? "" : String(Math.round((minutes / 60) * 100) / 100);
}

function Saved({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return <span className="text-xs font-semibold text-good">Saved</span>;
}

export function RulesClient({
  settings,
  slaRules,
  categories,
  targets,
}: {
  settings: TenantSettings;
  slaRules: Record<Severity, SlaRule>;
  categories: Category[];
  targets: Record<string, KpiTarget>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(
    key: string,
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
  ) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      setSaved(null);
      startTransition(async () => {
        const result = await action(fd);
        if (!result.ok) setError(result.error ?? "That didn't save.");
        else setSaved(key);
      });
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FieldError>{error}</FieldError>}

      {/* ---------------------------- SLA ---------------------------- */}
      <Card>
        <CardHeader
          title="Service levels"
          subtitle="Deadlines in hours from when a complaint is logged. Leave a deadline blank where a severity has none."
          action={<Saved shown={saved === "sla"} />}
        />
        <CardBody>
          <form
            onSubmit={submit("sla", saveSlaAction)}
            className="flex flex-col gap-3"
          >
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="pb-2 pr-4 font-semibold">Severity</th>
                    <th className="pb-2 pr-4 font-semibold">
                      Acknowledge within
                    </th>
                    <th className="pb-2 pr-4 font-semibold">
                      Resolution plan within
                    </th>
                    <th className="pb-2 font-semibold">RCA within</th>
                  </tr>
                </thead>
                <tbody>
                  {(["T1", "T2", "T3"] as Severity[]).map((s) => (
                    <tr key={s} className="border-t border-border">
                      <td className="py-2 pr-4">
                        <Badge
                          tone={
                            s === "T1"
                              ? "danger"
                              : s === "T2"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {s}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          name={`${s}_ack`}
                          type="number"
                          min="1"
                          step="0.25"
                          defaultValue={toHours(
                            slaRules[s]?.acknowledgement_minutes ?? null,
                          )}
                          className={numberControl}
                        />
                        <span className="ml-1.5 text-xs text-ink-faint">
                          hours
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          name={`${s}_plan`}
                          type="number"
                          min="0"
                          step="0.25"
                          defaultValue={toHours(
                            slaRules[s]?.resolution_plan_minutes ?? null,
                          )}
                          className={numberControl}
                        />
                        <span className="ml-1.5 text-xs text-ink-faint">
                          hours
                        </span>
                      </td>
                      <td className="py-2">
                        <input
                          name={`${s}_rca`}
                          type="number"
                          min="0"
                          step="0.25"
                          defaultValue={toHours(
                            slaRules[s]?.rca_minutes ?? null,
                          )}
                          className={numberControl}
                        />
                        <span className="ml-1.5 text-xs text-ink-faint">
                          hours
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-faint">
              A blank deadline means there isn&rsquo;t one. T3 has no RCA
              deadline by default: the brief asks that a minor complaint be
              logged, acknowledged and reviewed weekly, not investigated to a
              deadline.
            </p>
            <SaveButton pending={pending} />
          </form>
        </CardBody>
      </Card>

      {/* ------------------------ escalation ------------------------- */}
      <Card>
        <CardHeader
          title="Batch escalation thresholds"
          subtitle="How many complaints about the same product and batch, in how long, before the system acts."
          action={<Saved shown={saved === "thresholds"} />}
        />
        <CardBody>
          <form
            onSubmit={submit("thresholds", saveThresholdsAction)}
            className="flex flex-col gap-3"
          >
            <Threshold
              label="Warn — watch this batch"
              countName="warn_count"
              countValue={settings.warn_count}
              unitName="warn_hours"
              unitValue={settings.warn_hours}
              unit="hours"
            />
            <Threshold
              label="Escalate to T2"
              countName="escalate_count"
              countValue={settings.escalate_count}
              unitName="escalate_hours"
              unitValue={settings.escalate_hours}
              unit="hours"
            />
            <Threshold
              label="RCA becomes mandatory"
              countName="mandatory_rca_count"
              countValue={settings.mandatory_rca_count}
              unitName="mandatory_rca_hours"
              unitValue={settings.mandatory_rca_hours}
              unit="hours"
            />
            <Threshold
              label="Withdrawal assessment required"
              countName="withdrawal_count"
              countValue={settings.withdrawal_count}
              unitName="withdrawal_hours"
              unitValue={settings.withdrawal_hours}
              unit="hours"
            />
            <Threshold
              label="T3 complaints escalate to T2"
              countName="t3_escalate_count"
              countValue={settings.t3_escalate_count}
              unitName="t3_escalate_days"
              unitValue={settings.t3_escalate_days}
              unit="days"
            />
            <p className="text-xs text-ink-faint">
              Each threshold has to be higher than the one above it, so a
              warning always comes before an escalation.
            </p>
            <SaveButton pending={pending} />
          </form>
        </CardBody>
      </Card>

      {/* -------------------------- targets -------------------------- */}
      <Card>
        <CardHeader
          title="KPI targets"
          subtitle="What good looks like. A figure without a target is data; against a target it is performance."
          action={<Saved shown={saved === "targets"} />}
        />
        <CardBody>
          <form
            onSubmit={submit("targets", saveTargetsAction)}
            className="flex flex-col gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(KPI_LABELS) as KpiKey[]).map((key) => {
                const t = targets[key];
                const isTrend = t?.direction === "down";
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <label
                      htmlFor={`target_${key}`}
                      className="min-w-0 text-sm text-ink"
                    >
                      {KPI_LABELS[key]}
                      {isTrend && (
                        <span className="block text-xs text-ink-faint">
                          Goal is a downward trend, not a number
                        </span>
                      )}
                    </label>
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        id={`target_${key}`}
                        name={`target_${key}`}
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={t?.target_pct ?? ""}
                        disabled={isTrend}
                        placeholder={isTrend ? "—" : ""}
                        className={`${numberControl} disabled:opacity-40`}
                      />
                      <span className="text-xs text-ink-faint">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveButton pending={pending} />
          </form>
        </CardBody>
      </Card>

      {/* ------------------------- categories ------------------------ */}
      <CategoriesCard categories={categories} onError={setError} />

      {/* ------------------------ operations ------------------------- */}
      <Card>
        <CardHeader
          title="Automation and retention"
          subtitle="What the system does on its own, and how long personal data is kept."
          action={<Saved shown={saved === "ops"} />}
        />
        <CardBody>
          <form
            onSubmit={submit("ops", saveOperationsAction)}
            className="flex flex-col gap-3"
          >
            <Toggle
              name="auto_acknowledge"
              defaultChecked={settings.auto_acknowledge}
              label="Acknowledge complaints automatically"
              hint="Emails the complainant their case number as soon as a complaint is logged, where an address is on file."
            />
            <Toggle
              name="weekly_report_enabled"
              defaultChecked={settings.weekly_report_enabled}
              label="Send the weekly report every Monday"
              hint="Goes to leadership and administrators with last week's complaints, SLA compliance and anything overdue."
            />
            <Toggle
              name="monthly_report_enabled"
              defaultChecked={settings.monthly_report_enabled}
              label="Send the monthly management report"
              hint="First day of each month, covering the month just ended."
            />
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <label
                htmlFor="retention_days"
                className="text-sm font-medium text-ink"
              >
                Keep complainant contact details for
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="retention_days"
                  name="retention_days"
                  type="number"
                  min="30"
                  defaultValue={settings.retention_days ?? ""}
                  placeholder="Indefinitely"
                  className={`${control} max-w-[12rem]`}
                />
                <span className="text-xs text-ink-faint">
                  days after closure
                </span>
              </div>
              <p className="text-xs text-ink-faint">
                The complaint, its investigation and its quality record are
                never deleted. Only the complainant&rsquo;s name, email and
                phone number are removed once this period has passed. Leave
                blank to keep them indefinitely.
              </p>
            </div>
            <SaveButton pending={pending} />
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function Threshold({
  label,
  countName,
  countValue,
  unitName,
  unitValue,
  unit,
}: {
  label: string;
  countName: string;
  countValue: number;
  unitName: string;
  unitValue: number;
  unit: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="min-w-[14rem] flex-1 text-ink">{label}</span>
      <input
        name={countName}
        type="number"
        min="1"
        defaultValue={countValue}
        className={numberControl}
        aria-label={`${label} — complaint count`}
      />
      <span className="text-xs text-ink-faint">complaints within</span>
      <input
        name={unitName}
        type="number"
        min="1"
        defaultValue={unitValue}
        className={numberControl}
        aria-label={`${label} — window`}
      />
      <span className="text-xs text-ink-faint">{unit}</span>
    </div>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-faint">{hint}</span>
      </span>
    </label>
  );
}

function CategoriesCard({
  categories,
  onError,
}: {
  categories: Category[];
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="Complaint categories"
        subtitle="What a complaint can be classified as. Retiring one keeps it on the complaints already filed under it."
      />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                c.is_active
                  ? "border-border bg-background text-ink"
                  : "border-dashed border-border text-ink-faint"
              }`}
            >
              {c.name}
              <button
                type="button"
                disabled={pending}
                title={
                  c.is_active
                    ? "Retire this category"
                    : "Bring this category back"
                }
                onClick={() =>
                  startTransition(async () => {
                    const result = await setCategoryActiveAction(
                      c.id,
                      !c.is_active,
                    );
                    if (!result.ok)
                      onError(result.error ?? "That didn't save.");
                  })
                }
                className="text-ink-faint hover:text-ink disabled:opacity-50"
              >
                {c.is_active ? (
                  <Archive className="h-3 w-3" />
                ) : (
                  <Undo2 className="h-3 w-3" />
                )}
              </button>
            </span>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await addCategoryAction(name);
              if (!result.ok) onError(result.error ?? "That didn't save.");
              else setName("");
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a category"
            className={`${control} max-w-[16rem]`}
            aria-label="New category name"
          />
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
