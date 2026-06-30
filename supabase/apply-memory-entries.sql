create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  type text not null check (type in ('short', 'long', 'character', 'location')),
  episode_no integer not null default 1 check (episode_no >= 1),
  subject_key text not null default '',
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  importance integer not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memory_entries_session_type_idx
  on public.memory_entries (session_id, type, updated_at desc);

create index if not exists memory_entries_subject_idx
  on public.memory_entries (session_id, type, subject_key);

grant select, insert, update, delete on public.memory_entries to authenticated;
grant all privileges on public.memory_entries to service_role;

alter table public.memory_entries enable row level security;

drop policy if exists "session owners read memories" on public.memory_entries;
create policy "session owners read memories" on public.memory_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = memory_entries.session_id
      and chat_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "session owners insert memories" on public.memory_entries;
create policy "session owners insert memories" on public.memory_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = memory_entries.session_id
      and chat_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "session owners update memories" on public.memory_entries;
create policy "session owners update memories" on public.memory_entries
  for update to authenticated
  using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = memory_entries.session_id
      and chat_sessions.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = memory_entries.session_id
      and chat_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "session owners delete memories" on public.memory_entries;
create policy "session owners delete memories" on public.memory_entries
  for delete to authenticated
  using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = memory_entries.session_id
      and chat_sessions.user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
