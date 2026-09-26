/**
 * Every `edoscrm_*` table name, spelled once. `src/lib/data/*` is the only
 * code that queries a table — nothing under `app/` or `components/` calls
 * Supabase directly. That's what makes tenant isolation reviewable (a dozen
 * files, not every call site) and what makes a future rename a one-file diff.
 */
export const TABLES = {
  tenants: "edoscrm_tenants",
  users: "edoscrm_users",
  departments: "edoscrm_departments",
  teams: "edoscrm_teams",
  memberships: "edoscrm_memberships",
  permissions: "edoscrm_permissions",
  roles: "edoscrm_roles",
  rolePermissions: "edoscrm_role_permissions",
  userRoles: "edoscrm_user_roles",
  platformAdmins: "edoscrm_platform_admins",
  auditLogs: "edoscrm_audit_logs",
  workflows: "edoscrm_workflows",
  workflowVersions: "edoscrm_workflow_versions",
  complaints: "edoscrm_complaints",
  complaintEvents: "edoscrm_complaint_events",
} as const;
