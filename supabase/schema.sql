create table if not exists public.planner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_profiles enable row level security;

drop policy if exists "select own planner profile" on public.planner_profiles;
create policy "select own planner profile"
on public.planner_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own planner profile" on public.planner_profiles;
create policy "insert own planner profile"
on public.planner_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own planner profile" on public.planner_profiles;
create policy "update own planner profile"
on public.planner_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
