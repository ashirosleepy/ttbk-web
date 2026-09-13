# TTBK

Web app quan ly viec nha cho 4 thanh vien, dung HTML/CSS/JavaScript thuần, Supabase va GitHub Pages. Khong co buoc build frontend.

## Chay nhanh

1. Mo `login.html` qua GitHub Pages, localhost hoac mot web server HTTPS.
2. Tao tai khoan trong Supabase Authentication.
3. Chay `sql/schema.sql`, sau do chay cac migration can thiet trong `sql/`.
4. Dien Project URL va anon key vao `js/supabase-client.js`.
5. Neu dung AI chia viec, deploy Edge Function `ai-assign-tasks` va dat secret `ANTHROPIC_API_KEY`.

## Cau truc

```text
/
|-- index.html                 Trang chinh
|-- login.html                 Dang nhap
|-- Chi tieu TTBK.html         So chi tieu doc lap
|-- demo.html                  Preview giao dien, khong phai entry point
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
|-- sql/                       Schema va migration Supabase
`-- supabase/functions/
    |-- ai-assign-tasks/       Edge Function chia viec bang AI
    `-- send-push/              Edge Function gui Web Push
```

## Thu tu script cua index.html

`page-transition.js` -> Supabase CDN -> `supabase-client.js` -> `utils.js` va `auth.js` -> cac module nghiep vu -> `app.js` -> push/theme.

Cac file JavaScript dang dung bien/h ham global, vi vay khong tu y doi thu tu nap hoac doi ten file ma khong cap nhat `index.html`.

## Supabase Edge Functions

```powershell
supabase functions deploy ai-assign-tasks
supabase functions deploy send-push
```

Secret can thiet:

- `ai-assign-tasks`: `ANTHROPIC_API_KEY`
- `send-push`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

## Quy tac sua file

- Giao dien dung chung sua trong `css/style.css`.
- Giao dien mua sam sua trong `css/shopping.css`.
- Giao dien chi tieu sua trong `css/expense.css`.
- Logic moi khu vuc sua trong file JS cung ten.
- Thay doi database them thanh migration moi trong `sql/`, khong sua ngược migration da chay.
- Khi them/xoa file, cap nhat cay thu muc trong README nay.
