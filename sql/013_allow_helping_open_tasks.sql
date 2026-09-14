-- Cho phép thành viên làm hộ việc đang mở, không cần chờ tới trạng thái quá hạn.
-- Chạy file này sau sql/010_overdue_and_task_help.sql.

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

  insert into point_adjustments (user_id, task_id, delta, reason)
  values (p_helper_id, p_task_id, awarded_points, 'lam_ho_bonus');

  insert into point_adjustments (user_id, task_id, delta, reason)
  values (p_assigned_id, p_task_id, -awarded_points, 'bi_lam_ho');

  return result_task;
end;
$$;

grant execute on function public.mark_task_helped(uuid, uuid, uuid, integer) to authenticated;