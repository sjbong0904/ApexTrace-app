-- Allow null combat stats for incomplete GEP captures (do not store fake 0/0/0).
alter table public.matches
  alter column kills drop not null,
  alter column assists drop not null,
  alter column knocks drop not null,
  alter column damage drop not null;

alter table public.matches
  alter column kills drop default,
  alter column assists drop default,
  alter column knocks drop default,
  alter column damage drop default;

comment on column public.matches.kills is 'Null when tabs SSOT was untrusted (incomplete match).';
comment on column public.matches.assists is 'Null when tabs SSOT was untrusted (incomplete match).';
comment on column public.matches.knocks is 'Null when tabs SSOT was untrusted (incomplete match).';
comment on column public.matches.damage is 'Null when tabs SSOT was untrusted (incomplete match).';
