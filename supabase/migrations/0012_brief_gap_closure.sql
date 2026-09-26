-- Closes the gaps found auditing the codebase against the original CRM
-- brief (crm-word/Complaint Management System.docx): product/batch data,
-- attachments, communications, compensation, closure control, notifications,
-- and role differentiation. See README/audit table for the full context —
-- this migration is the schema half; the app layer follows in the same
-- change set.

-- ---------------------------------------------------------------------
-- 1. Product/batch/category fields the brief's §6 "Required fields" and
--    §"Batch grouping" need — the single biggest gap, since escalation
--    patterns and "related batch complaints" visibility both read off this.
--    pending_information mirrors EDOSPMIS's on_hold/blocked pattern: a
--    cross-cutting flag rather than forcing the brief's "Pending
--    Information" into the linear stage list, which would have meant
--    renaming stages out from under every already-seeded complaint.
-- ---------------------------------------------------------------------
alter table public.edoscrm_complaints
  add column category text,
  add column product_name text,
  add column sku text,
  add column batch_number text,
  add column production_date date,
  add column expiry_date date,
  add column purchase_details text,
  add column pending_information boolean not null default false,
  add column pending_information_reason text,
  add column severity_override_reason text,
  add column closure_note text;

create index edoscrm_complaints_batch_idx on public.edoscrm_complaints (tenant_id, sku, batch_number)
  where batch_number is not null;

