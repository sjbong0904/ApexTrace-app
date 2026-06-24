alter table public.matches
  drop constraint if exists matches_pkey;

alter table public.matches
  add constraint matches_pkey primary key (uid, match_id);

comment on constraint matches_pkey on public.matches is 'A match id is unique within a user profile, not globally across all users.';
