-- 老爹．涼糕：網站選單缺少的後台內容資料表
create table if not exists public.site_admin_content (
  section_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_admin_content enable row level security;

drop policy if exists "site_admin_content_select_admin" on public.site_admin_content;
drop policy if exists "site_admin_content_write_admin" on public.site_admin_content;

create policy "site_admin_content_select_admin"
on public.site_admin_content for select to authenticated
using (
  exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid()
      and p.enabled = true
      and p.role in ('super_admin','admin')
  )
);

create policy "site_admin_content_write_admin"
on public.site_admin_content for all to authenticated
using (
  exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid()
      and p.enabled = true
      and p.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid()
      and p.enabled = true
      and p.role in ('super_admin','admin')
  )
);

insert into public.site_admin_content(section_id,data) values
('marquee','{"text":"老爹．涼糕｜手工現做・每日新鮮製作","enabled":true}'),
('maintenance','{"enabled":false,"content":"網站維護中，請稍後再回來。","restore_time":""}')
on conflict (section_id) do nothing;