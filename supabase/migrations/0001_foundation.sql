-- EDOS CRM — Phase 2 foundation: tenants, users, org structure, RBAC, platform admin.
-- Lives in the shared "edos-pos" Supabase project (cnlyuwslpcgosgwdmzav) alongside
-- edos-poa / edospoa-posv1 / edoshatch360 / edospmis — additive only, edoscrm_* prefix,
-- never touches another product's tables (see ARCHITECTURE.md §2, §5).
--
-- This mirrors EDOSPMIS's proven tenancy/RBAC pattern (same project, verified live):
-- security-definer helper functions for RLS, platform admin as its own allow-list
-- table (never a column on the self-updatable users table — that would be
-- self-escalatable through the user's own update policy), RLS policies split by
-- operation instead of a single FOR ALL (avoids the "multiple permissive policies"
-- perf warning EDOSPMIS had to retrofit away), and a provision_tenant() function
-- that does signup-time seeding instead of ad hoc inserts from the client.

create table public.edoscrm_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  plan text not null default 'trial',
  timezone text not null default 'Africa/Nairobi',
  currency text not null default 'KES',
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.edoscrm_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  last_tenant_id uuid references public.edoscrm_tenants (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.edoscrm_departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.edoscrm_teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  department_id uuid references public.edoscrm_departments (id) on delete set null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.edoscrm_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.edoscrm_users (id) on delete cascade,
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  status text not null default 'invited',
  invited_by uuid references public.edoscrm_users (id) on delete set null,
  department_id uuid references public.edoscrm_departments (id) on delete set null,
  team_id uuid references public.edoscrm_teams (id) on delete set null,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table public.edoscrm_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null,
  description text not null
);

create table public.edoscrm_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.edoscrm_role_permissions (
  role_id uuid not null references public.edoscrm_roles (id) on delete cascade,
  permission_id uuid not null references public.edoscrm_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.edoscrm_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.edoscrm_users (id) on delete cascade,
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  role_id uuid not null references public.edoscrm_roles (id) on delete cascade,
  scope_type text not null default 'tenant',
  scope_id uuid,
  created_at timestamptz not null default now()
);

-- Allow-list, not a column on edoscrm_users — see note at top of file.
create table public.edoscrm_platform_admins (
  user_id uuid primary key references public.edoscrm_users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table public.edoscrm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  actor_id uuid references public.edoscrm_users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index edoscrm_memberships_user_idx on public.edoscrm_memberships (user_id);
create index edoscrm_memberships_tenant_idx on public.edoscrm_memberships (tenant_id);
create index edoscrm_user_roles_user_idx on public.edoscrm_user_roles (user_id);
create index edoscrm_user_roles_tenant_idx on public.edoscrm_user_roles (tenant_id);
create index edoscrm_audit_logs_tenant_idx on public.edoscrm_audit_logs (tenant_id, created_at desc);

alter table public.edoscrm_tenants enable row level security;
alter table public.edoscrm_users enable row level security;
alter table public.edoscrm_departments enable row level security;
alter table public.edoscrm_teams enable row level security;
alter table public.edoscrm_memberships enable row level security;
alter table public.edoscrm_permissions enable row level security;
alter table public.edoscrm_roles enable row level security;
alter table public.edoscrm_role_permissions enable row level security;
alter table public.edoscrm_user_roles enable row level security;
alter table public.edoscrm_platform_admins enable row level security;
alter table public.edoscrm_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer; left at default PUBLIC execute grant —
-- anon calls are harmless since auth.uid() is null for an unauthenticated caller).
-- ---------------------------------------------------------------------------

create function public.edoscrm_is_member(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from public.edoscrm_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create function public.edoscrm_has_permission(p_tenant_id uuid, p_permission_key text)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1
    from public.edoscrm_user_roles ur
    join public.edoscrm_role_permissions rp on rp.role_id = ur.role_id
    join public.edoscrm_permissions p on p.id = rp.permission_id
    join public.edoscrm_memberships m on m.user_id = ur.user_id and m.tenant_id = ur.tenant_id
    where ur.tenant_id = p_tenant_id
      and ur.user_id = auth.uid()
      and ur.scope_type = 'tenant'
      and m.status = 'active'
      and p.key = p_permission_key
  );
$$;

create function public.edoscrm_is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.edoscrm_platform_admins where user_id = auth.uid());
$$;

