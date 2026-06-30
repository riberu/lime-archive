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

alter table public.stories
  add column if not exists world_id uuid references public.worlds(id) on delete set null;

alter table public.characters
  add column if not exists world_id uuid references public.worlds(id) on delete set null,
  add column if not exists scope text not null default 'independent' check (scope in ('independent', 'world')),
  add column if not exists is_enabled boolean not null default true;

alter table public.story_characters
  add column if not exists role_note text not null default '',
  add column if not exists is_enabled boolean not null default true;

create index if not exists worlds_creator_id_idx on public.worlds (creator_id);
create index if not exists stories_world_id_idx on public.stories (world_id);
create index if not exists characters_world_id_idx on public.characters (world_id);
create index if not exists characters_scope_idx on public.characters (scope, visibility, is_enabled);

grant select on public.worlds to anon, authenticated;
grant all privileges on public.worlds to service_role;
alter table public.worlds enable row level security;

drop policy if exists "public worlds readable" on public.worlds;
create policy "public worlds readable" on public.worlds
  for select using (visibility = 'public' or auth.uid() = creator_id);

drop policy if exists "creators manage own worlds" on public.worlds;
create policy "creators manage own worlds" on public.worlds
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

with dma_story as (
  select id, creator_id, title, description, system_prompt, thumbnail_url, visibility
  from public.stories
  where id = '73a3be1a-c3e7-41d4-9e09-d1b9ad9b731e'
),
upsert_world as (
  insert into public.worlds (creator_id, title, description, rules, image_url, visibility)
  select creator_id, 'DMA 용인관리청 세계관', description, system_prompt, thumbnail_url, 'private'
  from dma_story
  where not exists (
    select 1 from public.worlds
    where title = 'DMA 용인관리청 세계관'
    and creator_id = dma_story.creator_id
  )
  returning id
),
target_world as (
  select id from upsert_world
  union
  select worlds.id
  from public.worlds
  join dma_story on worlds.creator_id = dma_story.creator_id
  where worlds.title = 'DMA 용인관리청 세계관'
  limit 1
)
update public.stories
set world_id = (select id from target_world),
    updated_at = now()
where id = '73a3be1a-c3e7-41d4-9e09-d1b9ad9b731e';

update public.characters
set scope = case when story_id is null then scope else 'world' end,
    world_id = coalesce(world_id, (select world_id from public.stories where id = characters.story_id)),
    is_enabled = true,
    updated_at = now()
where story_id is not null;

update public.story_characters
set role = 'base',
    is_enabled = true
where story_id = '73a3be1a-c3e7-41d4-9e09-d1b9ad9b731e';
