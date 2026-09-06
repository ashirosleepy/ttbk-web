// ============================================================
// CẤU HÌNH SUPABASE
// 1. Vào https://supabase.com/dashboard -> chọn project của bạn
// 2. Vào Project Settings (biểu tượng bánh răng) -> API
// 3. Copy "Project URL" và "anon public" key, dán thay vào 2 dòng dưới
// ============================================================
const SUPABASE_URL = "https://vxkcamaaqpdcyapzcoxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4a2NhbWFhcXBkY3lhcHpjb3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzE2MTEsImV4cCI6MjEwNDIwNzYxMX0.TGWaO9bQmp4NtAg7ZghjjDZCobXeSWrVH9X9qGXXLVA";

// Tạo 1 client dùng chung cho cả app (login.html và index.html đều nạp file này)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Màu mặc định gán cho từng người khi chưa tự chọn màu riêng ở trang Cài đặt
const AVATAR_COLORS = ["#3B6E8F", "#C77B2E", "#2F8F6B", "#A24E6B", "#6B5B95", "#4A7A96"];

// Nhãn tiếng Việt cho trạng thái việc
const STATUS_LABEL = {
  cho_nhan: "Chờ nhận",
  chua_lam: "Chưa làm",
  dang_cho: "Đang chờ",
  hoan_thanh: "Hoàn thành",
};

const WEEKDAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
