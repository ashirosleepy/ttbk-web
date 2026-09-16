# TTBK

Web app quan ly viec nha cho 4 thanh vien, dung HTML/CSS/JavaScript thuần, Supabase va GitHub Pages. Frontend duoc bundle bang Vite.

## Chay nhanh

1. Mo `login.html` qua GitHub Pages, localhost hoac mot web server HTTPS.
2. Tao tai khoan trong Supabase Authentication.
3. Chay `sql/schema.sql` trong Supabase SQL Editor (an toan de chay lai).
4. Dien Project URL va anon key vao `js/supabase-client.js`.
5. Neu dung AI chia viec, deploy Edge Function `ai-assign-tasks` va dat secret `ANTHROPIC_API_KEY`.

Lenh frontend:

```powershell
npm run dev
npm run build
npm run preview
```

## Cau truc

```text
/
|-- index.html                 Trang chinh
|-- login.html                 Dang nhap
|-- Chi tieu TTBK.html         So chi tieu doc lap
|-- demo.html                  Preview giao dien, khong phai entry point
|-- vite.config.js             Cau hinh multi-page build
|-- manifest.json              Cau hinh PWA
|-- sw.js                      Service worker cho Web Push
|
|-- css/
|   |-- style.css              Theme va giao dien dung chung
|   |-- shopping.css           Giao dien khu vuc Nha can gi
|   |-- expense.css            Giao dien trang Chi tieu
|   `-- ttbk.png               Icon
|
|-- js/
|   |-- supabase-client.js     Cau hinh Supabase va hang so chung
|   |-- auth.js                Session, profile, dang nhap/dang xuat
|   |-- utils.js               Ham dung chung
|   |-- app.js                 Khoi dong va dieu huong index
|   |-- tasks.js               Cong viec
|   |-- dashboard.js           Tong quan
|   |-- notifications.js       Thong bao
|   |-- schedule.js            Lich lap
|   |-- calendar.js            Lich thang
|   |-- class-schedule.js      Lich hoc
|   |-- rotations.js           Luan phien
|   |-- members.js             Thanh vien
|   |-- settings.js            Cai dat
|   |-- shopping.js            Danh sach mua sam
|   |-- shopping-ai.js         Goi y AI cho mua sam
|   |-- auto-assign.js         Chia viec cong bang/AI
|   |-- push-notifications.js  Web Push
|   |-- theme.js               Dong bo theme
|   `-- page-transition.js     Chuyen trang
|
|-- sql/schema.sql             Schema Supabase day du, chay lai duoc
`-- supabase/functions/
    |-- ai-assign-tasks/       Edge Function chia viec bang AI
    `-- send-push/              Edge Function gui Web Push
```

`src/` la cac entry ES Module cua Vite. `src/generated/` duoc tao tu dong trong luc build va khong sua truc tiep.

## Entry frontend

`src/main.js` la entry cua app chinh, `src/login.js` la entry cua dang nhap, `src/demo.js` la entry cua preview. Vite tao bundle tu dong; thu tu legacy van duoc khai bao tap trung trong `scripts/build-legacy.mjs`.

Cac module moi dung `import`/`export`. Cac module legacy dang duoc bundle trong scope tuong thich de giu nguyen chuc nang trong khi chuyen doi dan.

## Supabase Edge Functions

```powershell
supabase functions deploy ai-assign-tasks
supabase functions deploy send-push
supabase functions deploy process-reminders
```

`process-reminders` cần được gọi theo lịch mỗi giờ (Supabase Dashboard -> Edge Functions -> Schedules).
Hàm xử lý nhắc trước hạn lúc 01:00, nhắc xác nhận lúc 22:00 theo giờ Việt Nam và đẩy các thông báo quá hạn/làm hộ.

Secret can thiet:

- `ai-assign-tasks`: `ANTHROPIC_API_KEY`
- `send-push`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

## Quy tac sua file

- Giao dien dung chung sua trong `css/style.css`.
- Giao dien mua sam sua trong `css/shopping.css`.
- Giao dien chi tieu sua trong `css/expense.css`.
- Logic moi khu vuc sua trong file JS cung ten.
- Thay doi database sua trong `sql/schema.sql` (giu idempotent: create if not exists / add column if not exists).
- Khi them/xoa file, cap nhat cay thu muc trong README nay.
