import { defineConfig } from "vitest/config";
import path from "node:path";

/** Unit tests cover the pure domain rules — SLA status, escalation thresholds,
 * export writers. Anything that touches Supabase is verified against the
 * running app instead, where the RLS policies are real. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
