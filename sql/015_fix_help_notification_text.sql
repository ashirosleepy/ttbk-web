-- Cập nhật thông báo việc quá hạn từ x2 điểm thành x1 điểm.
-- Chạy file này trong Supabase SQL Editor.

update notifications
set message = replace(message, 'x2 điểm', 'x1 điểm')
where message like '%x2 điểm%';

create or replace function public.process_overdue_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  business_today date := (now() at time zone 'Asia/Ho_Chi_Minh' - interval '3 hours')::date;
  task_row record;
  changed_count integer := 0;
begin
  for task_row in
    select t.* from tasks t
    where t.due_date < business_today
      and t.status not in ('hoan_thanh', 'bo_lo', 'qua_han', 'vo_chu')
      and t.assigned_to is not null
  loop
    update tasks
      set status = 'qua_han'
      where id = task_row.id
        and status not in ('hoan_thanh', 'bo_lo', 'qua_han', 'vo_chu');

    if found then
      changed_count := changed_count + 1;
      insert into point_adjustments (user_id, task_id, delta, reason)
      select task_row.assigned_to, task_row.id, -coalesce(task_row.points, 0), 'qua_han'
      where coalesce(task_row.points, 0) > 0
        and not exists (
          select 1 from point_adjustments
          where task_id = task_row.id and reason = 'qua_han'
        );

      insert into task_history (task_id, user_id, action, detail)
      values (
        task_row.id, task_row.assigned_to, 'qua_han',
        format('Việc "%s" quá hạn, trừ %s điểm của người phụ trách.', task_row.title, coalesce(task_row.points, 0))
      );

      insert into notifications (user_id, task_id, type, message)
      values (
        task_row.assigned_to, task_row.id, 'qua_han',
        format('⚠️ Bạn đã quên làm "%s". Đã quá hạn và bị trừ %s điểm.', task_row.title, coalesce(task_row.points, 0))
      );

      insert into notifications (user_id, task_id, type, message)
      select p.id, task_row.id, 'lam_ho',
        format('🆘 %s đã quên làm "%s". Ai làm hộ sẽ được x1 điểm!', owner.name, task_row.title)
      from profiles p
      cross join profiles owner
      where owner.id = task_row.assigned_to and p.id <> task_row.assigned_to;
    end if;
  end loop;
  return changed_count;
end;
$$;

grant execute on function public.process_overdue_tasks() to authenticated;