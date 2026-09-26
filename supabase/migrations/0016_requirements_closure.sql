-- Schema for every requirement the 26 Sep 2026 compliance audit left Partial
-- or Not built. One migration, because most of these depend on each other:
-- the complainant record is what acknowledgement emails address, the stored
-- timestamps are what the KPIs read, and the settings table is what makes the
-- escalation rules configurable rather than compiled in.
--
-- Covers: contacts (CRM), acknowledged/resolved/informed timestamps, per-
-- workspace settings for escalation thresholds and retention, tenant-defined
-- categories, SLA resolution-plan deadline plus the missing T3 rule, KPI
-- targets, product hold/release/withdrawal/recall approvals, approved RCA/CAPA
-- summaries and their share log, inbound email-to-case, credit-note reference,
-- complainant satisfaction, and scheduled report runs.

-- ---------------------------------------------------------------------------
-- 1. Contacts — the complainant as a record, not free text on a case.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  -- Normalised to digits only so "+254 712 345 678" and "0712345678" are the
  -- same person. Kenyan numbers are stored however they were typed; this is
  -- only the matching key.
  phone_key text generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored,
  email_key text generated always as (nullif(lower(trim(coalesce(email, ''))), '')) stored,
  type text not null default 'consumer' check (type in ('consumer', 'trade', 'distributor')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists edoscrm_contacts_email_uq on public.edoscrm_contacts (tenant_id, email_key) where email_key is not null;
create unique index if not exists edoscrm_contacts_phone_uq on public.edoscrm_contacts (tenant_id, phone_key) where phone_key is not null;
create index if not exists edoscrm_contacts_tenant_idx on public.edoscrm_contacts (tenant_id);

alter table public.edoscrm_contacts enable row level security;
drop policy if exists edoscrm_contacts_select on public.edoscrm_contacts;
create policy edoscrm_contacts_select on public.edoscrm_contacts for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_contacts_insert on public.edoscrm_contacts;
create policy edoscrm_contacts_insert on public.edoscrm_contacts for insert with check (public.edoscrm_has_permission(tenant_id, 'complaints.create'));
drop policy if exists edoscrm_contacts_update on public.edoscrm_contacts;
create policy edoscrm_contacts_update on public.edoscrm_contacts for update using (public.edoscrm_has_permission(tenant_id, 'contacts.manage'));

-- ---------------------------------------------------------------------------
-- 2. Complaint: the timestamps every time-based KPI needs, plus the contact
--    link and the post-closure satisfaction capture.
--
--    These exist because the KPIs previously read *current* state: the
--    acknowledgement figure described this moment and could not be reported
--    for last week. An indicator that cannot be reported for a past period is
--    not an indicator.
-- ---------------------------------------------------------------------------
alter table public.edoscrm_complaints
  add column if not exists contact_id uuid references public.edoscrm_contacts(id) on delete set null,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists complainant_informed_at timestamptz,
  add column if not exists satisfaction_rating int check (satisfaction_rating between 1 and 5),
  add column if not exists satisfaction_comment text,
  add column if not exists satisfaction_at timestamptz;

create index if not exists edoscrm_complaints_contact_idx on public.edoscrm_complaints (contact_id);
create index if not exists edoscrm_complaints_assignee_idx on public.edoscrm_complaints (tenant_id, assignee_id);
create index if not exists edoscrm_complaints_batch_idx on public.edoscrm_complaints (tenant_id, sku, batch_number);

-- ---------------------------------------------------------------------------
-- 3. Per-workspace settings: escalation thresholds (§6 asks for these to be
--    configurable), retention, and report cadence.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_tenant_settings (
  tenant_id uuid primary key references public.edoscrm_tenants(id) on delete cascade,
  warn_count int not null default 2,
  warn_hours int not null default 48,
  escalate_count int not null default 3,
  escalate_hours int not null default 48,
  mandatory_rca_count int not null default 5,
  mandatory_rca_hours int not null default 72,
  withdrawal_count int not null default 10,
  withdrawal_hours int not null default 72,
  t3_escalate_count int not null default 3,
  t3_escalate_days int not null default 7,
  -- null means keep indefinitely. Anything else purges complainant contact
  -- details on closed cases older than this.
  retention_days int,
  weekly_report_enabled boolean not null default true,
  monthly_report_enabled boolean not null default true,
  -- Acknowledge the complainant automatically when a case is logged.
  auto_acknowledge boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.edoscrm_tenant_settings enable row level security;
drop policy if exists edoscrm_tenant_settings_select on public.edoscrm_tenant_settings;
create policy edoscrm_tenant_settings_select on public.edoscrm_tenant_settings for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_tenant_settings_write on public.edoscrm_tenant_settings;
create policy edoscrm_tenant_settings_write on public.edoscrm_tenant_settings for all
  using (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'));

-- ---------------------------------------------------------------------------
-- 4. Tenant-defined complaint categories, replacing a hard-coded list.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.edoscrm_categories enable row level security;
drop policy if exists edoscrm_categories_select on public.edoscrm_categories;
create policy edoscrm_categories_select on public.edoscrm_categories for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_categories_write on public.edoscrm_categories;
create policy edoscrm_categories_write on public.edoscrm_categories for all
  using (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'));

-- ---------------------------------------------------------------------------
-- 5. SLA: the T2 "resolution plan within 48 hours" deadline the brief names
--    separately from RCA, and write access so rules can be edited.
-- ---------------------------------------------------------------------------
alter table public.edoscrm_sla_rules
  add column if not exists resolution_plan_minutes int;

drop policy if exists edoscrm_sla_rules_write on public.edoscrm_sla_rules;
create policy edoscrm_sla_rules_write on public.edoscrm_sla_rules for all
  using (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'));

-- ---------------------------------------------------------------------------
-- 6. KPI targets — §7 sets explicit ones. Without a stored target a number is
--    data, not performance information.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_kpi_targets (
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  key text not null,
  target_pct numeric,
  -- 'gte' good when at or above target, 'lte' good when at or below,
  -- 'down' no fixed target, a downward trend is the goal.
  direction text not null default 'gte' check (direction in ('gte', 'lte', 'down')),
  primary key (tenant_id, key)
);
alter table public.edoscrm_kpi_targets enable row level security;
drop policy if exists edoscrm_kpi_targets_select on public.edoscrm_kpi_targets;
create policy edoscrm_kpi_targets_select on public.edoscrm_kpi_targets for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_kpi_targets_write on public.edoscrm_kpi_targets;
create policy edoscrm_kpi_targets_write on public.edoscrm_kpi_targets for all
  using (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'admin.settings.manage'));

-- ---------------------------------------------------------------------------
-- 7. Product hold / release / withdrawal / recall — §4 "Approval for product
--    hold, release, withdrawal or recall decisions". The most consequential
--    decision in the process and the one most likely to be audited after.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_product_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  sku text,
  batch_number text,
  product_name text,
  action text not null check (action in ('hold', 'release', 'withdrawal', 'recall')),
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined')),
  decision_note text,
  -- The complaints cited as evidence, so the decision keeps its basis.
  complaint_ids uuid[] not null default '{}',
  requested_by uuid references public.edoscrm_users(id),
  approved_by uuid references public.edoscrm_users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists edoscrm_product_actions_tenant_idx on public.edoscrm_product_actions (tenant_id, created_at desc);
alter table public.edoscrm_product_actions enable row level security;
drop policy if exists edoscrm_product_actions_select on public.edoscrm_product_actions;
create policy edoscrm_product_actions_select on public.edoscrm_product_actions for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_product_actions_insert on public.edoscrm_product_actions;
create policy edoscrm_product_actions_insert on public.edoscrm_product_actions for insert
  with check (public.edoscrm_has_permission(tenant_id, 'product.action.request'));
drop policy if exists edoscrm_product_actions_update on public.edoscrm_product_actions;
create policy edoscrm_product_actions_update on public.edoscrm_product_actions for update
  using (public.edoscrm_has_permission(tenant_id, 'product.action.approve'));

-- ---------------------------------------------------------------------------
-- 8. Approved RCA/CAPA summaries and a log of every external share — §4/§9
--    permit sharing an approved summary only, with raw notes staying internal.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_rca_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  complaint_id uuid not null references public.edoscrm_complaints(id) on delete cascade,
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_by uuid references public.edoscrm_users(id),
  approved_by uuid references public.edoscrm_users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (complaint_id)
);
alter table public.edoscrm_rca_summaries enable row level security;
drop policy if exists edoscrm_rca_summaries_select on public.edoscrm_rca_summaries;
create policy edoscrm_rca_summaries_select on public.edoscrm_rca_summaries for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_rca_summaries_insert on public.edoscrm_rca_summaries;
create policy edoscrm_rca_summaries_insert on public.edoscrm_rca_summaries for insert
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));
drop policy if exists edoscrm_rca_summaries_update on public.edoscrm_rca_summaries;
create policy edoscrm_rca_summaries_update on public.edoscrm_rca_summaries for update
  using (public.edoscrm_has_permission(tenant_id, 'rca.summary.approve'));

create table if not exists public.edoscrm_rca_summary_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  summary_id uuid not null references public.edoscrm_rca_summaries(id) on delete cascade,
  shared_with text not null,
  note text,
  shared_by uuid references public.edoscrm_users(id),
  created_at timestamptz not null default now()
);
alter table public.edoscrm_rca_summary_shares enable row level security;
drop policy if exists edoscrm_rca_shares_select on public.edoscrm_rca_summary_shares;
create policy edoscrm_rca_shares_select on public.edoscrm_rca_summary_shares for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_rca_shares_insert on public.edoscrm_rca_summary_shares;
create policy edoscrm_rca_shares_insert on public.edoscrm_rca_summary_shares for insert
  with check (public.edoscrm_has_permission(tenant_id, 'rca.summary.share'));

