-- Align public.seasons with the game's own schedule (calevent/seasonN + ranked2pt0/rankedperiodN_splitM,
-- build R5pc_r5-310 / 2026-11-04, via scripts/game-icons/game_data.py -> seasons.json).
--
-- Game schedule (UTC):
--   S29 Split 2  2026-06-23 17:00 -> 2026-08-04 17:00
--   S30 Split 1  2026-08-04 17:00 -> 2026-09-15 17:00
--   S30 Split 2  2026-09-15 17:00 -> 2026-11-03 18:00
--   S31 Split 1  2026-11-03 18:00 -> 2026-12-15 18:00
--   S31 Split 2  2026-12-15 18:00 -> 2027-02-09 18:00
--
-- Not applied automatically. Review, then run in the SQL editor.

begin;

-- 0) Backups of every row this script touches (schema "backup", not exposed to the API).
create schema if not exists backup;
create table if not exists backup.seasons_20261123 as select * from public.seasons;
create table if not exists backup.matches_season5_20261123 as
  select id, season_id, start_time from public.matches where season_id = 5 and start_time >= 1793728800000;
create table if not exists backup.player_season_stats_s5s6_20261123 as
  select * from public.player_season_stats where season_id in (5, 6);

-- 1) "Season 29 : Split 2" starts 2026-06-23, not 2026-03-24 (S28 Split 2's start).
--    All 305 matches on this row are from 2026-07-14 onward, so no match moves.
update public.seasons
   set start_time = 1782234000000, updated_at = now()
 where id = 3 and name = 'Season 29 : Split 2';

-- 2) "Season 31 : Split 1" ends when Split 2 starts.
update public.seasons
   set end_time = 1797357600000, updated_at = now()
 where id = 6 and name = 'Season 31 : Split 1';

-- 3) Add "Season 31 : Split 2" ahead of time so matches after 2026-12-15 18:00 UTC land in it.
insert into public.seasons (id, name, start_time, end_time, version)
values (7, 'Season 31 : Split 2', 1797357600000, 1802196000000, 1)
on conflict (id) do nothing;

-- 4) 11 matches played 2026-11-03 18:35 .. 2026-11-06 13:21 UTC are S31 Split 1 but tagged season 5.
update public.matches
   set season_id = 6
 where season_id = 5 and start_time >= 1793728800000;

-- 5) Move the same matches between player_season_stats buckets (payload.matches is newest-first,
--    deduped by matchId; there is no recompute RPC, so do it here).
with moved as (
  select s.uid, s.mode, e.value as m
    from public.player_season_stats s, jsonb_array_elements(s.payload->'matches') e
   where s.season_id = 5 and (e.value->>'startTime')::bigint >= 1793728800000
),
target as (
  select x.uid, x.mode, x.m
    from (
      select uid, mode, m from moved
      union all
      select t.uid, t.mode, e.value
        from public.player_season_stats t, jsonb_array_elements(t.payload->'matches') e
       where t.season_id = 6 and (t.uid, t.mode) in (select uid, mode from moved)
    ) x
),
dedup as (
  select distinct on (uid, mode, m->>'matchId') uid, mode, m from target order by uid, mode, m->>'matchId'
),
merged as (
  select uid, mode,
         jsonb_agg(m order by (m->>'startTime')::bigint desc) as arr,
         count(*)::int as n
    from dedup group by uid, mode
)
insert into public.player_season_stats (uid, season_id, mode, match_count, payload, updated_at)
select uid, 6, mode, n, jsonb_build_object('matches', arr), now() from merged
on conflict (uid, season_id, mode) do update
   set match_count = excluded.match_count,
       payload = public.player_season_stats.payload || jsonb_build_object('matches', excluded.payload->'matches'),
       updated_at = now();

update public.player_season_stats s
   set payload = s.payload || jsonb_build_object('matches', coalesce((
         select jsonb_agg(e.value order by (e.value->>'startTime')::bigint desc)
           from jsonb_array_elements(s.payload->'matches') e
          where (e.value->>'startTime')::bigint < 1793728800000), '[]'::jsonb)),
       updated_at = now()
 where s.season_id = 5
   and exists (select 1 from jsonb_array_elements(s.payload->'matches') e
               where (e.value->>'startTime')::bigint >= 1793728800000);

update public.player_season_stats s
   set match_count = jsonb_array_length(s.payload->'matches')
 where s.season_id = 5;

delete from public.player_season_stats where season_id = 5 and match_count = 0;

commit;
