-- ============================================================
-- SCHEMA CHO APP "SỔ TAY NHÓM" — quản lý công việc & chi tiêu
-- Dành cho nhóm 4 thành viên (HSSV)
-- Copy toàn bộ file này, dán vào Supabase > SQL Editor > Run
-- ============================================================

-- 1) BẬT extension tạo UUID (thường Supabase đã bật sẵn, chạy lại cũng không sao)
create extension if not exists "pgcrypto";

-- ============================================================
-- 2) BẢNG PROFILES — thông tin thành viên (map 1-1 với auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default 'Thành viên',
  avatar_emoji text not null default '🧑‍🎓',
  created_at timestamptz not null default now()
);

-- Tự động tạo 1 dòng profiles mỗi khi có người đăng ký (auth.users) mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3) BẢNG TASKS — công việc của nhóm
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4) BẢNG EXPENSES — khoản chi của nhóm
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) on delete set null,
  category text default 'Khác',
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5) BẢNG EXPENSE_SHARES — chia mỗi khoản chi cho từng thành viên
-- ============================================================
create table if not exists public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_amount numeric(12,2) not null check (share_amount >= 0),
  is_settled boolean not null default false,
  unique (expense_id, user_id)
);

-- ============================================================
-- 6) BẬT ROW LEVEL SECURITY (RLS)
-- Nhóm chỉ có 4 người tin tưởng nhau, nên chính sách đơn giản:
-- ai đã đăng nhập (authenticated) thì được xem/thêm/sửa/xoá tất cả.
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;

-- PROFILES: ai đăng nhập cũng xem được danh sách 4 thành viên
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- TASKS: authenticated user được xem / thêm / sửa / xoá mọi task trong nhóm
drop policy if exists "tasks_all_authenticated" on public.tasks;
create policy "tasks_all_authenticated" on public.tasks
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- EXPENSES: tương tự
drop policy if exists "expenses_all_authenticated" on public.expenses;
create policy "expenses_all_authenticated" on public.expenses
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- EXPENSE_SHARES: tương tự
drop policy if exists "expense_shares_all_authenticated" on public.expense_shares;
create policy "expense_shares_all_authenticated" on public.expense_shares
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 7) (TÙY CHỌN) Bật realtime để nhiều người thấy cập nhật ngay lập tức
-- Vào Supabase Dashboard > Database > Replication > bật cho 3 bảng:
-- tasks, expenses, expense_shares
-- ============================================================
