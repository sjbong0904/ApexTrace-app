create table if not exists public.player_season_stats (
  uid text not null,
  season_id integer not null references public.seasons (id),
  mode text not null check (mode in ('ALL', 'RANKED', 'TRIO', 'DUO')),
  match_count integer not null default 0,
  payload jsonb not null default '{"matches":[]}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (uid, season_id, mode)
);

create index if not exists player_season_stats_uid_season_idx
  on public.player_season_stats (uid, season_id);

alter table public.player_season_stats enable row level security;

drop policy if exists "Public read player season stats" on public.player_season_stats;
create policy "Public read player season stats"
  on public.player_season_stats
  for select
  to anon, authenticated
  using (true);

comment on table public.player_season_stats is 'Precomputed season/mode statistics for Statistics tab (V3).';
