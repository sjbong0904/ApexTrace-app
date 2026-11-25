-- GEP `player_stats` (local player account snapshot) — see docs/GEP-REQUESTS.md §player_stats.
-- Writes go through trace-proxy-server (service_role) only.

-- 1) Small scalars the profile card reads via address-book `select *`.
alter table public.global_profiles
  add column if not exists current_xp integer,
  add column if not exists needed_xp integer,
  add column if not exists total_xp bigint,
  add column if not exists gep_synced_at timestamptz;

comment on column public.global_profiles.current_xp is 'GEP player_stats_career.current_xp (XP into current level).';
comment on column public.global_profiles.needed_xp is 'GEP player_stats_career.needed_xp (XP required for next level).';
comment on column public.global_profiles.total_xp is 'GEP player_stats_career.total_xp (lifetime XP).';
comment on column public.global_profiles.gep_synced_at is 'Last time level/XP/RP came from the local player''s own GEP player_stats.';

-- 2) Full snapshots, one row per app user (kept off global_profiles: ~68k roster rows).
create table if not exists public.player_account_stats (
  uid text primary key references public.global_profiles (uid) on delete cascade,
  gep_season integer,
  career jsonb,
  br_ranked_latest jsonb,
  br_unranked_latest jsonb,
  br_ranked_history jsonb,
  br_unranked_history jsonb,
  -- When br_ranked_latest last changed. The next ranked match must start after this,
  -- so an RP delta is never pinned on an older unprocessed match.
  br_ranked_at timestamptz,
  -- RP delta observed before the matching ranked match row was uploaded; applied by POST /history.
  pending_rp jsonb,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_account_stats enable row level security;

drop policy if exists "Public read player account stats" on public.player_account_stats;
create policy "Public read player account stats"
  on public.player_account_stats
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.player_account_stats from anon, authenticated;
grant select on public.player_account_stats to anon, authenticated;

comment on table public.player_account_stats is 'Latest GEP player_stats snapshot per app user (career, current/past BR seasons).';
