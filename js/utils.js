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
// Nếu thành viên đang đi vắng (is_away), avatar được làm mờ đi để mọi người dễ nhận biết.
function avatarHTML(profile, size = "") {
  if (!profile) return `<div class="avatar ${size}" style="background:#ccc">?</div>`;
  const cls = size ? `avatar ${size}` : "avatar";
  const awayStyle = profile.is_away ? "opacity:0.4;filter:grayscale(70%);" : "";
  const title = profile.is_away ? ' title="Đang tạm vắng"' : "";
  return `<div class="${cls}" style="background:${profile.avatar_color || "#3B6E8F"};${awayStyle}"${title}>${initials(profile.name)}</div>`;
}

// Định dạng ngày kiểu Việt Nam: 2026-09-06 -> 06/09
function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr() {
  // Ngày nghiệp vụ của TTBK đổi lúc 03:00 theo giờ Việt Nam.
  const businessTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(businessTime);
}

function businessDateFromISO(isoString) {
  const businessTime = new Date(new Date(isoString).getTime() - 3 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(businessTime);
}

// Số ngày đã trễ so với hạn (0 nếu chưa tới hạn hoặc chưa có hạn).
// referenceDateStr mặc định là hôm nay, có thể truyền ngày khác (vd ngày hoàn thành)
// để tính "trễ N ngày so với hạn" ngay trên phiếu việc đã xong.
function daysOverdue(dueDate, referenceDateStr = todayStr()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  const ref = new Date(referenceDateStr + "T00:00:00");
  const diff = Math.round((ref - due) / 86400000);
  return diff > 0 ? diff : 0;
}

// Định dạng ngày giờ đầy đủ kiểu Việt Nam từ 1 chuỗi ISO: "06/09 14:35"
function formatDateTimeShort(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${dateStr} ${timeStr}`;
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
    vo_chu: `<span class="badge badge-pending">✈️ Vô chủ</span>`,
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

// ---- "Điểm bù vắng mặt" (shadow points) ----
// Mỗi khi 1 người ĐANG CÓ MẶT hoàn thành 1 việc và nhận điểm, mọi người ĐANG ĐI VẮNG
// được cộng thêm 1 khoản "điểm bù" = điểm việc đó / số người đang có mặt. Cộng dồn theo
// thời gian, khoản này đúng bằng điểm trung bình mà những người ở nhà đã kiếm được — nhờ
// vậy khi người đi vắng quay lại, điểm của họ vẫn cân bằng với mọi người và không bị hệ
// thống "Chia việc tự động" dồn việc để bắt kịp điểm.
async function distributeAwayShadowPoints(taskId, points) {
  if (!points) return;
  const awayMembers = (STATE.profiles || []).filter((p) => p.is_away);
  if (awayMembers.length === 0) return;

  const presentCount = (STATE.profiles || []).filter((p) => !p.is_away).length;
  if (presentCount === 0) return;

  const shadowAmount = Math.round(points / presentCount);
  if (!shadowAmount) return;

  for (const p of awayMembers) {
    await addPointAdjustment(p.id, taskId, shadowAmount, "bu_vang_mat");
  }
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
