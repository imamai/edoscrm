-- Widen edoscrm_complaints.source from a binary internal/web flag to a real
-- channel taxonomy, so every way a complaint can reach this tenant funnels
-- into the same table and is visibly tagged, per ARCHITECTURE.md §7/§8's
-- "all complaint channels converge on one CRM" principle. `web` keeps
-- meaning exactly what it means today (the public, unauthenticated
-- /api/v1/intake endpoint) — the new values are all staff-attested channels
-- (an agent recording that a complaint arrived by phone/email/WhatsApp/in
-- person), the same way real complaint-management systems tag channel
-- before automating each one individually. Dedicated
-- edoscrm_complaint_channels/communications tables (the ARCHITECTURE.md §7
-- "ceiling" schema, for full per-channel message threads) stay deferred —
-- this is the minimal real step: a channel taxonomy on the case itself.

alter table public.edoscrm_complaints drop constraint if exists edoscrm_complaints_source_check;

alter table public.edoscrm_complaints
  add constraint edoscrm_complaints_source_check
  check (source in ('internal', 'web', 'phone', 'email', 'whatsapp', 'walk_in'));
