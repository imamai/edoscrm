-- EDOS CRM — Phase 7: Investigation / RCA / CAPA, one record of each per
-- complaint (unique complaint_id) — the common case brief §12/§13 describe.
-- A reusable root-cause taxonomy for cross-complaint pattern detection
-- (brief §28/§29) is real, separate work for whenever that feature is
-- actually built, not scaffolded speculatively here. All three share one
-- permission (investigations.manage) since they're steps of the same
-- Quality workflow performed by the same role, not independently gated
-- actions — same reasoning as complaints.manage covering every complaint
-- mutation. provision_tenant() needs no change: it already grants the
-- Admin role every *current* row in edoscrm_permissions at insert time, and
-- 0 tenants exist (verified) so there's nothing to backfill either.

create table public.edoscrm_investigations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null unique references public.edoscrm_complaints (id) on delete cascade,
  findings text not null,
  investigator_id uuid references public.edoscrm_users (id) on delete set null,
  created_by uuid not null references public.edoscrm_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.edoscrm_root_causes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null unique references public.edoscrm_complaints (id) on delete cascade,
  -- Classic 5M+1 framework — a fixed set is fine until there's a real need
  -- for tenant-configurable categories.
  category text not null check (category in ('machine', 'method', 'material', 'man', 'measurement', 'environment', 'other')),
  description text not null,
  created_by uuid not null references public.edoscrm_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.edoscrm_capas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid not null unique references public.edoscrm_complaints (id) on delete cascade,
  corrective_action text not null,
  preventive_action text,
  owner_id uuid references public.edoscrm_users (id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'verified', 'closed')),
  created_by uuid not null references public.edoscrm_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index edoscrm_investigations_tenant_idx on public.edoscrm_investigations (tenant_id);
create index edoscrm_investigations_investigator_idx on public.edoscrm_investigations (investigator_id);
create index edoscrm_investigations_created_by_idx on public.edoscrm_investigations (created_by);
create index edoscrm_root_causes_tenant_idx on public.edoscrm_root_causes (tenant_id);
create index edoscrm_root_causes_created_by_idx on public.edoscrm_root_causes (created_by);
create index edoscrm_capas_tenant_idx on public.edoscrm_capas (tenant_id);
create index edoscrm_capas_owner_idx on public.edoscrm_capas (owner_id);
create index edoscrm_capas_created_by_idx on public.edoscrm_capas (created_by);

alter table public.edoscrm_investigations enable row level security;
alter table public.edoscrm_root_causes enable row level security;
alter table public.edoscrm_capas enable row level security;

insert into public.edoscrm_permissions (key, category, description) values
  ('investigations.manage', 'investigations', 'Record investigations, root causes and CAPAs');

create policy edoscrm_investigations_select on public.edoscrm_investigations for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_investigations_insert on public.edoscrm_investigations for insert
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));
create policy edoscrm_investigations_update on public.edoscrm_investigations for update
  using (public.edoscrm_has_permission(tenant_id, 'investigations.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));

create policy edoscrm_root_causes_select on public.edoscrm_root_causes for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_root_causes_insert on public.edoscrm_root_causes for insert
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));
create policy edoscrm_root_causes_update on public.edoscrm_root_causes for update
  using (public.edoscrm_has_permission(tenant_id, 'investigations.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));

create policy edoscrm_capas_select on public.edoscrm_capas for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_capas_insert on public.edoscrm_capas for insert
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));
create policy edoscrm_capas_update on public.edoscrm_capas for update
  using (public.edoscrm_has_permission(tenant_id, 'investigations.manage'))
  with check (public.edoscrm_has_permission(tenant_id, 'investigations.manage'));
