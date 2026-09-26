-- EDOS CRM — Phase 8: edos.ai, one action end-to-end ("Summarize case")
-- before building the other seven from the brief (ARCHITECTURE.md §11/§13).
-- A pure summary has nothing to accept/reject, so only edoscrm_ai_interactions
-- is needed here — edoscrm_ai_suggestions (for actions that propose a
-- specific field change, like "Suggest severity") is real, separate schema
-- for whenever the first such action gets built, not scaffolded now.
--
-- Gated on tenant membership alone, not a dedicated permission: this is a
-- read-only insight over data the member can already see in full, not a
-- mutation — the same reasoning edoscrm_complaint_events uses for its own
-- insert policy.

create table public.edoscrm_ai_interactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  complaint_id uuid references public.edoscrm_complaints (id) on delete cascade,
  user_id uuid not null references public.edoscrm_users (id) on delete cascade,
  action text not null,
  prompt text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create index edoscrm_ai_interactions_tenant_idx on public.edoscrm_ai_interactions (tenant_id, created_at desc);
create index edoscrm_ai_interactions_complaint_idx on public.edoscrm_ai_interactions (complaint_id);
create index edoscrm_ai_interactions_user_idx on public.edoscrm_ai_interactions (user_id);

alter table public.edoscrm_ai_interactions enable row level security;

create policy edoscrm_ai_interactions_select on public.edoscrm_ai_interactions for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_ai_interactions_insert on public.edoscrm_ai_interactions for insert
  with check (public.edoscrm_is_member(tenant_id) and user_id = (select auth.uid()));
