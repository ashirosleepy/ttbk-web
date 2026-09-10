-- ============================================================
-- 009_shopping_expiry_and_place.sql
-- Thêm:
--   - expiry_date: hạn sử dụng (chủ yếu cho Thực phẩm, nhưng để mở
--     cho mọi loại vì đồ như kem đánh răng/mỹ phẩm cũng có hạn dùng)
--   - buy_place: nơi thường mua, để gom "Danh sách mua" thành từng
--     chuyến đi chợ/siêu thị/tiện lợi/online riêng biệt
-- An toàn để chạy lại. Dán vào Supabase -> SQL Editor -> Run.
-- ============================================================

alter table shopping_items add column if not exists expiry_date date;
alter table shopping_items add column if not exists buy_place text;

alter table shopping_items drop constraint if exists shopping_items_buy_place_check;
alter table shopping_items add constraint shopping_items_buy_place_check
  check (buy_place is null or buy_place in ('sieu_thi', 'cho', 'tien_loi', 'online'));

create index if not exists shopping_items_expiry_idx on shopping_items(expiry_date);
create index if not exists shopping_items_buy_place_idx on shopping_items(buy_place);
