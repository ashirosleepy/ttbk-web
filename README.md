# TTBK — App việc nhà (Tiến · Tài · Bách · Khoa)

Web app quản lý việc nhà cho 4 người, dùng **GitHub Pages** (host web) + **Supabase**
(đăng nhập + lưu dữ liệu + realtime). Không cần server riêng, không cần build tool.

**Bản 2** bổ sung: việc không có giờ cố định tự xoay vòng theo hàng đợi (thay vì chia
cứng theo thứ), xin đổi việc/báo bận, và trang **Thông báo** ngay trên thanh menu để
nhận việc — theo đúng đề xuất trong tài liệu thiết kế.

**Bản 2.1** bổ sung: trang **Lịch** giờ hiển thị dạng **Lịch Tháng** thật (có điều
hướng Tháng trước/sau/Hôm nay), tô màu theo trạng thái từng việc — xanh lá (đã xong),
đỏ (bỏ lỡ/quá hạn), hồng nhạt (hôm nay chưa xong), xanh xám nhạt viền đứt nét (dự kiến
sắp tới) — thay cho "Lưới cả tuần" cũ.

## Cấu trúc file

```
ttbk-web/
├── index.html            Khung app (Tổng quan / Thông báo / Công việc / Lịch / Thành viên / Cài đặt)
├── login.html            Trang đăng nhập
├── css/style.css         Toàn bộ giao diện
├── js/supabase-client.js Kết nối Supabase (điền URL + key ở đây)
├── js/auth.js            Đăng nhập / đăng xuất / lấy hồ sơ
├── js/utils.js           Hàm dùng chung (avatar, ngày tháng, tính tuần...)
├── js/rotations.js       Hàng đợi luân phiên: tạo, báo có việc, tự chuyển lượt
├── js/notifications.js   Trang Thông báo trên menu + badge số chưa đọc + Realtime
├── js/tasks.js           Trang Công việc: thêm / xong / đổi người / gia hạn / chuyển việc / xem lịch sử / xoá
├── js/schedule.js        Trang Lịch: quản lý việc lặp lại (cố định hoặc luân phiên) + tự sinh việc mỗi ngày
├── js/calendar.js        Trang Lịch: vẽ Lịch Tháng (điều hướng, tô màu, nạp việc quá khứ + dự kiến tương lai)
├── js/dashboard.js       Trang Tổng quan: thống kê + công bằng tuần này + việc đang chờ nhận
├── js/members.js         Trang Thành viên
├── js/settings.js        Trang Cài đặt hồ sơ
├── js/app.js             Khởi động app + điều hướng menu
└── sql/schema.sql        Toàn bộ bảng database + RLS + Realtime — AN TOÀN chạy lại nhiều lần
```

## Cài đặt (làm theo thứ tự)

1. **Tạo project Supabase** tại supabase.com/dashboard (miễn phí).
2. **Tạo database**: vào SQL Editor, dán toàn bộ nội dung `sql/schema.sql`, bấm Run.
   File này tự tạo đủ bảng (`profiles`, `tasks`, `task_history`, `schedules`,
   `rotation_queues`, `task_exchanges`, `notifications`), bật RLS và bật Realtime cho
   `tasks` + `notifications`. Nếu sau này có bản cập nhật schema mới, chỉ cần dán đè và
   chạy lại — không làm mất dữ liệu cũ.
3. **Tạo 4 tài khoản**: Authentication → Users → Add user, tạo cho Tiến/Tài/Bách/Khoa
   (email dạng `ten@tro.local`, hoặc email thật). Hồ sơ (`profiles`) tự sinh nhờ trigger có sẵn.
   → Tắt "Confirm email" trong Authentication → Settings nếu dùng email giả, để đăng nhập được ngay.
4. **Lấy API key**: Project Settings → API, copy "Project URL" và "anon public key",
   dán vào `js/supabase-client.js`.
5. **Đẩy code lên GitHub**: tạo repo (vd `ttbk-web`), push toàn bộ thư mục này lên.
6. **Bật GitHub Pages**: Settings → Pages → chọn branch `main`, thư mục `/ (root)`.
7. **Đăng nhập thử** bằng 1 trong 4 tài khoản để kiểm tra kết nối.
8. Vào **Lịch**, thêm lịch lặp lại — chọn **"Cố định 1 người"** cho việc cố định (vd cất
   quần áo luôn của 1 người), hoặc **"Luân phiên theo hàng đợi"** cho việc như trực đun
   nước, tổng vệ sinh WC (tạo hàng đợi ở khối "⚡ Việc luân phiên" ngay bên dưới trước).
