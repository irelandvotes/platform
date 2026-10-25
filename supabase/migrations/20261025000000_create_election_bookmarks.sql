create table if not exists public.election_bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (path like '/elections/%'),
  title text not null check (length(trim(title)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, path)
);

create index if not exists election_bookmarks_user_created_idx
  on public.election_bookmarks (user_id, created_at desc);

alter table public.election_bookmarks enable row level security;

create policy "Users can read their own election bookmarks"
  on public.election_bookmarks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own election bookmarks"
  on public.election_bookmarks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own election bookmarks"
  on public.election_bookmarks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.election_bookmarks to authenticated;
