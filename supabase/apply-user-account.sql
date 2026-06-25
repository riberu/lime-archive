create extension if not exists pgcrypto;

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

insert into public.profiles (id, display_name, avatar_url)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    split_part(users.email, '@', 1),
    'New user'
  ),
  nullif(coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'), '')
from auth.users
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url;

insert into public.app_profiles (id, display_name, bio, avatar_url, updated_at)
select
  users.id::text,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    split_part(users.email, '@', 1),
    'New user'
  ),
  '',
  nullif(coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'), ''),
  now()
from auth.users
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.user_settings (user_id)
select users.id
from auth.users
on conflict (user_id) do nothing;

insert into public.user_personas (user_id, name, appearance, speech_style, memo, is_default)
select
  users.id,
  '리화',
  '검은 머리와 차분한 눈빛을 가진 미등록 용인. 겉으로는 침착하지만 낯선 상황을 빠르게 관찰한다.',
  '짧고 조심스럽게 말한다. 감정을 크게 드러내기보다 필요한 말만 먼저 꺼낸다.',
  '리화는 혈통, 계열, 능력이 아직 공식 등록되지 않은 용인이다. 리화의 대사와 행동은 플레이어가 직접 입력한 것만 반영한다.',
  true
from auth.users
where not exists (
  select 1 from public.user_personas
  where user_personas.user_id = users.id
);

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

create index if not exists user_personas_user_default_idx
on public.user_personas (user_id, is_default desc, created_at);

grant select, insert, update, delete on public.user_personas to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select on public.app_admins to authenticated;
grant all privileges on public.user_personas to service_role;
grant all privileges on public.user_settings to service_role;
grant all privileges on public.app_admins to service_role;

alter table public.user_personas enable row level security;
alter table public.user_settings enable row level security;
alter table public.app_admins enable row level security;

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

drop policy if exists "admins can read admin list" on public.app_admins;
create policy "admins can read admin list" on public.app_admins
  for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')));

notify pgrst, 'reload schema';
