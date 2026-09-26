// Plain data, no "server-only" — importable from client components
// (complaint-form.tsx) without pulling the Supabase server client into the
// browser bundle the way importing it from lib/data/complaints.ts did.
export const COMPLAINT_CATEGORIES = [
  "Product quality",
  "Foreign object",
  "Packaging",
  "Labelling",
  "Delivery / logistics",
  "Customer service",
  "Pricing / billing",
  "Other",
];
