-- Watchlist limit: 25 items in total (rackets, grips, shoes, anything). Paste into Supabase > SQL Editor > Run (safe to run twice).
alter table public.profiles drop constraint if exists watch_max_25;
alter table public.profiles add constraint watch_max_25 check (jsonb_array_length(watch) <= 25);
