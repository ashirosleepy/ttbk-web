-- ============================================================
-- MIGRATION: Status Engine nhiều lớp + Sick Mode
-- Chạy trong Supabase SQL editor
-- ============================================================
-- Thiết kế theo đúng convention đang có sẵn trong app (profiles.is_away /
-- profiles.away_until) thay vì tạo bảng availability_status / sick_records
-- riêng như trong bản đề xuất đầy đủ — để tương thích ngay với STATE.profiles
-- mà members.js / dashboard.js đang dùng, không cần sửa cách load dữ liệu.
-- Nếu sau này muốn tách lịch sử trạng thái (nhiều lần bận/ốm theo thời gian)
-- thì mới cần bảng con user_status như trong tài liệu gốc.

alter table profiles
  add column if not exists status text default 'AVAILABLE',
  -- status ∈ AVAILABLE | BUSY | STUDYING | SICK | AWAY
  add column if not exists busy_level smallint default 0,
  -- 0 = rảnh, 1 = bận nhẹ, 2 = bận, 3 = không nhận việc
  add column if not exists busy_reason text,
  add column if not exists busy_until timestamptz,
  add column if not exists sick_from date,
  add column if not exists sick_until date;

comment on column profiles.status is 'Trạng thái chính: AVAILABLE, BUSY, STUDYING, SICK, AWAY';
comment on column profiles.busy_level is '0 rảnh / 1 bận nhẹ / 2 bận / 3 không nhận việc';
