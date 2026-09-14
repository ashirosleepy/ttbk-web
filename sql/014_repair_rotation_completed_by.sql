-- Sửa điểm lịch sử của task luân phiên bị ghi cho người bấm hoàn thành
-- thay vì người được giao.
-- Chạy sau sql/013_allow_helping_open_tasks.sql.

update tasks as t
set completed_by = t.assigned_to
where t.rotation_queue_id is not null
  and t.status = 'hoan_thanh'
  and t.assigned_to is not null
  and t.completed_by is distinct from t.assigned_to;