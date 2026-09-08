-- Bảng lưu subscription push của từng thiết bị/trình duyệt
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Mỗi người chỉ được đọc/ghi/xoá subscription của chính mình
create policy "push_subscriptions_select_own"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on push_subscriptions for update
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on push_subscriptions for delete
  using (auth.uid() = user_id);
