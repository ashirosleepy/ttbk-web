-- ============================================================
-- 004_fix_completed_task_assignee.sql
-- Sửa lỗi: toggleTaskDone() (bản cũ) sau khi đánh dấu 1 việc "hoan_thanh" đã
-- ghi đè luôn cột assigned_to của chính task đó sang người "làm ít hơn" để
-- ưu tiên cho lần sau -> làm điểm bị tính nhầm cho người không thực sự làm.
-- Code đã được sửa (xem tasks.js mới, hàm toggleTaskDone không còn UPDATE
-- assigned_to sau khi hoàn thành nữa). File này chỉ sửa DỮ LIỆU CŨ đã bị sai.
-- ============================================================

-- BƯỚC 1 — XEM TRƯỚC (không sửa gì): so sánh assigned_to hiện tại của mỗi việc
-- đã hoàn thành với "người thực sự bấm hoàn thành" lấy từ task_history.
-- Nếu 2 cột assigned_to_hien_tai và nguoi_thuc_su_hoan_thanh khác nhau -> việc đó
-- đang bị tính điểm sai người.
select
  t.id,
  t.title,
  t.points,
  t.completed_at,
  pa.name as assigned_to_hien_tai,
  pb.name as nguoi_thuc_su_hoan_thanh
from tasks t
join lateral (
  select user_id
  from task_history
  where task_id = t.id and action = 'hoan_thanh'
  order by created_at asc
  limit 1
) h on true
left join profiles pa on pa.id = t.assigned_to
left join profiles pb on pb.id = h.user_id
where t.status = 'hoan_thanh'
  and t.assigned_to <> h.user_id
order by t.completed_at desc;

-- BƯỚC 2 — SAU KHI XEM KẾT QUẢ Ở TRÊN VÀ THẤY ĐÚNG LÀ SAI NGƯỜI,
-- chạy UPDATE này để trả assigned_to về đúng người đã thực sự hoàn thành việc
-- (lấy từ dòng "hoan_thanh" đầu tiên trong task_history của từng task).
-- Chỉ áp dụng cho task đã hoàn thành và đang bị lệch — không đụng gì khác.
update tasks t
set assigned_to = h.user_id
from (
  select distinct on (task_id) task_id, user_id
  from task_history
  where action = 'hoan_thanh'
  order by task_id, created_at asc
) h
where t.id = h.task_id
  and t.status = 'hoan_thanh'
  and t.assigned_to <> h.user_id;
