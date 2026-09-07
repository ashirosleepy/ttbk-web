-- ============================================================
-- 003_point_adjustments.sql
-- Bảng ghi các khoản CỘNG/TRỪ điểm không gắn với việc "hoàn thành":
--   - reason = 'bo_viec'  -> trừ điểm khi 1 việc bị đánh dấu "Không hoàn thành"
--   - reason = 'xin_doi'  -> trừ điểm khi xin đổi việc và có người khác nhận thành công
--
-- Tổng điểm của 1 người = tổng points của các task đã hoàn thành (status = 'hoan_thanh')
-- + tổng delta của người đó trong bảng này. Xem fetchMemberPointsMap() trong js/utils.js.
-- ============================================================

create table if not exists point_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid references tasks(id) on delete set null,
  delta integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists point_adjustments_user_idx on point_adjustments(user_id);
create index if not exists point_adjustments_task_idx on point_adjustments(task_id);

-- Bật RLS. Policy dưới đây cho phép mọi thành viên đã đăng nhập đọc/ghi/xoá,
-- giống tinh thần "cả nhà cùng thấy hết" của các bảng khác trong app. Nếu các
-- bảng tasks/notifications của bạn đang dùng policy chặt hơn (vd chỉ own household),
-- hãy sửa lại các policy này cho khớp thay vì dùng nguyên văn.
alter table point_adjustments enable row level security;

create policy "point_adjustments_select" on point_adjustments
  for select using (true);

create policy "point_adjustments_insert" on point_adjustments
  for insert with check (true);

create policy "point_adjustments_delete" on point_adjustments
  for delete using (true);

-- LƯU Ý: cột tasks.status hiện có thêm giá trị mới 'bo_lo' (đánh dấu "Không hoàn thành").
-- Nếu bảng tasks của bạn có ràng buộc CHECK giới hạn các giá trị status hợp lệ,
-- cần nới ràng buộc đó ra, ví dụ (đổi đúng tên constraint hiện có của bạn):
--
--   alter table tasks drop constraint tasks_status_check;
--   alter table tasks add constraint tasks_status_check
--     check (status in ('cho_nhan', 'chua_lam', 'dang_cho', 'hoan_thanh', 'bo_lo'));
