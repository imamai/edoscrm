-- Missed in 0009: a web-sourced complaint has no internal actor to record
-- as created_by until someone triages it — the public intake route has no
-- edoscrm_users row to attach. Internal complaint creation (complaints/new)
-- still always sets it; this only relaxes the constraint for the one path
-- that genuinely can't populate it.
alter table public.edoscrm_complaints alter column created_by drop not null;
