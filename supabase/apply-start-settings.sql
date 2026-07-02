alter table public.stories
  add column if not exists start_settings jsonb not null default '[]'::jsonb;

update public.stories
set start_settings = jsonb_build_array(
  jsonb_build_object(
    'id', 'default',
    'mode', 'scene',
    'title', '기본 설정',
    'description', '기존 스토리의 기본 시작 장면입니다.',
    'openingMessage', coalesce(opening_message, ''),
    'currentScene', coalesce(current_scene, ''),
    'statusText', coalesce(status_text, ''),
    'guide', '',
    'suggestedReplies', '[]'::jsonb
  )
)
where start_settings = '[]'::jsonb
  and (
    coalesce(opening_message, '') <> ''
    or coalesce(current_scene, '') <> ''
    or coalesce(status_text, '') <> ''
  );
