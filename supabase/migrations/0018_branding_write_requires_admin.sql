-- Uploading or replacing a workspace logo required only membership, while
-- deleting one required admin.org.manage. Branding is what an external reader
-- takes as the organisation's mark — it appears on every exported report — so
-- any member being able to replace it, but not remove it, was both a gap and
-- an inconsistency. The server action makes the same check; this closes the
-- way around it.

drop policy if exists edoscrm_branding_storage_insert on storage.objects;
create policy edoscrm_branding_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'edoscrm-branding'
    and public.edoscrm_has_permission(((storage.foldername(name))[1])::uuid, 'admin.org.manage')
  );

drop policy if exists edoscrm_branding_storage_update on storage.objects;
create policy edoscrm_branding_storage_update on storage.objects for update
  using (
    bucket_id = 'edoscrm-branding'
    and public.edoscrm_has_permission(((storage.foldername(name))[1])::uuid, 'admin.org.manage')
  );
