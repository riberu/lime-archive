create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paid_balance integer not null default 0,
  free_balance integer not null default 0,
  lifetime_paid_purchased integer not null default 0,
  lifetime_free_earned integer not null default 0,
  lifetime_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_balance_bounds check (
    free_balance >= 0
    and paid_balance >= -99999999
  )
);

create table if not exists public.currency_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency_type text not null check (currency_type in ('paid', 'free', 'mixed')),
  transaction_type text not null check (
    transaction_type in (
      'purchase',
      'spend',
      'attendance',
      'refund',
      'admin_grant',
      'adjustment'
    )
  ),
  amount integer not null,
  paid_delta integer not null default 0,
  free_delta integer not null default 0,
  paid_balance_after integer not null,
  free_balance_after integer not null,
  reason text not null default '',
  reference_type text not null default '',
  reference_id text not null default '',
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'toss')),
  order_id text not null,
  payment_key text,
  provider_transaction_id text,
  product_id text not null default '',
  amount_krw integer not null default 0,
  paid_coin_amount integer not null default 0,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled')
  ),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, order_id),
  unique (provider, payment_key),
  unique (provider, provider_transaction_id)
);

create table if not exists public.attendance_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null,
  streak_count integer not null default 1,
  reward_amount integer not null default 300,
  bonus_amount integer not null default 0,
  transaction_id uuid references public.currency_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, reward_date)
);

create index if not exists currency_transactions_user_created_idx
  on public.currency_transactions (user_id, created_at desc);
create index if not exists currency_transactions_reference_idx
  on public.currency_transactions (reference_type, reference_id);
create index if not exists purchase_receipts_user_created_idx
  on public.purchase_receipts (user_id, created_at desc);
create index if not exists attendance_rewards_user_date_idx
  on public.attendance_rewards (user_id, reward_date desc);

