const n=`// ============================================================
// CẤU HÌNH SUPABASE
// 1. Vào https://supabase.com/dashboard -> chọn project của bạn
// 2. Vào Project Settings (biểu tượng bánh răng) -> API
// 3. Copy "Project URL" và "anon public" key, dán thay vào 2 dòng dưới
// ============================================================
const SUPABASE_URL = "https://vxkcamaaqpdcyapzcoxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4a2NhbWFhcXBkY3lhcHpjb3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzE2MTEsImV4cCI6MjEwNDIwNzYxMX0.TGWaO9bQmp4NtAg7ZghjjDZCobXeSWrVH9X9qGXXLVA";

// Tạo 1 client dùng chung cho cả app (login.html và index.html đều nạp file này)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

// Màu mặc định gán cho từng người khi chưa tự chọn màu riêng ở trang Cài đặt
const AVATAR_COLORS = ["#3B6E8F", "#C77B2E", "#2F8F6B", "#A24E6B", "#6B5B95", "#4A7A96"];

// Nhãn tiếng Việt cho trạng thái việc
const STATUS_LABEL = {
  cho_nhan: "Chờ nhận",
  chua_lam: "Chưa làm",
  dang_cho: "Đang chờ",
  hoan_thanh: "Hoàn thành",
  vo_chu: "Vô chủ — cần người nhận thay",
};

// Điểm thưởng thêm khi 1 người nhận thay việc của thành viên đang đi vắng
const AWAY_COVER_BONUS = 5;

const WEEKDAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];


// ============================================================
// AUTH.JS — đăng nhập / đăng xuất / lấy hồ sơ người dùng
// ============================================================

// Kiểm tra đã đăng nhập chưa. Nếu chưa -> đá về trang login.
async function requireSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Đăng nhập bằng email + mật khẩu
async function login(email, password) {
  return await supabaseClient.auth.signInWithPassword({ email, password });
}

// Đăng xuất
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Lấy hồ sơ (profiles) của người đang đăng nhập
async function getCurrentProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Không lấy được hồ sơ:", error.message);
    return null;
  }
  return data;
}

// Lấy hồ sơ của tất cả thành viên trong nhà (để hiện tên, gán việc...)
async function getAllProfiles() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("name");

  if (error) {
    console.error("Không lấy được danh sách thành viên:", error.message);
    return [];
  }
  return data;
}


/* Theme toggle — sáng / tối, lưu lựa chọn vào localStorage */
(function () {
  var STORAGE_KEY = 'ttbk-theme';
  var root = document.documentElement;

  function getPreferred() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#171B15' : '#A13F52');
    var btn = document.getElementById('theme-switch');
    if (btn) btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // Áp dụng ngay (đề phòng script head bị bỏ qua / chạy muộn)
  apply(getPreferred());

  document.addEventListener('DOMContentLoaded', function () {
    apply(getPreferred());
    var btn = document.getElementById('theme-switch');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        apply(next);
      });
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) {}
      if (!saved) apply(e.matches ? 'dark' : 'light');
    });
  }
})();

window.login = login; window.supabaseClient = supabaseClient;
`;function e(){new Function(n)()}export{e as r};
