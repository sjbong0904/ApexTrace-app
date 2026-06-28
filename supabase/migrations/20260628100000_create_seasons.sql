create table if not exists public.seasons (
  id integer primary key,
  name text not null,
  start_time bigint not null,
  end_time bigint,
  is_active boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seasons_start_time_idx
  on public.seasons (start_time desc);

insert into public.seasons (id, name, start_time, end_time, is_active, version)
values
  (3, 'Season 28 : Split 2', (extract(epoch from timestamptz '2026-03-24T18:00:00Z') * 1000)::bigint, null, true, 1),
  (2, 'Season 28 : Split 1', (extract(epoch from timestamptz '2026-02-10T18:00:00Z') * 1000)::bigint, (extract(epoch from timestamptz '2026-03-24T18:00:00Z') * 1000)::bigint, false, 1),
  (1, 'Season 27 : Split 2', 0, (extract(epoch from timestamptz '2026-02-10T18:00:00Z') * 1000)::bigint, false, 1)
on conflict (id) do update set
  name = excluded.name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  is_active = excluded.is_active,
  version = excluded.version,
  updated_at = now();

alter table public.seasons enable row level security;

drop policy if exists "Public read seasons" on public.seasons;
create policy "Public read seasons"
  on public.seasons
  for select
  to anon, authenticated
  using (true);

comment on table public.seasons is 'Single source of truth for competitive season boundaries (V3).';
