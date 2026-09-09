-- ============================================================
-- MIGRATION V2 — Lịch học đổi theo TUẦN THỰC TẾ (không lặp cố định theo thứ)
-- Chạy sau khi đã chạy migration_class_schedule.sql lần trước.
-- Bảng class_periods (khung tiết 3 trường) GIỮ NGUYÊN, không cần chạy lại.
--
-- LƯU Ý: lệnh dưới đây XOÁ SẠCH bảng user_class_schedule cũ (theo day_of_week)
-- rồi tạo lại theo class_date. Nếu bạn đã lỡ tick thử vài tiết ở bản trước,
-- dữ liệu đó sẽ mất — cứ vào trang Lịch tick lại cho tuần hiện tại là đủ.
-- ============================================================

drop table if exists user_class_schedule;

create table user_class_schedule (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  university text not null,       -- 'PTIT' | 'HUCE' | 'HUST' (tại thời điểm tick)
  class_date date not null,       -- ngày cụ thể có tiết học đó, vd '2026-09-15'
  period_number int not null,
  created_at timestamptz not null default now(),
  unique (user_id, university, class_date, period_number)
);

create index idx_user_class_schedule_user on user_class_schedule(user_id);
create index idx_user_class_schedule_user_date on user_class_schedule(user_id, class_date);

alter table user_class_schedule enable row level security;

-- Mọi người trong nhà xem được lịch học của nhau (để tính vùng bận khi chia việc)
drop policy if exists "user_class_schedule_select_all" on user_class_schedule;
create policy "user_class_schedule_select_all"
  on user_class_schedule for select
  to authenticated
  using (true);

-- Nhưng chỉ tự sửa được lịch của chính mình
drop policy if exists "user_class_schedule_write_own" on user_class_schedule;
create policy "user_class_schedule_write_own"
  on user_class_schedule for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
