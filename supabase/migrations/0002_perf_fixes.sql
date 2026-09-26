-- Fixes two perf-advisor findings on migration 0001, both caught immediately
-- rather than left to retrofit (EDOSPMIS had to retrofit the RLS-multiple-
-- policy version of this same class of issue):
--
-- 1. Six policies called auth.uid() directly, which Postgres re-evaluates
--    per row; EDOSPMIS's own live policies already use the wrapped
--    `(select auth.uid())` form so the planner evaluates it once. Recreated
--    below to match.
-- 2. Eleven foreign keys had no covering index.

drop policy edoscrm_users_select on public.edoscrm_users;
create policy edoscrm_users_select on public.edoscrm_users for select
  using (id = (select auth.uid()) or public.edoscrm_shares_tenant(id));

drop policy edoscrm_users_update_self on public.edoscrm_users;
create policy edoscrm_users_update_self on public.edoscrm_users for update
  using (id = (select auth.uid()));

drop policy edoscrm_memberships_select on public.edoscrm_memberships;
create policy edoscrm_memberships_select on public.edoscrm_memberships for select
  using (public.edoscrm_is_member(tenant_id) or user_id = (select auth.uid()));

drop policy edoscrm_permissions_select on public.edoscrm_permissions;
create policy edoscrm_permissions_select on public.edoscrm_permissions for select
  using ((select auth.uid()) is not null);

drop policy edoscrm_user_roles_select on public.edoscrm_user_roles;
create policy edoscrm_user_roles_select on public.edoscrm_user_roles for select
  using (public.edoscrm_is_member(tenant_id) or user_id = (select auth.uid()));

drop policy edoscrm_platform_admins_select on public.edoscrm_platform_admins;
create policy edoscrm_platform_admins_select on public.edoscrm_platform_admins for select
  using (user_id = (select auth.uid()));

create index edoscrm_audit_logs_actor_idx on public.edoscrm_audit_logs (actor_id);
create index edoscrm_departments_tenant_idx on public.edoscrm_departments (tenant_id);
create index edoscrm_memberships_department_idx on public.edoscrm_memberships (department_id);
create index edoscrm_memberships_invited_by_idx on public.edoscrm_memberships (invited_by);
create index edoscrm_memberships_team_idx on public.edoscrm_memberships (team_id);
create index edoscrm_role_permissions_permission_idx on public.edoscrm_role_permissions (permission_id);
create index edoscrm_roles_tenant_idx on public.edoscrm_roles (tenant_id);
create index edoscrm_teams_department_idx on public.edoscrm_teams (department_id);
create index edoscrm_teams_tenant_idx on public.edoscrm_teams (tenant_id);
create index edoscrm_user_roles_role_idx on public.edoscrm_user_roles (role_id);
create index edoscrm_users_last_tenant_idx on public.edoscrm_users (last_tenant_id);
