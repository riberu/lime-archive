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

create table if not exists public.app_profiles (
  id text primary key default 'default',
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  appearance text not null default '',
  speech_style text not null default '',
  memo text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light',
  attendance_alert boolean not null default true,
  notice_alert boolean not null default true,
  event_alert boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_admins (
  email text primary key,
  role text not null default 'master',
  created_at timestamptz not null default now()
);

insert into public.app_admins (email, role)
values ('foxsun2@naver.com', 'master')
on conflict (email) do update set role = excluded.role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_display_name text;
  next_avatar_url text;
begin
  next_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1),
    'New user'
  );
  next_avatar_url := nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, next_display_name, next_avatar_url)
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  insert into public.app_profiles (id, display_name, bio, avatar_url, updated_at)
  values (new.id::text, next_display_name, '', next_avatar_url, now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_personas (user_id, name, appearance, speech_style, memo, is_default)
  values (
    new.id,
    '리화',
    '검은 머리와 차분한 눈빛을 가진 미등록 용인. 겉으로는 침착하지만 낯선 상황을 빠르게 관찰한다.',
    '짧고 조심스럽게 말한다. 감정을 크게 드러내기보다 필요한 말만 먼저 꺼낸다.',
    '리화는 혈통, 계열, 능력이 아직 공식 등록되지 않은 용인이다. 리화의 대사와 행동은 플레이어가 직접 입력한 것만 반영한다.',
    true
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  rules text not null default '',
  image_url text,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  world_id uuid references public.worlds(id) on delete set null,
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
  world_id uuid references public.worlds(id) on delete set null,
  scope text not null default 'independent' check (scope in ('independent', 'world')),
  is_enabled boolean not null default true,
  name text not null,
  description text not null default '',
  gender text not null default '',
  age text not null default '',
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
  role_note text not null default '',
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  primary key (story_id, character_id)
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
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

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_key text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_key)
);

create table if not exists public.character_likes (
  character_id uuid not null references public.characters(id) on delete cascade,
  user_key text not null,
  created_at timestamptz not null default now(),
  primary key (character_id, user_key)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_key text,
  category text not null default 'notice' check (category in ('attendance', 'notice', 'system')),
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gemini_api_assignments (
  assignment_key text primary key,
  slot_index integer not null check (slot_index >= 0),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_creator_id_idx on public.stories (creator_id);
create index if not exists worlds_creator_id_idx on public.worlds (creator_id);
create index if not exists stories_world_id_idx on public.stories (world_id);
create index if not exists characters_creator_id_idx on public.characters (creator_id);
create index if not exists characters_world_id_idx on public.characters (world_id);
create index if not exists characters_scope_idx on public.characters (scope, visibility, is_enabled);
create index if not exists user_follows_following_id_idx on public.user_follows (following_id);
create index if not exists user_follows_follower_id_idx on public.user_follows (follower_id);
create index if not exists characters_story_id_idx on public.characters (story_id);
create index if not exists chat_sessions_user_id_idx on public.chat_sessions (user_id);
create index if not exists chat_sessions_story_id_idx on public.chat_sessions (story_id);
create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at);
create index if not exists memory_entries_session_type_idx on public.memory_entries (session_id, type, updated_at desc);
create index if not exists memory_entries_subject_idx on public.memory_entries (session_id, type, subject_key);
create index if not exists story_likes_story_id_idx on public.story_likes (story_id);
create index if not exists character_likes_character_id_idx on public.character_likes (character_id);
create index if not exists notifications_user_created_idx on public.notifications (user_key, created_at desc);
create index if not exists user_personas_user_default_idx on public.user_personas (user_id, is_default desc, created_at);
create index if not exists gemini_api_assignments_slot_seen_idx on public.gemini_api_assignments (slot_index, last_seen_at desc);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.worlds to anon, authenticated;
grant select on public.stories to anon, authenticated;
grant select on public.characters to anon, authenticated;
grant select, insert, update, delete on public.user_personas to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.memory_entries to authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;

alter table public.profiles enable row level security;
alter table public.app_profiles enable row level security;
alter table public.worlds enable row level security;
alter table public.stories enable row level security;
alter table public.characters enable row level security;
alter table public.story_characters enable row level security;
alter table public.user_follows enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.memory_entries enable row level security;
alter table public.story_likes enable row level security;
alter table public.character_likes enable row level security;
alter table public.notifications enable row level security;
alter table public.user_personas enable row level security;
alter table public.user_settings enable row level security;
alter table public.gemini_api_assignments enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "app profile readable" on public.app_profiles;
create policy "app profile readable" on public.app_profiles
  for select using (true);

drop policy if exists "app profile writable by service path" on public.app_profiles;
create policy "app profile writable by service path" on public.app_profiles
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users read own personas" on public.user_personas;
create policy "users read own personas" on public.user_personas
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own personas" on public.user_personas;
create policy "users insert own personas" on public.user_personas
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own personas" on public.user_personas;
create policy "users update own personas" on public.user_personas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own personas" on public.user_personas;
create policy "users delete own personas" on public.user_personas
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users manage own settings" on public.user_settings;
create policy "users manage own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notifications readable" on public.notifications;
create policy "notifications readable" on public.notifications
  for select using (true);

drop policy if exists "public worlds readable" on public.worlds;
create policy "public worlds readable" on public.worlds
  for select using (visibility = 'public' or auth.uid() = creator_id);

drop policy if exists "creators manage own worlds" on public.worlds;
create policy "creators manage own worlds" on public.worlds
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

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

drop policy if exists "user_follows_select_public" on public.user_follows;
create policy "user_follows_select_public" on public.user_follows
  for select using (true);

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own" on public.user_follows
  for insert to authenticated
  with check ((select auth.uid()) = follower_id);

drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own" on public.user_follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id);

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

drop policy if exists "story assets are publicly readable" on storage.objects;
create policy "story assets are publicly readable" on storage.objects
  for select using (bucket_id = 'story-assets');

drop policy if exists "gemini assignments service only" on public.gemini_api_assignments;
create policy "gemini assignments service only" on public.gemini_api_assignments
  for all to service_role
  using (true)
  with check (true);
