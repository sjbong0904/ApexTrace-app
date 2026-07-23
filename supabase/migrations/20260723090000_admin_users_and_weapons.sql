-- Admin allowlist for team console access
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Weapons database (replaces hardcoded WeaponsData.ts)
create table if not exists public.weapons (
  id text primary key,
  base_id text,
  variant text not null default 'STANDARD',
  category text not null,
  fire_modes text[] not null default '{}',
  ammo_types text[] not null default '{}',
  image_url text not null default '',
  stats jsonb not null default '{}'::jsonb,
  attachments text[] not null default '{}',
  hopup text[],
  care_hopup text[],
  hopup_point int,
  name_key text not null,
  desc_key text not null,
  schema_version int not null default 1,
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists weapons_active_category_idx
  on public.weapons (is_active, category, sort_order);

alter table public.weapons enable row level security;

drop policy if exists "Public read active weapons" on public.weapons;
create policy "Public read active weapons"
  on public.weapons
  for select
  to anon, authenticated
  using (is_active = true);

comment on table public.admin_users is 'Allowlisted emails for Apex Trace admin console';
comment on table public.weapons is 'Weapon stats DB; editable via admin console without redeploy';
