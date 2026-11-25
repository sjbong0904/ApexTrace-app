-- Repair nicknames corrupted by the client's double base64 decode.
--
-- Bug: public/background/utils.js tryDecodeBase64() decoded any nickname that
-- looked like base64, and cleanName() ran twice on roster names (worker →
-- repository bulkUpdate). Plain names like "HiRo" / "RAMIN256" / "TANKURO"
-- were stored as control-character garbage ("\x1e$h", "D\x03\b7nz", …).
--
-- The corruption is exactly one atob() of the real name, so re-encoding the
-- stored bytes as base64 recovers it (trailing '=' padding dropped).
-- Only rows with C0/C1 control characters are touched; names corrupted into
-- printable-only garbage cannot be told apart from real names and are left
-- for ALS / the next roster sighting (the fixed proxy no longer aliases them).
--
-- Run ONLY after the fixed client (utils.js) and proxy (isCorruptName guard)
-- are deployed, otherwise old clients keep re-corrupting.
-- Measured 2026-11-14: 635 profiles recoverable, 0 skipped, 4 corrupt aliases.
-- updated_at is intentionally not bumped (keeps keep-alive ordering).

begin;

-- 1) Preview (run alone first)
-- select uid, name as corrupted,
--        rtrim(replace(encode(convert_to(name, 'UTF8'), 'base64'), E'\n', ''), '=') as recovered
-- from public.global_profiles
-- where name ~ '[\x01-\x1F\x7F-\x9F]'
-- order by updated_at desc;

-- 2) Restore current names
with fixed as (
  select uid,
         rtrim(replace(encode(convert_to(name, 'UTF8'), 'base64'), E'\n', ''), '=') as recovered
  from public.global_profiles
  where name ~ '[\x01-\x1F\x7F-\x9F]'
)
update public.global_profiles g
set name = f.recovered
from fixed f
where g.uid = f.uid
  and f.recovered ~ '^[A-Za-z0-9+/]+$';

-- 3) Corrupt aliases are not real former names
delete from public.profile_name_aliases
where name_raw ~ '[\x01-\x1F\x7F-\x9F]';

-- 4) Current name must never sit in aliases (restored names may now equal one)
delete from public.profile_name_aliases a
using public.global_profiles g
where a.uid = g.uid
  and a.name_norm = lower(btrim(g.name));

-- 5) Verify: both should be 0
select
  (select count(*) from public.global_profiles where name ~ '[\x01-\x1F\x7F-\x9F]') as corrupt_profiles_left,
  (select count(*) from public.profile_name_aliases where name_raw ~ '[\x01-\x1F\x7F-\x9F]') as corrupt_aliases_left;

commit;
