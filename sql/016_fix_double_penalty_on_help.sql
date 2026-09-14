-- ============================================================
-- 016_fix_double_penalty_on_help.sql
--
-- LỖI: khi 1 việc đã QUÁ HẠN, process_overdue_tasks() đã trừ điểm người
-- phụ trách 1 lần (point_adjustments.reason = 'qua_han'). Nhưng nếu sau đó
-- có người bấm "Tôi đã làm hộ", hàm mark_task_helped() (bản
-- 013_allow_helping_open_tasks.sql) lại trừ THÊM 1 lần điểm nữa của đúng
-- người đó (reason = 'bi_lam_ho') -> người quá hạn bị trừ điểm 2 LẦN cho
-- cùng 1 việc.
--
-- ĐÚNG RA:
--   - Nếu việc đã quá hạn (đã bị trừ điểm rồi) và có người làm hộ:
--       + Người làm hộ: được tính hoàn thành + cộng điểm (tự động qua
--         completed_by, không cần point_adjustments riêng).
--       + Người quá hạn: GIỮ NGUYÊN mức đã bị trừ, KHÔNG trừ thêm.
--   - Nếu việc CHƯA quá hạn mà đã được làm hộ (đúng tinh thần
--     013_allow_helping_open_tasks.sql): vẫn trừ điểm người được giao như cũ,
--     vì đây là lần trừ đầu tiên (không phải trừ chồng lên lần quá hạn).
--
-- Chạy file này sau 015_fix_help_notification_text.sql.
-- ============================================================

-- BƯỚC 1 — XEM TRƯỚC (không sửa gì): những việc đang bị trừ điểm 2 lần,
-- tức có cả dòng 'qua_han' và dòng 'bi_lam_ho' cho cùng task + cùng người.
select
  t.id as task_id,
  t.title,
  p.name as nguoi_bi_tru_oan,
  qh.delta as da_tru_vi_qua_han,
  lh.delta as tru_them_vi_lam_ho
from tasks t
join point_adjustments qh on qh.task_id = t.id and qh.reason = 'qua_han'
join point_adjustments lh on lh.task_id = t.id and lh.reason = 'bi_lam_ho' and lh.user_id = qh.user_id
left join profiles p on p.id = qh.user_id
order by t.id;

-- BƯỚC 2 — HOÀN ĐIỂM: xoá các dòng 'bi_lam_ho' bị trừ CHỒNG lên 1 dòng
-- 'qua_han' đã có sẵn cho cùng task + cùng người. Chỉ xoá đúng phần thừa,
-- KHÔNG đụng tới dòng 'qua_han' gốc (đó là mức trừ đúng, giữ nguyên).
delete from point_adjustments lh
using point_adjustments qh
where lh.reason = 'bi_lam_ho'
  and qh.reason = 'qua_han'
  and qh.task_id = lh.task_id
  and qh.user_id = lh.user_id;

-- BƯỚC 3 — SỬA HÀM: mark_task_helped() sẽ kiểm tra, nếu task đã có sẵn
-- 1 dòng trừ điểm vì lý do 'qua_han' thì KHÔNG trừ thêm 'bi_lam_ho' nữa.
-- Nếu task chưa từng bị trừ vì quá hạn (được làm hộ sớm, theo
-- 013_allow_helping_open_tasks.sql) thì vẫn trừ như cũ.
create or replace function public.mark_task_helped(
  p_task_id uuid,
  p_helper_id uuid,
  p_assigned_id uuid,
  p_points integer
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  result_task tasks;
  awarded_points integer;
  already_penalized_overdue boolean;
begin
  if auth.uid() is null or auth.uid() <> p_helper_id or p_helper_id = p_assigned_id then
    raise exception 'Không hợp lệ: chỉ thành viên khác mới được làm hộ';
  end if;

  update tasks
    set status = 'hoan_thanh', completed_by = p_helper_id, completed_at = now()
    where id = p_task_id
      and assigned_to = p_assigned_id
      and status in ('cho_nhan', 'chua_lam', 'dang_cho', 'qua_han')
    returning * into result_task;

  if not found then
    raise exception 'Việc không còn mở hoặc đã được người khác làm hộ';
  end if;

  awarded_points := greatest(coalesce(p_points, result_task.points), 0);

  select exists (
    select 1 from point_adjustments
    where task_id = p_task_id and reason = 'qua_han'
  ) into already_penalized_overdue;

  if not already_penalized_overdue then
    insert into point_adjustments (user_id, task_id, delta, reason)
    values (p_assigned_id, p_task_id, -awarded_points, 'bi_lam_ho');
  end if;

  return result_task;
end;
$$;

grant execute on function public.mark_task_helped(uuid, uuid, uuid, integer) to authenticated;
