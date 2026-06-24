alter table public.matches
  add column if not exists ultimates_used integer not null default 0,
  add column if not exists headshots integer not null default 0,
  add column if not exists grenade_damage integer,
  add column if not exists rank_score integer,
  add column if not exists rp_change integer,
  add column if not exists rp_processed boolean not null default false,
  add column if not exists is_kill_leader boolean;

comment on column public.matches.ultimates_used is 'Legacy match ultimatesUsed field.';
comment on column public.matches.headshots is 'Legacy match headshots field.';
comment on column public.matches.grenade_damage is 'Optional legacy match grenadeDamage field.';
comment on column public.matches.rank_score is 'Current RP after match when known.';
comment on column public.matches.rp_change is 'Confirmed RP delta calculated from later rank update.';
comment on column public.matches.rp_processed is 'Whether rp_change has already been confirmed.';
