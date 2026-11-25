-- Repair global_profiles.level rows that were written as total level (level + prestige*500),
-- sometimes repeatedly. The client bug (getUserDetail re-saving a search candidate's total level)
-- only ever added multiples of 500, so the in-prestige level is ((level - 1) % 500) + 1.
-- prestige itself was not corrupted and is left untouched.

-- Preview:
-- select uid, name, level, prestige, ((level - 1) % 500) + 1 as fixed_level
-- from public.global_profiles where level > 500 order by level desc;

update public.global_profiles
set level = ((level - 1) % 500) + 1
where level > 500;

select count(*) as rows_still_over_500 from public.global_profiles where level > 500;
