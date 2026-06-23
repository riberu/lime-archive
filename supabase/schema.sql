create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-assets',
  'story-assets',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New user',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  system_prompt text not null default '',
  opening_message text not null default '',
  current_scene text not null default '',
  status_text text not null default '',
  tags text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  share_slug text unique,
  like_count integer not null default 0,
  chat_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  name text not null,
  description text not null default '',
  avatar_url text,
  personality text not null default '',
  speech_style text not null default '',
  first_message text not null default '',
  prompt text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_characters (
  story_id uuid not null references public.stories(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  role text not null default 'npc',
  sort_order integer not null default 0,
  primary key (story_id, character_id)
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null default 'New chat',
  user_note text not null default '',
  current_scene text not null default '',
  memory_summary text not null default '',
  episode_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists stories_creator_id_idx on public.stories (creator_id);
create index if not exists characters_creator_id_idx on public.characters (creator_id);
create index if not exists characters_story_id_idx on public.characters (story_id);
create index if not exists chat_sessions_user_id_idx on public.chat_sessions (user_id);
create index if not exists chat_sessions_story_id_idx on public.chat_sessions (story_id);
create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at);

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.characters enable row level security;
alter table public.story_characters enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "public stories readable" on public.stories;
create policy "public stories readable" on public.stories
  for select using (visibility = 'public' or auth.uid() = creator_id);

drop policy if exists "creators manage own stories" on public.stories;
create policy "creators manage own stories" on public.stories
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "public characters readable" on public.characters;
create policy "public characters readable" on public.characters
  for select using (visibility = 'public' or auth.uid() = creator_id);

drop policy if exists "creators manage own characters" on public.characters;
create policy "creators manage own characters" on public.characters
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "story character links readable" on public.story_characters;
create policy "story character links readable" on public.story_characters
  for select using (true);

drop policy if exists "creators manage story character links" on public.story_characters;
create policy "creators manage story character links" on public.story_characters
  for all using (
    exists (
      select 1 from public.stories
      where stories.id = story_characters.story_id
      and stories.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stories
      where stories.id = story_characters.story_id
      and stories.creator_id = auth.uid()
    )
  );

drop policy if exists "session owners read sessions" on public.chat_sessions;
create policy "session owners read sessions" on public.chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "session owners manage sessions" on public.chat_sessions;
create policy "session owners manage sessions" on public.chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "session owners read messages" on public.chat_messages;
create policy "session owners read messages" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "session owners insert messages" on public.chat_messages;
create policy "session owners insert messages" on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "session owners delete messages" on public.chat_messages;
create policy "session owners delete messages" on public.chat_messages
  for delete using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "story assets are publicly readable" on storage.objects;
create policy "story assets are publicly readable" on storage.objects
  for select using (bucket_id = 'story-assets');
