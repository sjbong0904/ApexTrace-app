create table if not exists public.matches (
  match_id text primary key,
  uid text not null,
  start_time bigint not null,
  end_time bigint,
  mode text,
  map text,
  legend text,
  placement integer,
  kills integer not null default 0,
  assists integer not null default 0,
  knocks integer not null default 0,
  damage integer not null default 0,
  squad_kills integer not null default 0,
  rank jsonb not null default '{}'::jsonb,
  loadout jsonb not null default '{}'::jsonb,
  team_stats jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  path jsonb not null default '[]'::jsonb,
  teammate_kills jsonb not null default '{}'::jsonb,
  legacy_match jsonb not null,
  schema_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_uid_start_time_desc_idx
  on public.matches (uid, start_time desc);

create index if not exists matches_uid_mode_start_time_desc_idx
  on public.matches (uid, mode, start_time desc);

create index if not exists matches_uid_map_start_time_desc_idx
  on public.matches (uid, map, start_time desc);

create index if not exists matches_uid_legend_start_time_desc_idx
  on public.matches (uid, legend, start_time desc);

create or replace function public.set_matches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
  before update on public.matches
  for each row
  execute function public.set_matches_updated_at();

alter table public.matches enable row level security;

drop policy if exists "Public read matches" on public.matches;
create policy "Public read matches"
  on public.matches
  for select
  to anon, authenticated
  using (true);

comment on table public.matches is 'Normalized one-row-per-match storage. legacy_match preserves current frontend-compatible match shape during rollout.';
comment on column public.matches.match_id is 'Stable frontend matchId from the extension payload.';
comment on column public.matches.legacy_match is 'Exact legacy flat match object returned by current /history responses.';
