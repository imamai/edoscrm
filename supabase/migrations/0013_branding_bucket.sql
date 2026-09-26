-- Real logo upload for tenant branding. edoscrm_tenants.branding (jsonb)
-- has existed since Phase 2 provisioning but nothing ever read or wrote it.
-- Public bucket: a tenant logo isn't sensitive, and keeping it public means
-- any future branded-document export (PDF, print) can fetch it with a plain
-- unauthenticated fetch(url), matching EDOSPMIS's own document pipeline.

insert into storage.buckets (id, name, public)
  values ('edoscrm-branding', 'edoscrm-branding', true)
  on conflict (id) do nothing;

create policy edoscrm_branding_storage_insert on storage.objects for insert
  with check (bucket_id = 'edoscrm-branding' and public.edoscrm_is_member((storage.foldername(name))[1]::uuid));
create policy edoscrm_branding_storage_update on storage.objects for update
  using (bucket_id = 'edoscrm-branding' and public.edoscrm_is_member((storage.foldername(name))[1]::uuid));
create policy edoscrm_branding_storage_delete on storage.objects for delete
  using (bucket_id = 'edoscrm-branding' and public.edoscrm_has_permission((storage.foldername(name))[1]::uuid, 'admin.org.manage'));
