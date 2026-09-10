-- ============================================================
-- 007_shopping_and_expenses.sql
-- Chuyển module "🛒 Nhà cần gì?" từ localStorage (mỗi máy 1 kiểu)
-- sang Supabase (cả nhà nhìn thấy chung), và thêm bảng "expenses"
-- để lúc mua đồ ghi thẳng luôn ai trả bao nhiêu tiền.
--
-- An toàn để chạy lại (idempotent). Dán vào Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. shopping_items — danh sách đồ dùng của nhà
-- ------------------------------------------------------------
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'tieu_hao'
    check (category in ('tieu_hao', 'du_phong', 'dinh_ky', 'phat_sinh')),
  unit text,
  qty numeric not null default 0,
  min numeric not null default 0,
  ideal numeric,
  cycle_days int,
  last_restock date,
  -- báo nhanh 3 mức, không cần nhập số (xem shopping.js -> computeStatus)
  manual_level text check (manual_level in ('on', 'sap_het', 'het')),
  manual_by text,          -- tên người báo (lấy từ topbar, không ép FK profiles)
  manual_at text,          -- thời điểm báo, dạng chuỗi hiển thị sẵn (vi-VN)
  in_cart boolean not null default false,
  cart_priority text check (cart_priority in ('cao', 'binh_thuong', 'thap')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_items_category_idx on shopping_items(category);
create index if not exists shopping_items_in_cart_idx on shopping_items(in_cart);

-- Tự cập nhật updated_at mỗi lần sửa
create or replace function shopping_items_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_shopping_items_touch on shopping_items;
create trigger trg_shopping_items_touch
  before update on shopping_items
  for each row execute procedure shopping_items_touch_updated_at();

-- ------------------------------------------------------------
-- 2. shopping_purchase_log — lịch sử mua/thay, để tính chu kỳ trung bình
--    (dùng cho dự đoán "sắp hết" ở tab AI gợi ý)
-- ------------------------------------------------------------
create table if not exists shopping_purchase_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references shopping_items(id) on delete set null,
  item_name text not null,          -- lưu lại tên tại thời điểm mua, phòng khi món bị xoá
  qty numeric not null default 1,
  cost numeric,                     -- có thể để trống nếu không muốn ghi giá
  paid_by uuid references profiles(id) on delete set null,  -- ai trả tiền
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists shopping_purchase_log_item_idx on shopping_purchase_log(item_id);
create index if not exists shopping_purchase_log_date_idx on shopping_purchase_log(purchase_date);
create index if not exists shopping_purchase_log_paid_by_idx on shopping_purchase_log(paid_by);

-- ------------------------------------------------------------
-- 3. expenses — sổ chi tiêu chung của nhà (liên kết với trang Chi tiêu)
--    category dùng đúng key mà trang Chi_tiêu_TTBK.html đang có sẵn:
--    'food' | 'rent' | 'entertainment' | 'shopping' | 'other'
-- ------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'shopping',
  amount numeric not null check (amount > 0),
  paid_by uuid references profiles(id) on delete set null,
  expense_date date not null default current_date,
  -- 'manual' = tự nhập trong trang Chi tiêu, 'shopping' = tự sinh khi mua đồ ở "Nhà cần gì?"
  source text not null default 'manual' check (source in ('manual', 'shopping')),
  shopping_purchase_id uuid references shopping_purchase_log(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses(expense_date);
create index if not exists expenses_paid_by_idx on expenses(paid_by);
create index if not exists expenses_source_idx on expenses(source);

-- ------------------------------------------------------------
-- 4. RLS — theo đúng tinh thần "cả nhà cùng thấy hết" như bảng tasks
--    trong schema.sql (auth.role() = 'authenticated' cho mọi thao tác).
-- ------------------------------------------------------------
alter table shopping_items enable row level security;
alter table shopping_purchase_log enable row level security;
alter table expenses enable row level security;

drop policy if exists "shopping_items_select" on shopping_items;
create policy "shopping_items_select" on shopping_items for select using (auth.role() = 'authenticated');
drop policy if exists "shopping_items_insert" on shopping_items;
create policy "shopping_items_insert" on shopping_items for insert with check (auth.role() = 'authenticated');
drop policy if exists "shopping_items_update" on shopping_items;
create policy "shopping_items_update" on shopping_items for update using (auth.role() = 'authenticated');
drop policy if exists "shopping_items_delete" on shopping_items;
create policy "shopping_items_delete" on shopping_items for delete using (auth.role() = 'authenticated');

drop policy if exists "shopping_purchase_log_select" on shopping_purchase_log;
create policy "shopping_purchase_log_select" on shopping_purchase_log for select using (auth.role() = 'authenticated');
drop policy if exists "shopping_purchase_log_insert" on shopping_purchase_log;
create policy "shopping_purchase_log_insert" on shopping_purchase_log for insert with check (auth.role() = 'authenticated');
drop policy if exists "shopping_purchase_log_delete" on shopping_purchase_log;
create policy "shopping_purchase_log_delete" on shopping_purchase_log for delete using (auth.role() = 'authenticated');

drop policy if exists "expenses_select" on expenses;
create policy "expenses_select" on expenses for select using (auth.role() = 'authenticated');
drop policy if exists "expenses_insert" on expenses;
create policy "expenses_insert" on expenses for insert with check (auth.role() = 'authenticated');
drop policy if exists "expenses_update" on expenses;
create policy "expenses_update" on expenses for update using (auth.role() = 'authenticated');
drop policy if exists "expenses_delete" on expenses;
create policy "expenses_delete" on expenses for delete using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 5. Bật Realtime — để mọi thành viên tự thấy cập nhật ngay,
--    giống cách schema.sql đã bật cho tasks/notifications.
-- ------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table shopping_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table shopping_purchase_log;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table expenses;
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- LƯU Ý QUAN TRỌNG VỀ TRANG "Chi tiêu TTBK.html" HIỆN TẠI:
-- Trang đó đang lưu dữ liệu (yearsData) hoàn toàn trong biến JS,
-- KHÔNG đọc/ghi Supabase, KHÔNG có localStorage — tắt trình duyệt
-- là mất. Bảng "expenses" ở trên sẽ được js/shopping.js (bản mới)
-- ghi vào thật mỗi khi bạn mua đồ và nhập giá + người trả.
-- Nhưng trang Chi tiêu sẽ CHƯA tự hiển thị các khoản này cho tới khi
-- được sửa lại để đọc từ bảng "expenses" thay vì yearsData — đây là
-- việc tiếp theo nên làm nếu muốn 2 trang thực sự "thấy nhau".
-- ============================================================
