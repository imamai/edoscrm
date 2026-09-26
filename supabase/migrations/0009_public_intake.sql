-- EDOS CRM — Phase 9: public complaint intake (ARCHITECTURE.md §8).
--
-- Columns: who reported it and how, for a channel that has no account to
-- attach the complaint to. A full CRM "customer" entity (brief §22's
-- Same Customer relationship) is real, separate work for later — these
-- columns are enough to contact the reporter back without inventing that
-- module now.
--
-- edoscrm_next_case_number_public: a second, narrower numbering function
-- for this one caller. The existing edoscrm_next_case_number() checks
-- edoscrm_is_member(), which anon can never satisfy — RLS bypass via the
-- service-role client doesn't bypass that explicit check inside the
-- function body, only the table-level policies. This variant drops the
-- membership check; it's still only reachable from the server-side intake
-- route (admin.ts is never imported client-side), and the worst an anon
-- caller could do by hitting it directly is bump a tenant's sequence
-- counter — the rate limit in the intake route is what actually matters
-- for abuse, not this function's access control.

alter table public.edoscrm_complaints
  add column source text not null default 'internal' check (source in ('internal', 'web')),
  add column reporter_name text,
  add column reporter_email text,
  add column reporter_phone text,
  add column source_ip text;

create index edoscrm_complaints_source_ip_idx on public.edoscrm_complaints (tenant_id, source_ip, created_at);

create function public.edoscrm_next_case_number_public(p_tenant_id uuid)
returns text
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_seq bigint;
  v_format text;
  v_number text;
begin
  update public.edoscrm_tenants
  set case_sequence = case_sequence + 1
  where id = p_tenant_id
  returning case_sequence, numbering_format into v_seq, v_format;

  if v_seq is null then
    raise exception 'Unknown workspace.';
  end if;

  v_number := replace(v_format, '{year}', extract(year from now())::text);
  v_number := replace(v_number, '{seq}', lpad(v_seq::text, 6, '0'));
  return v_number;
end;
$$;
