create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;

create policy "Staff can read their own membership"
  on public.staff_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;
