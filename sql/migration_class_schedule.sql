-- ============================================================
-- MIGRATION: Lịch học 3 trường (PTIT / HUCE / HUST) + tự tính vùng bận
-- Chạy trong Supabase SQL editor. Đọc kỹ phần RLS ở cuối trước khi chạy
-- vì mình đoán theo mô hình "mọi người trong nhà đọc được profile của nhau" —
-- chỉnh lại cho khớp với RLS hiện tại của bạn nếu khác.
-- ============================================================

-- 1) Cột trường học trên profiles (bỏ qua nếu đã chạy ở bước trước)
alter table profiles add column if not exists university text;

-- 2) Khung tiết của từng trường — dữ liệu KHÔNG đổi theo học kỳ nên chỉ cần nhập 1 lần
create table if not exists class_periods (
  id bigint generated always as identity primary key,
  university text not null,            -- 'PTIT' | 'HUCE' | 'HUST'
  period_number int not null,
  start_time time not null,
  end_time time not null,
  unique (university, period_number)
);

-- 3) Lịch học cá nhân — mỗi dòng là 1 tiết học cố định vào 1 thứ trong tuần
create table if not exists user_class_schedule (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  university text not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Chủ nhật ... 6 = Thứ 7
  period_number int not null,
  created_at timestamptz not null default now(),
  unique (user_id, university, day_of_week, period_number)
);

create index if not exists idx_user_class_schedule_user on user_class_schedule(user_id);
create index if not exists idx_user_class_schedule_user_day on user_class_schedule(user_id, day_of_week);

-- ============================================================
-- SEED — khung tiết 3 trường (lấy từ ảnh thời khoá biểu bạn gửi)
-- ============================================================
delete from class_periods where university in ('PTIT', 'HUCE', 'HUST');

insert into class_periods (university, period_number, start_time, end_time) values
-- ---------------- PTIT ----------------
('PTIT', 1,  '07:00', '07:50'),
('PTIT', 2,  '08:00', '08:50'),
('PTIT', 3,  '09:00', '09:50'),
('PTIT', 4,  '10:00', '10:50'),
('PTIT', 5,  '11:00', '11:50'),
('PTIT', 7,  '13:00', '13:50'),
('PTIT', 8,  '14:00', '14:50'),
('PTIT', 9,  '15:00', '15:50'),
('PTIT', 10, '16:00', '16:50'),
('PTIT', 11, '17:00', '17:50'),
('PTIT', 12, '18:00', '18:50'),
('PTIT', 13, '19:00', '19:50'),
('PTIT', 14, '20:00', '20:50'),

-- ---------------- HUCE (Đại học Xây dựng Hà Nội) ----------------
('HUCE', 1,  '06:30', '07:20'),
('HUCE', 2,  '07:25', '08:15'),
('HUCE', 3,  '08:20', '09:10'),
('HUCE', 4,  '09:20', '10:10'),
('HUCE', 5,  '10:15', '11:05'),
('HUCE', 6,  '11:10', '12:00'),
('HUCE', 7,  '12:30', '13:20'),
('HUCE', 8,  '13:25', '14:15'),
('HUCE', 9,  '14:20', '15:10'),
('HUCE', 10, '15:20', '16:10'),
('HUCE', 11, '16:15', '17:05'),
('HUCE', 12, '17:10', '18:00'),
('HUCE', 13, '18:15', '19:05'),
('HUCE', 14, '19:10', '20:00'),
('HUCE', 15, '20:05', '20:55'),

-- ---------------- HUST (kíp học thứ 3) ----------------
('HUST', 1,  '06:45', '07:30'),
('HUST', 2,  '07:30', '08:15'),
('HUST', 3,  '08:25', '09:10'),
('HUST', 4,  '09:20', '10:05'),
('HUST', 5,  '10:15', '11:00'),
('HUST', 6,  '11:00', '11:45'),
('HUST', 7,  '12:30', '13:15'),
('HUST', 8,  '13:15', '14:00'),
('HUST', 9,  '14:10', '14:55'),
('HUST', 10, '15:05', '15:50'),
('HUST', 11, '16:00', '16:45'),
('HUST', 12, '16:45', '17:30'),
('HUST', 13, '17:45', '18:30'),
('HUST', 14, '18:30', '19:15');

-- ============================================================
-- RLS — mẫu tham khảo, SỬA LẠI cho khớp với chính sách hiện tại của bạn
-- (vd nếu profiles đang giới hạn theo household_id thì user_class_schedule
-- cũng nên join qua profiles để giới hạn tương tự thay vì mở toàn bộ).
-- ============================================================
alter table class_periods enable row level security;
alter table user_class_schedule enable row level security;

-- Khung tiết là dữ liệu công khai, ai đăng nhập cũng đọc được
create policy if not exists "class_periods_select_all"
  on class_periods for select
  to authenticated
  using (true);

-- Lịch học cá nhân: mọi người trong nhà xem được của nhau (để tính vùng bận khi chia việc),
-- nhưng chỉ tự sửa được lịch của chính mình.
create policy if not exists "user_class_schedule_select_all"
  on user_class_schedule for select
  to authenticated
  using (true);

create policy if not exists "user_class_schedule_write_own"
  on user_class_schedule for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
