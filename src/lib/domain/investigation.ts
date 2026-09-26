export type RootCauseCategory = "machine" | "method" | "material" | "man" | "measurement" | "environment" | "other";

/** Classic 5M+1 framework (see migration 0007 for why this stays a fixed
 * list rather than a tenant-configurable taxonomy). */
export const ROOT_CAUSE_CATEGORIES: { key: RootCauseCategory; label: string }[] = [
  { key: "machine", label: "Machine" },
  { key: "method", label: "Method" },
  { key: "material", label: "Material" },
  { key: "man", label: "Man / People" },
  { key: "measurement", label: "Measurement" },
  { key: "environment", label: "Environment" },
  { key: "other", label: "Other" },
];

export type CapaStatus = "open" | "in_progress" | "verified" | "closed";

export const CAPA_STATUSES: { key: CapaStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "verified", label: "Verified" },
  { key: "closed", label: "Closed" },
];
