-- FOCENTRA shared group timer. Run this once in Supabase SQL Editor.
create table if not exists public.study_group_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.study_groups(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'idle' check (status in ('idle','running','paused','completed')),
  duration_seconds integer not null default 1500 check (duration_seconds between 60 and 10800),
  remaining_seconds integer not null default 1500 check (remaining_seconds between 0 and 10800),
  started_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.study_group_sessions enable row level security;
drop policy if exists "Members can read shared group timers" on public.study_group_sessions;
create policy "Members can read shared group timers" on public.study_group_sessions for select to authenticated
using (exists (select 1 from public.study_group_members m where m.group_id = study_group_sessions.group_id and m.user_id = auth.uid()));
drop policy if exists "Group host can create shared timer" on public.study_group_sessions;
create policy "Group host can create shared timer" on public.study_group_sessions for insert to authenticated
with check (host_user_id = auth.uid() and exists (select 1 from public.study_groups g where g.id = group_id and g.created_by = auth.uid()) and exists (select 1 from public.study_group_members m where m.group_id = study_group_sessions.group_id and m.user_id = auth.uid()));
drop policy if exists "Group host can control shared timer" on public.study_group_sessions;
create policy "Group host can control shared timer" on public.study_group_sessions for update to authenticated
using (host_user_id = auth.uid() and exists (select 1 from public.study_groups g where g.id = group_id and g.created_by = auth.uid()))
with check (host_user_id = auth.uid() and exists (select 1 from public.study_groups g where g.id = group_id and g.created_by = auth.uid()));
do $$ begin
  alter publication supabase_realtime add table public.study_group_sessions;
exception when duplicate_object then null;
end $$;