create or replace function public.ensure_wallet(target_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  next_wallet public.wallets;
begin
  insert into public.wallets (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select * into next_wallet
  from public.wallets
  where user_id = target_user_id;

  return next_wallet;
end;
$$;

create or replace function public.spend_wallet_balance(
  target_user_id uuid,
  spend_amount integer,
  spend_reason text,
  spend_reference_type text default '',
  spend_reference_id text default '',
  spend_idempotency_key text default null,
  spend_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  paid_spent integer,
  free_spent integer,
  paid_balance_after integer,
  free_balance_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_wallet public.wallets;
  existing_tx public.currency_transactions;
  use_free integer;
  use_paid integer;
  new_paid integer;
  new_free integer;
  inserted_tx_id uuid;
begin
  if spend_amount <= 0 then
    raise exception 'spend_amount must be positive';
  end if;

  if spend_idempotency_key is not null then
    select * into existing_tx
    from public.currency_transactions
    where idempotency_key = spend_idempotency_key;

    if existing_tx.id is not null then
      transaction_id := existing_tx.id;
      paid_spent := greatest(-existing_tx.paid_delta, 0);
      free_spent := greatest(-existing_tx.free_delta, 0);
      paid_balance_after := existing_tx.paid_balance_after;
      free_balance_after := existing_tx.free_balance_after;
      return next;
      return;
    end if;
  end if;

  perform public.ensure_wallet(target_user_id);

  select * into locked_wallet
  from public.wallets
  where user_id = target_user_id
  for update;

  if locked_wallet.free_balance + locked_wallet.paid_balance < spend_amount then
    raise exception 'insufficient_balance';
  end if;

  use_free := least(locked_wallet.free_balance, spend_amount);
  use_paid := spend_amount - use_free;
  new_free := locked_wallet.free_balance - use_free;
  new_paid := locked_wallet.paid_balance - use_paid;

  update public.wallets
  set
    free_balance = new_free,
    paid_balance = new_paid,
    lifetime_spent = lifetime_spent + spend_amount,
    updated_at = now()
  where user_id = target_user_id;

  insert into public.currency_transactions (
    user_id,
    currency_type,
    transaction_type,
    amount,
    paid_delta,
    free_delta,
    paid_balance_after,
    free_balance_after,
    reason,
    reference_type,
    reference_id,
    idempotency_key,
    metadata
  )
  values (
    target_user_id,
    case
      when use_paid > 0 and use_free > 0 then 'mixed'
      when use_paid > 0 then 'paid'
      else 'free'
    end,
    'spend',
    -spend_amount,
    -use_paid,
    -use_free,
    new_paid,
    new_free,
    spend_reason,
    spend_reference_type,
    spend_reference_id,
    spend_idempotency_key,
    spend_metadata
  )
  returning id into inserted_tx_id;

  transaction_id := inserted_tx_id;
  paid_spent := use_paid;
  free_spent := use_free;
  paid_balance_after := new_paid;
  free_balance_after := new_free;
  return next;
end;
$$;

create or replace function public.grant_wallet_balance(
  target_user_id uuid,
  grant_paid integer default 0,
  grant_free integer default 0,
  grant_type text default 'adjustment',
  grant_reason text default '',
  grant_reference_type text default '',
  grant_reference_id text default '',
  grant_idempotency_key text default null,
  grant_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  paid_balance_after integer,
  free_balance_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_wallet public.wallets;
  existing_tx public.currency_transactions;
  new_paid integer;
  new_free integer;
  inserted_tx_id uuid;
begin
  if grant_paid = 0 and grant_free = 0 then
    raise exception 'grant amount is empty';
  end if;

  if grant_type not in ('purchase', 'attendance', 'refund', 'admin_grant', 'adjustment') then
    raise exception 'invalid grant_type';
  end if;

  if grant_idempotency_key is not null then
    select * into existing_tx
    from public.currency_transactions
    where idempotency_key = grant_idempotency_key;

    if existing_tx.id is not null then
      transaction_id := existing_tx.id;
      paid_balance_after := existing_tx.paid_balance_after;
      free_balance_after := existing_tx.free_balance_after;
      return next;
      return;
    end if;
  end if;

  perform public.ensure_wallet(target_user_id);

  select * into locked_wallet
  from public.wallets
  where user_id = target_user_id
  for update;

  new_paid := locked_wallet.paid_balance + grant_paid;
  new_free := locked_wallet.free_balance + grant_free;

  if new_free < 0 then
    raise exception 'free balance cannot be negative';
  end if;

  update public.wallets
  set
    paid_balance = new_paid,
    free_balance = new_free,
    lifetime_paid_purchased = lifetime_paid_purchased + case when grant_type = 'purchase' and grant_paid > 0 then grant_paid else 0 end,
    lifetime_free_earned = lifetime_free_earned + case when grant_type in ('attendance', 'admin_grant') and grant_free > 0 then grant_free else 0 end,
    updated_at = now()
  where user_id = target_user_id;

  insert into public.currency_transactions (
    user_id,
    currency_type,
    transaction_type,
    amount,
    paid_delta,
    free_delta,
    paid_balance_after,
    free_balance_after,
    reason,
    reference_type,
    reference_id,
    idempotency_key,
    metadata
  )
  values (
    target_user_id,
    case
      when grant_paid <> 0 and grant_free <> 0 then 'mixed'
      when grant_paid <> 0 then 'paid'
      else 'free'
    end,
    grant_type,
    grant_paid + grant_free,
    grant_paid,
    grant_free,
    new_paid,
    new_free,
    grant_reason,
    grant_reference_type,
    grant_reference_id,
    grant_idempotency_key,
    grant_metadata
  )
  returning id into inserted_tx_id;

  transaction_id := inserted_tx_id;
  paid_balance_after := new_paid;
  free_balance_after := new_free;
  return next;
end;
$$;

revoke all on function public.ensure_wallet(uuid) from public;
revoke all on function public.spend_wallet_balance(uuid, integer, text, text, text, text, jsonb) from public;
revoke all on function public.grant_wallet_balance(uuid, integer, integer, text, text, text, text, text, jsonb) from public;
grant execute on function public.ensure_wallet(uuid) to service_role;
grant execute on function public.spend_wallet_balance(uuid, integer, text, text, text, text, jsonb) to service_role;
grant execute on function public.grant_wallet_balance(uuid, integer, integer, text, text, text, text, text, jsonb) to service_role;

create or replace function public.handle_new_profile_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_profile_wallet() from public;

drop trigger if exists on_profile_wallet_created on public.profiles;
create trigger on_profile_wallet_created
after insert on public.profiles
for each row execute function public.handle_new_profile_wallet();

grant select on public.wallets to authenticated;
grant select on public.currency_transactions to authenticated;
grant select on public.purchase_receipts to authenticated;
grant select on public.attendance_rewards to authenticated;
grant all privileges on public.wallets to service_role;
grant all privileges on public.currency_transactions to service_role;
grant all privileges on public.purchase_receipts to service_role;
grant all privileges on public.attendance_rewards to service_role;

alter table public.wallets enable row level security;
alter table public.currency_transactions enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.attendance_rewards enable row level security;

drop policy if exists "users read own wallet" on public.wallets;
create policy "users read own wallet" on public.wallets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "wallets service only" on public.wallets;
create policy "wallets service only" on public.wallets
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users read own currency transactions" on public.currency_transactions;
create policy "users read own currency transactions" on public.currency_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "currency transactions service only" on public.currency_transactions;
create policy "currency transactions service only" on public.currency_transactions
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users read own purchase receipts" on public.purchase_receipts;
create policy "users read own purchase receipts" on public.purchase_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "purchase receipts service only" on public.purchase_receipts;
create policy "purchase receipts service only" on public.purchase_receipts
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users read own attendance rewards" on public.attendance_rewards;
create policy "users read own attendance rewards" on public.attendance_rewards
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "attendance rewards service only" on public.attendance_rewards;
create policy "attendance rewards service only" on public.attendance_rewards
  for all to service_role
  using (true)
  with check (true);
