-- 老爹．涼糕：首頁照片 Storage
insert into storage.buckets (id, name, public)
values ('site-images','site-images',true)
on conflict (id) do nothing;

drop policy if exists "site_images_public_read" on storage.objects;
create policy "site_images_public_read"
on storage.objects for select to public
using (bucket_id = 'site-images');

drop policy if exists "site_images_admin_insert" on storage.objects;
create policy "site_images_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-images'
  and exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.enabled = true and p.role in ('super_admin','admin')
  )
);

drop policy if exists "site_images_admin_update" on storage.objects;
create policy "site_images_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-images'
  and exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.enabled = true and p.role in ('super_admin','admin')
  )
)
with check (
  bucket_id = 'site-images'
  and exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.enabled = true and p.role in ('super_admin','admin')
  )
);

drop policy if exists "site_images_admin_delete" on storage.objects;
create policy "site_images_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-images'
  and exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.enabled = true and p.role in ('super_admin','admin')
  )
);