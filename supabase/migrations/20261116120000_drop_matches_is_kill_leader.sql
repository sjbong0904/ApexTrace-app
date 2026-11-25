-- Kill leader is not a documented GEP key (only localized HUD text, which we don't
-- subscribe to). The column was never written (100% null across all rows).
--
-- ORDER MATTERS: deploy trace-proxy-server without `is_kill_leader` (rowFromMatch /
-- SUMMARY_SELECT) BEFORE applying this. The currently deployed proxy still upserts and
-- selects the column, so dropping it first would break every match save and history read.
alter table public.matches
  drop column if exists is_kill_leader;
