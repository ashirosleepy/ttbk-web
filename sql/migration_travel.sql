-- ============================================================
-- MIGRATION 2: Vị trí + phương tiện di chuyển (cho tính khấu hao tắc đường)
-- Chạy sau migration_status_engine.sql
-- ============================================================
-- Giữ đúng convention "cột thẳng trên profiles" như university/is_away đã có,
-- thay vì bảng locations/travel_profiles riêng — vì mỗi người chỉ cần 1 nhà +
-- 1 trường, không cần lịch sử nhiều địa điểm.

alter table profiles
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists school_lat double precision,
  add column if not exists school_lng double precision,
  add column if not exists transport_type text default 'motorbike',
  -- transport_type ∈ 'motorbike' | 'bike' | 'walk' | 'car'
  add column if not exists average_speed_kmh numeric default 25;

comment on column profiles.transport_type is 'motorbike | bike | walk | car — ảnh hưởng tốc độ mặc định gợi ý';
comment on column profiles.average_speed_kmh is 'Tốc độ trung bình thực tế của người này, dùng để tính thời gian di chuyển nhà-trường';

-- Nếu home_lat/lng hoặc school_lat/lng còn trống, hệ thống sẽ tự fallback về
-- đệm cố định (20 phút trước / 30 phút sau giờ học) như trước — xem class-schedule.js.
