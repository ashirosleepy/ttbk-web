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

async function loadSection(name) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.section === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `section-${name}`));
  const loader = SECTION_LOADERS[name];
  if (loader) await loader();
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

  updateTopbar();
  setupNav();
  await generateTodayTasks(); // tự tạo việc của hôm nay từ các lịch lặp lại đang bật
  await loadSection("dashboard");
}

init();
