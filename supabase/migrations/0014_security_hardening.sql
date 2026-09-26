-- Security audit finding, verified live against the running project:
--
-- 1. EDOSCRM never received the anon/PUBLIC EXECUTE lockdown EDOSPMIS
--    applied to itself long ago. Postgres grants EXECUTE to the PUBLIC
--    pseudo-role by default on every CREATE FUNCTION, and Supabase
--    additionally grants anon/authenticated/service_role directly — so
--    every edoscrm_* SECURITY DEFINER function has been callable by an
--    unauthenticated caller via PostgREST since the day it was created.
--    Revoked here from PUBLIC and anon for everything except
--    is_member/has_permission/is_platform_admin, which RLS policies invoke
--    as the querying (authenticated) role and are harmless to anon anyway
--    since every edoscrm_* table's RLS already keys off auth.uid().
--
-- 2. edoscrm_next_case_number_public was a genuinely exploitable gap on top
--    of that: unlike its sibling edoscrm_next_case_number, it performs *no*
--    membership or authorization check before incrementing case_sequence —
--    by design, since it exists to serve an anonymous website visitor
--    through /api/v1/intake. But that route already calls it via the
--    service-role client. Being anon/PUBLIC-callable meant anyone could hit
--    it directly through PostgREST for *any* tenant_id, bypassing the
--    intake route's rate-limiting and validation entirely, and corrupt that
--    tenant's case numbering. Confirmed exploitable with a direct anon-key
--    curl call before this fix, confirmed blocked (HTTP 401) after it.
--    Locked to service_role only, matching EDOSPMIS's own precedent for its
--    token-authenticated RPCs.
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'edoscrm_%'
      and p.proname not in ('edoscrm_is_member', 'edoscrm_has_permission', 'edoscrm_is_platform_admin')
  loop
    execute format('revoke execute on function public.%I(%s) from public', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
  end loop;
end;
$$;

revoke execute on function public.edoscrm_next_case_number_public(uuid) from authenticated;

-- 3. CSV export (src/app/api/export/complaints/route.ts) only escaped
-- quotes/commas — a complainant or product name typed as
-- `=HYPERLINK("http://evil","click")` would run as a live formula the
-- moment the exported file is opened in Excel (CSV/formula injection,
-- OWASP). Fixed in the same commit as this migration to match EDOSPMIS's
-- existing lib/export/csv.ts guard (a leading = + - or @ gets an apostrophe
-- prefix) — noted here since it's part of the same audit pass, though the
-- fix itself is application code, not SQL.
