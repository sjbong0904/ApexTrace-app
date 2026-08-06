-- Previous in-game names per Origin/EA uid (nickname search after renames).
-- Current name stays on global_profiles.name; this table holds up to 3 prior names (30d TTL enforced in app).

create table if not exists public.profile_name_aliases (
  uid text not null references public.global_profiles (uid) on delete cascade,
  name_norm text not null,
  name_raw text not null,
  source text not null default 'unknown',
  seen_at timestamptz not null default now(),
  primary key (uid, name_norm)
);

create index if not exists profile_name_aliases_name_norm_idx
  on public.profile_name_aliases (name_norm);

create index if not exists profile_name_aliases_seen_at_idx
  on public.profile_name_aliases (seen_at);

alter table public.profile_name_aliases enable row level security;

drop policy if exists "Public read profile name aliases" on public.profile_name_aliases;
create policy "Public read profile name aliases"
  on public.profile_name_aliases
  for select
  to anon, authenticated
  using (true);

comment on table public.profile_name_aliases is 'Prior nicknames for a uid; max 3 rows / 30d TTL enforced by proxy';
comment on column public.profile_name_aliases.name_norm is 'trim + lower of name_raw for exact case-insensitive search';
comment on column public.profile_name_aliases.source is 'gep | als | keep-alive | unknown';
