-- ============================================================
-- MIGRATION: chế độ "Đang đi vắng" (away mode)
-- Chạy trong Supabase SQL editor (Project -> SQL Editor -> New query)
-- ============================================================

-- 1. Thêm cột trạng thái đi vắng vào profiles
alter table profiles
  add column if not exists is_away boolean not null default false,
  add column if not exists away_from date,
  add column if not exists away_until date;

-- 2. Cho phép tasks.assigned_to = null, dùng cho trạng thái "vo_chu"
--    (việc cố định rơi vào ngày người phụ trách đi vắng, chưa ai nhận thay).
alter table tasks
  alter column assigned_to drop not null;

-- 3. (Khuyến nghị) Nếu tasks.assigned_to đang có ràng buộc CHECK / enum cho status,
--    thêm 'vo_chu' vào danh sách giá trị hợp lệ. Bỏ qua bước này nếu status là kiểu text tự do.
-- Ví dụ nếu bạn dùng CHECK constraint:
--   alter table tasks drop constraint if exists tasks_status_check;
--   alter table tasks add constraint tasks_status_check
--     check (status in ('cho_nhan','chua_lam','dang_cho','hoan_thanh','bo_lo','vo_chu'));
