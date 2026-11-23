-- Price-drop email alerts. Paste into Supabase > SQL Editor > Run (safe to run twice).

alter table public.profiles add column if not exists email_alerts boolean not null default true;   -- the person's on/off switch
alter table public.profiles add column if not exists alert_state jsonb not null default '{}'::jsonb; -- remembers what we already emailed, so nobody gets repeats

-- People can flip their own email switch. Only the server can touch alert_state.
grant update (email_alerts) on public.profiles to authenticated;