-- ---------------------------------------------------------------------------
-- 9. Inbound email-to-case (§6 "Should"). A message lands here first and is
--    turned into a case explicitly — "controlled", per the brief, rather than
--    every inbound message silently opening a complaint.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  message_id text,
  from_email text not null,
  from_name text,
  subject text,
  body text,
  status text not null default 'received' check (status in ('received', 'converted', 'rejected')),
  complaint_id uuid references public.edoscrm_complaints(id) on delete set null,
  handled_by uuid references public.edoscrm_users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, message_id)
);
create index if not exists edoscrm_inbound_emails_tenant_idx on public.edoscrm_inbound_emails (tenant_id, status, created_at desc);
alter table public.edoscrm_inbound_emails enable row level security;
drop policy if exists edoscrm_inbound_emails_select on public.edoscrm_inbound_emails;
create policy edoscrm_inbound_emails_select on public.edoscrm_inbound_emails for select using (public.edoscrm_is_member(tenant_id));
drop policy if exists edoscrm_inbound_emails_update on public.edoscrm_inbound_emails;
create policy edoscrm_inbound_emails_update on public.edoscrm_inbound_emails for update
  using (public.edoscrm_has_permission(tenant_id, 'complaints.create'));

-- ---------------------------------------------------------------------------
-- 10. Compensation: the reference that makes a credit note traceable outward
--     to the Finance process, not just inward to the case (§9 B.6).
-- ---------------------------------------------------------------------------
alter table public.edoscrm_complaint_compensations
  add column if not exists credit_note_ref text,
  add column if not exists approved_at timestamptz,
  add column if not exists decision_note text;

