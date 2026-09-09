-- ============================================================
-- MIGRATION V3 — Bổ sung tiết 6 và tiết 15 cho PTIT (đủ 15 tiết/ngày)
--
-- Bản seed trước chỉ có PTIT: 1-5 (sáng), 7-11 (chiều), 12-14 (tối) = 13 tiết,
-- thiếu tiết 6 (giữa trưa) và tiết 15 (cuối tối).
--
-- ⚠️ Mình suy ra giờ tiết 6 và 15 theo ĐÚNG nhịp 50 phút học / nghỉ 10 phút
-- mà PTIT đang dùng cho các tiết còn lại (tiết 6: 12h00-12h50 nối liền sau
-- tiết 5; tiết 15: 21h00-21h50 nối liền sau tiết 14) — đây là SUY ĐOÁN theo
-- pattern, không phải số liệu gốc bạn gửi. Nếu giờ thật khác, sửa 2 dòng
-- UPDATE bên dưới cho đúng rồi chạy lại là được.
-- ============================================================

insert into class_periods (university, period_number, start_time, end_time) values
  ('PTIT', 6,  '12:00', '12:50'),
  ('PTIT', 15, '21:00', '21:50')
on conflict (university, period_number)
do update set start_time = excluded.start_time, end_time = excluded.end_time;

-- Nếu giờ thật khác giờ suy đoán ở trên, sửa lại và chạy 2 dòng dưới:
-- update class_periods set start_time = 'HH:MM', end_time = 'HH:MM'
--   where university = 'PTIT' and period_number = 6;
-- update class_periods set start_time = 'HH:MM', end_time = 'HH:MM'
--   where university = 'PTIT' and period_number = 15;
