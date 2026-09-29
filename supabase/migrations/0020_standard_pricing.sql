-- One price list across every EDOS product.
--
-- Until now each product priced itself: EDOS CRM and EDOSPMIS published
-- 4,500 / 7,500 / 10,000 a month with no onboarding fee at all, while the
-- quotations EDOS Centre actually sent carried two monthly lines — cloud
-- hosting and an SLA/support line — totalling 11,499, plus a one-off platform
-- design and development charge. The published price and the quoted price
-- disagreed, and the quoted one was the real one.
--
-- This sets the house price, and the same figures now apply to every product
-- that does not deliberately price another way:
--
--   Starter  4,499/month   up to 5 users
--   Growth   7,499/month   up to 20 users
--   Pro     11,499/month   unlimited
--
-- Onboarding is quoted per organisation, never published.
--
-- The monthly figure is the sum of the two lines a quotation itemises:
-- hosting (2,499 / 3,999 / 5,999) and SLA, maintenance and technical support
-- (2,000 / 3,500 / 5,500). They are stored as one price because that is what
-- a subscription charges; the split belongs on the quotation, not here.
--
-- Amounts are VAT-exclusive, as every other amount in this schema is. VAT at
-- 16% is added when a quotation or invoice is raised.
--
-- Existing subscriptions are untouched: they reference plan_id, which does not
-- change, so a workspace stays on its plan and is billed the new rate at its
-- next period. Nobody is re-billed for a period already paid.

update public.edoscrm_plans
   set price_cents          = 449900,
       max_users            = 5
 where code = 'starter';

update public.edoscrm_plans
   set price_cents          = 749900,
       max_users            = 20
 where code = 'growth';

update public.edoscrm_plans
   set price_cents          = 1149900,
       max_users            = null
 where code = 'pro';
--
-- Onboarding is NOT published. `onboarding_fee_cents` stays null, which this
-- schema already defines as "quoted per organisation rather than published".
-- What the work costs depends on the plan taken and on what the customer is
-- carrying across, and neither is known until we have spoken to them — so it
-- is agreed with the customer and put in writing before they commit. A
-- published figure would be wrong for most of them.
