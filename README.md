# TTBK — App việc nhà (Tiến · Tài · Bách · Khoa)

Web app quản lý việc nhà cho 4 người, dùng **GitHub Pages** (host web) + **Supabase**
(đăng nhập + lưu dữ liệu). Không cần server riêng, không cần build tool.

## Cấu trúc file

```
ttbk-web/
├── index.html          Khung app chính (Tổng quan / Công việc / Lịch / Thành viên / Cài đặt)
├── login.html           Trang đăng nhập
├── css/style.css        Toàn bộ giao diện
├── js/supabase-client.js  Kết nối Supabase (điền URL + key ở đây)
├── js/auth.js            Đăng nhập / đăng xuất / lấy hồ sơ
├── js/utils.js           Hàm dùng chung (avatar, ngày tháng...)
├── js/tasks.js           Trang Công việc: thêm / xong / đổi người / gia hạn / xoá
├── js/schedule.js        Trang Lịch: việc lặp lại + tự sinh việc mỗi ngày
├── js/dashboard.js       Trang Tổng quan
├── js/members.js         Trang Thành viên
├── js/settings.js        Trang Cài đặt hồ sơ
├── js/app.js             Khởi động app + điều hướng menu
└── sql/schema.sql        Toàn bộ bảng database + bảo mật (RLS), dán vào Supabase SQL Editor
```

## Cài đặt (làm theo thứ tự)

1. **Tạo project Supabase** tại supabase.com/dashboard (miễn phí).
2. **Tạo database**: vào SQL Editor, dán toàn bộ nội dung `sql/schema.sql`, bấm Run.
3. **Tạo 4 tài khoản**: vào Authentication → Users → Add user, tạo cho Tiến/Tài/Bách/Khoa
   (email dạng `ten@tro.local`, hoặc email thật). Hồ sơ (profiles) tự sinh nhờ trigger có sẵn.
   → Nhớ tắt "Confirm email" trong Authentication → Settings nếu dùng email giả, để đăng nhập được ngay.
4. **Lấy API key**: Project Settings → API, copy "Project URL" và "anon public key",
   dán vào `js/supabase-client.js`.
5. **Đẩy code lên GitHub**: tạo repo (vd `ttbk-web`), push toàn bộ thư mục này lên.
6. **Bật GitHub Pages**: Settings → Pages → chọn branch `main`, thư mục `/ (root)`.
7. **Mở trang login.html** (đường link GitHub Pages trả về) và đăng nhập thử.
8. Vào **Lịch**, thêm vài việc lặp lại (đổ rác, rửa bát...) để hệ thống tự tạo việc mỗi ngày.
9. Vào **Cài đặt** để mỗi người đổi tên hiển thị và chọn màu riêng của mình.
10. Xong — mọi người dùng chung 1 link, dữ liệu lưu trên Supabase nên đổi máy vẫn còn.

## Ghi chú
- App dùng vanilla JavaScript (không React, không bước build) — mở thẳng file `.html` là chạy.
- Bảo mật dữ liệu dùng Row Level Security (RLS) của Supabase: chỉ ai đăng nhập mới đọc/ghi được.
- Muốn thêm thông báo đẩy thực sự (browser push) cần thêm dịch vụ ngoài (vd OneSignal) — bảng
  `notifications` hiện tại mới chỉ lưu thông báo trong database, chưa gửi push.
