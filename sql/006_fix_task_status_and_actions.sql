-- Cho phép đánh dấu không hoàn thành.
-- Các thao tác task đã có policy update cho mọi người dùng đăng nhập.

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('cho_nhan', 'chua_lam', 'dang_cho', 'hoan_thanh', 'bo_lo', 'vo_chu'));