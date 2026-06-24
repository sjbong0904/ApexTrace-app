create table if not exists public.daily_rank_snapshots (
  uid text not null,
  snapshot_date date not null,
  rank_score integer not null default 0,
  rank_name text,
  level integer,
  prestige integer,
  legend text,
  source text not null default 'als',
  updated_at timestamptz not null default now(),
  primary key (uid, snapshot_date)
);

create index if not exists daily_rank_snapshots_uid_date_desc_idx
  on public.daily_rank_snapshots (uid, snapshot_date desc);

alter table public.daily_rank_snapshots enable row level security;

drop policy if exists "Public read daily rank snapshots" on public.daily_rank_snapshots;
create policy "Public read daily rank snapshots"
  on public.daily_rank_snapshots
  for select
  to anon, authenticated
  using (true);

comment on table public.daily_rank_snapshots is 'One rank snapshot per user per day for daily RP trend charts';
comment on column public.daily_rank_snapshots.snapshot_date is 'UTC calendar date for the rank snapshot';
