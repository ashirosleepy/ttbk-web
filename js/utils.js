// ============================================================
// UTILS.JS — các hàm nhỏ dùng chung cho nhiều trang
// ============================================================

// ---- Cấu hình hệ thống điểm công bằng ----
// Bỏ việc (quá hạn, bấm "Không hoàn thành"): trừ một nửa điểm thưởng của việc đó.
const MISS_PENALTY_RATIO = 0.5;
// Xin đổi việc và có người khác nhận thành công: trừ 1 khoản cố định nhỏ,
// đủ để không khuyến khích đổi việc tuỳ tiện nhưng không "phạt nặng" lý do chính đáng.
const HANDOFF_PENALTY = 2;

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
    bo_lo: `<span class="badge badge-missed">Bỏ việc</span>`,
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

// ---- Điểm công bằng: cộng khi hoàn thành việc, trừ khi bỏ việc / xin đổi việc ----
// Ghi 1 khoản cộng/trừ điểm vào bảng point_adjustments (cần tạo bảng này, xem sql/point_adjustments.sql).
// reason gợi ý: "bo_viec" (bỏ việc), "xin_doi" (xin đổi việc thành công).
async function addPointAdjustment(userId, taskId, delta, reason) {
  if (!userId || !delta) return;
  const { error } = await supabaseClient
    .from("point_adjustments")
    .insert({ user_id: userId, task_id: taskId, delta, reason });
  if (error) console.error("Không ghi được điều chỉnh điểm:", error.message);
}

// Tổng các khoản cộng/trừ điểm của mọi người, tính từ 1 thời điểm (mặc định: từ đầu).
async function fetchPointAdjustmentsSince(sinceISO = null) {
  const map = {};
  let query = supabaseClient.from("point_adjustments").select("user_id, delta");
  if (sinceISO) query = query.gte("created_at", sinceISO);
  const { data, error } = await query;
  if (error) {
    console.error("Không lấy được điều chỉnh điểm:", error.message);
    return map;
  }
  (data || []).forEach((a) => {
    map[a.user_id] = (map[a.user_id] || 0) + (a.delta || 0);
  });
  return map;
}

// Tổng điểm hiện tại của mỗi thành viên = tổng điểm việc đã hoàn thành (tasks.status = hoan_thanh)
// + tổng các khoản cộng/trừ điểm (point_adjustments). Dùng cho trang Thành viên và
// để ưu tiên chia việc mới cho người đang có ít điểm hơn.
async function fetchMemberPointsMap() {
  const map = {};
  (STATE.profiles || []).forEach((p) => (map[p.id] = 0));

  const { data: doneTasks, error: doneErr } = await supabaseClient
    .from("tasks")
    .select("assigned_to, points")
    .eq("status", "hoan_thanh");
  if (doneErr) {
    console.error("Không lấy được việc đã hoàn thành:", doneErr.message);
  } else {
    (doneTasks || []).forEach((t) => {
      if (map[t.assigned_to] !== undefined) map[t.assigned_to] += t.points || 0;
    });
  }

  const adjustments = await fetchPointAdjustmentsSince();
  Object.keys(adjustments).forEach((userId) => {
    if (map[userId] !== undefined) map[userId] += adjustments[userId];
  });

  return map;
}
