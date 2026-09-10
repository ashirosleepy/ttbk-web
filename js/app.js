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

// Giai đoạn 2 — Thanh điều hướng dưới cùng trên di động: 4 mục hay dùng nhất
// + nút "Menu" mở lại ngăn kéo đầy đủ (dùng chung hàm mở/đóng với nút ☰ cũ).
function setupBottomNav() {
  const bar = document.getElementById("bottom-nav");
  if (!bar) return;
  bar.querySelectorAll(".bn-item[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => loadSection(btn.dataset.section));
  });
  const moreBtn = document.getElementById("bn-more");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      const sidebar = document.getElementById("sidebar");
      const backdrop = document.getElementById("nav-backdrop");
      if (!sidebar || !backdrop) return;
      sidebar.classList.add("open");
      backdrop.classList.add("show");
    });
  }

  // Đồng bộ số thông báo/số món cần mua từ sidebar (thông báo đó do
  // notifications.js / shopping.js tự cập nhật) sang huy hiệu ở thanh dưới.
  mirrorBadge("notif-badge", "bn-notif-badge");
  mirrorBadge("shop-nav-badge", "bn-shop-badge");
}

function mirrorBadge(sourceId, targetId) {
  const source = document.getElementById(sourceId);
  const target = document.getElementById(targetId);
  if (!source || !target) return;
  const sync = () => {
    target.textContent = source.textContent;
    target.style.display = source.style.display;
  };
  sync();
  new MutationObserver(sync).observe(source, { characterData: true, childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
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
  document.querySelectorAll(".bn-item[data-section]").forEach((b) => b.classList.toggle("active", b.dataset.section === name));
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
  setupBottomNav();
  await generateTodayTasks(); // tự tạo việc của hôm nay từ các lịch lặp lại đang bật
  selectedUserId = STATE.me.id;

  // Mở đúng mục nếu được mở từ phím tắt PWA (VD: ?section=shopping)
  const requestedSection = new URLSearchParams(location.search).get("section");
  const validSection = requestedSection && SECTION_LOADERS[requestedSection] ? requestedSection : "tasks";
  await loadSection(validSection);
  refreshNotifBadge(); // hiện số thông báo chưa đọc ngay trên thanh menu
  subscribeRealtime(); // tự cập nhật khi có ai đó thay đổi việc/thông báo
}

init();
