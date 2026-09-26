-- EDOS CRM — Phase 6: SLA engine. Rules are data (brief §39 explicitly asks
-- for these to be configurable, not hard-coded), one row per severity per
-- tenant. Status itself (on-track/at-risk/overdue) is never stored — it's
-- computed at render time from now() vs. the rule (ARCHITECTURE.md §12) —
-- so nothing here needs a cron job yet. 0 tenants exist (verified), so only
-- edoscrm_provision_tenant (recreated below) needs to know about this table.

create table public.edoscrm_sla_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  severity text not null check (severity in ('T1', 'T2', 'T3')),
  -- Deadline to leave the workflow's first stage (brief's "acknowledgement"/
  -- "notification" window). Coupled to the 'received' stage key from the
  -- default workflow (migration 0003) rather than modelled generically —
  -- fine while every tenant runs that one seeded workflow (ARCHITECTURE.md
  -- §13); worth revisiting once workflows are actually customisable.
  acknowledgement_minutes integer not null,
  -- Deadline to reach the 'capa' stage (i.e. RCA done). Null for T3, per
  -- brief §39's "weekly review" rather than a hard deadline.
  rca_minutes integer,
  created_at timestamptz not null default now(),
  unique (tenant_id, severity)
);

create index edoscrm_sla_rules_tenant_idx on public.edoscrm_sla_rules (tenant_id);

alter table public.edoscrm_sla_rules enable row level security;

create policy edoscrm_sla_rules_select on public.edoscrm_sla_rules for select
  using (public.edoscrm_is_member(tenant_id));

-- Recreated in full to add SLA-rule seeding; everything else identical to
-- migration 0003.
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

  -- brief §39 defaults: T1 ack within 1h / RCA within 48h; T2 ack within
  -- 24h / RCA within 5 business days (approximated as 7200 min = 5 x 24h,
  -- business-day precision not worth modelling yet); T3 ack within 24h, no
  -- firm RCA deadline (weekly review instead).
  insert into public.edoscrm_sla_rules (tenant_id, severity, acknowledgement_minutes, rca_minutes) values
    (v_tenant_id, 'T1', 60, 2880),
    (v_tenant_id, 'T2', 1440, 7200),
    (v_tenant_id, 'T3', 1440, null);

  insert into public.edoscrm_audit_logs (tenant_id, actor_id, action, entity_type, entity_id, after)
  values (v_tenant_id, auth.uid(), 'tenant.provisioned', 'tenant', v_tenant_id,
          jsonb_build_object('name', p_tenant_name, 'slug', p_tenant_slug));

  return v_tenant_id;
end;
$$;
