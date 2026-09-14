-- ============================================================
-- 011_repair_fairness_points.sql
-- Sửa các task hoàn thành từ thời điểm assigned_to bị đổi nhầm
-- sang người khác sau khi hoàn thành.
-- Chạy file này một lần trong Supabase SQL Editor.
-- ============================================================

-- completed_by là nguồn ghi nhận người thực sự hoàn thành. Với dữ liệu cũ
-- chưa có cột này, lấy lần ghi lịch sử "hoan_thanh" đầu tiên.
with first_completion as (
  select distinct on (task_id) task_id, user_id
  from task_history
  where action = 'hoan_thanh'
  order by task_id, created_at asc
)
update tasks as t
set
  completed_by = fc.user_id,
  assigned_to = fc.user_id
from first_completion as fc
where t.id = fc.task_id
  and t.status = 'hoan_thanh'
  and t.completed_by is null
  and t.assigned_to is distinct from fc.user_id;
