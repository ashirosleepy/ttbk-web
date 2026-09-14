-- ============================================================
-- 010_overdue_and_task_help.sql
-- Quá hạn tự động, làm hộ và ghi nhận người thực tế hoàn thành.
-- Chạy file này trong Supabase SQL Editor trước khi dùng giao diện mới.
-- ============================================================

alter table tasks add column if not exists completed_by uuid references profiles(id) on delete set null;
alter table tasks add column if not exists proof_image_url text;

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check check (
  status in ('cho_nhan', 'chua_lam', 'dang_cho', 'hoan_thanh', 'bo_lo', 'qua_han', 'vo_chu')
);

create index if not exists tasks_overdue_idx on tasks (due_date, status) where status not in ('hoan_thanh', 'bo_lo');

-- Quá hạn được đánh dấu đúng một lần; point_adjustments giữ lịch sử và chống trừ lặp.
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

-- Hàm nguyên tử: chỉ người khác người được giao mới được làm hộ.
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
begin
  if auth.uid() is null or auth.uid() <> p_helper_id or p_helper_id = p_assigned_id then
    raise exception 'Không hợp lệ: chỉ thành viên khác mới được làm hộ';
  end if;

  update tasks
    set status = 'hoan_thanh', completed_by = p_helper_id, completed_at = now()
    where id = p_task_id
      and assigned_to = p_assigned_id
      and status = 'qua_han'
    returning * into result_task;

  if not found then
    raise exception 'Việc không còn ở trạng thái quá hạn hoặc đã được người khác làm hộ';
  end if;

  insert into point_adjustments (user_id, task_id, delta, reason)
  values (p_helper_id, p_task_id, greatest(coalesce(p_points, result_task.points), 0), 'lam_ho_bonus');

  insert into point_adjustments (user_id, task_id, delta, reason)
  values (p_assigned_id, p_task_id, -greatest(coalesce(p_points, result_task.points), 0), 'bi_lam_ho');

  return result_task;
end;
$$;

grant execute on function public.process_overdue_tasks() to authenticated;
grant execute on function public.mark_task_helped(uuid, uuid, uuid, integer) to authenticated;

-- Supabase pg_cron dùng UTC: 20:00 UTC = 03:00 sáng hôm sau tại Việt Nam.
create extension if not exists pg_cron;
select cron.unschedule(jobid)
from cron.job
where jobname = 'ttbk-process-overdue-tasks';
select cron.schedule('ttbk-process-overdue-tasks', '0 20 * * *', $$select public.process_overdue_tasks();$$);