-- ---------------------------------------------------------------------
-- 2. Attachments (§6 "Attachments") — Storage object metadata; the actual
--    bytes live in a Supabase Storage bucket (created below), this table
--    is what makes an upload show up on the complaint and RLS-checkable.
-- ---------------------------------------------------------------------
create table public.edoscrm_complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null references public.edoscrm_complaints (id) on delete cascade,
  uploaded_by uuid references public.edoscrm_users (id) on delete set null,
  file_name text not null,
  storage_path text not null,
  content_type text,
  created_at timestamptz not null default now()
);
create index edoscrm_complaint_attachments_complaint_idx on public.edoscrm_complaint_attachments (complaint_id);
alter table public.edoscrm_complaint_attachments enable row level security;
create policy edoscrm_complaint_attachments_select on public.edoscrm_complaint_attachments for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaint_attachments_insert on public.edoscrm_complaint_attachments for insert
  with check (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaint_attachments_delete on public.edoscrm_complaint_attachments for delete
  using (public.edoscrm_has_permission(tenant_id, 'complaints.manage'));

insert into storage.buckets (id, name, public)
  values ('edoscrm-attachments', 'edoscrm-attachments', false)
  on conflict (id) do nothing;

create policy edoscrm_attachments_storage_select on storage.objects for select
  using (bucket_id = 'edoscrm-attachments' and public.edoscrm_is_member((storage.foldername(name))[1]::uuid));
create policy edoscrm_attachments_storage_insert on storage.objects for insert
  with check (bucket_id = 'edoscrm-attachments' and public.edoscrm_is_member((storage.foldername(name))[1]::uuid));
create policy edoscrm_attachments_storage_delete on storage.objects for delete
  using (bucket_id = 'edoscrm-attachments' and public.edoscrm_has_permission((storage.foldername(name))[1]::uuid, 'complaints.manage'));

-- ---------------------------------------------------------------------
-- 3. Customer communication log (§6 "Customer communication")
-- ---------------------------------------------------------------------
create table public.edoscrm_complaint_communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null references public.edoscrm_complaints (id) on delete cascade,
  actor_id uuid references public.edoscrm_users (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  channel text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index edoscrm_complaint_communications_complaint_idx on public.edoscrm_complaint_communications (complaint_id, created_at);
alter table public.edoscrm_complaint_communications enable row level security;
create policy edoscrm_complaint_communications_select on public.edoscrm_complaint_communications for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaint_communications_insert on public.edoscrm_complaint_communications for insert
  with check (public.edoscrm_is_member(tenant_id) and (actor_id = (select auth.uid()) or actor_id is null));

-- ---------------------------------------------------------------------
-- 4. Compensation tracking (§6 "Compensation") — hamper or credit note,
--    approval and fulfilment, traceable to the case (§9 business rule).
-- ---------------------------------------------------------------------
create table public.edoscrm_complaint_compensations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null references public.edoscrm_complaints (id) on delete cascade,
  type text not null check (type in ('hamper', 'credit_note', 'other')),
  amount_cents bigint,
  status text not null default 'requested' check (status in ('requested', 'approved', 'fulfilled', 'declined')),
  requested_by uuid references public.edoscrm_users (id) on delete set null,
  approved_by uuid references public.edoscrm_users (id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);
create index edoscrm_complaint_compensations_complaint_idx on public.edoscrm_complaint_compensations (complaint_id);
alter table public.edoscrm_complaint_compensations enable row level security;
create policy edoscrm_complaint_compensations_select on public.edoscrm_complaint_compensations for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_complaint_compensations_insert on public.edoscrm_complaint_compensations for insert
  with check (public.edoscrm_has_permission(tenant_id, 'complaints.compensation.request'));
create policy edoscrm_complaint_compensations_update on public.edoscrm_complaint_compensations for update
  using (public.edoscrm_has_permission(tenant_id, 'complaints.compensation.approve'))
  with check (public.edoscrm_has_permission(tenant_id, 'complaints.compensation.approve'));

-- ---------------------------------------------------------------------
-- 5. In-app notifications (§6 "Notifications") — no transactional email
--    provider is configured for this project, so this is the honest,
--    fully-working half of that requirement; email delivery is a follow-on
--    once a provider key exists, not fabricated here.
-- ---------------------------------------------------------------------
create table public.edoscrm_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  user_id uuid not null references public.edoscrm_users (id) on delete cascade,
  complaint_id uuid references public.edoscrm_complaints (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index edoscrm_notifications_user_idx on public.edoscrm_notifications (user_id, read_at, created_at desc);
alter table public.edoscrm_notifications enable row level security;
create policy edoscrm_notifications_select on public.edoscrm_notifications for select
  using (user_id = (select auth.uid()));
create policy edoscrm_notifications_update on public.edoscrm_notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Broad insert, matching the project's own "visibility deliberately broad
-- for now" precedent on complaints_select — creating a notification is
-- routinely done on another member's behalf (assigning them a case, an SLA
-- breach alert), not just for oneself.
create policy edoscrm_notifications_insert on public.edoscrm_notifications for insert
  with check (public.edoscrm_is_member(tenant_id));

-- ---------------------------------------------------------------------
-- 6. New permission keys
-- ---------------------------------------------------------------------
insert into public.edoscrm_permissions (key, category, description) values
  ('complaints.assign', 'complaints', 'Assign a complaint to a team member'),
  ('complaints.severity.override', 'complaints', 'Override a complaint''s severity with a recorded reason'),
  ('complaints.close', 'complaints', 'Close a complaint once corrective action is confirmed in writing'),
  ('complaints.compensation.request', 'complaints', 'Request compensation (hamper or credit note) for a complaint'),
  ('complaints.compensation.approve', 'complaints', 'Approve, decline or fulfil a compensation request'),
  ('complaints.export', 'complaints', 'Export complaint data and reports'),
  ('complaints.import', 'complaints', 'Import historical complaints from a file');

-- ---------------------------------------------------------------------
-- 7. Named roles matching the brief's §4 role table, seeded for every
--    existing tenant and folded into edoscrm_provision_tenant for future
--    ones. Report-only/Leadership get no extra permissions beyond the
--    Member baseline — the complaints_select policy is already
--    tenant-wide, so "read everything, write nothing" falls out of simply
--    holding no write permission, no separate visibility rule needed.
-- ---------------------------------------------------------------------
do $$
declare
  v_tenant record;
  v_role_id uuid;
begin
  for v_tenant in select id from public.edoscrm_tenants loop
    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Marketing Operations', 'Process owner: intake, triage, assignment, communication, compensation, closure.', true)
    returning id into v_role_id;
    insert into public.edoscrm_role_permissions (role_id, permission_id)
    select v_role_id, id from public.edoscrm_permissions
    where key in ('complaints.create', 'complaints.manage', 'complaints.assign', 'complaints.severity.override',
                  'complaints.close', 'complaints.compensation.request', 'complaints.export', 'complaints.import',
                  'admin.audit.view');

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Quality', 'Investigation, root-cause analysis and CAPA ownership.', true)
    returning id into v_role_id;
    insert into public.edoscrm_role_permissions (role_id, permission_id)
    select v_role_id, id from public.edoscrm_permissions
    where key in ('complaints.manage', 'complaints.severity.override', 'investigations.manage');

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Manufacturing', 'Batch records and corrective-action implementation.', true)
    returning id into v_role_id;
    insert into public.edoscrm_role_permissions (role_id, permission_id)
    select v_role_id, id from public.edoscrm_permissions
    where key in ('complaints.manage', 'investigations.manage');

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Sales', 'Raises trade complaints and manages customer communication.', true)
    returning id into v_role_id;
    insert into public.edoscrm_role_permissions (role_id, permission_id)
    select v_role_id, id from public.edoscrm_permissions
    where key in ('complaints.create');

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Finance', 'Processes approved trade credit notes.', true)
    returning id into v_role_id;
    insert into public.edoscrm_role_permissions (role_id, permission_id)
    select v_role_id, id from public.edoscrm_permissions
    where key in ('complaints.compensation.approve');

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Leadership', 'Read-only visibility across dashboards and reports.', true);

    insert into public.edoscrm_roles (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Report Only', 'Read-only access, no write permissions.', true);
  end loop;
end;
$$;

create or replace function public.edoscrm_provision_tenant(p_tenant_name text, p_tenant_slug text)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_role_admin uuid;
  v_role_id uuid;
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

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Marketing Operations', 'Process owner: intake, triage, assignment, communication, compensation, closure.', true)
  returning id into v_role_id;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_id, id from public.edoscrm_permissions
  where key in ('complaints.create', 'complaints.manage', 'complaints.assign', 'complaints.severity.override',
                'complaints.close', 'complaints.compensation.request', 'complaints.export', 'complaints.import',
                'admin.audit.view');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Quality', 'Investigation, root-cause analysis and CAPA ownership.', true)
  returning id into v_role_id;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_id, id from public.edoscrm_permissions
  where key in ('complaints.manage', 'complaints.severity.override', 'investigations.manage');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Manufacturing', 'Batch records and corrective-action implementation.', true)
  returning id into v_role_id;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_id, id from public.edoscrm_permissions
  where key in ('complaints.manage', 'investigations.manage');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Sales', 'Raises trade complaints and manages customer communication.', true)
  returning id into v_role_id;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_id, id from public.edoscrm_permissions where key in ('complaints.create');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Finance', 'Processes approved trade credit notes.', true)
  returning id into v_role_id;
  insert into public.edoscrm_role_permissions (role_id, permission_id)
  select v_role_id, id from public.edoscrm_permissions where key in ('complaints.compensation.approve');

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Leadership', 'Read-only visibility across dashboards and reports.', true);

  insert into public.edoscrm_roles (tenant_id, name, description, is_system)
  values (v_tenant_id, 'Report Only', 'Read-only access, no write permissions.', true);

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

revoke execute on function public.edoscrm_provision_tenant(text, text) from anon;
revoke execute on function public.edoscrm_provision_tenant(text, text) from public;