9. Với việc phát sinh không có giờ cố định (đổ rác, thay bình nước, đi chợ...): tạo 1
   hàng đợi luân phiên (không gắn vào lịch), rồi bấm **"Báo có việc"** mỗi khi việc đó
   thật sự xảy ra — hệ thống tự gán cho đúng người đang tới lượt và gửi thông báo.
10. Mỗi người chỉnh tên/màu riêng ở **Cài đặt**. Xong — dữ liệu lưu trên Supabase nên đổi
    máy, tắt máy vẫn còn nguyên, và màn hình mọi người tự cập nhật nhờ Realtime.

## Những khái niệm mới trong bản 2

- **Hàng đợi luân phiên (`rotation_queues`)**: thay vì gán cứng "Tiến luôn thứ 2", hệ
  thống nhớ thứ tự 4 người và ai đang tới lượt. Việc xong thì tự chuyển cho người kế
  tiếp — dùng được cho cả việc lặp lại (gắn vào Lịch) lẫn việc phát sinh (bấm "Báo có việc").
- **Trạng thái "Chờ nhận" (`cho_nhan`)**: việc do hàng đợi luân phiên tạo ra sẽ ở trạng
  thái này cho đến khi đúng người được gán bấm **"Nhận việc"**. Nếu không làm được, họ có
  thể bấm **😅 chuyển việc** ngay — không cần nhận trước rồi mới chuyển.
- **🔄 Xin đổi việc**: với việc thường (không thuộc hàng đợi), bấm 😅 sẽ gửi yêu cầu cho
  cả nhà, ai bấm "Nhận đổi việc" trước thì được — tránh 2 người cùng nhận nhầm 1 việc.
- **🔔 Thông báo**: mục riêng trên thanh menu, có số đếm chưa đọc, và cập nhật ngay lập
  tức (Realtime) khi có việc mới/đến lượt/ai đó xin đổi việc — không cần tải lại trang.
- **⚖️ Công bằng tuần này**: ở Tổng quan, tính điểm việc đã hoàn thành từ đầu tuần, giúp
  thấy ngay ai đang làm nhiều/ít hơn để cân đối việc tiếp theo.
- **🕘 Xem lịch sử**: bấm biểu tượng đồng hồ trên phiếu việc để xem toàn bộ thay đổi của
  việc đó (ai tạo, ai đổi người, ai báo bận, ai hoàn thành...) — không xoá lịch sử cũ,
  đúng như tài liệu yêu cầu, để tránh tranh cãi.

- **📅 Lịch Tháng**: xem toàn bộ tháng cùng lúc thay vì từng tuần. Ngày đã qua lấy đúng
  dữ liệu thật từ lịch sử việc; ngày tương lai là **dự kiến** — được tính từ các lịch
  lặp lại và hàng đợi luân phiên đang bật, giả định hàng đợi dịch chuyển đúng 1 bước mỗi
  lần xảy ra. Nếu có ai bấm "Báo có việc" thủ công xen giữa, phần dự kiến xa có thể lệch
  nhẹ so với thực tế — đây là đánh đổi để giữ việc báo bận/đổi việc vẫn linh hoạt.

## Ghi chú
- App dùng vanilla JavaScript (không React, không bước build) — mở thẳng file `.html` là chạy.
- Bảo mật dữ liệu dùng Row Level Security (RLS): chỉ ai đăng nhập mới đọc/ghi được.
- Nếu chuông thông báo không tự cập nhật realtime, vào Supabase → Database → Replication,
  kiểm tra `tasks` và `notifications` đã được bật (schema.sql đã cố tự bật, nhưng nếu dự án
  cũ có thể cần bật tay).
- Muốn báo bận theo khung giờ để hệ thống tự né người đang bận khi phân việc mới (thay vì
  chuyển việc thủ công bằng nút 😅) là hướng mở rộng tiếp theo hợp lý, tài liệu gốc có đề
  cập ở mục "availability" — hiện chưa làm để giữ app đơn giản, dễ dùng cho sinh viên.
