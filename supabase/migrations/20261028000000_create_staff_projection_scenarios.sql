create table if not exists public.staff_projection_scenarios (
  id uuid primary key default gen_random_uuid(),
  model text not null check (model in ('hoc', 'nia')),
  name text not null check (length(trim(name)) between 1 and 60),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_projection_scenarios_model_name_idx
  on public.staff_projection_scenarios (model, name);

alter table public.staff_projection_scenarios enable row level security;

create policy "Staff can read shared projection scenarios"
  on public.staff_projection_scenarios
  for select
  to authenticated
  using (exists (
    select 1
    from public.staff_members
    where staff_members.user_id = (select auth.uid())
  ));

create policy "Staff can add shared projection scenarios"
  on public.staff_projection_scenarios
  for insert
  to authenticated
  with check (exists (
    select 1
    from public.staff_members
    where staff_members.user_id = (select auth.uid())
  ));

create policy "Staff can edit shared projection scenarios"
  on public.staff_projection_scenarios
  for update
  to authenticated
  using (exists (
    select 1
    from public.staff_members
    where staff_members.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.staff_members
    where staff_members.user_id = (select auth.uid())
  ));

create policy "Staff can delete shared projection scenarios"
  on public.staff_projection_scenarios
  for delete
  to authenticated
  using (exists (
    select 1
    from public.staff_members
    where staff_members.user_id = (select auth.uid())
  ));

revoke all on public.staff_projection_scenarios from anon, authenticated;
grant select, insert, update, delete on public.staff_projection_scenarios to authenticated;
