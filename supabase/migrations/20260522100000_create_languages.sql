create table if not exists public.languages (
  lang text primary key,
  display_name text not null,
  strings jsonb not null default '{}'::jsonb,
  version int not null default 1,
  is_active boolean not null default true,
  is_default boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists languages_active_idx on public.languages (is_active) where is_active;

alter table public.languages enable row level security;

drop policy if exists "Public read active languages" on public.languages;
create policy "Public read active languages"
  on public.languages
  for select
  to anon, authenticated
  using (is_active = true);

comment on table public.languages is 'One row per locale; strings matches i18next translation tree';
