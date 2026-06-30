alter table public.characters
  add column if not exists gender text not null default '',
  add column if not exists age text not null default '';

notify pgrst, 'reload schema';
