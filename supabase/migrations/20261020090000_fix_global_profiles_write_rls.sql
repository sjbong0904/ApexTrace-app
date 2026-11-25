-- Fix misconfigured RLS: policy was named for service_role but applied to PUBLIC
-- with FOR ALL + USING/CHECK (true), so anon/authenticated could write via Data API.
-- Product writes go through trace-proxy-server (service_role), which bypasses RLS.
-- Public SELECT stays unchanged — Overwolf/web read paths unaffected.

drop policy if exists "Allow service role insert/update" on public.global_profiles;

-- Defense in depth: table grants no longer allow client roles to mutate rows.
-- service_role retains full privileges for the proxy.
revoke insert, update, delete on public.global_profiles from anon, authenticated;
grant select on public.global_profiles to anon, authenticated;
