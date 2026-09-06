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
    chua_lam: `<span class="badge badge-todo">Chưa làm</span>`,
    dang_cho: `<span class="badge badge-wait">Đang chờ</span>`,
    hoan_thanh: `<span class="badge badge-done">Hoàn thành</span>`,
  };
  return map[status] || "";
}

// Ghi 1 dòng vào task_history — gọi hàm này mỗi khi có thay đổi trên 1 việc
async function logHistory(taskId, userId, action, detail) {
  const { error } = await supabaseClient
    .from("task_history")
    .insert({ task_id: taskId, user_id: userId, action, detail });
  if (error) console.error("Không ghi được lịch sử:", error.message);
}
