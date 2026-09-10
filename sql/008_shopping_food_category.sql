-- ============================================================
-- 008_shopping_food_category.sql
-- Thêm loại "🥦 Thực phẩm" (đồ ăn/đồ bếp: gạo, trứng, rau, gia vị...)
-- cho shopping_items — dùng chung cơ chế còn/sắp hết/hết theo số
-- lượng như loại "Tiêu hao" sẵn có, không cần đổi gì ở bảng khác.
-- An toàn để chạy lại. Dán vào Supabase -> SQL Editor -> Run.
-- ============================================================

alter table shopping_items drop constraint if exists shopping_items_category_check;
alter table shopping_items add constraint shopping_items_category_check
  check (category in ('thuc_pham', 'tieu_hao', 'du_phong', 'dinh_ky', 'phat_sinh'));
