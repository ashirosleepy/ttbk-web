// ============================================================
// UTILS.JS — các hàm nhỏ dùng chung cho nhiều trang
// ============================================================

// Lấy chữ cái đầu của tên, vd "Tiến" -> "T"
function initials(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

// Vẽ 1 avatar tròn có màu + chữ cái đầu, dựa trên profile {name, avatar_color}
function avatarHTML(profile, size = "") {
  if (!profile) return `<div class="avatar ${size}" style="background:#ccc">?</div>`;
  const cls = size ? `avatar ${size}` : "avatar";
  return `<div class="${cls}" style="background:${profile.avatar_color || "#3B6E8F"}">${initials(profile.name)}</div>`;
}

// Định dạng ngày kiểu Việt Nam: 2026-09-06 -> 06/09
function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

// Trả về id (uuid) của profile theo tên, dùng khi cần tra nhanh trong danh sách đã tải sẵn
function findProfile(profiles, id) {
  return profiles.find((p) => p.id === id) || null;
}

// Tránh lỗi hiển thị nếu người dùng gõ ký tự đặc biệt trong tên việc
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function statusBadgeHTML(status) {
  const map = {
    cho_nhan: `<span class="badge badge-pending">Chờ nhận</span>`,
    chua_lam: `<span class="badge badge-todo">Chưa làm</span>`,
    dang_cho: `<span class="badge badge-wait">Đang chờ</span>`,
    hoan_thanh: `<span class="badge badge-done">Hoàn thành</span>`,
  };
  return map[status] || "";
}

// Thời gian tương đối kiểu "5 phút trước", "hôm qua"... dùng cho danh sách thông báo
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "hôm qua";
  return `${day} ngày trước`;
}

// Trả về ngày thứ 2 của tuần chứa dateStr, dùng để tính điểm công bằng "tuần này"
function mondayOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=CN..6=T7
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Ghi 1 dòng vào task_history — gọi hàm này mỗi khi có thay đổi trên 1 việc
async function logHistory(taskId, userId, action, detail) {
  const { error } = await supabaseClient
    .from("task_history")
    .insert({ task_id: taskId, user_id: userId, action, detail });
  if (error) console.error("Không ghi được lịch sử:", error.message);
}
