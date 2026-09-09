// ============================================================
// APP.JS — khởi động app + điều hướng giữa các trang
// ============================================================

// STATE lưu dữ liệu dùng chung, các file khác (tasks.js, dashboard.js...) đọc từ đây
let STATE = {
  me: null, // hồ sơ người đang đăng nhập
  profiles: [], // hồ sơ tất cả 4 thành viên
};

const SECTION_LOADERS = {
  dashboard: loadDashboardSection,
  notifications: loadNotificationsSection,
  activity: loadActivitySection,
  tasks: loadTasksSection,
  schedule: loadScheduleSection,
  members: loadMembersSection,
  settings: loadSettingsSection,
};

function updateTopbar() {
  document.getElementById("topbar-user").innerHTML = `${avatarHTML(STATE.me, "avatar-sm")}<span>${escapeHTML(STATE.me.name)}</span>`;
  document.getElementById("household-name").textContent = STATE.me.household || "Nhà TTBK";
}

function setupNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => loadSection(btn.dataset.section));
  });
  document.getElementById("btn-logout").addEventListener("click", logout);
}

// Menu ☰ trên di động: thay cho việc lướt ngang, bấm ☰ để hiện danh sách đầy đủ,
// bấm vào 1 mục hoặc chạm ra ngoài (nền mờ) để tự đóng lại.
function setupMobileMenu() {
  const toggleBtn = document.getElementById("btn-menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("nav-backdrop");
  if (!toggleBtn || !sidebar || !backdrop) return;

  const openMenu = () => {
    sidebar.classList.add("open");
    backdrop.classList.add("show");
  };
  const closeMenu = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  };

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.contains("open") ? closeMenu() : openMenu();
  });
  backdrop.addEventListener("click", closeMenu);
  sidebar.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", closeMenu));
}

async function loadSection(name) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.section === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `section-${name}`));
  const loader = SECTION_LOADERS[name];
  if (loader) await loader();
}

// Nếu người này đã đặt "Đến ngày" cho chế độ đi vắng và ngày đó đã qua, tự động
// khôi phục trạng thái có mặt ngay khi họ mở lại app — đúng như lúc bật họ mong muốn.
async function autoResumeIfNeeded() {
  if (!STATE.me || !STATE.me.is_away || !STATE.me.away_until) return;
  if (STATE.me.away_until >= todayStr()) return;

  const { error } = await supabaseClient
    .from("profiles")
    .update({ is_away: false, away_from: null, away_until: null })
    .eq("id", STATE.me.id);
  if (error) return;

  await logHistory(null, STATE.me.id, "ket_thuc_vang", `${STATE.me.name} đã tự động được khôi phục trạng thái có mặt (hết hạn đi vắng).`);

  STATE.me.is_away = false;
  STATE.me.away_from = null;
  STATE.me.away_until = null;
  STATE.profiles = await getAllProfiles();
}

async function init() {
  const session = await requireSession();
  if (!session) return; // requireSession đã tự chuyển về login.html

  STATE.me = await getCurrentProfile();
  if (!STATE.me) {
    alert("Không tìm thấy hồ sơ của bạn trong bảng profiles. Nhờ quản trị viên kiểm tra lại.");
    return;
  }
  STATE.profiles = await getAllProfiles();
  await autoResumeIfNeeded();

  updateTopbar();
  setupNav();
  setupMobileMenu();
  await generateTodayTasks(); // tự tạo việc của hôm nay từ các lịch lặp lại đang bật
  await loadSection("dashboard");
  refreshNotifBadge(); // hiện số thông báo chưa đọc ngay trên thanh menu
  subscribeRealtime(); // tự cập nhật khi có ai đó thay đổi việc/thông báo
}

init();
