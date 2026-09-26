-- The brief names four inbound routes — "Sales, phone/email, social media and
-- trade" (§1) — and §4 "Receive" spells them out again: "complaints enter
-- through Sales, phone, WhatsApp, email, social media and, in future, a
-- website self-service form". §2 also gives Digital/Marketing a standing job:
-- "Monitor public social channels and forward complaints".
--
-- The channel list had no value for either. A Facebook or Instagram complaint
-- could only be filed as `web` or `email`, and a trade CFR raised by a Sales
-- rep as `internal` — so "Reporting ... by channel" (§6) could not show the
-- social route at all, and the Digital/Marketing team's entire intake was
-- invisible as a category. That defeats the first success criterion, which is
-- about every route landing in one place *identifiably*, not just landing.
--
--  social     — Facebook, Instagram, X, TikTok: a public post or DM, forwarded
--               by whoever monitors the social inboxes.
--  sales_rep  — a trade complaint raised by a Sales Representative or Manager,
--               the InfoPath CFR route the brief is replacing. Distinct from
--               `internal`, which stays the catch-all for staff logging
--               something that reached them some other way.

alter table public.edoscrm_complaints
  drop constraint if exists edoscrm_complaints_source_check;

alter table public.edoscrm_complaints
  add constraint edoscrm_complaints_source_check
  check (source in ('internal', 'web', 'phone', 'email', 'whatsapp', 'walk_in', 'social', 'sales_rep'));
