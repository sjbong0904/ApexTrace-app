alter table public.matches
  add column if not exists season_id integer references public.seasons (id);

create index if not exists matches_uid_season_id_start_time_desc_idx
  on public.matches (uid, season_id, start_time desc);

comment on column public.matches.season_id is 'Resolved from public.seasons at write time using start_time.';
