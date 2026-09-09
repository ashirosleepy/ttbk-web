-- ============================================================
-- SCHEMA CHO ỨNG DỤNG VIỆC NHÀ TTBK — BẢN 2 (có luân phiên + đổi việc + thông báo)
-- File này AN TOÀN ĐỂ CHẠY LẠI (idempotent) dù bạn đã chạy bản 1 trước đó chưa.
-- Copy toàn bộ, dán vào Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. profiles — 4 thành viên
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_color text not null default '#3B6E8F',
  household text not null default 'Nhà TTBK',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. rotation_queues — hàng đợi luân phiên dùng cho việc phát sinh
--    (đổ rác, thay bình nước, đi chợ...) và việc lặp lại xoay vòng
--    (tổng vệ sinh WC, giặt chăn gối, trực đun nước...)
-- ------------------------------------------------------------
create table if not exists rotation_queues (
  id uuid primary key default gen_random_uuid(),
  label text not null,                 -- "Đổ rác", "Thay bình nước"...
  icon text not null default '🔁',
  member_order uuid[] not null,        -- thứ tự luân phiên, vd [Tiến, Tài, Bách, Khoa]
  current_index int not null default 0,
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. tasks — các việc cần làm
--    status thêm 'cho_nhan': việc phát sinh/luân phiên đang chờ người
--    được gán bấm "Nhận việc" thì mới chuyển sang chua_lam
-- ------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  schedule_id uuid,
  rotation_queue_id uuid,
  due_date date not null default current_date,
  status text not null default 'chua_lam',
  priority text not null default 'binh_thuong'
    check (priority in ('thap', 'binh_thuong', 'cao')),
  points int not null default 10,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('cho_nhan', 'chua_lam', 'dang_cho', 'hoan_thanh', 'bo_lo', 'vo_chu'));

alter table tasks add column if not exists rotation_queue_id uuid;
alter table tasks drop constraint if exists tasks_rotation_queue_id_fkey;
alter table tasks add constraint tasks_rotation_queue_id_fkey
  foreign key (rotation_queue_id) references rotation_queues(id) on delete set null;

-- ------------------------------------------------------------
-- 4. task_history — lịch sử thay đổi
-- ------------------------------------------------------------
create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. schedules — việc lặp lại định kỳ
--    có thể gán CỐ ĐỊNH (assigned_to) hoặc LUÂN PHIÊN (rotation_queue_id)
-- ------------------------------------------------------------
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  rotation_queue_id uuid,
  repeat_type text not null check (repeat_type in ('daily', 'weekly')),
  repeat_days int[] default '{}',      -- 0=CN..6=T7, chỉ dùng khi weekly
  start_date date not null default current_date,
  end_date date,
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tasks drop constraint if exists tasks_schedule_id_fkey;
alter table tasks add constraint tasks_schedule_id_fkey
  foreign key (schedule_id) references schedules(id) on delete set null;

alter table schedules add column if not exists rotation_queue_id uuid;
alter table schedules drop constraint if exists schedules_rotation_queue_id_fkey;
alter table schedules add constraint schedules_rotation_queue_id_fkey
  foreign key (rotation_queue_id) references rotation_queues(id) on delete set null;

