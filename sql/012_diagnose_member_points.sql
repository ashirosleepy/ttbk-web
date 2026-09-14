-- Chạy truy vấn này trong Supabase SQL Editor để xác định tầng dữ liệu
-- đang gán nhầm điểm giữa Tiến và Tài. Truy vấn chỉ đọc, không sửa dữ liệu.

-- 1) Kiểm tra UUID thực tế của hai hồ sơ.
select id, name
from profiles
where name in ('Tiến', 'Tài')
order by name;

-- 2) Các task hoàn thành có người được giao khác người nhận điểm.
select
  t.id,
  t.title,
  t.points,
  assigned.name as assigned_name,
  completed.name as completed_name,
  t.assigned_to,
  t.completed_by
from tasks t
left join profiles assigned on assigned.id = t.assigned_to
left join profiles completed on completed.id = t.completed_by
where t.status = 'hoan_thanh'
  and t.assigned_to is distinct from t.completed_by
order by t.completed_at desc;

-- 3) Tổng điểm theo UUID, kèm tên profile để đối chiếu với giao diện.
select
  p.name,
  p.id,
  coalesce(done.total, 0) as completed_points,
  coalesce(adj.total, 0) as adjustment_points,
  coalesce(done.total, 0) + coalesce(adj.total, 0) as total_points
from profiles p
left join (
  select completed_by as user_id, sum(points) as total
  from tasks
  where status = 'hoan_thanh'
  group by completed_by
) done on done.user_id = p.id
left join (
  select user_id, sum(delta) as total
  from point_adjustments
  group by user_id
) adj on adj.user_id = p.id
where p.name in ('Tiến', 'Tài')
order by p.name;