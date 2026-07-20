-- Player death count from combat log (finisher + inferred squad-elim deaths). Nullable = legacy rows.
alter table public.matches
  add column if not exists deaths integer;

comment on column public.matches.deaths is
  'Local player death count from combat log (each finisher/squad-elim death). Null = pre-migration legacy.';