create function public.edoscrm_shares_tenant(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1
    from public.edoscrm_memberships mine
    join public.edoscrm_memberships theirs
      on theirs.tenant_id = mine.tenant_id and theirs.user_id = p_user_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.status in ('active', 'invited')
  );
$$;

-- Mirrors edospmis: no auth.users trigger. Called right after sign-in/sign-up
-- so a profile row and any pending invite both settle before anything else runs.
create function public.edoscrm_ensure_profile()
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.edoscrm_users (id, email, full_name, phone)
  select u.id, u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         coalesce(u.raw_user_meta_data ->> 'phone', u.phone)
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;

  update public.edoscrm_memberships
  set status = 'active'
  where user_id = auth.uid() and status = 'invited';
end;
$$;

-- Signup-time seeding: creates the tenant, makes the caller its administrator,
-- and seeds a lean two-role starting point. Deliberately not seeding
-- complaint-domain roles (Quality, Manufacturing, ...) yet — those permission
-- keys don't exist until the modules that check them are built (ARCHITECTURE.md
-- §13); adding roles for permissions nothing enforces yet is exactly the kind
-- of premature scaffolding worth avoiding.
create function public.edoscrm_provision_tenant(p_tenant_name text, p_tenant_slug text)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_role_admin uuid;
begin
  if exists (select 1 from public.edoscrm_tenants where slug = p_tenant_slug) then
    raise exception 'That workspace URL is already taken.' using errcode = 'unique_violation';
  end if;

  perform public.edoscrm_ensure_profile();

  insert into public.edoscrm_tenants (name, slug) values (p_tenant_name, p_tenant_slug)
  returning id into v_tenant_id;

  insert into public.edoscrm_memberships (user_id, tenant_id, status)
  values (auth.uid(), v_tenant_id, 'active');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Tenant Administrator', 'Full control of this workspace.', true)
  returning id into v_role_admin;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_admin, id from public.edoscrm_permissions;

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Member', 'Base access; permissions granted per module as they are enabled.', true);

  insert into public.edoscrm_user_roles (user_id, tenant_id, role_id, scope_type)
  values (auth.uid(), v_tenant_id, v_role_admin, 'tenant');

  update public.edoscrm_users set last_tenant_id = v_tenant_id where id = auth.uid();

  insert into public.edoscrm_audit_logs (tenant_id, actor_id, action, entity_type, entity_id, after)
  values (v_tenant_id, auth.uid(), 'tenant.provisioned', 'tenant', v_tenant_id,
          jsonb_build_object('name', p_tenant_name, 'slug', p_tenant_slug));

  return v_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed permission catalog — just what this migration's own RBAC/org screens
-- need to function. Each later module adds its own keys alongside the tables
-- it governs, not speculatively here.
-- ---------------------------------------------------------------------------

insert into public.edoscrm_permissions (key, category, description) values
  ('admin.org.manage', 'admin', 'Manage tenant settings, departments and teams'),
  ('admin.users.manage', 'admin', 'Invite, remove and reassign members'),
  ('admin.roles.manage', 'admin', 'Create and edit roles and their permissions'),
  ('admin.audit.view', 'admin', 'View the tenant audit log');

-- ---------------------------------------------------------------------------
-- RLS policies — split by operation (insert/update/delete), not a single
-- FOR ALL, from day one.
-- ---------------------------------------------------------------------------

create policy edoscrm_tenants_select on public.edoscrm_tenants for select
  using (public.edoscrm_is_member(id) or public.edoscrm_is_platform_admin());
create policy edoscrm_tenants_update on public.edoscrm_tenants for update
  using (public.edoscrm_has_permission(id, 'admin.org.manage'))
  with check (public.edoscrm_has_permission(id, 'admin.org.manage'));

create policy edoscrm_users_select on public.edoscrm_users for select
  using (id = auth.uid() or public.edoscrm_shares_tenant(id));
