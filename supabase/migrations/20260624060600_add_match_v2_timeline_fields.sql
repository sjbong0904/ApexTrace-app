alter table public.matches
  add column if not exists ring_rounds jsonb not null default '[]'::jsonb,
  add column if not exists weapon_timeline jsonb not null default '[]'::jsonb;

comment on column public.matches.ring_rounds is 'Per-round ring data for map overlays: round, start/end time, next ring center x/y, and radius.';
comment on column public.matches.weapon_timeline is 'Weapon swap timeline entries for replay/stat views.';
