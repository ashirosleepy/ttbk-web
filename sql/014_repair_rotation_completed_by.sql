-- Sửa điểm lịch sử của task luân phiên bị ghi cho người đến lượt
-- thay vì người thực tế bấm hoàn thành.
-- Chạy sau sql/013_allow_helping_open_tasks.sql.

with first_completion as (
  select distinct on (task_id) task_id, user_id
  from task_history
  where action = 'hoan_thanh'
  order by task_id, created_at asc
)
update tasks as t
set completed_by = fc.user_id
from first_completion as fc
where t.id = fc.task_id
  and t.rotation_queue_id is not null
  and t.status = 'hoan_thanh'
  and t.completed_by is distinct from fc.user_id;