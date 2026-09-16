-- ============================================================
-- TTBK — schema đầy đủ, an toàn để chạy lại
-- Supabase → SQL Editor → dán file này → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Hồ sơ
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_color text not null default '#3B6E8F',
  avatar_url text,
  household text not null default 'Nhà TTBK',
  university text,
  is_away boolean not null default false,
  away_from date,
  away_until date,
  status text not null default 'AVAILABLE',
  busy_level smallint not null default 0,
  busy_reason text,
  busy_until timestamptz,
  sick_from date,
  sick_until date,
  home_lat double precision,
  home_lng double precision,
  school_lat double precision,
  school_lng double precision,
  transport_type text default 'motorbike',
  average_speed_kmh numeric default 25,
  created_at timestamptz not null default now()
);

alter table profiles
  add column if not exists avatar_url text,
  add column if not exists university text,
  add column if not exists is_away boolean not null default false,
  add column if not exists away_from date,
  add column if not exists away_until date,
  add column if not exists status text default 'AVAILABLE',
  add column if not exists busy_level smallint default 0,
  add column if not exists busy_reason text,
  add column if not exists busy_until timestamptz,
  add column if not exists sick_from date,
  add column if not exists sick_until date,
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists school_lat double precision,
  add column if not exists school_lng double precision,
  add column if not exists transport_type text default 'motorbike',
  add column if not exists average_speed_kmh numeric default 25;

-- ------------------------------------------------------------
-- Việc nhà
-- ------------------------------------------------------------
create table if not exists rotation_queues (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '🔁',
  member_order uuid[] not null,
  current_index int not null default 0,
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  rotation_queue_id uuid references rotation_queues(id) on delete set null,
  repeat_type text not null check (repeat_type in ('daily', 'weekly')),
  repeat_days int[] default '{}',
  start_date date not null default current_date,
  end_date date,
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table schedules add column if not exists rotation_queue_id uuid;
alter table schedules drop constraint if exists schedules_rotation_queue_id_fkey;
alter table schedules add constraint schedules_rotation_queue_id_fkey
  foreign key (rotation_queue_id) references rotation_queues(id) on delete set null;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  schedule_id uuid references schedules(id) on delete set null,
  rotation_queue_id uuid references rotation_queues(id) on delete set null,
  due_date date not null default current_date,
  status text not null default 'chua_lam',
  priority text not null default 'binh_thuong' check (priority in ('thap', 'binh_thuong', 'cao')),
  points int not null default 10,
  completed_by uuid references profiles(id) on delete set null,
  proof_image_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table tasks
  add column if not exists rotation_queue_id uuid,
  add column if not exists completed_by uuid,
  add column if not exists proof_image_url text;
alter table tasks alter column assigned_to drop not null;
alter table tasks drop constraint if exists tasks_rotation_queue_id_fkey;
alter table tasks add constraint tasks_rotation_queue_id_fkey
  foreign key (rotation_queue_id) references rotation_queues(id) on delete set null;
alter table tasks drop constraint if exists tasks_schedule_id_fkey;
alter table tasks add constraint tasks_schedule_id_fkey
  foreign key (schedule_id) references schedules(id) on delete set null;
alter table tasks drop constraint if exists tasks_completed_by_fkey;
alter table tasks add constraint tasks_completed_by_fkey
  foreign key (completed_by) references profiles(id) on delete set null;
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('cho_nhan', 'chua_lam', 'dang_cho', 'hoan_thanh', 'bo_lo', 'qua_han', 'vo_chu'));

create index if not exists tasks_overdue_idx on tasks (due_date, status)
  where status not in ('hoan_thanh', 'bo_lo');

