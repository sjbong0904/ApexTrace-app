-- Headshot-rate denominator: every GEP `damage` hit the local player landed.
-- Nullable on purpose: null = row written by a build that did not count hits.
alter table public.matches
  add column if not exists damage_hits integer;

comment on column public.matches.damage_hits is 'GEP damage hit count (headshots / damage_hits = headshot rate). Null = not collected.';
