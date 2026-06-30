create table if not exists public.gemini_api_assignments (
  assignment_key text primary key,
  slot_index integer not null check (slot_index >= 0),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gemini_api_assignments_slot_seen_idx
  on public.gemini_api_assignments (slot_index, last_seen_at desc);

grant all privileges on public.gemini_api_assignments to service_role;

alter table public.gemini_api_assignments enable row level security;

drop policy if exists "gemini assignments service only" on public.gemini_api_assignments;
create policy "gemini assignments service only" on public.gemini_api_assignments
  for all to service_role
  using (true)
  with check (true);
