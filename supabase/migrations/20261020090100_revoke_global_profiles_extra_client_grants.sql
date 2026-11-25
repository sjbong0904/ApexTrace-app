-- Remove leftover default privileges clients never need on global_profiles.
revoke references, trigger, truncate on public.global_profiles from anon, authenticated;
grant select on public.global_profiles to anon, authenticated;