-- ---------------------------------------------------------------------------
-- 11. A record of each scheduled report run, so "sent every Monday" is
--     evidenced rather than assumed.
-- ---------------------------------------------------------------------------
create table if not exists public.edoscrm_report_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  recipients int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, period_start)
);
alter table public.edoscrm_report_runs enable row level security;
drop policy if exists edoscrm_report_runs_select on public.edoscrm_report_runs;
create policy edoscrm_report_runs_select on public.edoscrm_report_runs for select using (public.edoscrm_is_member(tenant_id));

-- ---------------------------------------------------------------------------
-- 12. New permissions, and the audit log opened for reading.
-- ---------------------------------------------------------------------------
insert into public.edoscrm_permissions (key, category, description) values
  ('contacts.manage',        'complaints',     'Edit complainant and customer records.'),
  ('admin.settings.manage',  'admin',          'Edit SLA rules, escalation thresholds, categories and KPI targets.'),
  ('product.action.request', 'investigations', 'Raise a hold, release, withdrawal or recall for a batch.'),
  ('product.action.approve', 'investigations', 'Decide a hold, release, withdrawal or recall.'),
  ('rca.summary.approve',    'investigations', 'Approve an external RCA/CAPA summary for sharing.'),
  ('rca.summary.share',      'investigations', 'Send an approved RCA/CAPA summary outside the workspace.')
on conflict (key) do nothing;

drop policy if exists edoscrm_audit_logs_select on public.edoscrm_audit_logs;
create policy edoscrm_audit_logs_select on public.edoscrm_audit_logs for select
  using (public.edoscrm_has_permission(tenant_id, 'admin.audit.view'));
drop policy if exists edoscrm_audit_logs_insert on public.edoscrm_audit_logs;
create policy edoscrm_audit_logs_insert on public.edoscrm_audit_logs for insert
  with check (public.edoscrm_is_member(tenant_id));

-- ---------------------------------------------------------------------------
-- 13. Backfill every existing workspace, so this is not only true for
--     workspaces created from now on.
-- ---------------------------------------------------------------------------
insert into public.edoscrm_tenant_settings (tenant_id)
select id from public.edoscrm_tenants
on conflict (tenant_id) do nothing;

