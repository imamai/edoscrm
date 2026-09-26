-- EDOS CRM — Phase 3 (cases + event log) and Phase 4 (workflow engine) together,
-- since Phase 4 wires the workflow engine to cases that Phase 3 creates.
--
-- Workflows are data (ARCHITECTURE.md §10): a workflow version pins a JSON
-- stage list, exactly like EDOSPMIS's edospmis_workflow_versions.definition —
-- proven pattern, reused rather than the more elaborate normalised
-- transitions/conditions tables from the brief's ceiling schema (§7), which
-- stay deferred until something actually needs a transition *rule*, not just
-- an ordered stage list. No tenants exist yet (verified: 0 rows), so this
-- migration needs no backfill — only edoscrm_provision_tenant (recreated at
-- the bottom) needs to know about the new tables, for tenants created after
-- this point.

alter table public.edoscrm_tenants
  add column case_sequence bigint not null default 0,
  add column numbering_format text not null default 'CASE-{year}-{seq}';

create table public.edoscrm_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.edoscrm_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.edoscrm_workflows (id) on delete cascade,
  version_number integer not null,
  -- {"stages": [{"key": "received", "label": "Received"}, ...]}
  definition jsonb not null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version_number)
);

create table public.edoscrm_complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  case_number text not null,
  title text not null,
  description text,
  -- brief §38's T1/T2/T3 severity — preserved verbatim, it's load-bearing
  -- for SLA rules (§12) and escalation counts later, not cosmetic.
  severity text not null default 'T3' check (severity in ('T1', 'T2', 'T3')),
  workflow_version_id uuid not null references public.edoscrm_workflow_versions (id),
  -- Authoritative lifecycle position — no separate status column. "closed"
  -- is a stage like any other (current_stage_key = 'closed'), not a second
  -- source of truth alongside it. Preserves the brief's Received/In
  -- Progress/.../Closed vocabulary (§38) as stage labels rather than an
  -- independently-tracked field.
  current_stage_key text not null,
  assignee_id uuid references public.edoscrm_users (id) on delete set null,
  department_id uuid references public.edoscrm_departments (id) on delete set null,
  created_by uuid not null references public.edoscrm_users (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (tenant_id, case_number)
);

create table public.edoscrm_complaint_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null references public.edoscrm_complaints (id) on delete cascade,
  actor_id uuid references public.edoscrm_users (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index edoscrm_workflows_tenant_idx on public.edoscrm_workflows (tenant_id);
create index edoscrm_workflow_versions_workflow_idx on public.edoscrm_workflow_versions (workflow_id);
create index edoscrm_complaints_tenant_idx on public.edoscrm_complaints (tenant_id, created_at desc);
create index edoscrm_complaints_workflow_version_idx on public.edoscrm_complaints (workflow_version_id);
create index edoscrm_complaints_assignee_idx on public.edoscrm_complaints (assignee_id);
create index edoscrm_complaints_department_idx on public.edoscrm_complaints (department_id);
create index edoscrm_complaints_created_by_idx on public.edoscrm_complaints (created_by);
create index edoscrm_complaint_events_complaint_idx on public.edoscrm_complaint_events (complaint_id, created_at);
create index edoscrm_complaint_events_actor_idx on public.edoscrm_complaint_events (actor_id);

alter table public.edoscrm_workflows enable row level security;
alter table public.edoscrm_workflow_versions enable row level security;
alter table public.edoscrm_complaints enable row level security;
alter table public.edoscrm_complaint_events enable row level security;

create function public.edoscrm_next_case_number(p_tenant_id uuid)
returns text
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_seq bigint;
  v_format text;
  v_number text;
begin
  if not public.edoscrm_is_member(p_tenant_id) then
    raise exception 'Not authorized.';
  end if;

  update public.edoscrm_tenants
  set case_sequence = case_sequence + 1
  where id = p_tenant_id
  returning case_sequence, numbering_format into v_seq, v_format;

  v_number := replace(v_format, '{year}', extract(year from now())::text);
  v_number := replace(v_number, '{seq}', lpad(v_seq::text, 6, '0'));
  return v_number;
end;
$$;

insert into public.edoscrm_permissions (key, category, description) values
  ('complaints.create', 'complaints', 'Log a new complaint'),
  ('complaints.manage', 'complaints', 'Advance a complaint''s stage, assign it, edit its details');

create policy edoscrm_workflows_select on public.edoscrm_workflows for select
  using (public.edoscrm_is_member(tenant_id));

create policy edoscrm_workflow_versions_select on public.edoscrm_workflow_versions for select
  using (exists (
    select 1 from public.edoscrm_workflows w
    where w.id = edoscrm_workflow_versions.workflow_id and public.edoscrm_is_member(w.tenant_id)
  ));

-- Visibility deliberately broad for now (any tenant member sees every
-- complaint) — narrowing to assignment/department scope is a real product
-- decision (who's allowed to see a complaint they're not on) worth making
-- once there's a real second role to design it against, not guessed here.
create policy edoscrm_complaints_select on public.edoscrm_complaints for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaints_insert on public.edoscrm_complaints for insert
  with check (public.edoscrm_has_permission(tenant_id, 'complaints.create'));
create policy edoscrm_complaints_update on public.edoscrm_complaints for update
  using (public.edoscrm_has_permission(tenant_id, 'complaints.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'complaints.manage'));

create policy edoscrm_complaint_events_select on public.edoscrm_complaint_events for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaint_events_insert on public.edoscrm_complaint_events for insert
  with check (
    public.edoscrm_is_member(tenant_id)
    and (actor_id = (select auth.uid()) or actor_id is null)
  );

-- Recreated in full (Postgres functions aren't patched incrementally) to add
-- default-workflow seeding; everything else is identical to migration 0001.
create or replace function public.edoscrm_provision_tenant(p_tenant_name text, p_tenant_slug text)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_role_admin uuid;
  v_workflow_id uuid;
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

  insert into public.edoscrm_workflows (tenant_id, name, is_default)
  values (v_tenant_id, 'Standard Complaint Handling', true)
  returning id into v_workflow_id;

  insert into public.edoscrm_workflow_versions (workflow_id, version_number, definition)
  values (v_workflow_id, 1, jsonb_build_object(
    'stages', jsonb_build_array(
      jsonb_build_object('key', 'received', 'label', 'Received'),
      jsonb_build_object('key', 'triage', 'label', 'Triage'),
      jsonb_build_object('key', 'investigating', 'label', 'Investigating'),
      jsonb_build_object('key', 'rca', 'label', 'RCA'),
      jsonb_build_object('key', 'capa', 'label', 'CAPA'),
      jsonb_build_object('key', 'resolution', 'label', 'Resolution'),
      jsonb_build_object('key', 'communicate', 'label', 'Communicate'),
      jsonb_build_object('key', 'closed', 'label', 'Closed')
    )
  ));

  insert into public.edoscrm_audit_logs (tenant_id, actor_id, action, entity_type, entity_id, after)
  values (v_tenant_id, auth.uid(), 'tenant.provisioned', 'tenant', v_tenant_id,
          jsonb_build_object('name', p_tenant_name, 'slug', p_tenant_slug));

  return v_tenant_id;
end;
$$;
