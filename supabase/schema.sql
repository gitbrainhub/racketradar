-- Racket Radar accounts. Paste this whole file into Supabase > SQL Editor > Run (safe to run twice).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text,                                   -- Stripe subscription status (active, canceled, ...)
  stripe_customer_id text unique,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  watch jsonb not null default '[]'::jsonb,      -- the racket ids on the person's watchlist
  alerts jsonb not null default '{}'::jsonb,     -- the "alert me below" prices (used later by the email/text alerts)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in person can read their own row, and change ONLY their watchlist and alert prices.
-- They can never change "plan": only the payment webhook (server key) can do that.
revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;            -- the payment webhook writes the plan with this role
grant select on public.profiles to authenticated;
grant update (watch, alerts) on public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "update own watchlist" on public.profiles;
create policy "update own watchlist" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Make a profile row automatically whenever someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Anyone who signed up before this file was run still gets a row.
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;
