create table if not exists public.blog_content (
  id text primary key,
  data jsonb not null default '{"adBanners":[],"categories":[],"heroVideo":null,"posts":[],"savedAt":null}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.blog_content (id, data)
values ('main', '{"adBanners":[],"categories":[],"heroVideo":null,"posts":[],"savedAt":null}'::jsonb)
on conflict (id) do nothing;
