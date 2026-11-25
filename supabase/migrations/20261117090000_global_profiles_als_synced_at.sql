-- When ALS (apexlegendsstatus bridge) last confirmed this row.
-- `updated_at` is also bumped by GEP roster upserts (address-book), so it cannot tell
-- whether rank/legend/avatar are fresh. /apex-stats uses this for its uid DB cache and
-- keep-alive orders by it (never-synced rows first).
alter table public.global_profiles
  add column if not exists als_synced_at timestamptz;

comment on column public.global_profiles.als_synced_at is
  'Last successful ALS bridge fetch for this uid (apex-stats / keep-alive). Null = never synced from ALS.';

create index if not exists global_profiles_als_synced_at_idx
  on public.global_profiles (als_synced_at asc nulls first);
