-- Per-weapon kill/assist aggregates for summary stats (no need to load events).
alter table public.matches
  add column if not exists weapon_combat jsonb not null default '{}'::jsonb;

comment on column public.matches.weapon_combat is
  'Per-weapon kill/assist counts derived from combat-log events for accurate stats aggregation without loading full events.';