-- ------------------------------------------------------------
-- 6. task_exchanges — yêu cầu đổi việc (ai nhận trước thì được)
-- ------------------------------------------------------------
create table if not exists task_exchanges (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  from_user uuid references profiles(id) on delete set null,
  to_user uuid references profiles(id) on delete set null,
  reason text,
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ------------------------------------------------------------
-- 7. notifications — thông báo, có thể kèm hành động (nhận việc / nhận đổi việc)
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications add column if not exists type text not null default 'thong_bao';
alter table notifications add column if not exists exchange_id uuid;
alter table notifications drop constraint if exists notifications_exchange_id_fkey;
alter table notifications add constraint notifications_exchange_id_fkey
  foreign key (exchange_id) references task_exchanges(id) on delete set null;

-- ------------------------------------------------------------
-- 8. Tự tạo hồ sơ khi có tài khoản mới
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, initcap(split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 9. Bật Row Level Security — chỉ ai đăng nhập mới đọc/ghi được
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_history enable row level security;
alter table schedules enable row level security;
alter table notifications enable row level security;
alter table rotation_queues enable row level security;
alter table task_exchanges enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

drop policy if exists "tasks_select_all" on tasks;
create policy "tasks_select_all" on tasks for select using (auth.role() = 'authenticated');
drop policy if exists "tasks_insert_all" on tasks;
create policy "tasks_insert_all" on tasks for insert with check (auth.role() = 'authenticated');
drop policy if exists "tasks_update_all" on tasks;
create policy "tasks_update_all" on tasks for update using (auth.role() = 'authenticated');
drop policy if exists "tasks_delete_all" on tasks;
create policy "tasks_delete_all" on tasks for delete using (auth.role() = 'authenticated');

drop policy if exists "history_select_all" on task_history;
create policy "history_select_all" on task_history for select using (auth.role() = 'authenticated');
drop policy if exists "history_insert_all" on task_history;
create policy "history_insert_all" on task_history for insert with check (auth.role() = 'authenticated');

drop policy if exists "schedules_select_all" on schedules;
create policy "schedules_select_all" on schedules for select using (auth.role() = 'authenticated');
drop policy if exists "schedules_insert_all" on schedules;
create policy "schedules_insert_all" on schedules for insert with check (auth.role() = 'authenticated');
drop policy if exists "schedules_update_all" on schedules;
create policy "schedules_update_all" on schedules for update using (auth.role() = 'authenticated');
drop policy if exists "schedules_delete_all" on schedules;
create policy "schedules_delete_all" on schedules for delete using (auth.role() = 'authenticated');

drop policy if exists "notif_select_own" on notifications;
create policy "notif_select_own" on notifications for select using (auth.uid() = user_id);
drop policy if exists "notif_insert_all" on notifications;
create policy "notif_insert_all" on notifications for insert with check (auth.role() = 'authenticated');
drop policy if exists "notif_update_own" on notifications;
create policy "notif_update_own" on notifications for update using (auth.uid() = user_id);

drop policy if exists "rotations_select_all" on rotation_queues;
create policy "rotations_select_all" on rotation_queues for select using (auth.role() = 'authenticated');
drop policy if exists "rotations_insert_all" on rotation_queues;
create policy "rotations_insert_all" on rotation_queues for insert with check (auth.role() = 'authenticated');
drop policy if exists "rotations_update_all" on rotation_queues;
create policy "rotations_update_all" on rotation_queues for update using (auth.role() = 'authenticated');
drop policy if exists "rotations_delete_all" on rotation_queues;
create policy "rotations_delete_all" on rotation_queues for delete using (auth.role() = 'authenticated');

drop policy if exists "exchanges_select_all" on task_exchanges;
create policy "exchanges_select_all" on task_exchanges for select using (auth.role() = 'authenticated');
drop policy if exists "exchanges_insert_all" on task_exchanges;
create policy "exchanges_insert_all" on task_exchanges for insert with check (auth.role() = 'authenticated');
drop policy if exists "exchanges_update_all" on task_exchanges;
create policy "exchanges_update_all" on task_exchanges for update using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 10. Bật Realtime — để màn hình mọi người tự cập nhật khi có thay đổi
--     Nếu dòng nào báo lỗi "already member of publication" thì bỏ qua, không sao cả.
-- ------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table notifications;
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- XONG! Nếu là lần đầu chạy: vào Authentication -> Users -> Add user
-- để tạo 4 tài khoản. Nếu đã chạy bản 1 trước đó: chỉ cần chạy lại
-- toàn bộ file này 1 lần, dữ liệu cũ (profiles, tasks...) vẫn giữ nguyên.
-- ============================================================
