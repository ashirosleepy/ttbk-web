-- ============================================================
-- SCHEMA CHO ỨNG DỤNG VIỆC NHÀ TTBK (Tiến - Tài - Bách - Khoa)
-- Copy toàn bộ file này, dán vào Supabase -> SQL Editor -> Run
-- ============================================================

-- Bật tiện ích tạo UUID tự động
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. BẢNG profiles: thông tin 4 thành viên
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_color text not null default '#3B6E8F',
  household text not null default 'Nhà TTBK',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. BẢNG tasks: các việc nhà cần làm
-- ------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  schedule_id uuid, -- liên kết tới lịch lặp lại (nếu việc này do lịch sinh ra)
  due_date date not null default current_date,
  status text not null default 'chua_lam'
    check (status in ('chua_lam', 'dang_cho', 'hoan_thanh')),
  priority text not null default 'binh_thuong'
    check (priority in ('thap', 'binh_thuong', 'cao')),
  points int not null default 10,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ------------------------------------------------------------
-- 3. BẢNG task_history: lịch sử thay đổi (để tránh tranh cãi)
-- ------------------------------------------------------------
create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,       -- vd: 'tao_viec', 'hoan_thanh', 'doi_nguoi', 'gia_han', 'bao_ban', 'xoa_viec'
  detail text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. BẢNG schedules: việc lặp lại định kỳ
-- ------------------------------------------------------------
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  repeat_type text not null check (repeat_type in ('daily', 'weekly')),
  -- repeat_days: 0=Chủ Nhật .. 6=Thứ Bảy, chỉ dùng khi repeat_type = 'weekly'
  repeat_days int[] default '{}',
  start_date date not null default current_date,
  end_date date,
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tasks
  add constraint tasks_schedule_id_fkey
  foreign key (schedule_id) references schedules(id) on delete set null;

-- ------------------------------------------------------------
-- 5. BẢNG notifications: thông báo nhắc việc
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. TRIGGER: tự tạo profile khi tạo tài khoản mới trong Authentication
--    Tên mặc định lấy từ phần trước @ của email, có thể đổi sau ở trang Cài đặt
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
-- 7. BẬT ROW LEVEL SECURITY (RLS)
--    Nguyên tắc: chỉ ai đã đăng nhập (authenticated) mới đọc/ghi được dữ liệu.
--    Vì đây là app dùng chung trong nhà nên mọi thành viên đều thấy được việc của nhau.
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_history enable row level security;
alter table schedules enable row level security;
alter table notifications enable row level security;

-- profiles: ai cũng đọc được (để hiện tên/avatar), chỉ tự sửa hồ sơ của mình
create policy "profiles_select_all" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- tasks: mọi người trong nhà đều xem/thêm/sửa/xoá được (để đổi người làm, đánh dấu xong...)
create policy "tasks_select_all" on tasks
  for select using (auth.role() = 'authenticated');
create policy "tasks_insert_all" on tasks
  for insert with check (auth.role() = 'authenticated');
create policy "tasks_update_all" on tasks
  for update using (auth.role() = 'authenticated');
create policy "tasks_delete_all" on tasks
  for delete using (auth.role() = 'authenticated');

-- task_history: xem được hết, chỉ được thêm (không sửa/xoá lịch sử)
create policy "history_select_all" on task_history
  for select using (auth.role() = 'authenticated');
create policy "history_insert_all" on task_history
  for insert with check (auth.role() = 'authenticated');

-- schedules: mọi người quản lý lịch chung
create policy "schedules_select_all" on schedules
  for select using (auth.role() = 'authenticated');
create policy "schedules_insert_all" on schedules
  for insert with check (auth.role() = 'authenticated');
create policy "schedules_update_all" on schedules
  for update using (auth.role() = 'authenticated');
create policy "schedules_delete_all" on schedules
  for delete using (auth.role() = 'authenticated');

-- notifications: mỗi người chỉ thấy thông báo của chính mình
create policy "notif_select_own" on notifications
  for select using (auth.uid() = user_id);
create policy "notif_insert_all" on notifications
  for insert with check (auth.role() = 'authenticated');
create policy "notif_update_own" on notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- XONG! Bước tiếp theo: vào Authentication -> Users -> Add user
-- để tạo 4 tài khoản (tien@..., tai@..., bach@..., khoa@...).
-- Hồ sơ (profiles) sẽ tự động được tạo nhờ trigger ở trên.
-- ============================================================
