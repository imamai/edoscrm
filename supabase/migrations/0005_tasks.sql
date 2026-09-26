-- EDOS CRM — Phase 5: tasks, as first-class records (brief §15) that can
-- optionally hang off a complaint. Status is a small fixed set (todo/
-- in_progress/done) rather than a per-tenant configurable workflow like
-- complaints get — nothing has asked for custom task statuses yet, and the
-- generic board component (ARCHITECTURE.md §10) only needs an ordered list
-- of {key, label} columns to render either one, so upgrading tasks to a
-- workflow-versioned status later is a data migration, not a component
-- rewrite. 0 tenants exist (verified), so no backfill needed.

create table public.edoscrm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.edoscrm_tenants (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  assignee_id uuid references public.edoscrm_users (id) on delete set null,
  complaint_id uuid references public.edoscrm_complaints (id) on delete cascade,
  created_by uuid not null references public.edoscrm_users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index edoscrm_tasks_tenant_idx on public.edoscrm_tasks (tenant_id, created_at desc);
create index edoscrm_tasks_assignee_idx on public.edoscrm_tasks (assignee_id);
create index edoscrm_tasks_complaint_idx on public.edoscrm_tasks (complaint_id);
create index edoscrm_tasks_created_by_idx on public.edoscrm_tasks (created_by);

alter table public.edoscrm_tasks enable row level security;

insert into public.edoscrm_permissions (key, category, description) values
  ('tasks.create', 'tasks', 'Create a task'),
  ('tasks.manage', 'tasks', 'Edit or reassign any task in the tenant');

create policy edoscrm_tasks_select on public.edoscrm_tasks for select
  using (public.edoscrm_is_member(tenant_id));
create policy edoscrm_tasks_insert on public.edoscrm_tasks for insert
  with check (public.edoscrm_has_permission(tenant_id, 'tasks.create'));
-- An assignee can move their own task (todo -> in_progress -> done) without
-- needing tasks.manage; anything wider (reassigning, editing someone else's
-- task) needs the real permission.
create policy edoscrm_tasks_update on public.edoscrm_tasks for update
  using (public.edoscrm_has_permission(tenant_id, 'tasks.manage') or assignee_id = (select auth.uid()))
  with check (public.edoscrm_has_permission(tenant_id, 'tasks.manage') or assignee_id = (select auth.uid()));
create policy edoscrm_tasks_delete on public.edoscrm_tasks for delete
  using (public.edoscrm_has_permission(tenant_id, 'tasks.manage'));