create policy edoscrm_users_update_self on public.edoscrm_users for update
  using (id = auth.uid());

create policy edoscrm_departments_select on public.edoscrm_departments for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_departments_insert on public.edoscrm_departments for insert
  with check (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));
create policy edoscrm_departments_update on public.edoscrm_departments for update
  using (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));
create policy edoscrm_departments_delete on public.edoscrm_departments for delete
  using (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));

create policy edoscrm_teams_select on public.edoscrm_teams for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_teams_insert on public.edoscrm_teams for insert
  with check (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));
create policy edoscrm_teams_update on public.edoscrm_teams for update
  using (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));
create policy edoscrm_teams_delete on public.edoscrm_teams for delete
  using (public.edoscrm_has_permission(tenant_id, 'admin.org.manage'));

create policy edoscrm_memberships_select on public.edoscrm_memberships for select
  using (public.edoscrm_is_member(tenant_id) or user_id = auth.uid());
create policy edoscrm_memberships_insert on public.edoscrm_memberships for insert
  with check (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));
create policy edoscrm_memberships_update on public.edoscrm_memberships for update
  using (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));
create policy edoscrm_memberships_delete on public.edoscrm_memberships for delete
  using (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));

create policy edoscrm_permissions_select on public.edoscrm_permissions for select
  using (auth.uid() is not null);

create policy edoscrm_roles_select on public.edoscrm_roles for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_roles_insert on public.edoscrm_roles for insert
  with check (public.edoscrm_has_permission(tenant_id, 'admin.roles.manage') and not is_system);
create policy edoscrm_roles_update on public.edoscrm_roles for update
  using (public.edoscrm_has_permission(tenant_id, 'admin.roles.manage') and not is_system)
  with check (public.edoscrm_has_permission(tenant_id, 'admin.roles.manage') and not is_system);
create policy edoscrm_roles_delete on public.edoscrm_roles for delete
  using (public.edoscrm_has_permission(tenant_id, 'admin.roles.manage') and not is_system);

create policy edoscrm_role_permissions_select on public.edoscrm_role_permissions for select
  using (exists (
    select 1 from public.edoscrm_roles r
    where r.id = edoscrm_role_permissions.role_id and public.edoscrm_is_member(r.tenant_id)
  ));
create policy edoscrm_role_permissions_insert on public.edoscrm_role_permissions for insert
  with check (exists (
    select 1 from public.edoscrm_roles r
    where r.id = edoscrm_role_permissions.role_id and public.edoscrm_has_permission(r.tenant_id, 'admin.roles.manage')
  ));
create policy edoscrm_role_permissions_update on public.edoscrm_role_permissions for update
  using (exists (
    select 1 from public.edoscrm_roles r
    where r.id = edoscrm_role_permissions.role_id and public.edoscrm_has_permission(r.tenant_id, 'admin.roles.manage')
  ))
  with check (exists (
    select 1 from public.edoscrm_roles r
    where r.id = edoscrm_role_permissions.role_id and public.edoscrm_has_permission(r.tenant_id, 'admin.roles.manage')
  ));
create policy edoscrm_role_permissions_delete on public.edoscrm_role_permissions for delete
  using (exists (
    select 1 from public.edoscrm_roles r
    where r.id = edoscrm_role_permissions.role_id and public.edoscrm_has_permission(r.tenant_id, 'admin.roles.manage')
  ));

create policy edoscrm_user_roles_select on public.edoscrm_user_roles for select
  using (public.edoscrm_is_member(tenant_id) or user_id = auth.uid());
create policy edoscrm_user_roles_insert on public.edoscrm_user_roles for insert
  with check (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));
create policy edoscrm_user_roles_update on public.edoscrm_user_roles for update
  using (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));
create policy edoscrm_user_roles_delete on public.edoscrm_user_roles for delete
  using (public.edoscrm_has_permission(tenant_id, 'admin.users.manage'));

create policy edoscrm_platform_admins_select on public.edoscrm_platform_admins for select
  using (user_id = auth.uid());

create policy edoscrm_audit_logs_select on public.edoscrm_audit_logs for select
  using (public.edoscrm_has_permission(tenant_id, 'admin.audit.view'));
