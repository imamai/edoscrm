-- Missed in 0003: edoscrm_complaint_events.tenant_id is a foreign key with
-- no covering index, caught by the performance advisor.
create index edoscrm_complaint_events_tenant_idx on public.edoscrm_complaint_events (tenant_id);