-- The missing T3 rule. Its RCA clock is the brief's "weekly review" (7 days),
-- and its acknowledgement is the blanket 24 hours that applies to all
-- complaints. Without this row a T3 complaint had no SLA at all.
insert into public.edoscrm_sla_rules (tenant_id, severity, acknowledgement_minutes, rca_minutes)
select t.id, 'T3', 1440, 10080
from public.edoscrm_tenants t
where not exists (
  select 1 from public.edoscrm_sla_rules r where r.tenant_id = t.id and r.severity = 'T3'
);

-- T2 "issue resolution plan within 48 hours", tracked separately from RCA.
update public.edoscrm_sla_rules set resolution_plan_minutes = 2880
where severity = 'T2' and resolution_plan_minutes is null;

insert into public.edoscrm_categories (tenant_id, name, sort_order)
select t.id, c.name, c.ord
from public.edoscrm_tenants t
cross join (values
  ('Product quality', 1), ('Foreign object', 2), ('Packaging', 3), ('Labelling', 4),
  ('Delivery / logistics', 5), ('Customer service', 6), ('Pricing / billing', 7), ('Other', 8)
) as c(name, ord)
on conflict (tenant_id, name) do nothing;

insert into public.edoscrm_kpi_targets (tenant_id, key, target_pct, direction)
select t.id, k.key, k.target, k.dir
from public.edoscrm_tenants t
cross join (values
  ('captureRate', 100, 'gte'),
  ('acknowledgementSlaPct', 100, 'gte'),
  ('closedLoopPct', 85, 'gte'),
  ('rcaSlaPct', 100, 'gte'),
  ('capaOnTimePct', 100, 'gte'),
  ('repeatIssuePct', null, 'down')
) as k(key, target, dir)
on conflict (tenant_id, key) do nothing;

-- Give the seeded roles the new permissions. Point-in-time role snapshots do
-- not inherit new keys, which is why this is explicit.
insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id
from public.edoscrm_roles r
join public.edoscrm_permissions p on true
where r.name = 'Tenant Administrator'
on conflict do nothing;

insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id from public.edoscrm_roles r join public.edoscrm_permissions p on true
where r.name = 'Marketing Operations'
  and p.key in ('contacts.manage', 'admin.settings.manage', 'product.action.request', 'rca.summary.share', 'admin.users.manage', 'admin.roles.manage')
on conflict do nothing;

insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id from public.edoscrm_roles r join public.edoscrm_permissions p on true
where r.name = 'Quality' and p.key in ('product.action.request', 'rca.summary.approve', 'complaints.export')
on conflict do nothing;

-- The brief gives Manufacturing the hold/release/withdrawal decision.
insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id from public.edoscrm_roles r join public.edoscrm_permissions p on true
where r.name = 'Manufacturing' and p.key in ('product.action.approve', 'product.action.request')
on conflict do nothing;

insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id from public.edoscrm_roles r join public.edoscrm_permissions p on true
where r.name = 'Sales' and p.key in ('contacts.manage')
on conflict do nothing;

insert into public.edoscrm_role_permissions (role_id, permission_id)
select r.id, p.id from public.edoscrm_roles r join public.edoscrm_permissions p on true
where r.name in ('Leadership', 'Report Only') and p.key in ('complaints.export')
on conflict do nothing;

-- Backfill contacts from the reporter details already on complaints, so the
-- history that exists is not lost when the case screen starts reading a
-- contact record. Email wins as the match key; phone-only reporters follow.
insert into public.edoscrm_contacts (tenant_id, full_name, email, phone)
select distinct on (c.tenant_id, lower(trim(c.reporter_email)))
       c.tenant_id, c.reporter_name, trim(c.reporter_email), c.reporter_phone
from public.edoscrm_complaints c
where nullif(trim(coalesce(c.reporter_email, '')), '') is not null
order by c.tenant_id, lower(trim(c.reporter_email)), c.created_at
on conflict do nothing;

update public.edoscrm_complaints c
set contact_id = ct.id
from public.edoscrm_contacts ct
where c.contact_id is null
  and ct.tenant_id = c.tenant_id
  and ct.email_key = nullif(lower(trim(coalesce(c.reporter_email, ''))), '');

-- Closed cases predate the new timestamps; treat closure as the resolution
-- moment so historical KPIs are not silently zero.
update public.edoscrm_complaints
set resolved_at = closed_at
where closed_at is not null and resolved_at is null;
