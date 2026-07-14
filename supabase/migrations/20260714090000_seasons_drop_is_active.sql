-- UI resolves the current season from start_time/end_time; is_active is unused.
alter table public.seasons
  drop column if exists is_active;