create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists task_exchanges (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  from_user uuid references profiles(id) on delete set null,
  to_user uuid references profiles(id) on delete set null,
  reason text,
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  exchange_id uuid references task_exchanges(id) on delete set null,
  type text not null default 'thong_bao',
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications add column if not exists type text not null default 'thong_bao';
alter table notifications add column if not exists exchange_id uuid;
alter table notifications drop constraint if exists notifications_exchange_id_fkey;
alter table notifications add constraint notifications_exchange_id_fkey
  foreign key (exchange_id) references task_exchanges(id) on delete set null;

create table if not exists point_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  delta integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists point_adjustments_user_idx on point_adjustments(user_id);
create index if not exists point_adjustments_task_idx on point_adjustments(task_id);

-- ------------------------------------------------------------
-- Mua sắm / chi tiêu
-- ------------------------------------------------------------
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'tieu_hao',
  unit text,
  qty numeric not null default 0,
  min numeric not null default 0,
  ideal numeric,
  cycle_days int,
  last_restock date,
  expiry_date date,
  buy_place text,
  manual_level text check (manual_level in ('on', 'sap_het', 'het')),
  manual_by text,
  manual_at text,
  in_cart boolean not null default false,
  cart_priority text check (cart_priority in ('cao', 'binh_thuong', 'thap')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shopping_items
  add column if not exists expiry_date date,
  add column if not exists buy_place text;
alter table shopping_items drop constraint if exists shopping_items_category_check;
alter table shopping_items add constraint shopping_items_category_check
  check (category in ('thuc_pham', 'tieu_hao', 'du_phong', 'dinh_ky', 'phat_sinh'));
alter table shopping_items drop constraint if exists shopping_items_buy_place_check;
alter table shopping_items add constraint shopping_items_buy_place_check
  check (buy_place is null or buy_place in ('sieu_thi', 'cho', 'tien_loi', 'online'));

create index if not exists shopping_items_category_idx on shopping_items(category);
create index if not exists shopping_items_in_cart_idx on shopping_items(in_cart);
create index if not exists shopping_items_expiry_idx on shopping_items(expiry_date);
create index if not exists shopping_items_buy_place_idx on shopping_items(buy_place);

create or replace function shopping_items_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shopping_items_touch on shopping_items;
create trigger trg_shopping_items_touch
  before update on shopping_items
  for each row execute procedure shopping_items_touch_updated_at();

create table if not exists shopping_purchase_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references shopping_items(id) on delete set null,
  item_name text not null,
  qty numeric not null default 1,
  cost numeric,
  paid_by uuid references profiles(id) on delete set null,
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists shopping_purchase_log_item_idx on shopping_purchase_log(item_id);
create index if not exists shopping_purchase_log_date_idx on shopping_purchase_log(purchase_date);
create index if not exists shopping_purchase_log_paid_by_idx on shopping_purchase_log(paid_by);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'shopping',
  amount numeric not null check (amount > 0),
  paid_by uuid references profiles(id) on delete set null,
  expense_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'shopping')),
  shopping_purchase_id uuid references shopping_purchase_log(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses(expense_date);
create index if not exists expenses_paid_by_idx on expenses(paid_by);
create index if not exists expenses_source_idx on expenses(source);

-- ------------------------------------------------------------
-- Lịch học
-- ------------------------------------------------------------
create table if not exists class_periods (
  id bigint generated always as identity primary key,
  university text not null,
  period_number int not null,
  start_time time not null,
  end_time time not null,
  unique (university, period_number)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_class_schedule' and column_name = 'day_of_week'
  ) then
    drop table public.user_class_schedule;
  end if;
end $$;

create table if not exists user_class_schedule (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  university text not null,
  class_date date not null,
  period_number int not null,
  created_at timestamptz not null default now(),
  unique (user_id, university, class_date, period_number)
);

create index if not exists idx_user_class_schedule_user on user_class_schedule(user_id);
create index if not exists idx_user_class_schedule_user_date on user_class_schedule(user_id, class_date);

insert into class_periods (university, period_number, start_time, end_time) values
  ('PTIT', 1,  '07:00', '07:50'), ('PTIT', 2,  '08:00', '08:50'),
  ('PTIT', 3,  '09:00', '09:50'), ('PTIT', 4,  '10:00', '10:50'),
  ('PTIT', 5,  '11:00', '11:50'), ('PTIT', 6,  '12:00', '12:50'),
  ('PTIT', 7,  '13:00', '13:50'), ('PTIT', 8,  '14:00', '14:50'),
  ('PTIT', 9,  '15:00', '15:50'), ('PTIT', 10, '16:00', '16:50'),
  ('PTIT', 11, '17:00', '17:50'), ('PTIT', 12, '18:00', '18:50'),
  ('PTIT', 13, '19:00', '19:50'), ('PTIT', 14, '20:00', '20:50'),
  ('PTIT', 15, '21:00', '21:50'),
  ('HUCE', 1,  '06:30', '07:20'), ('HUCE', 2,  '07:25', '08:15'),
  ('HUCE', 3,  '08:20', '09:10'), ('HUCE', 4,  '09:20', '10:10'),
  ('HUCE', 5,  '10:15', '11:05'), ('HUCE', 6,  '11:10', '12:00'),
  ('HUCE', 7,  '12:30', '13:20'), ('HUCE', 8,  '13:25', '14:15'),
  ('HUCE', 9,  '14:20', '15:10'), ('HUCE', 10, '15:20', '16:10'),
  ('HUCE', 11, '16:15', '17:05'), ('HUCE', 12, '17:10', '18:00'),
  ('HUCE', 13, '18:15', '19:05'), ('HUCE', 14, '19:10', '20:00'),
  ('HUCE', 15, '20:05', '20:55'),
  ('HUST', 1,  '06:45', '07:30'), ('HUST', 2,  '07:30', '08:15'),
  ('HUST', 3,  '08:25', '09:10'), ('HUST', 4,  '09:20', '10:05'),
  ('HUST', 5,  '10:15', '11:00'), ('HUST', 6,  '11:00', '11:45'),
  ('HUST', 7,  '12:30', '13:15'), ('HUST', 8,  '13:15', '14:00'),
  ('HUST', 9,  '14:10', '14:55'), ('HUST', 10, '15:05', '15:50'),
  ('HUST', 11, '16:00', '16:45'), ('HUST', 12, '16:45', '17:30'),
  ('HUST', 13, '17:45', '18:30'), ('HUST', 14, '18:30', '19:15')
on conflict (university, period_number)
do update set start_time = excluded.start_time, end_time = excluded.end_time;

-- ------------------------------------------------------------
-- Thông báo đẩy
-- ------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- ------------------------------------------------------------
-- Tự tạo hồ sơ khi có tài khoản mới
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, initcap(split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Quá hạn + làm hộ
-- ------------------------------------------------------------
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

grant execute on function public.process_overdue_tasks() to authenticated;
grant execute on function public.mark_task_helped(uuid, uuid, uuid, integer) to authenticated;

do $cron$
declare jid bigint;
begin
  create extension if not exists pg_cron;
  for jid in select jobid from cron.job where jobname = 'ttbk-process-overdue-tasks' loop
    perform cron.unschedule(jid);
  end loop;
  perform cron.schedule('ttbk-process-overdue-tasks', '0 20 * * *', 'select public.process_overdue_tasks();');
exception when others then
  raise notice 'Bỏ qua pg_cron: %', sqlerrm;
end;
$cron$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_history enable row level security;
alter table schedules enable row level security;
alter table notifications enable row level security;
alter table rotation_queues enable row level security;
alter table task_exchanges enable row level security;
alter table point_adjustments enable row level security;
alter table shopping_items enable row level security;
alter table shopping_purchase_log enable row level security;
alter table expenses enable row level security;
alter table class_periods enable row level security;
alter table user_class_schedule enable row level security;
alter table push_subscriptions enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

drop policy if exists "tasks_select_all" on tasks;
create policy "tasks_select_all" on tasks for select using (auth.role() = 'authenticated');
drop policy if exists "tasks_insert_all" on tasks;
create policy "tasks_insert_all" on tasks for insert with check (auth.role() = 'authenticated');
drop policy if exists "tasks_update_all" on tasks;
create policy "tasks_update_all" on tasks for update using (auth.role() = 'authenticated');
drop policy if exists "tasks_delete_all" on tasks;
create policy "tasks_delete_all" on tasks for delete using (auth.role() = 'authenticated');

drop policy if exists "history_select_all" on task_history;
create policy "history_select_all" on task_history for select using (auth.role() = 'authenticated');
drop policy if exists "history_insert_all" on task_history;
create policy "history_insert_all" on task_history for insert with check (auth.role() = 'authenticated');

drop policy if exists "schedules_select_all" on schedules;
create policy "schedules_select_all" on schedules for select using (auth.role() = 'authenticated');
drop policy if exists "schedules_insert_all" on schedules;
create policy "schedules_insert_all" on schedules for insert with check (auth.role() = 'authenticated');
drop policy if exists "schedules_update_all" on schedules;
create policy "schedules_update_all" on schedules for update using (auth.role() = 'authenticated');
drop policy if exists "schedules_delete_all" on schedules;
create policy "schedules_delete_all" on schedules for delete using (auth.role() = 'authenticated');

drop policy if exists "notif_select_own" on notifications;
create policy "notif_select_own" on notifications for select using (auth.uid() = user_id);
drop policy if exists "notif_insert_all" on notifications;
create policy "notif_insert_all" on notifications for insert with check (auth.role() = 'authenticated');
drop policy if exists "notif_update_own" on notifications;
create policy "notif_update_own" on notifications for update using (auth.uid() = user_id);

drop policy if exists "rotations_select_all" on rotation_queues;
create policy "rotations_select_all" on rotation_queues for select using (auth.role() = 'authenticated');
drop policy if exists "rotations_insert_all" on rotation_queues;
create policy "rotations_insert_all" on rotation_queues for insert with check (auth.role() = 'authenticated');
drop policy if exists "rotations_update_all" on rotation_queues;
create policy "rotations_update_all" on rotation_queues for update using (auth.role() = 'authenticated');
drop policy if exists "rotations_delete_all" on rotation_queues;
create policy "rotations_delete_all" on rotation_queues for delete using (auth.role() = 'authenticated');

drop policy if exists "exchanges_select_all" on task_exchanges;
create policy "exchanges_select_all" on task_exchanges for select using (auth.role() = 'authenticated');
drop policy if exists "exchanges_insert_all" on task_exchanges;
create policy "exchanges_insert_all" on task_exchanges for insert with check (auth.role() = 'authenticated');
drop policy if exists "exchanges_update_all" on task_exchanges;
create policy "exchanges_update_all" on task_exchanges for update using (auth.role() = 'authenticated');

drop policy if exists "point_adjustments_select" on point_adjustments;
create policy "point_adjustments_select" on point_adjustments for select using (auth.role() = 'authenticated');
drop policy if exists "point_adjustments_insert" on point_adjustments;
create policy "point_adjustments_insert" on point_adjustments for insert with check (auth.role() = 'authenticated');
drop policy if exists "point_adjustments_delete" on point_adjustments;
create policy "point_adjustments_delete" on point_adjustments for delete using (auth.role() = 'authenticated');

drop policy if exists "shopping_items_select" on shopping_items;
create policy "shopping_items_select" on shopping_items for select using (auth.role() = 'authenticated');
drop policy if exists "shopping_items_insert" on shopping_items;
create policy "shopping_items_insert" on shopping_items for insert with check (auth.role() = 'authenticated');
drop policy if exists "shopping_items_update" on shopping_items;
create policy "shopping_items_update" on shopping_items for update using (auth.role() = 'authenticated');
drop policy if exists "shopping_items_delete" on shopping_items;
create policy "shopping_items_delete" on shopping_items for delete using (auth.role() = 'authenticated');

drop policy if exists "shopping_purchase_log_select" on shopping_purchase_log;
create policy "shopping_purchase_log_select" on shopping_purchase_log for select using (auth.role() = 'authenticated');
drop policy if exists "shopping_purchase_log_insert" on shopping_purchase_log;
create policy "shopping_purchase_log_insert" on shopping_purchase_log for insert with check (auth.role() = 'authenticated');
drop policy if exists "shopping_purchase_log_delete" on shopping_purchase_log;
create policy "shopping_purchase_log_delete" on shopping_purchase_log for delete using (auth.role() = 'authenticated');

drop policy if exists "expenses_select" on expenses;
create policy "expenses_select" on expenses for select using (auth.role() = 'authenticated');
drop policy if exists "expenses_insert" on expenses;
create policy "expenses_insert" on expenses for insert with check (auth.role() = 'authenticated');
drop policy if exists "expenses_update" on expenses;
create policy "expenses_update" on expenses for update using (auth.role() = 'authenticated');
drop policy if exists "expenses_delete" on expenses;
create policy "expenses_delete" on expenses for delete using (auth.role() = 'authenticated');

drop policy if exists "class_periods_select_all" on class_periods;
create policy "class_periods_select_all" on class_periods for select to authenticated using (true);

drop policy if exists "user_class_schedule_select_all" on user_class_schedule;
create policy "user_class_schedule_select_all" on user_class_schedule for select to authenticated using (true);
drop policy if exists "user_class_schedule_write_own" on user_class_schedule;
create policy "user_class_schedule_write_own" on user_class_schedule for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
create policy "push_subscriptions_insert_own" on push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "push_subscriptions_update_own" on push_subscriptions;
create policy "push_subscriptions_update_own" on push_subscriptions for update using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_delete_own" on push_subscriptions for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'notifications', 'shopping_items', 'shopping_purchase_log', 'expenses']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
