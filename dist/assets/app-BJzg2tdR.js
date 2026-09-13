import"./style-C_uAb6-X.js";import"./theme-preload-Cz4vKcn8.js";import{c as e}from"./index-C6pgQ0vL.js";const a=`/* ==========================================================\r
   TTBK - Hieu ung chuyen trang muot\r
   Dung chung cho index.html va "Chi tieu TTBK.html".\r
   ========================================================== */\r
(function () {\r
  var FADE_OUT_MS = 220;\r
  var root = document.documentElement;\r
\r
  function showPage() {\r
    requestAnimationFrame(function () {\r
      requestAnimationFrame(function () {\r
        root.classList.add("pg-ready");\r
      });\r
    });\r
  }\r
\r
  function isLocalHtmlLink(href) {\r
    if (!href) return false;\r
    try {\r
      var url = new URL(href, window.location.href);\r
      if (url.origin !== window.location.origin) return false;\r
      if (url.href.split("#")[0] === window.location.href.split("#")[0]) return false;\r
      return /\\.html?$/i.test(url.pathname) || href.slice(-5).toLowerCase() === ".html";\r
    } catch (e) {\r
      return false;\r
    }\r
  }\r
\r
  window.ttbkNavigate = function (href) {\r
    root.classList.remove("pg-ready");\r
    root.classList.add("pg-leave");\r
    window.setTimeout(function () {\r
      window.location.href = href;\r
    }, FADE_OUT_MS);\r
  };\r
\r
  document.addEventListener("click", function (e) {\r
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;\r
    var el = e.target.closest("a[href]");\r
    if (!el || el.target === "_blank") return;\r
    var href = el.getAttribute("href");\r
    if (!isLocalHtmlLink(href)) return;\r
    e.preventDefault();\r
    window.ttbkNavigate(href);\r
  }, true);\r
\r
  window.addEventListener("pageshow", function (e) {\r
    if (e.persisted) {\r
      root.classList.remove("pg-leave");\r
      root.classList.add("pg-fade");\r
      showPage();\r
    }\r
  });\r
\r
  if (document.readyState === "loading") {\r
    document.addEventListener("DOMContentLoaded", showPage);\r
  } else {\r
    showPage();\r
  }\r
})();\r


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
  if (!profile) return \`<div class="avatar \${size}" style="background:#ccc">?</div>\`;
  const cls = size ? \`avatar \${size}\` : "avatar";
  const awayStyle = profile.is_away ? "opacity:0.4;filter:grayscale(70%);" : "";
  const title = profile.is_away ? ' title="Đang tạm vắng"' : "";
  if (profile.avatar_url) {
    return \`<img class="\${cls} avatar-img" src="\${profile.avatar_url}" style="\${awayStyle}"\${title} alt="\${escapeHTML(profile.name || "")}" />\`;
  }
  return \`<div class="\${cls}" style="background:\${profile.avatar_color || "#3B6E8F"};\${awayStyle}"\${title}>\${initials(profile.name)}</div>\`;
}

// Định dạng ngày kiểu Việt Nam: 2026-09-06 -> 06/09
function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return \`\${String(d.getDate()).padStart(2, "0")}/\${String(d.getMonth() + 1).padStart(2, "0")}\`;
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
  const dateStr = \`\${String(d.getDate()).padStart(2, "0")}/\${String(d.getMonth() + 1).padStart(2, "0")}\`;
  const timeStr = \`\${String(d.getHours()).padStart(2, "0")}:\${String(d.getMinutes()).padStart(2, "0")}\`;
  return \`\${dateStr} \${timeStr}\`;
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
    cho_nhan: \`<span class="badge badge-pending">Chờ nhận</span>\`,
    chua_lam: \`<span class="badge badge-todo">Chưa làm</span>\`,
    dang_cho: \`<span class="badge badge-wait">Đang chờ</span>\`,
    hoan_thanh: \`<span class="badge badge-done">Hoàn thành</span>\`,
    bo_lo: \`<span class="badge badge-missed">Bỏ việc</span>\`,
    vo_chu: \`<span class="badge badge-pending">✈️ Vô chủ</span>\`,
  };
  return map[status] || "";
}

// Thời gian tương đối kiểu "5 phút trước", "hôm qua"... dùng cho danh sách thông báo
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return \`\${min} phút trước\`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return \`\${hour} giờ trước\`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "hôm qua";
  return \`\${day} ngày trước\`;
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

// ============================================================
// GIAI ĐOẠN 3 — TOAST / SNACKBAR
// Thông báo nhỏ mọc lên góc dưới màn hình khi thao tác xong,
// thay cho việc chuyển trang hụt hẫng. Dùng: showToast("Đã lưu việc").
// type: "success" (mặc định) | "error" | "info"
// ============================================================
function ensureToastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

function showToast(message, type = "success", duration = 2600) {
  if (!message) return;
  const host = ensureToastHost();
  const icon = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✅";
  const el = document.createElement("div");
  el.className = \`toast toast-\${type}\`;
  el.innerHTML = \`<span class="toast-icon">\${icon}</span><span class="toast-msg"></span>\`;
  el.querySelector(".toast-msg").textContent = message;
  host.appendChild(el);
  // buộc reflow để animation vào chạy đúng
  void el.offsetWidth;
  el.classList.add("show");

  const remove = () => {
    el.classList.remove("show");
    el.classList.add("hide");
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener("click", remove);
  setTimeout(remove, duration);
}

// ============================================================
// GIAI ĐOẠN 3 — Ô TRỐNG (EMPTY STATE) THÂN THIỆN
// Dùng: emptyStateHTML("🎉", "Hoàn thành mọi việc hôm nay!", "Nghỉ ngơi thôi")
// ============================================================
function emptyStateHTML(icon, title, sub = "") {
  return \`
    <div class="empty-state-rich">
      <div class="empty-state-icon">\${icon}</div>
      <div class="empty-state-title">\${escapeHTML(title)}</div>
      \${sub ? \`<div class="empty-state-sub">\${escapeHTML(sub)}</div>\` : ""}
    </div>\`;
}

// ============================================================
// GIAI ĐOẠN 3 — SKELETON LOADING
// Dùng để thay chữ "Đang tải..." tĩnh trong index.html.
// Sinh ra n khối xám nhấp nháy mờ, có thể dùng cho phiếu việc,
// thẻ đồ dùng, hàng bảng... container CSS lo phần khung ngoài.
// ============================================================
function skeletonTicketsHTML(n = 3) {
  let html = "";
  for (let i = 0; i < n; i++) {
    html += \`
      <div class="skeleton skeleton-ticket">
        <div class="skeleton-circle"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line" style="width:\${55 + (i % 3) * 12}%"></div>
          <div class="skeleton-line short" style="width:\${30 + (i % 2) * 10}%"></div>
        </div>
      </div>\`;
  }
  return html;
}

function skeletonCardsHTML(n = 4) {
  let html = "";
  for (let i = 0; i < n; i++) {
    html += \`
      <div class="skeleton skeleton-card-block">
        <div class="skeleton-line" style="width:70%"></div>
        <div class="skeleton-line short" style="width:40%"></div>
      </div>\`;
  }
  return html;
}

// ============================================================
// GIAI ĐOẠN 2 — VUỐT TRÁI/PHẢI (SWIPE ACTIONS) TRÊN DI ĐỘNG
// Gắn 1 lần lên container (event delegation), tự nhận biết các thẻ
// con khớp itemSelector và cho vuốt để kích hoạt nút hành động có sẵn
// bên trong thẻ đó — không cần đổi cấu trúc dữ liệu hay render lại.
//   enableSwipeActions(containerEl, {
//     itemSelector: ".task-ticket",
//     rightSelector: '[data-action="toggle"]',   // vuốt sang PHẢI
//     leftSelector: '[data-action="miss"]',       // vuốt sang TRÁI
//     rightLabel: "✓ Xong", leftLabel: "✕ Bỏ việc"
//   });
// Chỉ kích hoạt bằng cảm ứng (bỏ qua chuột) để không cấn thao tác kéo-thả khác.
// ============================================================
function enableSwipeActions(container, opts) {
  if (!container || container.dataset.swipeBound) return;
  container.dataset.swipeBound = "1";

  const itemSelector = opts.itemSelector;
  const rightSelector = opts.rightSelector || null;
  const leftSelector = opts.leftSelector || null;
  const rightLabel = opts.rightLabel || "✓";
  const leftLabel = opts.leftLabel || "✕";
  const THRESHOLD = 72;
  const MAX_DRAG = 96;

  let item = null, startX = 0, startY = 0, dx = 0, axis = null, dragging = false;

  function setupBg(el) {
    if (el.querySelector(":scope > .swipe-bg")) return;
    el.classList.add("swipe-enabled");
    const bg = document.createElement("div");
    bg.className = "swipe-bg";
    bg.innerHTML =
      \`<span class="swipe-bg-side swipe-bg-left">\${leftSelector ? leftLabel : ""}</span>\` +
      \`<span class="swipe-bg-side swipe-bg-right">\${rightSelector ? rightLabel : ""}</span>\`;
    el.insertBefore(bg, el.firstChild);
  }

  function reset() {
    if (item) {
      item.classList.remove("swiping");
      item.style.transform = "";
      const bg = item.querySelector(":scope > .swipe-bg");
      if (bg) bg.removeAttribute("data-dir");
    }
    item = null; dx = 0; axis = null; dragging = false;
  }

  container.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const el = e.target.closest(itemSelector);
    if (!el || !container.contains(el)) return;
    if (e.target.closest("button, select, input, a, textarea")) return;
    item = el;
    startX = e.clientX; startY = e.clientY; dx = 0; axis = null; dragging = false;
    setupBg(item);
  });

  container.addEventListener("pointermove", (e) => {
    if (!item) return;
    const curDx = e.clientX - startX;
    const curDy = e.clientY - startY;
    if (axis === null) {
      if (Math.abs(curDx) < 8 && Math.abs(curDy) < 8) return;
      axis = Math.abs(curDx) > Math.abs(curDy) ? "x" : "y";
      if (axis === "y") { item = null; return; }
      dragging = true;
      item.classList.add("swiping");
    }
    if (!dragging) return;
    dx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, curDx));
    if (dx > 0 && !rightSelector) dx = 0;
    if (dx < 0 && !leftSelector) dx = 0;
    item.style.transform = \`translateX(\${dx}px)\`;
    const bg = item.querySelector(":scope > .swipe-bg");
    if (bg) bg.setAttribute("data-dir", dx > 4 ? "right" : dx < -4 ? "left" : "");
  });

  function endDrag() {
    if (!item) return;
    const el = item;
    const finalDx = dx;
    el.classList.remove("swiping");
    el.style.transform = "";
    const bg = el.querySelector(":scope > .swipe-bg");
    if (bg) bg.removeAttribute("data-dir");
    if (dragging && Math.abs(finalDx) > THRESHOLD) {
      const sel = finalDx > 0 ? rightSelector : leftSelector;
      const btn = sel ? el.querySelector(sel) : null;
      if (btn) btn.click();
    }
    item = null; dx = 0; axis = null; dragging = false;
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
}


// ============================================================
// CLASS-SCHEDULE.JS — lịch học cá nhân theo trường + tự tính "vùng bận"
//
// Ý tưởng (theo đúng đề xuất): giờ bận do học KHÔNG chỉ là giờ học,
// mà là: đệm chuẩn bị/di chuyển trước + giờ học + đệm về nhà/nghỉ sau.
// Toàn bộ khoảng từ tiết sớm nhất -> tiết muộn nhất trong ngày được coi
// là 1 "vùng bận" liền mạch (kể cả nếu giữa các tiết có tiết trống).
//
// LƯU Ý: lịch học không lặp cố định theo thứ mỗi tuần (lịch thật đổi theo
// tuần thực tế), nên user_class_schedule lưu theo NGÀY CỤ THỂ (class_date),
// không phải theo day_of_week. Người dùng cập nhật theo từng tuần ở trang
// "Lịch" (xem phần renderClassScheduleCard trong schedule.js).
//
// BỔ SUNG (v2):
// - Đệm trước/sau giờ học được tính từ khoảng cách cố định theo trường,
//   tốc độ di chuyển và hệ số tắc đường theo khung giờ.
// - getEffectiveStatus(): điểm chốt DUY NHẤT cho "trạng thái thật ngay lúc
//   này" của 1 người — gộp Ốm > Đi xa > Đang học (tính cả đệm di chuyển) >
//   trạng thái bận tự khai trong Cài đặt > Rảnh. auto-assign.js và giao diện
//   (members.js/dashboard.js) nên dùng hàm này thay vì tự suy luận riêng lẻ.
// ============================================================

const CLASS_BUFFER_BEFORE_MIN = 20; // fallback khi chưa chọn trường
const CLASS_BUFFER_AFTER_MIN = 30;  // fallback khi chưa chọn trường
const UNIVERSITY_TRAVEL_DISTANCE_KM = {
  PTIT: 4.5,
  HUST: 5,
  HUCE: 4.8,
};
const DEFAULT_TRAVEL_SPEED_KMH = {
  motorbike: 25,
  bike: 15,
  walk: 5,
  car: 22,
  bus: 18,
};

const CLASS_WEEKDAY_SHORT = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 0: "CN" };

// Hệ số tắc đường theo khung giờ (gộp từ 2 bản đề xuất, có thể chỉnh lại sau
// khi có dữ liệu thực tế). Khung nào không khớp -> hệ số 1 (đường thoáng).
const RUSH_HOUR_FACTORS = [
  { from: 6 * 60, to: 7 * 60, factor: 1.5 },
  { from: 7 * 60, to: 9 * 60, factor: 2.0 },
  { from: 11 * 60, to: 13 * 60, factor: 1.5 },
  { from: 16 * 60, to: 19 * 60, factor: 2.0 },
];

let CLASS_PERIODS_CACHE = {}; // university -> [{period_number, start_time, end_time}]
let USER_CLASS_SCHEDULE_CACHE = {}; // user_id -> rows (reset khi lưu lại)

async function fetchClassPeriods(university) {
  if (!university) return [];
  if (CLASS_PERIODS_CACHE[university]) return CLASS_PERIODS_CACHE[university];
  const { data, error } = await supabaseClient
    .from("class_periods")
    .select("*")
    .eq("university", university)
    .order("period_number");
  if (error) {
    console.error("Không lấy được khung tiết:", error.message);
    return [];
  }
  CLASS_PERIODS_CACHE[university] = data || [];
  return CLASS_PERIODS_CACHE[university];
}

async function fetchUserClassSchedule(userId, { fresh = false } = {}) {
  if (!fresh && USER_CLASS_SCHEDULE_CACHE[userId]) return USER_CLASS_SCHEDULE_CACHE[userId];
  const { data, error } = await supabaseClient
    .from("user_class_schedule")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.error("Không lấy được lịch học:", error.message);
    return [];
  }
  USER_CLASS_SCHEDULE_CACHE[userId] = data || [];
  return USER_CLASS_SCHEDULE_CACHE[userId];
}

function invalidateUserClassScheduleCache(userId) {
  delete USER_CLASS_SCHEDULE_CACHE[userId];
}

function classTimeToMinutes(t) {
  // nhận "07:00:00" hoặc "07:00"
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function classMinutesToTime(mins) {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return \`\${String(h).padStart(2, "0")}:\${String(m).padStart(2, "0")}\`;
}

// "YYYY-MM-DD" theo giờ địa phương (không dùng toISOString vì lệch múi giờ)
function classDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return \`\${y}-\${m}-\${day}\`;
}

// Mảng 7 Date (Thứ 2 -> Chủ nhật) của tuần chứa anchorDate
function getWeekDates(anchorDate) {
  const d = new Date(anchorDate);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = CN .. 6 = T7
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt;
  });
}

// ---------------- Khấu hao tắc đường ----------------

function getRushFactor(minutesOfDay) {
  const wrapped = ((minutesOfDay % 1440) + 1440) % 1440;
  const hit = RUSH_HOUR_FACTORS.find((r) => wrapped >= r.from && wrapped < r.to);
  return hit ? hit.factor : 1.0;
}

// Thời gian di chuyển (phút, đã nhân hệ số tắc đường tại thời điểm atMinutes).
// Trả về null nếu chưa chọn trường hoặc thiếu tốc độ -> nơi gọi tự fallback
// về đệm cố định.
function computeTravelMinutes(profile, atMinutes) {
  const distanceKm = UNIVERSITY_TRAVEL_DISTANCE_KM[profile?.university];
  if (distanceKm == null) return null;
  const speed = Number(profile.average_speed_kmh) || DEFAULT_TRAVEL_SPEED_KMH[profile.transport_type] || 25;
  const baseMinutes = (distanceKm / speed) * 60;
  const factor = getRushFactor(atMinutes);
  return Math.max(5, Math.round(baseMinutes * factor));
}

// Tính "vùng bận do học" của 1 người trong 1 ngày cụ thể (Date object).
// Trả về {start, end, classStart, classEnd, university, travelBeforeMin, travelAfterMin}
// hoặc null nếu hôm đó không có lịch học.
async function computeClassBusyZone(userId, dateObj) {
  const profile = findProfile(STATE.profiles, userId);
  if (!profile || !profile.university) return null;

  const dateKey = classDateKey(dateObj);
  const rows = await fetchUserClassSchedule(userId);
  const todayRows = rows.filter((r) => r.class_date === dateKey && r.university === profile.university);
  if (todayRows.length === 0) return null;

  const periods = await fetchClassPeriods(profile.university);
  if (periods.length === 0) return null;

  const periodMap = Object.fromEntries(periods.map((p) => [p.period_number, p]));
  const matched = todayRows.map((r) => periodMap[r.period_number]).filter(Boolean);
  if (matched.length === 0) return null;

  const startMin = Math.min(...matched.map((p) => classTimeToMinutes(p.start_time)));
  const endMin = Math.max(...matched.map((p) => classTimeToMinutes(p.end_time)));

  // Đệm trước tính theo hệ số tắc đường tại chính giờ khởi hành (startMin - đệm),
  // đệm sau tính theo giờ tan học (endMin) — dùng vòng lặp ngắn để hội tụ vì
  // "giờ khởi hành" phụ thuộc ngược lại chính thời gian di chuyển.
  let travelBefore = computeTravelMinutes(profile, startMin);
  if (travelBefore != null) {
    // tinh chỉnh 1 lần theo giờ khởi hành thực tế cho chính xác hơn
    travelBefore = computeTravelMinutes(profile, startMin - travelBefore) ?? travelBefore;
  }
  const travelAfter = computeTravelMinutes(profile, endMin);

  const bufferBefore = travelBefore ?? CLASS_BUFFER_BEFORE_MIN;
  const bufferAfter = travelAfter ?? CLASS_BUFFER_AFTER_MIN;

  return {
    start: classMinutesToTime(startMin - bufferBefore),
    end: classMinutesToTime(endMin + bufferAfter),
    classStart: classMinutesToTime(startMin),
    classEnd: classMinutesToTime(endMin),
    university: profile.university,
    travelBeforeMin: travelBefore,
    travelAfterMin: travelAfter,
  };
}

// Người này có đang trong "vùng bận do học" ngay lúc gọi hàm không?
async function isUserInClassRightNow(userId) {
  const now = new Date();
  const zone = await computeClassBusyZone(userId, now);
  if (!zone) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= classTimeToMinutes(zone.start) && nowMin <= classTimeToMinutes(zone.end);
}

// Tóm tắt lịch học hôm nay để hiển thị trên thẻ thành viên (members.js).
// Trả về null nếu hôm nay không có lịch học.
async function getTodayClassSummary(userId) {
  const zone = await computeClassBusyZone(userId, new Date());
  if (!zone) return null;
  return {
    university: zone.university,
    classStart: zone.classStart,
    classEnd: zone.classEnd,
    travelMinutes: zone.travelBeforeMin ?? CLASS_BUFFER_BEFORE_MIN,
  };
}

// ---------------- Trạng thái thật, gộp tất cả nguồn ----------------
// Ưu tiên: Ốm > Đi xa > Đang học (kể cả đệm di chuyển) > bận tự khai > Rảnh.
// Đây là điểm DUY NHẤT nên dùng để quyết định "người này có nhận việc được
// không ngay lúc này" — auto-assign.js và giao diện đều gọi hàm này.
async function getEffectiveStatus(userId) {
  const profile = findProfile(STATE.profiles, userId);
  if (!profile) return { status: "AVAILABLE", busy_level: 0, reason: null };

  if (profile.status === "SICK") {
    return { status: "SICK", busy_level: 3, reason: profile.busy_reason || "Đang ốm", source: "sick" };
  }
  if (profile.status === "AWAY" || profile.is_away) {
    return { status: "AWAY", busy_level: 3, reason: profile.busy_reason || "Đi xa", source: "away" };
  }

  const zone = await computeClassBusyZone(userId, new Date());
  if (zone) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= classTimeToMinutes(zone.start) && nowMin <= classTimeToMinutes(zone.end)) {
      return {
        status: "STUDYING",
        busy_level: 3,
        reason: \`Học \${zone.classStart}-\${zone.classEnd}\${zone.university ? \` (\${zone.university})\` : ""}\`,
        source: "class",
      };
    }
  }

  const level = profile.busy_level ?? 0;
  return {
    status: level > 0 ? "BUSY" : "AVAILABLE",
    busy_level: level,
    reason: profile.busy_reason || null,
    source: "manual",
  };
}


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


// ============================================================
// ROTATIONS.JS — hàng đợi luân phiên dùng cho việc phát sinh
// và việc lặp lại xoay vòng (thay vì gán cứng "Tiến luôn thứ 2")
// ============================================================

let rqOrder = []; // thứ tự đang chọn khi tạo hàng đợi mới (mảng id thành viên)
let editingRotationId = null;

function resetRotationForm() {
  editingRotationId = null;
  document.getElementById("rq-label").value = "";
  document.getElementById("rq-icon").value = "🔁";
  document.getElementById("rq-points").value = 10;
  rqOrder = [];
  renderOrderPicker();

  const saveBtn = document.getElementById("rq-save");
  if (saveBtn) saveBtn.textContent = "Tạo hàng đợi";
}

async function fetchRotationQueues() {
  const { data, error } = await supabaseClient.from("rotation_queues").select("*").order("created_at");
  if (error) {
    console.error("Không lấy được hàng đợi:", error.message);
    return [];
  }
  return data;
}

// Người đang tới lượt trong hàng đợi. Nếu người đó đang đi vắng, tự động bỏ qua (skip)
// và chuyển cho người kế tiếp trong hàng đợi — không cần đổi current_index lưu trong DB,
// vì lần "hoàn thành/không hoàn thành" tiếp theo sẽ tự dựa trên người thực sự đã làm.
function currentHolder(queue) {
  if (!queue || !queue.member_order || queue.member_order.length === 0) return null;
  const order = queue.member_order;
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const id = order[(queue.current_index + i) % n];
    const profile = findProfile(STATE.profiles, id);
    if (profile && !profile.is_away) return profile;
  }
  // Cả hàng đợi đều đang đi vắng -> đành trả về người theo lượt gốc để không bị kẹt.
  return findProfile(STATE.profiles, order[queue.current_index % n]);
}

// Người kế tiếp NGAY SAU 1 người cụ thể trong hàng đợi (dùng khi báo bận, chuyển việc),
// cũng bỏ qua những người đang đi vắng.
function nextAfterUser(queue, userId) {
  const order = queue.member_order || [];
  const idx = order.indexOf(userId);
  if (idx === -1 || order.length === 0) return null;
  const n = order.length;
  for (let i = 1; i <= n; i++) {
    const id = order[(idx + i) % n];
    const profile = findProfile(STATE.profiles, id);
    if (profile && !profile.is_away) return profile;
  }
  return findProfile(STATE.profiles, order[(idx + 1) % n]);
}

// Gọi khi 1 việc thuộc hàng đợi được hoàn thành: chuyển lượt cho người SAU người vừa làm xong
async function advanceQueueByCompleter(queueId, completedUserId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue || !queue.member_order || queue.member_order.length === 0) return;

  const order = queue.member_order;
  const idx = order.indexOf(completedUserId);
  const newIndex = idx === -1 ? (queue.current_index + 1) % order.length : (idx + 1) % order.length;

  const { error: updateError } = await supabaseClient
    .from("rotation_queues")
    .update({ current_index: newIndex })
    .eq("id", queueId);
  if (updateError) return;

  const nextQueue = { ...queue, current_index: newIndex };
  const nextHolder = currentHolder(nextQueue);
  if (nextHolder && nextHolder.id !== completedUserId) {
    await createNotification(nextHolder.id, \`\${queue.icon} \${queue.label} — đến lượt bạn.\`, {
      type: "den_luot",
    });
  }
}

async function restoreQueueToUser(queueId, userId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("member_order").eq("id", queueId).single();
  if (error || !queue || !Array.isArray(queue.member_order)) return;

  const userIndex = queue.member_order.indexOf(userId);
  if (userIndex === -1) return;
  await supabaseClient.from("rotation_queues").update({ current_index: userIndex }).eq("id", queueId);
}

// Tạo 1 việc phát sinh (đổ rác, thay bình nước...) giao cho người đang tới lượt
async function reportAdhocTask(queueId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue) return alert("Không tìm thấy hàng đợi.");

  const { data: activeTask } = await supabaseClient
    .from("tasks")
    .select("assigned_to")
    .eq("rotation_queue_id", queueId)
    .eq("due_date", todayStr())
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const holder = activeTask?.assigned_to
    ? findProfile(STATE.profiles, activeTask.assigned_to)
    : currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  // Chỉ gửi thông báo nhắc người tới lượt, không tạo thêm task mới.
  await createNotification(holder.id, \`\${queue.icon} \${queue.label} — đến lượt bạn.\`, {
    type: "den_luot",
  });

  await logHistory(
    null,
    STATE.me.id,
    "bao_phat_sinh",
    \`\${STATE.me.name} báo có việc "\${queue.label}", đến lượt \${holder.name}\`
  );

  alert(\`Đã thông báo cho \${holder.name}.\`);
  renderRotationAdmin();
}

function renderOrderPicker() {
  const wrap = document.getElementById("rq-order-picker");
  if (!wrap) return;

  const profiles = Array.isArray(STATE.profiles) ? STATE.profiles : [];
  wrap.innerHTML = profiles
    .map((p) => {
      const idx = rqOrder.indexOf(p.id);
      const label = idx === -1 ? escapeHTML(p.name) : \`\${idx + 1}. \${escapeHTML(p.name)}\`;
      return \`<button type="button" class="day-toggle \${idx !== -1 ? "on" : ""}" style="width:auto;padding:8px 12px;" data-member="\${p.id}">\${label}</button>\`;
    })
    .join("");
}

async function renderRotationAdmin() {
  const queues = await fetchRotationQueues();
  const listEl = document.getElementById("rotation-list");

  if (!listEl) return;

  // Task đang mở là nguồn chính xác hơn current_index, kể cả khi due_date
  // là ngày cũ do task đã được tạo trước khi xin đổi việc.
  const { data: activeTasks, error: taskErr } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id, assigned_to, status")
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false });
  const activeTaskByQueue = taskErr
    ? {}
    : (activeTasks || []).reduce((map, task) => {
        if (task.rotation_queue_id && task.assigned_to && !map[task.rotation_queue_id]) {
          map[task.rotation_queue_id] = task;
        }
        return map;
      }, {});

  const safeQueues = Array.isArray(queues) ? queues : [];
  if (safeQueues.length === 0) {
    listEl.innerHTML = \`<p class="empty-state">Chưa có hàng đợi nào. Thử tạo cho "Đổ rác" hoặc "Thay bình nước".</p>\`;
    return;
  }

  listEl.innerHTML = safeQueues
    .map((q) => {
      const activeTask = activeTaskByQueue[q.id];
      const holder = activeTask
        ? findProfile(STATE.profiles, activeTask.assigned_to)
        : currentHolder(q);
      const orderNames = (q.member_order || [])
        .map((id) => {
          const p = findProfile(Array.isArray(STATE.profiles) ? STATE.profiles : [], id);
          return p ? p.name : "?";
        })
        .join(" → ");
      return \`
      <div class="task-ticket" style="border-left-color:\${holder ? holder.avatar_color : "#ccc"}" data-id="\${q.id}">
        <div class="task-body">
          <div class="task-title">\${q.icon} \${escapeHTML(q.label)}</div>
          <div class="task-meta">
            <span>Thứ tự: \${escapeHTML(orderNames)}</span>
            <span>Đang tới lượt: <strong>\${holder ? escapeHTML(holder.name) : "?"}</strong></span>
            <span>\${q.points} điểm</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" data-action="report-adhoc">Báo có việc</button>
          <button class="icon-btn" data-action="edit-rotation" title="Sửa hàng đợi">✏️</button>
          <button class="icon-btn" data-action="del-rotation" title="Xoá hàng đợi">🗑</button>
        </div>
      </div>\`;
    })
    .join("");
}

function bindRotationEvents() {
  const wrap = document.getElementById("rq-order-picker");
  if (wrap && !wrap.dataset.bound) {
    wrap.dataset.bound = "1";
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-member]");
      if (!btn) return;
      const id = btn.dataset.member;
      const idx = rqOrder.indexOf(id);
      if (idx === -1) rqOrder.push(id);
      else rqOrder.splice(idx, 1);
      renderOrderPicker();
    });
  }

  const listEl = document.getElementById("rotation-list");
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = "1";
    listEl.addEventListener("click", async (e) => {
      const ticket = e.target.closest(".task-ticket");
      if (!ticket) return;
      const id = ticket.dataset.id;
      if (e.target.dataset.action === "report-adhoc") await reportAdhocTask(id);
      if (e.target.dataset.action === "edit-rotation") {
        const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", id).single();
        if (error || !queue) return alert("Không tìm thấy hàng đợi để sửa.");

        editingRotationId = queue.id;
        document.getElementById("rq-label").value = queue.label || "";
        document.getElementById("rq-icon").value = queue.icon || "🔁";
        document.getElementById("rq-points").value = queue.points ?? 10;
        rqOrder = Array.isArray(queue.member_order) ? [...queue.member_order] : [];
        renderOrderPicker();

        const saveBtn = document.getElementById("rq-save");
        if (saveBtn) saveBtn.textContent = "Lưu thay đổi";
        document.getElementById("rq-label").focus();
      }
      if (e.target.dataset.action === "del-rotation") {
        if (!confirm("Xoá hàng đợi luân phiên này? Các lịch đang dùng hàng đợi này sẽ không còn tự gán được nữa.")) return;
        const { error } = await supabaseClient.from("rotation_queues").delete().eq("id", id);
        if (error) return alert("Lỗi: " + error.message);
        if (editingRotationId === id) resetRotationForm();
        renderRotationAdmin();
      }
    });
  }

  const saveBtn = document.getElementById("rq-save");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const label = document.getElementById("rq-label").value.trim();
      if (!label) return alert("Nhập tên việc.");
      if (rqOrder.length < 2) return alert("Chọn ít nhất 2 người theo đúng thứ tự luân phiên.");

      const payload = {
        label,
        icon: document.getElementById("rq-icon").value.trim() || "🔁",
        member_order: rqOrder,
        points: Number(document.getElementById("rq-points").value) || 10,
      };

      if (editingRotationId) {
        const { error } = await supabaseClient.from("rotation_queues").update(payload).eq("id", editingRotationId);
        if (error) return alert("Lỗi: " + error.message);
      } else {
        const { data: duplicate } = await supabaseClient
          .from("rotation_queues")
          .select("id")
          .ilike("label", label)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        if (duplicate) return alert("Công việc luân phiên này đã tồn tại.");
        const { error } = await supabaseClient.from("rotation_queues").insert(payload);
        if (error) return alert("Lỗi: " + error.message);
      }

      resetRotationForm();
      renderRotationAdmin();
      if (typeof refreshScheduleRotationOptions === "function") refreshScheduleRotationOptions();
    });
  }
}

async function loadRotationAdmin() {
  renderOrderPicker();
  bindRotationEvents();
  await renderRotationAdmin();
}


// ============================================================
// NOTIFICATIONS.JS — trang "Thông báo" ở menu bên trái + realtime
// ============================================================

// Gọi hàm này ở bất cứ đâu cần báo cho 1 người: đến lượt, xin đổi việc...
async function createNotification(userId, message, opts = {}) {
  const payload = {
    user_id: userId,
    message,
    type: opts.type || "thong_bao",
    task_id: opts.taskId || null,
    exchange_id: opts.exchangeId || null,
  };
  const { error } = await supabaseClient.from("notifications").insert(payload);
  if (error) {
    console.error("Không gửi được thông báo:", error.message);
    return;
  }

  const { error: pushError } = await supabaseClient.functions.invoke("send-push", {
    body: {
      user_id: userId,
      title: opts.title || "Nhiệm vụ hệ thống",
      body: message,
      url: opts.url || new URL("index.html", document.baseURI).href,
      tag: opts.type || "thong_bao",
    },
  });
  if (pushError) console.error("Không gửi được push notification:", pushError.message);
}

async function notifyTaskAssignee(task, message) {
  if (!task || !task.assigned_to) return;
  await createNotification(
    task.assigned_to,
    message || \`📌 Bạn có việc mới: "\${task.title}".\`,
    { type: "thong_bao", taskId: task.id }
  );
}

async function fetchNotifications() {
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", STATE.me.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("Không lấy được thông báo:", error.message);
    return [];
  }
  return data;
}

// Cập nhật số thông báo chưa đọc hiện ở mục "Thông báo" trên thanh menu
async function refreshNotifBadge() {
  const list = await fetchNotifications();
  const unread = list.filter((n) => !n.is_read).length;
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (unread > 0) {
    badge.style.display = "inline-flex";
    badge.textContent = unread > 9 ? "9+" : String(unread);
  } else {
    badge.style.display = "none";
  }
}

function notifIconForType(type) {
  const map = { den_luot: "🔁", xin_doi: "🔄", thong_bao: "🔔" };
  return map[type] || "🔔";
}

function isExchangeNotification(n) {
  if (!n) return false;
  if (n.type === "xin_doi") return true;
  if (n.exchange_id) return true;
  if (!n.task_id || !n.message) return false;
  const msg = String(n.message).toLowerCase();
  if (msg.includes("đã nhận đổi việc") || msg.includes("cả 3 người còn lại")) return false;
  return msg.includes("muốn đổi việc") || msg.includes("ai nhận giúp") || msg.includes("xin đổi việc");
}

async function fetchExchangeStatuses(notifications) {
  const taskIds = [...new Set(notifications.filter((n) => isExchangeNotification(n) && n.task_id).map((n) => n.task_id))];
  if (taskIds.length === 0) return [];

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .select("id, task_id, to_user, status")
    .in("task_id", taskIds)
    .eq("to_user", STATE.me.id);

  if (error) {
    console.error("Không lấy được trạng thái yêu cầu đổi việc:", error.message);
    return [];
  }
  return data || [];
}

async function findOpenExchangeForTask(taskId, userId) {
  if (!taskId || !userId) return null;
  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .select("*")
    .eq("task_id", taskId)
    .eq("to_user", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Không tìm được yêu cầu đổi việc phù hợp:", error.message);
    return null;
  }
  return data || null;
}

async function renderNotifSection() {
  const list = await fetchNotifications();
  const container = document.getElementById("notif-list");

  if (list.length === 0) {
    container.innerHTML = \`<p class="empty-state">Chưa có thông báo nào.</p>\`;
    return;
  }

  const exchangeStatuses = await fetchExchangeStatuses(list);

  container.innerHTML = list
    .map((n) => {
      let actionBtn = "";
      if (n.type === "den_luot" && n.task_id) {
        actionBtn = \`<button class="btn btn-primary btn-sm" data-action="accept-task" data-task="\${n.task_id}">Nhận việc</button>\`;
      } else if (isExchangeNotification(n)) {
        const exchange = exchangeStatuses.find((row) =>
          (n.exchange_id && row.id === n.exchange_id) || (!n.exchange_id && row.task_id === n.task_id)
        );
        if (exchange && exchange.status !== "open") {
          actionBtn = \`<button class="btn btn-ghost btn-sm" data-action="mark-read">Đã đọc</button>\`;
        } else {
          actionBtn = \`
            <button class="btn btn-primary btn-sm" data-action="accept-exchange" data-exchange="\${n.exchange_id || ""}" data-task="\${n.task_id || ""}">Nhận đổi việc</button>
            <button class="btn btn-ghost btn-sm" data-action="reject-exchange" data-exchange="\${n.exchange_id || ""}" data-task="\${n.task_id || ""}">Từ chối</button>
          \`;
        }
      }
      return \`
      <div class="task-ticket \${n.is_read ? "done" : ""}" style="border-left-color:\${n.is_read ? "#ccc" : "var(--accent)"}" data-id="\${n.id}">
        <div class="task-check" style="border:none; font-size:16px;">\${notifIconForType(n.type)}</div>
        <div class="task-body">
          <div class="task-title" style="font-weight:\${n.is_read ? "500" : "700"}">\${escapeHTML(n.message)}</div>
          <div class="task-meta"><span>\${timeAgo(n.created_at)}</span></div>
        </div>
        <div class="task-actions">
          \${actionBtn}
          \${!n.is_read ? \`<button class="icon-btn" data-action="mark-read" title="Đánh dấu đã đọc">✓</button>\` : ""}
        </div>
      </div>\`;
    })
    .join("");
}

async function markNotificationRead(id) {
  await supabaseClient.from("notifications").update({ is_read: true }).eq("id", id);
}

async function markAllNotificationsRead() {
  await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", STATE.me.id).eq("is_read", false);
  renderNotifSection();
  refreshNotifBadge();
}

// Người đầu tiên bấm "Nhận đổi việc" thì được — người sau sẽ thấy báo "đã có người nhận"
async function syncRotationQueueForAssignedUser(queueId, userId) {
  if (!queueId || !userId) return;

  const { data: queue, error } = await supabaseClient
    .from("rotation_queues")
    .select("member_order")
    .eq("id", queueId)
    .single();

  if (error || !queue || !Array.isArray(queue.member_order)) return;

  const idx = queue.member_order.indexOf(userId);
  if (idx === -1) return;

  await supabaseClient.from("rotation_queues").update({ current_index: idx }).eq("id", queueId);
}

async function acceptExchangeFromNotif(exchangeId, taskId, notifId) {
  let resolvedExchangeId = exchangeId;
  if (!resolvedExchangeId && taskId) {
    const exchange = await findOpenExchangeForTask(taskId, STATE.me.id);
    resolvedExchangeId = exchange?.id || null;
  }

  if (!resolvedExchangeId) {
    alert("Không tìm thấy lời mời đổi việc phù hợp.");
    return;
  }

  const { data: taskInfo } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id, assigned_to")
    .eq("id", taskId)
    .maybeSingle();

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .update({ status: "accepted", to_user: STATE.me.id, resolved_at: new Date().toISOString() })
    .eq("id", resolvedExchangeId)
    .eq("status", "open")
    .select()
    .single();

  if (error || !data) {
    alert("Việc này có người nhận trước bạn rồi.");
    await markNotificationRead(notifId);
    renderNotifSection();
    refreshNotifBadge();
    return;
  }

  const { data: reassignedTask, error: reassignError } = await supabaseClient
    .from("tasks")
    .update({ assigned_to: STATE.me.id })
    .eq("id", taskId)
    .eq("assigned_to", data.from_user)
    .select("id")
    .maybeSingle();

  if (reassignError || !reassignedTask) {
    await supabaseClient.from("task_exchanges").update({ status: "cancelled" }).eq("id", resolvedExchangeId).eq("status", "accepted");
    alert("Việc này vừa được người khác nhận trước bạn.");
    await markNotificationRead(notifId);
    renderNotifSection();
    refreshNotifBadge();
    return;
  }

  await supabaseClient.from("task_exchanges").update({ status: "cancelled" }).eq("task_id", taskId).eq("from_user", data.from_user).neq("id", resolvedExchangeId).eq("status", "open");
  if (taskInfo?.rotation_queue_id) {
    await syncRotationQueueForAssignedUser(taskInfo.rotation_queue_id, STATE.me.id);
  }

  // Xin đổi việc thành công (có người nhận) -> trừ điểm người xin đổi, chấm điểm công bằng hơn.
  if (typeof addPointAdjustment === "function") {
    await addPointAdjustment(data.from_user, taskId, -HANDOFF_PENALTY, "xin_doi");
  }

  await logHistory(taskId, STATE.me.id, "doi_viec", \`\${STATE.me.name} nhận đổi việc (người xin đổi bị trừ \${HANDOFF_PENALTY} điểm)\`);
  await createNotification(data.from_user, \`✅ \${STATE.me.name} đã nhận đổi việc giúp bạn. Bạn bị trừ \${HANDOFF_PENALTY} điểm vì xin đổi việc.\`, { type: "thong_bao", taskId });
  await markNotificationRead(notifId);

  renderNotifSection();
  refreshNotifBadge();
  alert("Bạn đã nhận việc này.");
}

async function rejectExchangeFromNotif(exchangeId, taskId, notifId) {
  let resolvedExchangeId = exchangeId;
  if (!resolvedExchangeId && taskId) {
    const exchange = await findOpenExchangeForTask(taskId, STATE.me.id);
    resolvedExchangeId = exchange?.id || null;
  }

  if (!resolvedExchangeId) {
    alert("Không tìm thấy lời mời đổi việc phù hợp.");
    return;
  }

  const { data: taskInfo } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id")
    .eq("id", taskId)
    .maybeSingle();

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", resolvedExchangeId)
    .eq("status", "open")
    .select()
    .single();

  if (error || !data) {
    await markNotificationRead(notifId);
    renderNotifSection();
    refreshNotifBadge();
    return;
  }

  const { data: allRows, error: rowsErr } = await supabaseClient
    .from("task_exchanges")
    .select("status")
    .eq("task_id", taskId)
    .eq("from_user", data.from_user);

  if (!rowsErr && Array.isArray(allRows)) {
    const hasOpen = allRows.some((row) => row.status === "open");
    const hasAccepted = allRows.some((row) => row.status === "accepted");

    if (!hasOpen && !hasAccepted) {
      const profile = findProfile(STATE.profiles, data.from_user);
      await supabaseClient.from("tasks").update({ assigned_to: data.from_user }).eq("id", taskId);
      if (taskInfo?.rotation_queue_id) {
        await syncRotationQueueForAssignedUser(taskInfo.rotation_queue_id, data.from_user);
      }
      await logHistory(taskId, data.from_user, "bat_buoc_lam", \`\${profile ? profile.name : "Người yêu cầu"} phải làm việc vì cả 3 người còn lại đều từ chối.\`);
      await createNotification(data.from_user, \`⚠️ Cả 3 người còn lại đều từ chối, nên bạn phải làm việc này.\`, { type: "thong_bao", taskId });
    }
  }

  await markNotificationRead(notifId);
  renderNotifSection();
  refreshNotifBadge();
  alert("Bạn đã từ chối nhận việc này.");
}

function bindNotifEvents() {
  const container = document.getElementById("notif-list");
  if (!container.dataset.bound) {
    container.dataset.bound = "1";
    container.addEventListener("click", async (e) => {
      const ticket = e.target.closest(".task-ticket");
      if (!ticket) return;
      const notifId = ticket.dataset.id;
      const action = e.target.dataset.action;

      if (action === "accept-task") {
        await acceptTask(e.target.dataset.task);
        await markNotificationRead(notifId);
        renderNotifSection();
        refreshNotifBadge();
      }
      if (action === "accept-exchange") {
        await acceptExchangeFromNotif(e.target.dataset.exchange, e.target.dataset.task, notifId);
      }
      if (action === "reject-exchange") {
        await rejectExchangeFromNotif(e.target.dataset.exchange, e.target.dataset.task, notifId);
      }
      if (action === "mark-read") {
        await markNotificationRead(notifId);
        renderNotifSection();
        refreshNotifBadge();
      }
    });
  }

  const markAllBtn = document.getElementById("notif-mark-all");
  if (markAllBtn && !markAllBtn.dataset.bound) {
    markAllBtn.dataset.bound = "1";
    markAllBtn.addEventListener("click", markAllNotificationsRead);
  }
}

async function loadNotificationsSection() {
  bindNotifEvents();
  await renderNotifSection();
  refreshNotifBadge();
}

// ---------------------------------------------------------------
// REALTIME: tự cập nhật cho mọi người khi có ai đó thay đổi dữ liệu,
// không cần bấm F5. Cần bật Realtime cho bảng tasks/notifications
// trong Supabase (đã có sẵn trong sql/schema.sql, mục 10).
// ---------------------------------------------------------------
function subscribeRealtime() {
  supabaseClient
    .channel("notifications-" + STATE.me.id)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: \`user_id=eq.\${STATE.me.id}\` },
      () => {
        refreshNotifBadge();
        const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
        if (activeSection === "notifications") renderNotifSection();
      }
    )
    .subscribe();

  supabaseClient
    .channel("tasks-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
      if (activeSection === "tasks") renderTasksView();
      if (activeSection === "dashboard") renderDashboard();
      if (activeSection === "schedule") {
        renderScheduleView();
        if (typeof renderMonthCalendar === "function") renderMonthCalendar();
      }
    })
    .subscribe();
}


// ============================================================
// TASKS.JS — trang "Công việc" (Đã tích hợp Tab & Tự động luân phiên)
// ============================================================

// Biến lưu trữ ID người dùng đang được chọn xem (Mặc định sẽ gán là người đang đăng nhập)
let selectedUserId = null;

// Một người được coi là "không khả dụng cho việc mới" nếu đang đi vắng HOẶC
// đang ốm (Status Engine) — dùng để lọc ứng viên ở nhiều nơi trong file này.
function isUnavailableForTasks(p) {
  if (!p) return false;
  return !!p.is_away || p.status === "AWAY" || p.status === "SICK";
}

// Đưa toàn bộ việc CHƯA XONG (không phải luân phiên) của 1 người sang trạng
// thái "vo_chu" (vô chủ) để bất kỳ ai khác cũng thấy và có thể bấm "Nhận thay".
// Dùng chung cho cả "Đi vắng" và "Sick Mode" — chỉ khác icon/lý do hiển thị.
// Việc luân phiên không xử lý ở đây vì đã có cơ chế riêng (restoreQueueToUser/
// chuyển lượt cho người kế tiếp trong rotations.js).
async function reassignTasksForUnavailableUser(userId) {
  const { data: myTasks, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .is("rotation_queue_id", null)
    .not("status", "in", "(hoan_thanh,bo_lo,vo_chu)");

  if (error || !myTasks || myTasks.length === 0) return;

  for (const t of myTasks) {
    const { error: updErr } = await supabaseClient.from("tasks").update({ status: "vo_chu" }).eq("id", t.id);
    if (!updErr && typeof logHistory === "function") {
      await logHistory(t.id, userId, "vo_chu", \`Việc "\${t.title}" được đưa vào hàng chờ chia lại vì người phụ trách tạm thời không nhận việc được.\`);
    }
  }
}

async function fetchTasks() {
  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Không lấy được việc:", error.message);
    return [];
  }
  return data;
}

function rotationDisplayKey(label) {
  return String(label || "").trim().toLocaleLowerCase("vi");
}

function keepOneOpenRotationTask(tasks, rotations = []) {
  const queueLabelById = new Map(rotations.map((queue) => [queue.id, rotationDisplayKey(queue.label)]));
  const latestByQueue = new Map();
  const openTasks = (tasks || [])
    .filter((task) => task.rotation_queue_id && task.status !== "hoan_thanh" && task.status !== "bo_lo")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  openTasks.forEach((task) => {
    const key = queueLabelById.get(task.rotation_queue_id) || task.rotation_queue_id;
    if (!latestByQueue.has(key)) latestByQueue.set(key, task.id);
  });

  return (tasks || []).filter(
    (task) => {
      if (!task.rotation_queue_id || task.status === "hoan_thanh" || task.status === "bo_lo") return true;
      const key = queueLabelById.get(task.rotation_queue_id) || task.rotation_queue_id;
      return latestByQueue.get(key) === task.id;
    }
  );
}

// Lấy danh sách các việc luân phiên đang active
async function fetchRotations() {
  const { data, error } = await supabaseClient
    .from("rotation_queues")
    .select("*")
    .eq("active", true);
  if (error) {
    console.error("Không lấy được hàng đợi luân phiên:", error.message);
    return [];
  }
  return data;
}

function groupTasksByDate(tasks) {
  const groups = {};
  tasks.forEach((t) => {
    if (!groups[t.due_date]) groups[t.due_date] = [];
    groups[t.due_date].push(t);
  });
  return groups;
}

async function buildTaskFrequencyMap({ title, rotation_queue_id, excludeUserIds = [] }) {
  const eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id));
  if (eligible.length === 0) return {};

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("assigned_to, title, rotation_queue_id")
    .eq("status", "hoan_thanh")
    .in("assigned_to", eligible.map((p) => p.id));

  if (error || !Array.isArray(data)) return {};

  const map = {};
  for (const row of data) {
    const matches = rotation_queue_id
      ? row.rotation_queue_id === rotation_queue_id
      : row.title === title;
    if (!matches) continue;
    map[row.assigned_to] = (map[row.assigned_to] || 0) + 1;
  }
  return map;
}

async function pickLeastFrequentAssignee({ title, rotation_queue_id, excludeUserIds = [] }) {
  // Người đang đi vắng/ốm không được coi là ứng cử viên nhận việc mới.
  let eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id) && !isUnavailableForTasks(p));
  if (eligible.length === 0) {
    // Nếu chỉ vì loại người đi vắng/ốm mà hết ứng viên thì đành bỏ ràng buộc đó để không bị kẹt.
    eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id));
  }
  if (eligible.length === 0) return null;

  const [frequencyMap, pointsMap] = await Promise.all([
    buildTaskFrequencyMap({ title, rotation_queue_id, excludeUserIds }),
    typeof fetchMemberPointsMap === "function" ? fetchMemberPointsMap() : Promise.resolve({}),
  ]);

  return [...eligible].sort((a, b) => {
    const freqDiff = (frequencyMap[a.id] || 0) - (frequencyMap[b.id] || 0);
    if (freqDiff !== 0) return freqDiff;
    // Làm ít bằng nhau -> ưu tiên người đang có ít điểm hơn (chấm điểm công bằng hơn)
    const pointsDiff = (pointsMap[a.id] || 0) - (pointsMap[b.id] || 0);
    if (pointsDiff !== 0) return pointsDiff;
    return a.name.localeCompare(b.name);
  })[0] || null;
}

// ================= GIAO DIỆN PHIẾU VIỆC =================

function taskTicketHTML(task) {
  const isPending = task.status === "cho_nhan";
  const isDone = task.status === "hoan_thanh";
  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";

  // Việc cố định rơi vào ngày người phụ trách đang đi vắng: không có ai làm, hiện cho
  // TẤT CẢ mọi người thấy để ai đó bấm "Nhận thay" (được cộng thêm điểm thưởng).
  if (task.status === "vo_chu") {
    const isSickOwner = assignee?.status === "SICK";
    const vcIcon = isSickOwner ? "🤒" : "✈️";
    const vcReason = isSickOwner ? "đang bị ốm" : "đang đi vắng";
    return \`
      <div class="task-ticket" style="border-left-color:#c9932e; border-left-style:dashed;" data-id="\${task.id}">
        <div class="task-check" style="border-style:dashed;">\${vcIcon}</div>
        <div class="task-body">
          <div class="task-title">\${escapeHTML(task.title)}</div>
          <div class="task-meta">
            \${statusBadgeHTML(task.status)}
            <span>Người phụ trách \${vcReason} — chưa có ai làm việc này</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" data-action="claim-unassigned">🙋 Nhận thay (+\${AWAY_COVER_BONUS}đ)</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>\`;
  }

  const isMissed = task.status === "bo_lo";

  // Việc bị đánh dấu "Không hoàn thành" — vẫn hiện trong danh sách (gạch ngang),
  // có thể huỷ đánh dấu để hoàn lại điểm nếu đánh dấu nhầm.
  if (isMissed) {
    return \`
      <div class="task-ticket missed" style="border-left-color:\${borderColor}; opacity:0.7;" data-id="\${task.id}">
        <div class="task-check" style="border-style:solid; border-color:#c0392b; color:#c0392b;">✕</div>
        <div class="task-body">
          <div class="task-title" style="text-decoration:line-through;">\${escapeHTML(task.title)}</div>
          <div class="task-meta">
            \${statusBadgeHTML(task.status)}
            <span>\${assignee ? escapeHTML(assignee.name) : "?"} đã bỏ việc này</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="undo-miss" title="Huỷ đánh dấu bỏ việc, hoàn lại điểm">↺</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>\`;
  }

  // Việc phát sinh / luân phiên đang chờ người được gán xác nhận
  if (isPending) {
    const isMine = task.assigned_to === STATE.me.id;
    return \`
      <div class="task-ticket" style="border-left-color:\${borderColor}" data-id="\${task.id}">
        <div class="task-check" style="border-style:dashed;"></div>
        <div class="task-body">
          <div class="task-title">\${escapeHTML(task.title)}</div>
          <div class="task-meta">
            \${statusBadgeHTML(task.status)}
            <span>Đang chờ \${assignee ? escapeHTML(assignee.name) : "?"} nhận</span>
          </div>
        </div>
        <div class="task-actions">
          \${
            isMine
              ? \`<button class="btn btn-primary btn-sm" data-action="accept">Nhận việc</button>
                 <button class="icon-btn" data-action="handoff" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>\`
              : ""
          }
          <button class="icon-btn" data-action="miss" title="Đánh dấu không hoàn thành (trừ điểm)">✕</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>\`;
  }

  const isRotationLinked = !!task.rotation_queue_id;

  // Phiếu việc ĐÃ HOÀN THÀNH: không cần sửa người làm / hạn nữa — chỉ cần biết
  // hoàn thành lúc nào, và nếu có hạn thì có trễ hay không.
  if (isDone) {
    const late = task.due_date ? daysOverdue(task.due_date, (task.completed_at || "").slice(0, 10)) : 0;
    return \`
      <div class="task-ticket done" style="border-left-color:\${borderColor}" data-id="\${task.id}">
        <button class="task-check done" data-action="toggle" title="Mở lại việc này">✓</button>
        <div class="task-body">
          <div class="task-title">\${escapeHTML(task.title)}</div>
          <div class="task-meta">
            <span class="task-done-meta">✅ Hoàn thành lúc \${formatDateTimeShort(task.completed_at)}</span>
            \${late > 0 ? \`<span class="task-overdue-tag">⚠️ Trễ \${late} ngày so với hạn \${formatDateShort(task.due_date)}</span>\` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>\`;
  }

  const options = STATE.profiles
    .map((p) => \`<option value="\${p.id}" \${p.id === task.assigned_to ? "selected" : ""}>\${escapeHTML(p.name)}</option>\`)
    .join("");

  const late = !isRotationLinked ? daysOverdue(task.due_date) : 0;
  const dueControl = isRotationLinked
    ? \`<span class="task-no-due">🔁 Việc luân phiên — không có hạn</span>\`
    : \`<input type="date" data-action="due" value="\${task.due_date}" class="task-mini-date" title="Đổi hạn" />\`;

  return \`
    <div class="task-ticket" style="border-left-color:\${borderColor}" data-id="\${task.id}">
      <button class="task-check" data-action="toggle" title="Đánh dấu hoàn thành"></button>
      <div class="task-body">
        <div class="task-title">\${escapeHTML(task.title)}</div>
        <div class="task-meta">
          \${statusBadgeHTML(task.status)}
          \${late > 0 ? \`<span class="task-overdue-tag">⚠️ Trễ \${late} ngày</span>\` : ""}
          <select data-action="reassign" class="task-mini-select" title="Đổi người làm">\${options}</select>
          \${dueControl}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="handoff" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>
        <button class="icon-btn" data-action="miss" title="Đánh dấu không hoàn thành (trừ điểm)">✕</button>
        <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>\`;
}

// ================= XỬ LÝ GIAO DIỆN LỚN (TABS & LIST) =================

// Tạo HTML cho thanh Tabs 4 người
function renderTabsHTML() {
  let html = '<div class="tabs-container" style="display:flex; gap:10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">';
  STATE.profiles.forEach(p => {
      const isActive = p.id === selectedUserId;
      // Dùng màu của từng người để làm nổi bật tab
      const style = isActive 
        ? \`background: \${p.avatar_color}; color: white; border: 1px solid \${p.avatar_color};\` 
        : \`background: transparent; color: \${p.avatar_color}; border: 1px solid \${p.avatar_color};\`;
        
      html += \`<button class="btn-tab" style="padding: 6px 16px; border-radius: 20px; cursor: pointer; font-weight: bold; white-space: nowrap; \${style}" data-user="\${p.id}">\${escapeHTML(p.name)}</button>\`;
  });
  html += '</div>';
  return html;
}

// Việc luân phiên chỉ có 1 trạng thái đáng quan tâm khi CHƯA XONG: "đang tới lượt ai".
// Trước đây trang này tách làm 2 khu vực (thẻ ảo "Tới lượt luân phiên" + thẻ thật
// "Việc luân phiên — chưa làm") dù về bản chất là cùng 1 loại dữ liệu, gây trùng lặp.
// Hàm này gộp lại thành DUY NHẤT 1 danh sách "🔁 Đang tới lượt", không hiển thị ngày hạn.
//
// - rotations: tất cả hàng đợi luân phiên đang active
// - queueHasTaskToday: các queue đã có 1 việc thật cho hôm nay rồi (vd vừa "xin chuyển việc")
//   -> không hiện thẻ ảo trùng, vì việc thật của queue đó đã nằm trong rotationPinnedTasks
// - rotationPinnedTasks: các việc thật (đã tạo), gắn với hàng đợi, của người đang được chọn,
//   mà chưa hoàn thành / chưa bị đánh dấu bỏ
function rotationTaskTicketHTML(task, queue) {
  if (!queue) return taskTicketHTML(task);

  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";
  return \`
    <div class="task-ticket" style="border-left-color:\${borderColor}" data-id="\${task.id}">
      <button class="task-check" data-action="toggle" title="Đánh dấu hoàn thành"></button>
      <div class="task-body">
        <div class="task-title">\${queue.icon} \${escapeHTML(queue.label)}</div>
        <div class="task-meta">
          <span class="badge badge-wait">Đến lượt</span>
          <span class="task-no-due">Không có ngày</span>
          <span>+\${queue.points} điểm</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="handoff" title="Xin chuyển việc">😅</button>
        <button class="icon-btn" data-action="miss" title="Không hoàn thành">✕</button>
        <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>\`;
}

function renderRotationSectionHTML(rotations, queueHasTaskToday, activeRotationLabels, rotationPinnedTasks, queueMap) {
  const renderedLabels = new Set();
  const myVirtualTurns = rotations.filter((r) => {
    if (!r.member_order || r.member_order.length === 0) return false;
    const labelKey = rotationDisplayKey(r.label);
    if (renderedLabels.has(labelKey) || activeRotationLabels.has(labelKey)) return false;
    const currentTurnUserId = typeof currentHolder === "function" ? currentHolder(r)?.id : r.member_order[r.current_index];
    if (currentTurnUserId !== selectedUserId) return false;
    renderedLabels.add(labelKey);
    return !queueHasTaskToday.has(r.id);
  });

  if (myVirtualTurns.length === 0 && rotationPinnedTasks.length === 0) return "";

  let html = '<div class="section-title rotation">🔁 Đang tới lượt</div><div class="task-list">';

  const assignee = findProfile(STATE.profiles, selectedUserId);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";

  myVirtualTurns.forEach((r) => {
    html += \`
      <div class="task-ticket" style="border-left-color: \${borderColor}" data-queue-id="\${r.id}">
          <button class="task-check" data-action="complete-rotation" title="Đánh dấu đã làm xong"></button>
          <div class="task-body">
              <div class="task-title">\${r.icon} \${escapeHTML(r.label)}</div>
              <div class="task-meta">
                  <span class="badge badge-wait">Đến lượt</span>
                  <span class="task-no-due">Không có ngày</span>
                  <span>+\${r.points} điểm</span>
              </div>
          </div>
          <div class="task-actions">
              <button class="icon-btn" data-action="request-handoff" data-queue="\${r.id}" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>
              <button class="icon-btn" data-action="miss-rotation" data-queue="\${r.id}" title="Không hoàn thành — trừ điểm và chuyển lượt cho người kế tiếp">✕</button>
          </div>
      </div>\`;
  });

  rotationPinnedTasks.forEach((t) => (html += rotationTaskTicketHTML(t, queueMap[t.rotation_queue_id])));

  html += "</div>";
  return html;
}

// Việc vừa hoàn thành vẫn hiện ở đây (có ghi giờ) trong vài ngày, sau đó mới coi là
// "cũ" và chỉ còn nằm trong Nhật ký hoạt động — tránh vừa bấm xong là biến mất luôn.
const RECENT_DONE_DAYS = 3;

// Bộ lọc nhanh đang chọn cho trang Công việc: all | today | rotation | overdue | done
let taskDisplayFilter = "all";

function renderTaskFilterBarHTML() {
  const filters = [
    { key: "all", label: "Tất cả" },
    { key: "today", label: "🔥 Hôm nay" },
    { key: "rotation", label: "🔁 Luân phiên" },
    { key: "overdue", label: "⚠️ Trễ hạn" },
    { key: "done", label: "✅ Đã xong" },
  ];
  const chips = filters
    .map(
      (f) =>
        \`<button type="button" class="filter-chip \${taskDisplayFilter === f.key ? "on" : ""}" data-filter="\${f.key}">\${f.label}</button>\`
    )
    .join("");
  return \`<div class="task-filter-bar">\${chips}</div>\`;
}

async function renderTasksView() {
  const container = document.getElementById("tasks-container");

  // Mặc định chọn người đang đăng nhập nếu chưa chọn ai
  if (!selectedUserId) {
    selectedUserId = STATE.me.id;
  }

  // Tải song song cả danh sách task truyền thống và danh sách luân phiên
  const [loadedTasks, rotations] = await Promise.all([fetchTasks(), fetchRotations()]);
  const tasks = keepOneOpenRotationTask(loadedTasks, rotations);
  const queueMap = Object.fromEntries(rotations.map((queue) => [queue.id, queue]));

  // Lọc task theo người đang được chọn ở Tab
  const filteredTasks = tasks.filter((t) => t.assigned_to === selectedUserId);

  const today = todayStr();

  // Queue có task thật đang mở hôm nay thì không tạo thêm thẻ ảo, tránh
  // hiển thị song song task thật và lượt ảo của cùng một queue.
  const activeRotationQueues = new Set(
    tasks
      .filter((t) => t.rotation_queue_id && t.due_date === today && t.status !== "hoan_thanh" && t.status !== "bo_lo")
      .map((t) => t.rotation_queue_id)
  );
  const activeRotationLabels = new Set(
    tasks
      .filter((t) => t.rotation_queue_id && t.status !== "hoan_thanh" && t.status !== "bo_lo")
      .map((t) => rotationDisplayKey(queueMap[t.rotation_queue_id]?.label || t.title))
  );

  // Việc gắn với hàng đợi luân phiên, chưa xong / chưa bị đánh dấu bỏ -> không có hạn,
  // luôn nằm trong nhóm "Đang tới lượt" (không chôn theo ngày như việc thường).
  // Một hàng đợi chỉ được hiển thị một task đang mở. Nếu dữ liệu cũ có nhiều
  // task trùng queue, giữ task mới nhất để không hiện hai việc giống nhau.
  const rotationPinned = [];
  const pinnedQueueIds = new Set();
  const pinnedLabels = new Set();
  [...filteredTasks]
    .filter((t) => t.rotation_queue_id && t.status !== "hoan_thanh" && t.status !== "bo_lo")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .forEach((task) => {
      const labelKey = rotationDisplayKey(queueMap[task.rotation_queue_id]?.label || task.title);
      if (pinnedQueueIds.has(task.rotation_queue_id) || pinnedLabels.has(labelKey)) return;
      pinnedQueueIds.add(task.rotation_queue_id);
      pinnedLabels.add(labelKey);
      rotationPinned.push(task);
    });
  const rest = filteredTasks.filter((t) => !rotationPinned.includes(t));

  const todayTasks = rest.filter((t) => t.status !== "hoan_thanh" && t.due_date === today);
  const overdueTasks = rest
    .filter((t) => t.status !== "hoan_thanh" && t.due_date < today)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1)); // trễ lâu nhất lên trước
  const upcomingTasks = rest.filter((t) => t.status !== "hoan_thanh" && t.due_date > today);

  // Hoàn thành gần đây: gồm cả việc thường lẫn việc luân phiên đã xong, mới nhất lên trước.
  const doneCutoffMs = Date.now() - RECENT_DONE_DAYS * 86400000;
  const recentDone = filteredTasks
    .filter((t) => !t.rotation_queue_id && t.status === "hoan_thanh" && t.completed_at && new Date(t.completed_at).getTime() >= doneCutoffMs)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

  const rotationSectionHTML = renderRotationSectionHTML(rotations, activeRotationQueues, activeRotationLabels, rotationPinned, queueMap);
  const hasRotationTurn = rotationSectionHTML !== "";

  const sections = [];

  if (todayTasks.length > 0) {
    sections.push({
      key: "today",
      html: \`<div class="section-title today">🔥 Hôm nay</div><div class="task-list">\${todayTasks
        .map((t) => taskTicketHTML(t))
        .join("")}</div>\`,
    });
  }
  if (hasRotationTurn) {
    sections.push({ key: "rotation", html: rotationSectionHTML });
  }
  if (overdueTasks.length > 0) {
    sections.push({
      key: "overdue",
      html: \`<div class="section-title overdue">⚠️ Cần xử lý</div><div class="task-list">\${overdueTasks
        .map((t) => taskTicketHTML(t))
        .join("")}</div>\`,
    });
  }
  if (upcomingTasks.length > 0) {
    const groups = groupTasksByDate(upcomingTasks);
    const dates = Object.keys(groups).sort();
    const body = dates
      .map((date) => \`<div class="day-label">\${formatDateShort(date)}</div><div class="task-list">\${groups[date].map((t) => taskTicketHTML(t)).join("")}</div>\`)
      .join("");
    sections.push({ key: "upcoming", html: \`<div class="section-title upcoming">📅 Sắp tới</div>\${body}\` });
  }
  if (recentDone.length > 0) {
    sections.push({
      key: "done",
      html: \`<div class="section-title done">✅ Hoàn thành gần đây</div><div class="task-list">\${recentDone
        .map((t) => taskTicketHTML(t))
        .join("")}</div>\`,
    });
  }

  let html = renderTabsHTML() + renderTaskFilterBarHTML();

  // Bộ lọc nhanh: "Tất cả" hiện mọi nhóm, còn lại chỉ hiện đúng 1 nhóm tương ứng.
  // "Trễ hạn" hiện nhóm "Cần xử lý", "Luân phiên" hiện nhóm "Đang tới lượt".
  const filterToSection = { today: "today", rotation: "rotation", overdue: "overdue", done: "done" };
  const visibleSections =
    taskDisplayFilter === "all" ? sections : sections.filter((s) => s.key === filterToSection[taskDisplayFilter]);

  if (sections.length === 0) {
    html += \`<p class="empty-state">Chưa có việc nào. Bấm "+ Thêm việc" để tạo việc.</p>\`;
  } else if (visibleSections.length === 0) {
    html += \`<p class="empty-state">Không có việc nào trong bộ lọc này.</p>\`;
  } else {
    html += visibleSections.map((s) => s.html).join("");
  }

  container.innerHTML = html;
}

// Sau khi thao tác xong 1 việc, làm mới đúng màn hình đang mở
function refreshActiveView() {
  const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
  if (activeSection === "dashboard" && typeof renderDashboard === "function") return renderDashboard();
  renderTasksView();
}


// ================= XỬ LÝ HÀNH ĐỘNG =================

// Hiện/ẩn lịch sử thay đổi của 1 việc
async function toggleTaskHistory(id, ticketEl) {
  const existing = ticketEl.nextElementSibling;
  if (existing && existing.classList.contains("task-history-panel")) {
    existing.remove();
    return;
  }

  const { data, error } = await supabaseClient
    .from("task_history")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  const rows = error ? [] : data;
  const panel = document.createElement("div");
  panel.className = "task-history-panel";
  panel.innerHTML = rows.length
    ? rows
        .map((r) => \`<div class="history-row"><span class="history-time">\${timeAgo(r.created_at)}</span><span>\${escapeHTML(r.detail || r.action)}</span></div>\`)
        .join("")
    : \`<div class="history-row"><span style="color:var(--ink-faint)">Chưa có lịch sử thay đổi cho việc này.</span></div>\`;
  ticketEl.insertAdjacentElement("afterend", panel);
}

// Hoàn thành task truyền thống
const taskCompletionRequests = new Map();

function toggleTaskDone(id) {
  if (taskCompletionRequests.has(id)) return taskCompletionRequests.get(id);

  const request = toggleTaskDoneInternal(id).finally(() => taskCompletionRequests.delete(id));
  taskCompletionRequests.set(id, request);
  return request;
}

async function toggleTaskDoneInternal(id) {
  const ticket = document.querySelector(\`.task-ticket[data-id="\${id}"]\`);
  if (!ticket) return;
  const isDone = ticket.classList.contains("done");
  const currentTask = await supabaseClient.from("tasks").select("assigned_to, title, status").eq("id", id).single();
  if (currentTask.error || !currentTask.data) return alert("Không tìm thấy việc.");

  const currentStatus = currentTask.data.status;
  const newStatus = isDone ? "chua_lam" : "hoan_thanh";
  const assignedProfile = currentTask.data ? findProfile(STATE.profiles, currentTask.data.assigned_to) : null;
  const actingFor = assignedProfile && assignedProfile.id !== STATE.me.id
    ? \` hộ \${assignedProfile.name}\`
    : "";

  const { data, error } = await supabaseClient
    .from("tasks")
    .update({ status: newStatus, completed_at: newStatus === "hoan_thanh" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("status", currentStatus)
    .neq("status", newStatus)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") {
      refreshActiveView();
      return;
    }
    return alert("Lỗi: " + error.message);
  }

  await logHistory(
    id,
    STATE.me.id,
    newStatus === "hoan_thanh" ? "hoan_thanh" : "mo_lai",
    newStatus === "hoan_thanh"
      ? \`\${STATE.me.name} đánh dấu hoàn thành\${actingFor}\`
      : \`\${STATE.me.name} mở lại việc\${actingFor}\`
  );

  if (newStatus === "hoan_thanh") {
    if (typeof distributeAwayShadowPoints === "function") {
      await distributeAwayShadowPoints(id, data.points);
    }

    if (data.rotation_queue_id) {
      if (typeof advanceQueueByCompleter === "function") {
        await advanceQueueByCompleter(data.rotation_queue_id, data.assigned_to);
      }
    } else {
      // CHỈ gợi ý cho lần giao việc TIẾP THEO — KHÔNG được đổi assigned_to của task vừa
      // hoàn thành này, vì đó là bản ghi lịch sử dùng để tính điểm cho người đã làm.
      const nextAssignee = await pickLeastFrequentAssignee({
        title: data.title,
        rotation_queue_id: data.rotation_queue_id,
        excludeUserIds: [data.assigned_to],
      });
      if (nextAssignee) {
        await createNotification(
          nextAssignee.id,
          \`📌 \${STATE.me.name} đánh dấu hoàn thành\${actingFor} việc "\${data.title}". Lần sau việc này nên ưu tiên giao cho bạn vì bạn làm ít hơn.\`,
          { type: "thong_bao", taskId: id }
        );
      }
    }
  } else if (data.rotation_queue_id && typeof restoreQueueToUser === "function") {
    await restoreQueueToUser(data.rotation_queue_id, data.assigned_to);
  }

  if (typeof showToast === "function") {
    showToast(newStatus === "hoan_thanh" ? \`✅ Đã hoàn thành "\${data.title}"\` : \`↺ Đã mở lại "\${data.title}"\`);
  }
  refreshActiveView();
}

// NHÂN TÍNH NĂNG MỚI: Xử lý khi bấm hoàn thành việc Tự Động Luân Phiên
async function handleCompleteAutoRotation(queueId) {
    // Lấy thông tin queue
    const { data: queue, error: qErr } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
    if (qErr || !queue) return alert("Lỗi lấy thông tin luân phiên.");
  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

    // Tự động tạo 1 task trạng thái "hoan_thanh" để ghi nhận điểm và lịch sử
    const payload = {
        title: queue.label,
    assigned_to: holder.id, // người đang tới lượt và hoàn thành việc
        created_by: STATE.me.id,
        rotation_queue_id: queue.id,
        status: 'hoan_thanh',
        points: queue.points,
        due_date: todayStr(),
        completed_at: new Date().toISOString()
    };

    const { data: task, error: tErr } = await supabaseClient.from('tasks').insert(payload).select().single();
    if (tErr) return alert("Lỗi ghi nhận công việc: " + tErr.message);

    if (typeof distributeAwayShadowPoints === "function") {
      await distributeAwayShadowPoints(task.id, queue.points);
    }

    // Ghi lịch sử: holder là người được giao, STATE.me là người thực tế bấm hoàn thành.
    const actingFor = holder.id !== STATE.me.id ? \` hộ \${holder.name}\` : "";
    await logHistory(
      task.id,
      STATE.me.id,
      "hoan_thanh",
      \`\${STATE.me.name} đánh dấu hoàn thành\${actingFor} việc luân phiên: \${queue.label}\`
    );

    // Tự động tăng current_index lên người tiếp theo
    const nextIndex = (queue.current_index + 1) % queue.member_order.length;
    const { error: queueError } = await supabaseClient
      .from('rotation_queues')
      .update({ current_index: nextIndex })
      .eq('id', queueId);
    if (!queueError) {
      const nextHolder = currentHolder({ ...queue, current_index: nextIndex });
      if (nextHolder && nextHolder.id !== holder.id) {
        await createNotification(nextHolder.id, \`\${queue.icon} \${queue.label} — đến lượt bạn.\`, {
          type: "den_luot",
        });
      }
    }

    refreshActiveView();
}

// Đánh dấu lượt luân phiên hiện tại là "Không hoàn thành": tạo 1 phiếu việc trạng thái
// bo_lo để lưu lại lịch sử + trừ điểm người đang tới lượt, rồi tự chuyển sang người kế tiếp
// (giống hệt việc họ đã "hoàn thành" về mặt chuyển lượt, chỉ khác là bị trừ điểm thay vì cộng).
async function handleMissRotation(queueId) {
  const { data: queue, error: qErr } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
  if (qErr || !queue) return alert("Lỗi lấy thông tin luân phiên.");

  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  // Không phạt điểm nếu người đang tới lượt đang ở chế độ Ốm (Sick Mode) — theo đúng
  // quy tắc "reason = sick => penalty = 0" trong đề xuất thiết kế.
  const holderIsSick = holder.status === "SICK";
  const penalty = holderIsSick ? 0 : -Math.round((queue.points || 0) * MISS_PENALTY_RATIO);
  const confirmMsg = holderIsSick
    ? \`Đánh dấu "\${queue.label}" là KHÔNG hoàn thành? \${holder.name} đang ốm nên sẽ KHÔNG bị trừ điểm, lượt sẽ chuyển cho người kế tiếp.\`
    : \`Đánh dấu "\${queue.label}" là KHÔNG hoàn thành? \${holder.name} sẽ bị trừ \${Math.abs(penalty)} điểm và lượt sẽ chuyển cho người kế tiếp.\`;
  if (!confirm(confirmMsg)) return;

  const payload = {
    title: queue.label,
    assigned_to: holder.id,
    created_by: STATE.me.id,
    rotation_queue_id: queue.id,
    status: 'bo_lo',
    points: queue.points,
    due_date: todayStr(),
  };

  const { data: task, error: tErr } = await supabaseClient.from('tasks').insert(payload).select().single();
  if (tErr) return alert("Lỗi ghi nhận: " + tErr.message);

  if (penalty !== 0) await addPointAdjustment(holder.id, task.id, penalty, "bo_viec");

  await logHistory(task.id, STATE.me.id, "bo_viec", \`\${STATE.me.name} đánh dấu "\${queue.label}" là không hoàn thành (trừ \${Math.abs(penalty)} điểm của \${holder.name}).\`);

  const nextIndex = (queue.current_index + 1) % queue.member_order.length;
  await supabaseClient.from('rotation_queues').update({ current_index: nextIndex }).eq('id', queueId);

  refreshActiveView();
}

// Đánh dấu 1 việc thường/việc phát sinh đã có phiếu thật là "Không hoàn thành": đổi trạng
// thái sang bo_lo và trừ điểm người phụ trách (một nửa điểm thưởng của việc đó).
async function markTaskMissed(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");
  const assignee = findProfile(STATE.profiles, task.assigned_to);

  // Không phạt điểm nếu người phụ trách đang ốm (Sick Mode).
  const assigneeIsSick = assignee?.status === "SICK";
  const penalty = assigneeIsSick ? 0 : -Math.round((task.points || 0) * MISS_PENALTY_RATIO);
  const confirmMsg = assigneeIsSick
    ? \`Đánh dấu "\${task.title}" là KHÔNG hoàn thành? \${assignee ? assignee.name : "Người phụ trách"} đang ốm nên sẽ KHÔNG bị trừ điểm.\`
    : \`Đánh dấu "\${task.title}" là KHÔNG hoàn thành? \${assignee ? assignee.name : "Người phụ trách"} sẽ bị trừ \${Math.abs(penalty)} điểm.\`;
  if (!confirm(confirmMsg)) return;

  const { error: updErr } = await supabaseClient.from("tasks").update({ status: "bo_lo" }).eq("id", id);
  if (updErr) return alert("Lỗi: " + updErr.message);

  if (penalty !== 0 && task.assigned_to) {
    await addPointAdjustment(task.assigned_to, id, penalty, "bo_viec");
  }

  await logHistory(
    id,
    STATE.me.id,
    "bo_viec",
    \`\${STATE.me.name} đánh dấu "\${task.title}" là không hoàn thành\${assignee && assignee.id !== STATE.me.id ? \` hộ \${assignee.name}\` : ""}\${penalty ? \` (trừ \${Math.abs(penalty)} điểm của \${assignee ? assignee.name : "?"})\` : ""}.\`
  );
  if (typeof showToast === "function") showToast(\`Đã đánh dấu "\${task.title}" là không hoàn thành\`, "error");
  refreshActiveView();
}

// Huỷ đánh dấu "bỏ việc" nếu lỡ đánh dấu nhầm: trả việc về "chưa làm" và hoàn lại điểm đã trừ.
async function undoMissedTask(id) {
  if (!confirm("Huỷ đánh dấu bỏ việc? Việc sẽ trở lại trạng thái chưa làm và điểm đã trừ sẽ được hoàn lại.")) return;

  const { error: updErr } = await supabaseClient.from("tasks").update({ status: "chua_lam" }).eq("id", id);
  if (updErr) return alert("Lỗi: " + updErr.message);

  const { error: delErr } = await supabaseClient
    .from("point_adjustments")
    .delete()
    .eq("task_id", id)
    .eq("reason", "bo_viec");
  if (delErr) console.error("Không hoàn lại được điểm:", delErr.message);

  await logHistory(id, STATE.me.id, "huy_bo_viec", \`\${STATE.me.name} huỷ đánh dấu bỏ việc, hoàn lại điểm.\`);
  if (typeof showToast === "function") showToast("↺ Đã huỷ đánh dấu bỏ việc, hoàn lại điểm");
  refreshActiveView();
}

// XIN CHUYỂN VIỆC cho việc luân phiên phát sinh (chưa có phiếu việc thật):
// tạo 1 phiếu việc thật gán cho người đang tới lượt, rồi gửi yêu cầu chuyển việc
// cho 3 người còn lại — giống hệt việc thường (ai nhận trước thì được).
// Nếu cả 3 từ chối, người đang tới lượt buộc phải tự làm (xử lý sẵn trong
// rejectExchangeFromNotif ở notifications.js).
async function requestRotationHandoff(queueId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue) return alert("Không tìm thấy hàng đợi.");

  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  const today = todayStr();

  // Nếu đã có sẵn 1 phiếu việc thật cho lượt này hôm nay thì dùng lại, tránh tạo trùng
  const { data: existing, error: findErr } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("rotation_queue_id", queueId)
    .eq("due_date", today)
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let taskId = !findErr && existing ? existing.id : null;

  if (!taskId) {
    const payload = {
      title: queue.label,
      assigned_to: holder.id,
      created_by: holder.id,
      rotation_queue_id: queue.id,
      due_date: today,
      status: "chua_lam",
      priority: "binh_thuong",
      points: queue.points,
    };
    const { data: task, error: insertErr } = await supabaseClient.from("tasks").insert(payload).select().single();
    if (insertErr) return alert("Lỗi tạo việc: " + insertErr.message);
    taskId = task.id;
  }

  await handoffTask(taskId);
  refreshActiveView();
}

async function acceptTask(id) {
  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "chua_lam" })
    .eq("id", id)
    .eq("status", "cho_nhan")
    .eq("assigned_to", STATE.me.id);
  if (error) return alert("Lỗi: " + error.message);
  await logHistory(id, STATE.me.id, "nhan_viec", \`\${STATE.me.name} đã nhận việc\`);
  if (typeof showToast === "function") showToast("🙋 Đã nhận việc");
  refreshActiveView();
  if (typeof refreshNotifBadge === "function") refreshNotifBadge();
}

// Nhận thay 1 việc "vô chủ" (người phụ trách gốc đang đi vắng): người đầu tiên bấm
// "Nhận thay" sẽ được gán việc đó và được cộng thêm điểm thưởng AWAY_COVER_BONUS.
async function claimUnassignedTask(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");
  if (task.status !== "vo_chu") {
    alert("Việc này đã có người nhận rồi.");
    refreshActiveView();
    return;
  }

  const { data, error: updErr } = await supabaseClient
    .from("tasks")
    .update({ assigned_to: STATE.me.id, status: "chua_lam" })
    .eq("id", id)
    .eq("status", "vo_chu")
    .select()
    .single();

  if (updErr || !data) {
    alert("Việc này vừa có người khác nhận mất rồi.");
    refreshActiveView();
    return;
  }

  await addPointAdjustment(STATE.me.id, id, AWAY_COVER_BONUS, "nhan_thay_vang_mat");
  await logHistory(
    id,
    STATE.me.id,
    "nhan_thay",
    \`\${STATE.me.name} nhận thay việc "\${task.title}" của người đang đi vắng (+\${AWAY_COVER_BONUS} điểm thưởng).\`
  );

  refreshActiveView();
  if (typeof refreshNotifBadge === "function") refreshNotifBadge();
  if (typeof showToast === "function") {
    showToast(\`🙋 Đã nhận thay việc này (+\${AWAY_COVER_BONUS} điểm thưởng)\`);
  } else {
    alert(\`Bạn đã nhận thay việc này (+\${AWAY_COVER_BONUS} điểm thưởng).\`);
  }
}

async function reassignTask(id, newUserId) {
  const newProfile = findProfile(STATE.profiles, newUserId);
  const { error } = await supabaseClient.from("tasks").update({ assigned_to: newUserId }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "doi_nguoi", \`\${STATE.me.name} đổi người làm thành \${newProfile ? newProfile.name : "?"}\`);
  if (typeof showToast === "function") showToast(\`Đã đổi người làm thành \${newProfile ? newProfile.name : "?"}\`);
  refreshActiveView();
}

async function changeDueDate(id, newDate) {
  const { error } = await supabaseClient.from("tasks").update({ due_date: newDate }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "gia_han", \`\${STATE.me.name} đổi hạn thành \${formatDateShort(newDate)}\`);
  if (typeof showToast === "function") showToast(\`Đã đổi hạn thành \${formatDateShort(newDate)}\`);
  refreshActiveView();
}

const handoffRequests = new Map();

function handoffTask(id) {
  if (handoffRequests.has(id)) return handoffRequests.get(id);

  const request = handoffTaskInternal(id).finally(() => handoffRequests.delete(id));
  handoffRequests.set(id, request);
  return request;
}

async function handoffTaskInternal(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");

  // Không tạo lại lời mời, thông báo và nhật ký nếu người dùng bấm gửi lần nữa
  // trong lúc các lời mời cũ vẫn còn đang mở.
  const { data: openExchanges, error: openExchangeError } = await supabaseClient
    .from("task_exchanges")
    .select("id")
    .eq("task_id", id)
    .eq("from_user", STATE.me.id)
    .eq("status", "open")
    .limit(1);
  if (!openExchangeError && openExchanges?.length) {
    alert("Việc này đã được gửi yêu cầu đổi việc. Hãy chờ mọi người phản hồi.");
    return;
  }

  const reason = prompt("Lý do (không bắt buộc):", "Bận việc khác") || "";
  let others = (STATE.profiles || []).filter((p) => p.id !== STATE.me.id && p.id !== task.assigned_to && !isUnavailableForTasks(p));
  if (others.length === 0) {
    // Nếu ai cũng đang đi vắng/ốm thì đành bỏ ràng buộc đó, còn hơn không gửi được cho ai.
    others = (STATE.profiles || []).filter((p) => p.id !== STATE.me.id && p.id !== task.assigned_to);
  }
  const othersIds = others.map((p) => p.id);

  if (othersIds.length === 0) {
    alert("Không còn ai khác để gửi yêu cầu đổi việc. Bạn phải làm việc này.");
    return;
  }

  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const actingFor = assignee && assignee.id !== STATE.me.id ? \` hộ \${assignee.name}\` : "";
  await logHistory(id, STATE.me.id, "xin_doi", \`\${STATE.me.name} báo bận\${actingFor} và xin đổi việc "\${task.title}"\${reason ? " — " + reason : ""}\`);

  let frequencyMap = {};
  if (othersIds.length) {
    const { data: doneTasks, error: countErr } = await supabaseClient
      .from("tasks")
      .select("assigned_to, title, rotation_queue_id")
      .eq("status", "hoan_thanh")
      .in("assigned_to", othersIds);

    if (!countErr && Array.isArray(doneTasks)) {
      for (const row of doneTasks) {
        const matches =
          task.rotation_queue_id && row.rotation_queue_id
            ? row.rotation_queue_id === task.rotation_queue_id
            : row.title === task.title;

        if (matches) {
          frequencyMap[row.assigned_to] = (frequencyMap[row.assigned_to] || 0) + 1;
        }
      }
    }
  }

  const orderedOthers = [...others].sort((a, b) => {
    const diff = (frequencyMap[a.id] || 0) - (frequencyMap[b.id] || 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  const createdExchangeIds = [];
  for (const p of orderedOthers) {
    const { data: exch, error: exErr } = await supabaseClient
      .from("task_exchanges")
      .insert({ task_id: id, from_user: STATE.me.id, to_user: p.id, reason, status: "open" })
      .select()
      .single();

    if (!exErr && exch) {
      createdExchangeIds.push(exch.id);
      await createNotification(
        p.id,
        \`🔄 \${STATE.me.name} báo bận\${actingFor} và xin đổi việc "\${task.title}"\${reason ? " — " + reason : ""}\`,
        {
          type: "xin_doi",
          taskId: id,
          exchangeId: exch.id,
        }
      );
    }
  }

  alert(\`Đã gửi yêu cầu đổi việc cho \${createdExchangeIds.length} người còn lại. Nếu cả 3 từ chối thì bạn phải làm việc này.\`);
}

async function deleteTask(id) {
  if (!confirm("Xoá việc này? Không thể hoàn tác.")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) return alert("Lỗi: " + error.message);
  if (typeof showToast === "function") showToast("🗑 Đã xoá việc");
  refreshActiveView();
}


// ================= GẮN SỰ KIỆN (CHỈ CHẠY 1 LẦN) =================

function bindTaskEvents(containerId = "tasks-container") {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "1";

  // Giai đoạn 2 — vuốt phải để đánh dấu hoàn thành, vuốt trái để đánh dấu không
  // hoàn thành, ngay trên phiếu việc (chỉ hoạt động bằng cảm ứng trên di động).
  if (typeof enableSwipeActions === "function") {
    enableSwipeActions(container, {
      itemSelector: ".task-ticket",
      rightSelector: '[data-action="toggle"]',
      leftSelector: '[data-action="miss"]',
      rightLabel: "✓ Xong",
      leftLabel: "✕ Bỏ việc",
    });
  }

  container.addEventListener("click", async (e) => {
    // 1. Xử lý click chuyển Tab User
    const tab = e.target.closest(".btn-tab");
    if (tab) {
        selectedUserId = tab.dataset.user;
        renderTasksView(); // Render lại danh sách
        return;
    }

    // 1b. Xử lý click bộ lọc nhanh
    const filterChip = e.target.closest(".filter-chip");
    if (filterChip) {
      taskDisplayFilter = filterChip.dataset.filter;
      renderTasksView();
      return;
    }

    // 2. Xử lý click phiếu việc
    const ticket = e.target.closest(".task-ticket");
    if (!ticket) return;
    const id = ticket.dataset.id;
    const queueId = ticket.dataset.queueId; // Chứa ID của việc luân phiên tự động
    const action = e.target.dataset.action;

    // Phân luồng hành động:
    if (action === "toggle") {
      const button = e.target.closest('[data-action="toggle"]');
      if (button) button.disabled = true;
      await toggleTaskDone(id);
    }
    if (action === "accept") acceptTask(id);
    if (action === "handoff") handoffTask(id);
    if (action === "miss") await markTaskMissed(id);
    if (action === "undo-miss") await undoMissedTask(id);
    if (action === "history") toggleTaskHistory(id, ticket);
    if (action === "delete") deleteTask(id);
    if (action === "claim-unassigned") await claimUnassignedTask(id);

    // Xử lý các nút của Phiếu việc luân phiên tự động
    if (action === "complete-rotation") await handleCompleteAutoRotation(queueId);
    if (action === "request-handoff") await requestRotationHandoff(queueId);
    if (action === "miss-rotation") await handleMissRotation(queueId);
  });

  container.addEventListener("change", (e) => {
    const ticket = e.target.closest(".task-ticket");
    if (!ticket) return;
    const id = ticket.dataset.id;
    const action = e.target.dataset.action;
    if (action === "reassign") reassignTask(id, e.target.value);
    if (action === "due") changeDueDate(id, e.target.value);
  });
}

function bindNewTaskForm() {
  const btnNew = document.getElementById("btn-new-task");
  const formCard = document.getElementById("new-task-form");
  if (btnNew.dataset.bound) return;
  btnNew.dataset.bound = "1";

  btnNew.addEventListener("click", () => {
    document.getElementById("nt-assigned").innerHTML = STATE.profiles
      .map((p) => \`<option value="\${p.id}" \${p.id === selectedUserId ? 'selected' : ''}>\${escapeHTML(p.name)}</option>\`)
      .join("");
    document.getElementById("nt-due").value = todayStr();
    formCard.style.display = formCard.style.display === "block" ? "none" : "block";
  });

  document.getElementById("cancel-new-task").addEventListener("click", () => {
    formCard.style.display = "none";
  });

  document.getElementById("save-new-task").addEventListener("click", async () => {
    const title = document.getElementById("nt-title").value.trim();
    if (!title) return alert("Nhập tên việc đã nhé.");

    const payload = {
      title,
      description: document.getElementById("nt-desc").value.trim(),
      assigned_to: document.getElementById("nt-assigned").value,
      created_by: STATE.me.id,
      due_date: document.getElementById("nt-due").value || todayStr(),
      priority: document.getElementById("nt-priority").value,
      points: Number(document.getElementById("nt-points").value) || 10,
    };

    const { data, error } = await supabaseClient.from("tasks").insert(payload).select().single();
    if (error) return alert("Lỗi: " + error.message);

    await logHistory(data.id, STATE.me.id, "tao_viec", \`\${STATE.me.name} tạo việc "\${title}"\`);
    await notifyTaskAssignee(data);
    formCard.style.display = "none";
    document.getElementById("nt-title").value = "";
    document.getElementById("nt-desc").value = "";
    renderTasksView();
  });
}

async function loadTasksSection() {
  // Gán tab mặc định là người dùng đang đăng nhập lúc load trang lần đầu
  if(!selectedUserId && STATE.me) {
      selectedUserId = STATE.me.id;
  }
  bindNewTaskForm();
  bindTaskEvents();
  if (typeof bindAutoAssignEvents === "function") bindAutoAssignEvents();
  await renderTasksView();
}

// ============================================================
// AUTO-ASSIGN.JS — "🤖 Chia việc tự động" trong trang Công việc
//
// Luồng hoạt động:
// 1. Người dùng chọn việc có sẵn (chip) và/hoặc gõ thêm việc mới (mỗi dòng 1 việc).
// 2. Bấm "⚖️ Chia công bằng ngay": thuật toán tự chọn người đang có ÍT việc
//    đang mở (open workload, tính theo điểm) hơn để giao việc mới — không cần
//    gọi dịch vụ ngoài, luôn chạy được.
// 3. Bấm "🤖 Hỏi AI gợi ý cách chia": gọi 1 Supabase Edge Function (proxy tới
//    Claude API) để AI xem xét tên/điểm từng việc và gợi ý cách chia hợp lý hơn
//    (vd việc nặng nên ưu tiên né người đã có nhiều việc khó). Nếu gọi lỗi/chưa
//    triển khai Edge Function, tự động rơi về thuật toán công bằng ở bước 2 và
//    báo cho người dùng biết.
// 4. Cả 2 cách đều ra 1 bảng xem trước — người dùng có thể sửa tay người làm/điểm
//    trước khi bấm "✅ Tạo tất cả việc" để ghi vào Supabase.
//
// LƯU Ý TRIỂN KHAI AI (bước 3): xem file
// supabase/functions/ai-assign-tasks/index.ts để biết cách triển khai Edge
// Function. Không gọi thẳng api.anthropic.com từ trình duyệt vì sẽ lộ API key.
//
// BỔ SUNG (v2) — dùng chung Status Engine với class-schedule.js:
// - Điều kiện nhận việc giờ dựa trên getEffectiveStatus() (Ốm / Đi xa / Đang
//   học / bận tự khai) thay vì chỉ is_away + đang trong giờ học.
// - Mức "Bận nhẹ" (busy_level 1) vẫn được nhận, nhưng CHỈ với việc nhỏ
//   (<= SMALL_TASK_POINT_THRESHOLD điểm) — đúng quy tắc Level 1 trong đề xuất.
// - "Bận" (busy_level 2) trở lên: không tự động giao, chỉ giao được nếu ép tay
//   qua preset (đổi người làm trong bảng xem trước).
// ============================================================

const PRESET_CHORES = [
  { title: "Quét nhà", points: 10 },
  { title: "Lau nhà", points: 15 },
  { title: "Nấu ăn trưa", points: 30 },
  { title: "Nấu ăn tối", points: 30 },
  { title: "Lấy quần áo", points: 10 },
];

// Việc có điểm <= ngưỡng này được coi là "việc nhỏ" (đổ rác, rửa bát...) —
// người đang bận nhẹ (busy_level 1) vẫn có thể nhận được.
const SMALL_TASK_POINT_THRESHOLD = 15;

// Kết quả chia việc đang xem trước (chưa lưu vào Supabase)
let aaPreviewItems = [];

// ---------------- Dựng UI ----------------

function renderPresetChips() {
  const wrap = document.getElementById("aa-presets");
  wrap.innerHTML = PRESET_CHORES.map(
    (c, i) =>
      \`<button type="button" class="chore-chip on" data-idx="\${i}">\${escapeHTML(c.title)}</button>\`
  ).join("");
}

function collectSelectedItems() {
  const items = [];

  document.querySelectorAll("#aa-presets .chore-chip.on").forEach((btn) => {
    const chore = PRESET_CHORES[Number(btn.dataset.idx)];
    if (chore) items.push({ title: chore.title, points: chore.points });
  });

  const defaultPoints = Number(document.getElementById("aa-points").value) || 10;
  const customLines = document
    .getElementById("aa-custom")
    .value.split("\\n")
    .map((l) => l.trim())
    .filter(Boolean);
  customLines.forEach((title) => items.push({ title, points: defaultPoints }));

  return items;
}

// ---------------- Thuật toán chia công bằng ----------------

// "Mức độ bận" của mỗi thành viên = tổng điểm các việc CHƯA XONG hiện tại
// + tổng điểm đã có (chấm điểm công bằng hơn: ưu tiên việc mới cho người đang ít điểm hơn).
// Việc đã bị đánh dấu "bo_lo" (bỏ việc) không tính vào việc đang mở nữa.
async function computeCurrentLoad() {
  const tasks = await fetchTasks();
  const load = {};
  STATE.profiles.forEach((p) => (load[p.id] = 0));
  tasks
    .filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo")
    .forEach((t) => {
      if (load[t.assigned_to] !== undefined) load[t.assigned_to] += t.points || 0;
    });

  if (typeof fetchMemberPointsMap === "function") {
    const pointsMap = await fetchMemberPointsMap();
    STATE.profiles.forEach((p) => {
      load[p.id] = (load[p.id] || 0) + (pointsMap[p.id] || 0);
    });
  }

  return load;
}

// Trạng thái thật (Ốm/Đi xa/Đang học/bận tự khai) của TẤT CẢ thành viên,
// lấy 1 lần cho cả lượt chia việc. Nếu getEffectiveStatus chưa tồn tại (chưa
// nạp class-schedule.js bản mới) thì fallback về is_away như bản cũ.
async function computeStatusMap() {
  const map = {};
  for (const p of STATE.profiles || []) {
    if (typeof getEffectiveStatus === "function") {
      map[p.id] = await getEffectiveStatus(p.id);
    } else {
      map[p.id] = p.is_away
        ? { status: "AWAY", busy_level: 3, reason: "Đi vắng" }
        : { status: "AVAILABLE", busy_level: 0, reason: null };
    }
  }
  return map;
}

// 1 người có nhận được ĐÚNG việc "item" cụ thể này không, theo busy_level:
// level 3 (ốm/đi xa/đang học/không khả dụng) -> không bao giờ tự động giao
// level 2 (bận) -> không tự động giao
// level 1 (bận nhẹ) -> chỉ nhận việc nhỏ (<= SMALL_TASK_POINT_THRESHOLD điểm)
// level 0 (rảnh) -> nhận mọi việc
function isEligibleForItem(status, item) {
  if (!status) return true;
  if (status.busy_level >= 2) return false;
  if (status.busy_level === 1) return (item.points || 0) <= SMALL_TASK_POINT_THRESHOLD;
  return true;
}

// Danh sách người CÓ THỂ nhận ít nhất 1 việc nào đó ngay bây giờ (dùng để báo
// cho người dùng biết ai đang bị tạm né và vì sao).
function summarizeExcluded(statusMap) {
  return (STATE.profiles || [])
    .filter((p) => statusMap[p.id] && statusMap[p.id].busy_level >= 2)
    .map((p) => \`\${p.name} (\${statusMap[p.id].reason || statusMap[p.id].status})\`);
}

// Chia items cho người đang có mức độ bận thấp nhất trong số những người ĐỦ
// ĐIỀU KIỆN cho đúng việc đó, việc điểm cao chia trước để cân bằng tốt hơn
// (giống bin-packing kiểu "largest first"). Nếu 1 việc không còn ai đủ điều
// kiện, nới lỏng dần: bỏ level 2, rồi mới tới bỏ hẳn kiểm tra (để không kẹt).
function fairDistribute(items, load, statusMap, presetAssignments = {}) {
  const runningLoad = { ...load };
  const sorted = [...items].sort((a, b) => b.points - a.points);
  const allProfiles = STATE.profiles || [];

  return sorted.map((item) => {
    const preset = presetAssignments[item.title];
    if (preset && runningLoad[preset] !== undefined) {
      runningLoad[preset] += item.points;
      return { ...item, assigned_to: preset, reason: presetAssignments.__reason?.[item.title] || "" };
    }

    let candidates = allProfiles.filter((p) => isEligibleForItem(statusMap[p.id], item));
    if (candidates.length === 0) {
      // nới lỏng: cho phép cả busy_level 2 (nhưng vẫn né ốm/đi xa/đang học/level 3)
      candidates = allProfiles.filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
    }
    if (candidates.length === 0) candidates = allProfiles; // vẫn không có ai -> chia hết cho tất cả để không kẹt

    let best = candidates[0];
    candidates.forEach((p) => {
      if (runningLoad[p.id] < runningLoad[best.id]) best = p;
    });
    runningLoad[best.id] += item.points;
    return { ...item, assigned_to: best?.id || null, reason: "" };
  });
}

// Giữ lại tên hàm cũ để tương thích nếu file khác (vd tasks.js) có gọi tới —
// trả về danh sách người không ở mức "không khả dụng" (busy_level 3).
async function getEligibleAssignees() {
  const statusMap = await computeStatusMap();
  const free = (STATE.profiles || []).filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
  return free.length > 0 ? free : STATE.profiles || [];
}

// ---------------- Gợi ý từ AI (qua Edge Function proxy) ----------------

async function askAIForAssignment(items, load, eligibleProfiles, statusMap) {
  if (typeof SUPABASE_URL !== "string" || !SUPABASE_URL) return null;
  const endpoint = \`\${SUPABASE_URL}/functions/v1/ai-assign-tasks\`;

  try {
    let authToken = SUPABASE_ANON_KEY;
    if (supabaseClient?.auth?.getSession) {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session?.access_token) authToken = data.session.access_token;
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${authToken}\`,
      },
      body: JSON.stringify({
        tasks: items,
        members: eligibleProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          busy_level: statusMap[p.id]?.busy_level ?? 0,
          status_reason: statusMap[p.id]?.reason || null,
        })),
        current_load: load,
      }),
    });

    if (!resp.ok) throw new Error(\`Edge Function trả về lỗi \${resp.status}\`);
    const result = await resp.json();
    if (!Array.isArray(result?.assignments)) throw new Error("Phản hồi AI không đúng định dạng.");

    const byTitle = {};
    const reasons = {};
    const eligibleIds = new Set(eligibleProfiles.map((p) => p.id));
    result.assignments.forEach((a) => {
      if (!a || !a.title) return;
      const validMember = eligibleIds.has(a.assigned_to);
      if (validMember) {
        byTitle[a.title] = a.assigned_to;
        if (a.reason) reasons[a.title] = a.reason;
      }
    });
    byTitle.__reason = reasons;
    return byTitle;
  } catch (err) {
    console.error("Không gọi được AI để chia việc:", err);
    return null;
  }
}

// ---------------- Bảng xem trước ----------------

function renderPreview() {
  const listEl = document.getElementById("aa-preview-list");
  const previewWrap = document.getElementById("aa-preview");

  if (aaPreviewItems.length === 0) {
    previewWrap.style.display = "none";
    return;
  }
  previewWrap.style.display = "block";

  listEl.innerHTML = aaPreviewItems
    .map((item, idx) => {
      const assignee = findProfile(STATE.profiles, item.assigned_to);
      const borderColor = assignee ? assignee.avatar_color : "#ccc";
      const options = STATE.profiles
        .map((p) => \`<option value="\${p.id}" \${p.id === item.assigned_to ? "selected" : ""}>\${escapeHTML(p.name)}</option>\`)
        .join("");
      return \`
      <div class="task-ticket" style="border-left-color:\${borderColor}" data-idx="\${idx}">
        <div class="task-body">
          <div class="task-title">\${escapeHTML(item.title)}</div>
          <div class="task-meta">
            <select data-action="aa-reassign" class="task-mini-select" title="Đổi người làm">\${options}</select>
            <input type="number" min="0" data-action="aa-points" value="\${item.points}" class="task-mini-date" style="width:64px" title="Điểm thưởng" />
            \${item.reason ? \`<span style="font-style:italic">\${escapeHTML(item.reason)}</span>\` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="aa-remove" title="Bỏ việc này khỏi danh sách">🗑</button>
        </div>
      </div>\`;
    })
    .join("");
}

async function runDistribution(mode) {
  const items = collectSelectedItems();
  if (items.length === 0) {
    alert("Chọn ít nhất 1 việc có sẵn hoặc gõ thêm việc mới.");
    return;
  }

  const load = await computeCurrentLoad();
  const statusMap = await computeStatusMap();
  const eligible = (STATE.profiles || []).filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
  const eligibleForAI = eligible.length > 0 ? eligible : STATE.profiles || [];

  if (mode === "ai") {
    const aiBtn = document.getElementById("aa-ai-btn");
    const oldLabel = aiBtn.textContent;
    aiBtn.textContent = "Đang hỏi AI...";
    aiBtn.disabled = true;

    const aiMap = await askAIForAssignment(items, load, eligibleForAI, statusMap);
    aiBtn.textContent = oldLabel;
    aiBtn.disabled = false;

    if (!aiMap) {
      alert(
        "Chưa gọi được AI (có thể Edge Function chưa được triển khai). Đã tự động dùng thuật toán chia công bằng thay thế."
      );
      aaPreviewItems = fairDistribute(items, load, statusMap, {});
    } else {
      aaPreviewItems = fairDistribute(items, load, statusMap, aiMap);
    }
  } else {
    aaPreviewItems = fairDistribute(items, load, statusMap, {});
  }

  const noteEl = document.getElementById("aa-class-note");
  if (noteEl) {
    const excluded = summarizeExcluded(statusMap);
    if (excluded.length > 0) {
      noteEl.style.display = "block";
      noteEl.textContent = "📚🤒✈️ Đã tạm né giao việc lớn cho: " + excluded.join(", ") + ".";
    } else {
      noteEl.style.display = "none";
      noteEl.textContent = "";
    }
  }

  renderPreview();
}

async function confirmCreateTasks() {
  if (aaPreviewItems.length === 0) return;
  const dueDate = document.getElementById("aa-due").value || todayStr();

  const payloads = aaPreviewItems
    .filter((item) => item.assigned_to)
    .map((item) => ({
      title: item.title,
      description: "",
      assigned_to: item.assigned_to,
      created_by: STATE.me.id,
      due_date: dueDate,
      status: "chua_lam",
      priority: "binh_thuong",
      points: Number(item.points) || 0,
    }));

  if (payloads.length === 0) {
    alert("Chưa có việc nào được gán người làm hợp lệ.");
    return;
  }

  const { data, error } = await supabaseClient.from("tasks").insert(payloads).select();
  if (error) return alert("Lỗi: " + error.message);

  if (typeof logHistory === "function") {
    for (const row of data) {
      await logHistory(row.id, STATE.me.id, "tao_viec", \`\${STATE.me.name} tạo việc "\${row.title}" (chia tự động)\`);
    }
  }

  for (const row of data || []) {
    await notifyTaskAssignee(row, \`📌 Bạn được giao việc mới: "\${row.title}".\`);
  }

  // Dọn form và ẩn bảng
  aaPreviewItems = [];
  document.getElementById("aa-custom").value = "";
  document.querySelectorAll("#aa-presets .chore-chip.on").forEach((b) => b.classList.remove("on"));
  document.getElementById("aa-preview").style.display = "none";
  document.getElementById("auto-assign-form").style.display = "none";

  renderTasksView();
}

// ---------------- Gắn sự kiện ----------------

function bindAutoAssignEvents() {
  const btnOpen = document.getElementById("btn-auto-assign");
  if (!btnOpen || btnOpen.dataset.bound) return;
  btnOpen.dataset.bound = "1";

  renderPresetChips();
  document.getElementById("aa-due").value = todayStr();

  const formCard = document.getElementById("auto-assign-form");

  btnOpen.addEventListener("click", () => {
    const newTaskForm = document.getElementById("new-task-form");
    if (newTaskForm) newTaskForm.style.display = "none";
    formCard.style.display = formCard.style.display === "block" ? "none" : "block";
  });

  document.getElementById("aa-cancel-btn").addEventListener("click", () => {
    formCard.style.display = "none";
    document.getElementById("aa-preview").style.display = "none";
    aaPreviewItems = [];
  });

  document.getElementById("aa-presets").addEventListener("click", (e) => {
    const chip = e.target.closest(".chore-chip");
    if (chip) chip.classList.toggle("on");
  });

  document.getElementById("aa-fair-btn").addEventListener("click", () => runDistribution("fair"));
  document.getElementById("aa-ai-btn").addEventListener("click", () => runDistribution("ai"));
  document.getElementById("aa-redo-btn").addEventListener("click", () => {
    document.getElementById("aa-preview").style.display = "none";
    aaPreviewItems = [];
  });
  document.getElementById("aa-confirm-btn").addEventListener("click", confirmCreateTasks);

  const previewList = document.getElementById("aa-preview-list");
  previewList.addEventListener("change", (e) => {
    const row = e.target.closest(".task-ticket");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target.dataset.action === "aa-reassign") aaPreviewItems[idx].assigned_to = e.target.value;
    if (e.target.dataset.action === "aa-points") aaPreviewItems[idx].points = Number(e.target.value) || 0;
  });
  previewList.addEventListener("click", (e) => {
    if (e.target.dataset.action !== "aa-remove") return;
    const row = e.target.closest(".task-ticket");
    const idx = Number(row.dataset.idx);
    aaPreviewItems.splice(idx, 1);
    renderPreview();
  });
}


// ============================================================
// SCHEDULE.JS — trang "Lịch" (việc lặp lại) + tự sinh việc mỗi ngày
// Mỗi lịch có thể gán CỐ ĐỊNH (1 người) hoặc LUÂN PHIÊN (1 hàng đợi)
// ============================================================

async function fetchSchedules() {
  const { data, error } = await supabaseClient.from("schedules").select("*").order("created_at");
  if (error) {
    console.error("Không lấy được lịch:", error.message);
    return [];
  }
  return data;
}

function scheduleMatchesDate(schedule, dateObj, dateStr) {
  if (!schedule.active) return false;
  if (schedule.start_date && dateStr < schedule.start_date) return false;
  if (schedule.end_date && dateStr > schedule.end_date) return false;
  if (schedule.repeat_type === "daily") return true;
  if (schedule.repeat_type === "weekly") return (schedule.repeat_days || []).includes(dateObj.getDay());
  return false;
}

// Ai sẽ là người thực hiện lịch này hôm nay: cố định thì lấy assigned_to,
// luân phiên thì lấy người đang đứng đầu hàng đợi liên kết
function effectiveAssigneeId(schedule, queueMap) {
  if (schedule.rotation_queue_id) {
    const queue = queueMap[schedule.rotation_queue_id];
    const holder = currentHolder(queue);
    return holder ? holder.id : null;
  }
  return schedule.assigned_to;
}

// Gọi hàm này 1 lần mỗi khi mở app: tự tạo việc của "hôm nay" từ các lịch đang chạy,
// không tạo trùng nếu việc của lịch đó, ngày đó đã có rồi.
async function generateTodayTasks() {
  const today = todayStr();
  const todayObj = new Date(today + "T00:00:00");
  const schedules = await fetchSchedules();
  const matching = schedules.filter((s) => scheduleMatchesDate(s, todayObj, today));
  if (matching.length === 0) return;

  const queues = await fetchRotationQueues();
  const queueMap = Object.fromEntries(queues.map((q) => [q.id, q]));

  const scheduleIds = matching.map((s) => s.id);
  const { data: existing, error } = await supabaseClient
    .from("tasks")
    .select("schedule_id")
    .eq("due_date", today)
    .in("schedule_id", scheduleIds);
  if (error) {
    console.error("Không kiểm tra được việc đã tạo:", error.message);
    return;
  }

  const already = new Set((existing || []).map((t) => t.schedule_id));
  const toInsert = [];
  // Lịch cố định (không luân phiên) mà người phụ trách đang đi vắng hôm nay -> ghi lại
  // để sau khi tạo xong, báo cho các thành viên còn lại biết ai có thể nhận thay.
  const unownedBySchedule = new Map(); // schedule.id -> { title, awayName }

  matching
    .filter((s) => !already.has(s.id))
    .forEach((s) => {
      const isRotation = !!s.rotation_queue_id;
      const fixedProfile = !isRotation ? findProfile(STATE.profiles, s.assigned_to) : null;

      // Việc luân phiên: currentHolder() ở rotations.js đã tự bỏ qua người đang đi vắng rồi.
      if (!isRotation && fixedProfile && fixedProfile.is_away) {
        toInsert.push({
          title: s.title,
          description: s.description || null,
          assigned_to: null,
          created_by: s.assigned_to,
          schedule_id: s.id,
          rotation_queue_id: null,
          due_date: today,
          status: "vo_chu",
          priority: "binh_thuong",
          points: s.points,
        });
        unownedBySchedule.set(s.id, { title: s.title, awayName: fixedProfile.name });
        return;
      }

      const assignee = effectiveAssigneeId(s, queueMap);
      if (!assignee) return; // lịch luân phiên nhưng hàng đợi rỗng -> bỏ qua
      toInsert.push({
        title: s.title,
        description: s.description || null,
        assigned_to: assignee,
        created_by: assignee,
        schedule_id: s.id,
        rotation_queue_id: s.rotation_queue_id || null,
        due_date: today,
        status: "chua_lam",
        priority: "binh_thuong",
        points: s.points,
      });
    });

  if (toInsert.length === 0) return;

  const { data: insertedRows, error: insertErr } = await supabaseClient.from("tasks").insert(toInsert).select();
  if (insertErr) {
    console.error("Không tạo được việc từ lịch:", insertErr.message);
    return;
  }

  if (unownedBySchedule.size > 0) {
    const presentMembers = (STATE.profiles || []).filter((p) => !p.is_away);
    const rowByScheduleId = new Map((insertedRows || []).map((row) => [row.schedule_id, row]));

    for (const [scheduleId, info] of unownedBySchedule) {
      const row = rowByScheduleId.get(scheduleId);
      for (const member of presentMembers) {
        await createNotification(
          member.id,
          \`📣 \${info.awayName} đang đi vắng — ai có thể nhận thay việc "\${info.title}" hôm nay?\`,
          { type: "thong_bao", taskId: row ? row.id : null }
        );
      }
    }
  }

  for (const row of insertedRows || []) {
    if (row.assigned_to) {
      await notifyTaskAssignee(row, \`📌 Bạn có việc mới hôm nay: "\${row.title}".\`);
    }
  }
}

async function renderScheduleView() {
  const schedules = await fetchSchedules();
  const queues = await fetchRotationQueues();
  const queueMap = Object.fromEntries(queues.map((q) => [q.id, q]));
  const { data: activeTasks, error: taskErr } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id, assigned_to, status")
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false });
  const activeTaskByQueue = taskErr
    ? {}
    : (activeTasks || []).reduce((map, task) => {
        if (task.rotation_queue_id && task.assigned_to && !map[task.rotation_queue_id]) {
          map[task.rotation_queue_id] = task;
        }
        return map;
      }, {});

  const displayHolder = (queueId) => {
    const activeTask = activeTaskByQueue[queueId];
    return activeTask
      ? findProfile(STATE.profiles, activeTask.assigned_to)
      : currentHolder(queueMap[queueId]);
  };

  const listEl = document.getElementById("schedule-list");
  if (schedules.length === 0) {
    listEl.innerHTML = \`<p class="empty-state">Chưa có lịch lặp lại nào.</p>\`;
    return;
  }
  listEl.innerHTML = schedules
    .map((s) => {
      const rotating = !!s.rotation_queue_id;
      const who = rotating
        ? \`🔁 luân phiên — hôm nay: \${(() => {
            const holder = displayHolder(s.rotation_queue_id);
            return holder ? escapeHTML(holder.name) : "?";
          })()}\`
        : escapeHTML(findProfile(STATE.profiles, s.assigned_to)?.name || "?");
      const when = s.repeat_type === "daily" ? "Mỗi ngày" : "Mỗi " + (s.repeat_days || []).map((d) => WEEKDAY_LABEL[d]).join(", ");
      const holderColor = rotating
        ? displayHolder(s.rotation_queue_id)?.avatar_color || "#ccc"
        : findProfile(STATE.profiles, s.assigned_to)?.avatar_color || "#ccc";
      return \`
      <div class="task-ticket" style="border-left-color:\${holderColor}" data-id="\${s.id}">
        <div class="task-body">
          <div class="task-title">\${escapeHTML(s.title)}</div>
          <div class="task-meta"><span>\${when}</span><span>\${who}</span><span>\${s.points} điểm</span></div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="del-schedule" title="Xoá lịch">🗑</button>
        </div>
      </div>\`;
    })
    .join("");
}

function toggleAssignModeUI() {
  const mode = document.getElementById("sc-assign-mode").value;
  document.getElementById("sc-fixed-wrap").style.display = mode === "fixed" ? "block" : "none";
  document.getElementById("sc-rotation-wrap").style.display = mode === "rotation" ? "block" : "none";
}

async function refreshScheduleRotationOptions() {
  const sel = document.getElementById("sc-rotation-queue");
  if (!sel) return;
  const queues = await fetchRotationQueues();
  sel.innerHTML = queues.map((q) => \`<option value="\${q.id}">\${q.icon} \${escapeHTML(q.label)}</option>\`).join("");
}

function bindScheduleEvents() {
  const listEl = document.getElementById("schedule-list");
  if (!listEl.dataset.bound) {
    listEl.dataset.bound = "1";
    listEl.addEventListener("click", async (e) => {
      if (e.target.dataset.action !== "del-schedule") return;
      const id = e.target.closest(".task-ticket").dataset.id;
      if (!confirm("Xoá lịch lặp lại này? Các việc đã tạo trước đó vẫn giữ nguyên.")) return;
      const { error } = await supabaseClient.from("schedules").delete().eq("id", id);
      if (error) return alert("Lỗi: " + error.message);
      renderScheduleView();
    });
  }

  const repeatTypeSel = document.getElementById("sc-repeat-type");
  const daysPicker = document.getElementById("sc-days-picker");
  const assignModeSel = document.getElementById("sc-assign-mode");
  const saveBtn = document.getElementById("save-schedule");
  if (!repeatTypeSel || !daysPicker || !assignModeSel || !saveBtn) return;

  if (!repeatTypeSel.dataset.bound) {
    repeatTypeSel.dataset.bound = "1";
    repeatTypeSel.addEventListener("change", () => {
      daysPicker.style.display = repeatTypeSel.value === "weekly" ? "flex" : "none";
    });
  }

  if (!daysPicker.dataset.bound) {
    daysPicker.dataset.bound = "1";
    daysPicker.querySelectorAll(".day-toggle").forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("on"));
    });
  }

  if (!assignModeSel.dataset.bound) {
    assignModeSel.dataset.bound = "1";
    assignModeSel.addEventListener("change", toggleAssignModeUI);
  }

  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const title = document.getElementById("sc-title").value.trim();
      if (!title) return alert("Nhập tên việc lặp lại.");

      const repeatType = repeatTypeSel.value;
      const days = Array.from(daysPicker.querySelectorAll(".day-toggle.on")).map((b) => Number(b.dataset.day));
      if (repeatType === "weekly" && days.length === 0) return alert("Chọn ít nhất 1 ngày trong tuần.");

      const assignMode = assignModeSel.value;
      if (assignMode === "rotation" && !document.getElementById("sc-rotation-queue").value) {
        return alert("Chưa có hàng đợi luân phiên nào. Tạo 1 hàng đợi ở mục bên dưới trước đã.");
      }

      const payload = {
        title,
        assigned_to: assignMode === "fixed" ? document.getElementById("sc-assigned").value : null,
        rotation_queue_id: assignMode === "rotation" ? document.getElementById("sc-rotation-queue").value : null,
        repeat_type: repeatType,
        repeat_days: repeatType === "weekly" ? days : [],
        start_date: document.getElementById("sc-start").value || todayStr(),
        end_date: document.getElementById("sc-end").value || null,
        points: Number(document.getElementById("sc-points").value) || 10,
      };

      const { error } = await supabaseClient.from("schedules").insert(payload);
      if (error) return alert("Lỗi: " + error.message);

      document.getElementById("sc-title").value = "";
      await renderScheduleView();
      generateTodayTasks();
    });
  }
}

// ============================================================
// LỊCH HỌC — theo tuần thực tế (không lặp cố định theo thứ)
// ============================================================

let clsWeekAnchor = new Date();

function classWeekLabel(weekDates) {
  const fmt = (d) => \`\${String(d.getDate()).padStart(2, "0")}/\${String(d.getMonth() + 1).padStart(2, "0")}\`;
  const first = weekDates[0];
  const last = weekDates[6];
  const todayWeekStart = getWeekDates(new Date())[0];
  const weekDifference = Math.round((first - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));
  let relativeLabel = "tuần này";

  if (weekDifference < 0) {
    const weeksAgo = Math.abs(weekDifference);
    relativeLabel = weeksAgo === 1 ? "tuần trước" : \`\${weeksAgo} tuần trước\`;
  } else if (weekDifference > 0) {
    relativeLabel = weekDifference === 1 ? "tuần sau" : \`\${weekDifference} tuần sau\`;
  }

  return \`\${fmt(first)} - \${fmt(last)}/\${last.getFullYear()} (\${relativeLabel})\`;
}

async function renderClassScheduleCard() {
  const gridEl = document.getElementById("cls-grid");
  const labelEl = document.getElementById("cls-week-label");
  if (!gridEl || !labelEl) return;

  const weekDates = getWeekDates(clsWeekAnchor);
  labelEl.textContent = classWeekLabel(weekDates);

  const university = STATE.me?.university;
  if (!university) {
    gridEl.innerHTML = \`<p class="empty-state">Chưa chọn trường học — vào mục Cài đặt để chọn trước.</p>\`;
    return;
  }

  gridEl.innerHTML = \`<p class="empty-state">Đang tải khung tiết...</p>\`;
  const periods = await fetchClassPeriods(university);
  if (periods.length === 0) {
    gridEl.innerHTML = \`<p class="empty-state">Chưa có dữ liệu khung tiết cho trường này.</p>\`;
    return;
  }

  const rows = await fetchUserClassSchedule(STATE.me.id, { fresh: true });
  const weekKeys = weekDates.map(classDateKey);
  const ticks = new Set(
    rows
      .filter((r) => r.university === university && weekKeys.includes(r.class_date))
      .map((r) => \`\${r.class_date}-\${r.period_number}\`)
  );

  const header = \`<tr><th style="text-align:left;padding:4px 8px;">Tiết</th>\${weekDates
    .map(
      (d) =>
        \`<th style="padding:4px 8px;">\${CLASS_WEEKDAY_SHORT[d.getDay()]}<br><span style="font-weight:400;font-size:11px;">\${String(
          d.getDate()
        ).padStart(2, "0")}/\${String(d.getMonth() + 1).padStart(2, "0")}</span></th>\`
    )
    .join("")}</tr>\`;

  const bodyRows = periods
    .map((p) => {
      const timeLabel = \`\${p.start_time.slice(0, 5)}-\${p.end_time.slice(0, 5)}\`;
      const cells = weekDates
        .map((d) => {
          const dateKey = classDateKey(d);
          const key = \`\${dateKey}-\${p.period_number}\`;
          const checked = ticks.has(key) ? "checked" : "";
          return \`<td style="text-align:center;padding:4px 8px;"><input type="checkbox" data-date="\${dateKey}" data-period="\${p.period_number}" \${checked} /></td>\`;
        })
        .join("");
      return \`<tr><td style="padding:4px 8px;white-space:nowrap;">Tiết \${p.period_number}<br><span style="font-size:11px;color:var(--ink-faint);">\${timeLabel}</span></td>\${cells}</tr>\`;
    })
    .join("");

  gridEl.innerHTML = \`<table class="class-schedule-table" style="width:100%;border-collapse:collapse;font-size:13px;">\${header}\${bodyRows}</table>\`;
}

async function saveClassScheduleWeek() {
  const university = STATE.me?.university;
  const statusEl = document.getElementById("cls-status");
  const saveBtn = document.getElementById("cls-save");
  if (!university) return;

  const weekDates = getWeekDates(clsWeekAnchor);
  const weekKeys = weekDates.map(classDateKey);

  const ticked = Array.from(document.querySelectorAll("#cls-grid input[type=checkbox]:checked")).map((cb) => ({
    user_id: STATE.me.id,
    university,
    class_date: cb.dataset.date,
    period_number: Number(cb.dataset.period),
  }));

  if (saveBtn) saveBtn.disabled = true;
  if (statusEl) statusEl.textContent = "Đang lưu...";

  // Chỉ xoá + ghi lại đúng các ngày trong tuần đang sửa, không đụng tới tuần khác.
  const { error: delErr } = await supabaseClient
    .from("user_class_schedule")
    .delete()
    .eq("user_id", STATE.me.id)
    .eq("university", university)
    .in("class_date", weekKeys);
  if (delErr) {
    if (saveBtn) saveBtn.disabled = false;
    if (statusEl) statusEl.textContent = "";
    return alert("Lỗi: " + delErr.message);
  }

  if (ticked.length > 0) {
    const { error: insErr } = await supabaseClient.from("user_class_schedule").insert(ticked);
    if (insErr) {
      if (saveBtn) saveBtn.disabled = false;
      if (statusEl) statusEl.textContent = "";
      return alert("Lỗi: " + insErr.message);
    }
  }

  invalidateUserClassScheduleCache(STATE.me.id);
  if (saveBtn) saveBtn.disabled = false;
  if (statusEl) statusEl.textContent = "Đã lưu lịch học tuần này.";
}

// Chép các tiết đã tick của tuần trước sang đúng cùng thứ của tuần đang xem
// (chỉ tick lên lưới hiện tại — vẫn phải bấm "Lưu lịch học tuần này" để ghi lại).
async function copyClassScheduleFromPrevWeek() {
  const university = STATE.me?.university;
  const statusEl = document.getElementById("cls-status");
  if (!university) return;

  const thisWeek = getWeekDates(clsWeekAnchor);
  const prevAnchor = new Date(clsWeekAnchor);
  prevAnchor.setDate(prevAnchor.getDate() - 7);
  const prevWeek = getWeekDates(prevAnchor);
  const prevKeys = prevWeek.map(classDateKey);

  const rows = await fetchUserClassSchedule(STATE.me.id, { fresh: true });
  const prevTicks = rows.filter((r) => r.university === university && prevKeys.includes(r.class_date));

  if (prevTicks.length === 0) {
    if (statusEl) statusEl.textContent = "Tuần trước chưa có lịch học nào để sao chép.";
    return;
  }

  prevWeek.forEach((prevDate, idx) => {
    const prevKey = classDateKey(prevDate);
    const periodsThatDay = prevTicks.filter((r) => r.class_date === prevKey).map((r) => r.period_number);
    const targetKey = classDateKey(thisWeek[idx]);
    periodsThatDay.forEach((periodNum) => {
      const cb = document.querySelector(\`#cls-grid input[data-date="\${targetKey}"][data-period="\${periodNum}"]\`);
      if (cb) cb.checked = true;
    });
  });

  if (statusEl) statusEl.textContent = "Đã điền theo tuần trước — bấm \\"Lưu lịch học tuần này\\" để ghi lại.";
}

function bindClassScheduleEvents() {
  const prevBtn = document.getElementById("cls-week-prev");
  if (!prevBtn || prevBtn.dataset.bound) return;
  prevBtn.dataset.bound = "1";

  prevBtn.addEventListener("click", () => {
    clsWeekAnchor.setDate(clsWeekAnchor.getDate() - 7);
    renderClassScheduleCard();
  });
  document.getElementById("cls-week-next").addEventListener("click", () => {
    clsWeekAnchor.setDate(clsWeekAnchor.getDate() + 7);
    renderClassScheduleCard();
  });
  document.getElementById("cls-week-today").addEventListener("click", () => {
    clsWeekAnchor = new Date();
    renderClassScheduleCard();
  });
  document.getElementById("cls-save").addEventListener("click", saveClassScheduleWeek);
  document.getElementById("cls-copy-prev").addEventListener("click", copyClassScheduleFromPrevWeek);
}

async function loadScheduleSection() {
  const assignedSelect = document.getElementById("sc-assigned");
  if (assignedSelect) {
    assignedSelect.innerHTML = STATE.profiles
      .map((p) => \`<option value="\${p.id}">\${escapeHTML(p.name)}</option>\`)
      .join("");
  }
  await refreshScheduleRotationOptions();
  if (document.getElementById("sc-assign-mode")) toggleAssignModeUI();
  bindScheduleEvents();
  bindClassScheduleEvents();
  await renderScheduleView();
  await renderClassScheduleCard();
  await loadRotationAdmin();
  await loadMonthCalendar();
}


// ============================================================
// CALENDAR.JS — "Lịch Tháng" trong trang Lịch
//
// Thay cho "Lưới cả tuần" cũ. Vẽ lịch dạng tháng thật (7 cột T2->CN,
// 5-6 hàng), có điều hướng Tháng trước/sau/Hôm nay, và tô màu theo
// trạng thái công việc:
//   - Ngày đã qua: Xanh lá = đã hoàn thành, Đỏ = bỏ lỡ/quá hạn.
//   - Hôm nay: giữ màu trạng thái thật (chưa xong = màu trung tính).
//   - Ngày tương lai: chiếu (dự kiến) từ các "schedules" đang bật và
//     hàng đợi luân phiên liên quan — không phải việc thật trong DB,
//     vì generateTodayTasks() chỉ tạo việc của hôm nay.
//
// Việc luân phiên ở tương lai được MÔ PHỎNG bằng cách giả định hàng đợi
// dịch chuyển đúng 1 bước mỗi lần lịch đó xảy ra, bắt đầu từ current_index
// hiện tại. Đây là ước lượng để hình dung trước — có thể lệch nếu có
// "việc phát sinh" thủ công (báo có việc) xen giữa làm hàng đợi dịch
// chuyển sớm hơn dự kiến.
// ============================================================

let calViewYear;
let calViewMonth; // 0 = Tháng 1 ... 11 = Tháng 12
let calItemsByDate = {};

const CAL_MONTH_LABEL = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function calInitState() {
  const now = new Date();
  calViewYear = now.getFullYear();
  calViewMonth = now.getMonth();
}

function calDateStrFromDate(d) {
  return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, "0")}-\${String(d.getDate()).padStart(2, "0")}\`;
}

function calDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Offset kiểu Thứ 2 đầu tuần: Thứ 2 = 0 ... Chủ Nhật = 6 (JS Date#getDay() trả 0=CN)
function calMondayOffset(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  return firstDay === 0 ? 6 : firstDay - 1;
}

// Lấy toàn bộ việc có due_date trong khoảng [startStr, endStr] (bao gồm 2 đầu)
async function fetchTasksInRange(startStr, endStr) {
  if (startStr > endStr) return [];
  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .gte("due_date", startStr)
    .lte("due_date", endStr);
  if (error) {
    console.error("Không lấy được việc trong khoảng ngày:", error.message);
    return [];
  }
  return data || [];
}

function calendarTaskIsRequired(task) {
  return task.priority === "cao";
}

function calendarDisplayDate(task, todayStr_) {
  const isOpen = task.status !== "hoan_thanh" && task.status !== "bo_lo";
  const isOldRotation = task.rotation_queue_id && task.due_date < todayStr_;

  // Việc luân phiên chưa xong không bị kẹt ở ngày cũ; chỉ việc bắt buộc
  // mới giữ lại ngày quá hạn để đánh dấu đỏ trong lịch.
  if (isOpen && isOldRotation && !calendarTaskIsRequired(task)) return todayStr_;
  return task.due_date;
}

// Chiếu (dự kiến) các lịch lặp lại vào những ngày TƯƠNG LAI trong khoảng xem.
// Trả về map: "YYYY-MM-DD" -> [{ title, assigneeId, points, projected: true }]
function projectFutureOccurrences(schedules, queues, startStr, endStr, todayStr_, existingTasks = []) {
  const queueMap = Object.fromEntries(queues.map((q) => [q.id, q]));
  // Số bước đã dịch chuyển của mỗi hàng đợi, tính từ hôm nay tới ngày đang xét
  const queueStep = {};
  queues.forEach((q) => (queueStep[q.id] = 0));

  const occurrencesByDate = {};
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dStr = calDateStrFromDate(d);
    if (dStr <= todayStr_) continue; // hôm nay trở về trước dùng dữ liệu thật, không chiếu

    schedules.forEach((s) => {
      if (!scheduleMatchesDate(s, d, dStr)) return;

      let assigneeId = null;
      if (s.rotation_queue_id) {
        const queue = queueMap[s.rotation_queue_id];
        if (!queue || !Array.isArray(queue.member_order) || queue.member_order.length === 0) return;
        const n = queue.member_order.length;
        const idx = (queue.current_index + queueStep[s.rotation_queue_id]) % n;
        assigneeId = queue.member_order[idx];
        queueStep[s.rotation_queue_id] += 1;
      } else {
        assigneeId = s.assigned_to;
      }

      if (!occurrencesByDate[dStr]) occurrencesByDate[dStr] = [];
      occurrencesByDate[dStr].push({
        title: s.title,
        assigneeId,
        points: s.points,
        projected: true,
      });
    });
  }

  // Học lịch sử của mọi task cũ, kể cả task không còn schedule/rotation_queue.
  // Nhờ vậy việc xuất hiện 2 lần trong một ngày vẫn được dự báo 2 lần.
  const scheduledTitles = new Set(schedules.map((s) => s.title));
  const queueTitles = new Set(queues.map((q) => q.label));
  const inferredTasks = {};
  existingTasks
    .filter((task) => task.due_date <= todayStr_ && !scheduledTitles.has(task.title) && !queueTitles.has(task.title))
    .forEach((task) => {
      if (!inferredTasks[task.title]) inferredTasks[task.title] = { byDate: {}, rows: [] };
      if (!inferredTasks[task.title].byDate[task.due_date]) inferredTasks[task.title].byDate[task.due_date] = [];
      inferredTasks[task.title].byDate[task.due_date].push(task);
      inferredTasks[task.title].rows.push(task);
    });

  Object.values(inferredTasks).forEach((pattern) => {
    const dates = Object.keys(pattern.byDate).sort();
    pattern.weekdays = new Set(dates.map((date) => new Date(date + "T00:00:00").getDay()));
    pattern.daily = dates.some((date, index) => {
      if (index === 0) return false;
      const previous = new Date(dates[index - 1] + "T00:00:00");
      const current = new Date(date + "T00:00:00");
      return current - previous === 86400000;
    });
    pattern.count = Math.max(...dates.map((date) => pattern.byDate[date].length));
    pattern.rows.sort((a, b) => \`\${a.due_date}-\${a.created_at}\`.localeCompare(\`\${b.due_date}-\${b.created_at}\`));
    pattern.points = pattern.rows[pattern.rows.length - 1]?.points || 0;
    pattern.cursor = 0;
  });

  // Các việc thuộc hàng đợi luân phiên vẫn phải dự báo theo current_index,
  // ngay cả khi lịch gốc trong bảng schedules không còn tồn tại.
  const scheduledQueueIds = new Set(schedules.filter((s) => s.rotation_queue_id).map((s) => s.rotation_queue_id));
  const inferredQueues = {};
  existingTasks
    .filter((task) => task.rotation_queue_id && task.due_date <= todayStr_ && !scheduledQueueIds.has(task.rotation_queue_id))
    .forEach((task) => {
      if (!inferredQueues[task.rotation_queue_id]) inferredQueues[task.rotation_queue_id] = { dates: new Set(), weekdays: new Set() };
      inferredQueues[task.rotation_queue_id].dates.add(task.due_date);
      inferredQueues[task.rotation_queue_id].weekdays.add(new Date(task.due_date + "T00:00:00").getDay());
    });

  Object.values(inferredQueues).forEach((pattern) => {
    const dates = [...pattern.dates].sort();
    pattern.daily = dates.some((date, index) => {
      if (index === 0) return false;
      const previous = new Date(dates[index - 1] + "T00:00:00");
      const current = new Date(date + "T00:00:00");
      return current - previous === 86400000;
    });
  });

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dStr = calDateStrFromDate(d);
    if (dStr <= todayStr_) continue;

    Object.entries(inferredTasks).forEach(([title, pattern]) => {
      if (!pattern.daily && !pattern.weekdays.has(d.getDay())) return;
      if (!occurrencesByDate[dStr]) occurrencesByDate[dStr] = [];
      for (let count = 0; count < pattern.count; count++) {
        const source = pattern.rows[pattern.cursor % pattern.rows.length];
        pattern.cursor += 1;
        occurrencesByDate[dStr].push({
          title,
          assigneeId: source.assigned_to,
          points: pattern.points,
          projected: true,
        });
      }
    });

    Object.entries(inferredQueues).forEach(([queueId, pattern]) => {
      if (!pattern.daily && !pattern.weekdays.has(d.getDay())) return;
      const queue = queueMap[queueId];
      if (!queue || !Array.isArray(queue.member_order) || queue.member_order.length === 0) return;
      const step = queueStep[queueId] || 0;
      const assigneeId = queue.member_order[(queue.current_index + step) % queue.member_order.length];
      queueStep[queueId] = step + 1;
      if (!occurrencesByDate[dStr]) occurrencesByDate[dStr] = [];
      occurrencesByDate[dStr].push({
        title: queue.label,
        assigneeId,
        points: queue.points,
        projected: true,
      });
    });
  }

  return occurrencesByDate;
}

// Vẽ 1 thẻ việc nhỏ (chip) bên trong ô ngày
function calChipHTML(item) {
  const assignee = findProfile(STATE.profiles || [], item.assigneeId);
  const nameShort = assignee ? assignee.name.split(" ").slice(-1)[0] : "";

  let cls = "cal-chip-future";
  if (!item.projected) {
    if (item.status === "hoan_thanh") cls = "cal-chip-done";
    else if (item.status === "bo_lo") cls = "cal-chip-missed";
    else if (item.overdueRequired) cls = "cal-chip-missed";
    else cls = "cal-chip-todo";
  }

  const titleAttr = \`\${item.title}\${assignee ? " — " + assignee.name : ""}\`;
  const label = nameShort ? \`\${escapeHTML(item.title)} · \${escapeHTML(nameShort)}\` : escapeHTML(item.title);
  return \`<div class="cal-chip \${cls}" title="\${escapeHTML(titleAttr)}">\${label}</div>\`;
}

function calCellChipsHTML(items) {
  const visibleItems = (items || []).slice(0, 3);
  const remaining = Math.max(0, (items || []).length - visibleItems.length);
  return visibleItems.map((item) => calChipHTML(item)).join("") + (remaining ? \`<div class="cal-more">+\${remaining} việc khác</div>\` : "");
}

function calEnsureDetailModal() {
  if (document.getElementById("calendar-detail-modal")) return;
  document.body.insertAdjacentHTML("beforeend", \`
    <div class="calendar-detail-modal" id="calendar-detail-modal" aria-hidden="true">
      <div class="calendar-detail-backdrop" data-calendar-close></div>
      <section class="calendar-detail-panel" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title">
        <div class="calendar-detail-head">
          <div>
            <span class="calendar-detail-kicker">Lịch trong ngày</span>
            <h3 id="calendar-detail-title">Chi tiết</h3>
          </div>
          <button class="calendar-detail-close" type="button" data-calendar-close aria-label="Đóng">×</button>
        </div>
        <div class="calendar-detail-list" id="calendar-detail-list"></div>
      </section>
    </div>\`);

  const modal = document.getElementById("calendar-detail-modal");
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-calendar-close]")) calCloseDetailModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") calCloseDetailModal();
  });
}

function calOpenDetailModal(dateStr) {
  calEnsureDetailModal();
  const modal = document.getElementById("calendar-detail-modal");
  const title = document.getElementById("calendar-detail-title");
  const list = document.getElementById("calendar-detail-list");
  const date = new Date(\`\${dateStr}T00:00:00\`);
  const dateLabel = date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const items = calItemsByDate[dateStr] || [];
  title.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  list.innerHTML = items.length
    ? items.map((item) => {
        const assignee = findProfile(STATE.profiles || [], item.assigneeId);
        const status = item.projected ? "Dự kiến" : item.status === "hoan_thanh" ? "Đã hoàn thành" : item.status === "bo_lo" ? "Đã bỏ việc" : item.overdueRequired ? "Bắt buộc chưa hoàn thành" : "Chưa hoàn thành";
        const statusClass = item.projected ? "future" : item.status === "hoan_thanh" ? "done" : item.status === "bo_lo" || item.overdueRequired ? "missed" : "todo";
        return \`
          <div class="calendar-detail-item">
            <div class="calendar-detail-icon \${statusClass}">\${item.projected ? "◷" : item.status === "hoan_thanh" ? "✓" : item.status === "bo_lo" || item.overdueRequired ? "!" : "•"}</div>
            <div class="calendar-detail-body">
              <strong>\${escapeHTML(item.title)}</strong>
              <span>\${assignee ? \`Người làm: \${escapeHTML(assignee.name)}\` : "Chưa có người làm"}</span>
            </div>
            <div class="calendar-detail-meta"><span>\${status}</span>\${item.points ? \`<small>+\${item.points}đ</small>\` : ""}</div>
          </div>\`;
      }).join("")
    : \`<p class="calendar-detail-empty">Ngày này chưa có công việc.</p>\`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function calCloseDetailModal() {
  const modal = document.getElementById("calendar-detail-modal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

async function renderMonthCalendar() {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month-label");
  if (!grid || !label) return;

  if (calViewYear === undefined) calInitState();
  label.textContent = \`\${CAL_MONTH_LABEL[calViewMonth]}, \${calViewYear}\`;

  const daysInMonth = calDaysInMonth(calViewYear, calViewMonth);
  const offset = calMondayOffset(calViewYear, calViewMonth);
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const firstCellDate = new Date(calViewYear, calViewMonth, 1 - offset);
  const rangeStart = calDateStrFromDate(firstCellDate);
  const lastCellDate = new Date(calViewYear, calViewMonth, 1 - offset + totalCells - 1);
  const rangeEnd = calDateStrFromDate(lastCellDate);
  const today = todayStr();

  const historyStartDate = new Date(rangeStart + "T00:00:00");
  historyStartDate.setDate(historyStartDate.getDate() - 90);
  const historyStart = calDateStrFromDate(historyStartDate);
  const [tasks, schedules, queues] = await Promise.all([
    fetchTasksInRange(historyStart, today < rangeEnd ? today : rangeEnd),
    fetchSchedules(),
    fetchRotationQueues(),
  ]);

  const tasksByDate = {};
  tasks.forEach((t) => {
    const displayDate = calendarDisplayDate(t, today);
    if (!tasksByDate[displayDate]) tasksByDate[displayDate] = [];
    tasksByDate[displayDate].push({ ...t, calendarDisplayDate: displayDate });
  });

  const futureByDate = projectFutureOccurrences(schedules, queues, rangeStart, rangeEnd, today, tasks);
  calItemsByDate = {};
  Object.entries(tasksByDate).forEach(([date, dayTasks]) => {
    calItemsByDate[date] = dayTasks.map((task) => ({
      title: task.title,
      status: task.status,
      assigneeId: task.assigned_to,
      points: task.points,
      projected: false,
      overdueRequired: date < today && calendarTaskIsRequired(task) && task.status !== "hoan_thanh" && task.status !== "bo_lo",
    }));
  });
  Object.entries(futureByDate).forEach(([date, items]) => {
    calItemsByDate[date] = [...(calItemsByDate[date] || []), ...items];
  });

  const weekdayHeader = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    .map((d) => \`<div class="cal-weekday">\${d}</div>\`)
    .join("");

  let cellsHTML = "";
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(calViewYear, calViewMonth, 1 - offset + i);
    const dStr = calDateStrFromDate(cellDate);
    const isOutside = cellDate.getMonth() !== calViewMonth;
    const isToday = dStr === today;

    let chipsHTML = "";
    if (dStr <= today) {
      const dayTasks = tasksByDate[dStr] || [];
      chipsHTML = calCellChipsHTML(dayTasks.map((t) => ({
            title: t.title,
            status: t.status,
            assigneeId: t.assigned_to,
            overdueRequired: dStr < today && calendarTaskIsRequired(t) && t.status !== "hoan_thanh" && t.status !== "bo_lo",
          })));
    } else if (dStr > today) {
      const dayFuture = futureByDate[dStr] || [];
      chipsHTML = calCellChipsHTML(dayFuture);
    }

    const cls = ["cal-day", isOutside ? "outside" : "", isToday ? "today" : ""].filter(Boolean).join(" ");
    cellsHTML += \`
      <div class="\${cls}" data-calendar-date="\${dStr}" role="button" tabindex="0" aria-label="Xem chi tiết ngày \${dStr}">
        <div class="cal-day-num">\${cellDate.getDate()}</div>
        <div class="cal-day-chips">\${chipsHTML}</div>
      </div>\`;
  }

  grid.innerHTML = weekdayHeader + cellsHTML;
  if (!grid.dataset.detailBound) {
    grid.dataset.detailBound = "1";
    grid.addEventListener("click", (event) => {
      const day = event.target.closest("[data-calendar-date]");
      if (day) calOpenDetailModal(day.dataset.calendarDate);
    });
    grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const day = event.target.closest("[data-calendar-date]");
      if (day) {
        event.preventDefault();
        calOpenDetailModal(day.dataset.calendarDate);
      }
    });
  }
}

function calGoPrevMonth() {
  calViewMonth -= 1;
  if (calViewMonth < 0) {
    calViewMonth = 11;
    calViewYear -= 1;
  }
  renderMonthCalendar();
}

function calGoNextMonth() {
  calViewMonth += 1;
  if (calViewMonth > 11) {
    calViewMonth = 0;
    calViewYear += 1;
  }
  renderMonthCalendar();
}

function calGoToday() {
  calInitState();
  renderMonthCalendar();
}

function bindCalendarEvents() {
  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  const todayBtn = document.getElementById("cal-today");

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = "1";
    prevBtn.addEventListener("click", calGoPrevMonth);
  }
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", calGoNextMonth);
  }
  if (todayBtn && !todayBtn.dataset.bound) {
    todayBtn.dataset.bound = "1";
    todayBtn.addEventListener("click", calGoToday);
  }
}

async function loadMonthCalendar() {
  if (calViewYear === undefined) calInitState();
  bindCalendarEvents();
  await renderMonthCalendar();
}


// ============================================================
// DASHBOARD.JS — trang "Tổng quan"
// Bổ sung: khối "Trạng thái thành viên hôm nay" + "AI đề xuất"
// (chuyển việc từ người bận/ốm sang người đang rảnh nhất)
// theo đề xuất thiết kế TTBK v2.
// ============================================================

async function fetchRecentActivity(limit = 12) {
  const { data, error } = await supabaseClient
    .from("task_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Không lấy được nhật ký hoạt động:", error.message);
    return [];
  }

  const taskIds = [...new Set((data || []).filter((row) => row.task_id).map((row) => row.task_id))];
  let taskMap = {};

  if (taskIds.length > 0) {
    const { data: tasksData, error: taskErr } = await supabaseClient
      .from("tasks")
      .select("id, title")
      .in("id", taskIds);

    if (!taskErr && Array.isArray(tasksData)) {
      taskMap = Object.fromEntries((tasksData || []).map((task) => [task.id, task]));
    }
  }

  return (data || []).map((row) => {
    const actor = findProfile(STATE.profiles, row.user_id);
    const task = taskMap[row.task_id];
    return {
      ...row,
      actor,
      taskTitle: task?.title || "công việc",
    };
  });
}

function renderActivityLogGroup(rows) {
  const groups = {};
  rows.forEach((row) => {
    const key = businessDateFromISO(row.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const orderedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  return orderedDates
    .map((dateKey) => {
      const dayRows = groups[dateKey].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const dateObj = new Date(dateKey + "T00:00:00");
      const today = todayStr();
      const yesterdayDate = new Date(today + "T00:00:00");
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = \`\${yesterdayDate.getFullYear()}-\${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-\${String(yesterdayDate.getDate()).padStart(2, "0")}\`;
      let label = dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
      if (dateKey === today) label = "Hôm nay";
      else if (dateKey === yesterday) label = "Hôm qua";

      return \`
        <div>
          <div class="day-label">\${label}</div>
          <div class="task-list">
            \${dayRows
              .map((row) => {
                const actorName = row.actor ? escapeHTML(row.actor.name) : "Ai đó";
                const taskName = escapeHTML(row.taskTitle || "công việc");
                const detail = escapeHTML(row.detail || row.action || "Hoạt động");
                const timeLabel = new Date(row.created_at).toLocaleTimeString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return \`
                  <div class="task-ticket" style="border-left-color:\${row.actor?.avatar_color || "#ccc"}">
                    <div class="task-check" style="border:none; font-size:16px;">🕘</div>
                    <div class="task-body">
                      <div class="task-title">\${actorName}: \${detail}</div>
                      <div class="task-meta">
                        <span>\${taskName}</span>
                        <span>\${timeLabel}</span>
                      </div>
                    </div>
                  </div>\`;
              })
              .join("")}
          </div>
        </div>\`;
    })
    .join("");
}

async function renderActivitySection() {
  const container = document.getElementById("activity-log");
  if (!container) return;

  const recentActivity = await fetchRecentActivity(50);
  if (recentActivity.length === 0) {
    container.innerHTML = \`<p class="empty-state">Chưa có hoạt động nào.</p>\`;
    return;
  }

  container.innerHTML = renderActivityLogGroup(recentActivity);
}

// ---------- Trạng thái thành viên hôm nay ----------
// Dùng chung logic status/availability với members.js (STATUS_MAP,
// resolveMemberStatus, estimateAvailability đã định nghĩa ở đó).

function memberStatusRowHTML(p, pendingCount) {
  const status = resolveMemberStatus(p);
  const availability = estimateAvailability(p, pendingCount);
  return \`
    <div class="progress-row">
      <span class="name">\${escapeHTML(p.name)}</span>
      <span style="flex:1;font-size:13px;">\${status.emoji} \${status.label}\${status.reason ? \` · \${escapeHTML(status.reason)}\` : ""}</span>
      <span class="progress-pct">\${availability}%</span>
    </div>\`;
}

// Gợi ý đơn giản: tìm việc chưa xong của người đang bận/ốm/đi xa,
// đề xuất chuyển cho người có độ sẵn sàng cao nhất hiện tại.
// Đây KHÔNG phải thuật toán auto-assign v2 đầy đủ (chưa có lịch học/di
// chuyển thật) — chỉ là gợi ý nhanh trên dashboard.
function buildAiSuggestions(tasks, profiles) {
  const pendingByUser = {};
  tasks
    .filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo")
    .forEach((t) => {
      pendingByUser[t.assigned_to] = (pendingByUser[t.assigned_to] || 0) + 1;
    });

  const scored = profiles.map((p) => ({
    profile: p,
    availability: estimateAvailability(p, pendingByUser[p.id] || 0),
  }));

  const mostAvailable = scored.slice().sort((a, b) => b.availability - a.availability)[0];
  if (!mostAvailable) return [];

  const suggestions = [];
  const today = todayStr();

  tasks
    .filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo" && t.due_date === today)
    .forEach((t) => {
      const owner = profiles.find((p) => p.id === t.assigned_to);
      if (!owner) return;
      const ownerAvailability = estimateAvailability(owner, pendingByUser[owner.id] || 0);
      if (ownerAvailability <= 10 && mostAvailable.profile.id !== owner.id && mostAvailable.availability >= 60) {
        suggestions.push(
          \`Chuyển "\${escapeHTML(t.title)}" từ \${escapeHTML(owner.name)} (\${ownerAvailability}% sẵn sàng) sang \${escapeHTML(mostAvailable.profile.name)} (\${mostAvailable.availability}% sẵn sàng)\`
        );
      }
    });

  return suggestions.slice(0, 4);
}

async function renderDashboard() {
  const container = document.getElementById("dashboard-content");
  const tasks = await fetchTasks();
  const recentActivity = await fetchRecentActivity();
  const today = todayStr();
  const todayTasks = tasks.filter((t) => t.due_date === today);
  const doneToday = todayTasks.filter((t) => t.status === "hoan_thanh").length;
  const notDoneToday = todayTasks.length - doneToday;

  const perPerson = STATE.profiles.map((p) => {
    const assigned = tasks.filter((t) => t.assigned_to === p.id);
    const done = assigned.filter((t) => t.status === "hoan_thanh");
    const pct = assigned.length ? Math.round((done.length / assigned.length) * 100) : 0;
    return { profile: p, pct };
  });

  // Điểm công bằng: việc hoàn thành CỘNG các khoản trừ (bỏ việc, xin đổi việc)
  // từ thứ 2 tuần này trở đi.
  const weekStartDate = mondayOfWeek(today);
  const weekStart = new Date(weekStartDate + "T00:00:00").getTime();
  const weeklyAdjustments = typeof fetchPointAdjustmentsSince === "function"
    ? await fetchPointAdjustmentsSince(new Date(weekStart).toISOString())
    : {};
  const weekly = STATE.profiles.map((p) => {
    const earned = tasks
      .filter((t) => t.assigned_to === p.id && t.status === "hoan_thanh" && t.completed_at && new Date(t.completed_at).getTime() >= weekStart)
      .reduce((sum, t) => sum + (t.points || 0), 0);
    const points = earned + (weeklyAdjustments[p.id] || 0);
    return { profile: p, points };
  });
  const maxPoints = Math.max(1, ...weekly.map((w) => w.points));

  const statsHTML = \`
    <div class="grid-stats">
      <div class="stat wait"><div class="num">\${notDoneToday}</div><div class="label">Việc chưa làm hôm nay</div></div>
      <div class="stat ok"><div class="num">\${doneToday}</div><div class="label">Việc đã hoàn thành hôm nay</div></div>
      <div class="stat"><div class="num">\${tasks.length}</div><div class="label">Tổng số việc trong nhà</div></div>
    </div>\`;

  const pendingByUserCount = {};
  tasks
    .filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo")
    .forEach((t) => {
      pendingByUserCount[t.assigned_to] = (pendingByUserCount[t.assigned_to] || 0) + 1;
    });

  const statusHTML = \`
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">👥 Trạng thái thành viên hôm nay</h3>
      \${STATE.profiles.map((p) => memberStatusRowHTML(p, pendingByUserCount[p.id] || 0)).join("")}
    </div>\`;

  const aiSuggestions = buildAiSuggestions(tasks, STATE.profiles);
  const aiHTML = \`
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">🤖 AI đề xuất</h3>
      \${
        aiSuggestions.length === 0
          ? \`<p class="empty-state" style="padding:6px 0;">Chưa có đề xuất nào — mọi việc hôm nay đang ổn.</p>\`
          : \`<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;">\${aiSuggestions.map((s) => \`<li>\${s}</li>\`).join("")}</ul>\`
      }
    </div>\`;

  const fairnessHTML = \`
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">⚖️ Công bằng tuần này</h3>
      \${weekly
        .map(
          (w) => \`
        <div class="progress-row">
          <span class="name">\${escapeHTML(w.profile.name)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:\${Math.max(0, Math.round((w.points / maxPoints) * 100))}%;background:\${w.profile.avatar_color}"></div></div>
          <span class="progress-pct">\${w.points} đ</span>
        </div>\`
        )
        .join("")}
    </div>\`;

  const progressHTML = \`
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">Tiến độ từng người (tổng số việc đã hoàn thành)</h3>
      \${perPerson
        .map(
          (pp) => \`
        <div class="progress-row">
          <span class="name">\${escapeHTML(pp.profile.name)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:\${pp.pct}%;background:\${pp.profile.avatar_color}"></div></div>
          <span class="progress-pct">\${pp.pct}%</span>
        </div>\`
        )
        .join("")}
    </div>\`;

  // Việc phát sinh / luân phiên đang chờ người được gán bấm "Nhận việc"
  const pending = tasks.filter((t) => t.status === "cho_nhan");
  const pendingHTML = \`
    <div class="card">
      <h3 style="margin-bottom:14px;font-size:15px;">⚡ Việc phát sinh đang chờ nhận</h3>
      \${
        pending.length === 0
          ? \`<p class="empty-state" style="padding:10px 0;">Không có việc nào đang chờ.</p>\`
          : \`<div class="task-list">\${pending.map((t) => taskTicketHTML(t)).join("")}</div>\`
      }
    </div>\`;

  const activityHTML = \`
    <div class="card" style="margin-top:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">📝 Nhật ký hoạt động gần đây</h3>
      \${
        recentActivity.length === 0
          ? \`<p class="empty-state" style="padding:10px 0;">Chưa có hoạt động nào.</p>\`
          : renderActivityLogGroup(recentActivity.slice(0, 6))
      }
    </div>\`;

  container.innerHTML = statsHTML + statusHTML + aiHTML + fairnessHTML + progressHTML + pendingHTML + activityHTML;
  bindTaskEvents("dashboard-content"); // để nút "Nhận việc" trong khối trên hoạt động luôn
}

async function loadActivitySection() {
  await renderActivitySection();
}

async function loadDashboardSection() {
  await renderDashboard();
}


// ============================================================
// MEMBERS.JS — trang "Thành viên"
// Bổ sung: Status Engine nhiều lớp (🟢🟡🔴🤒✈️📚), Sick Mode,
// và "Độ sẵn sàng" ước tính — theo đề xuất thiết kế TTBK v2.
// ============================================================

// Trạng thái chính -> nhãn hiển thị. Ưu tiên: SICK > AWAY > STUDYING > BUSY > AVAILABLE
const STATUS_MAP = {
  SICK: { emoji: "🤒", label: "Bị ốm", bg: "#fdecec", fg: "#b3261e" },
  AWAY: { emoji: "✈️", label: "Đi xa", bg: "#fdf1dc", fg: "#a86b16" },
  STUDYING: { emoji: "📚", label: "Đang học", bg: "#eaf1fd", fg: "#2255a4" },
  BUSY: { emoji: "🔴", label: "Không thể nhận việc", bg: "#fdecec", fg: "#b3261e" },
  AVAILABLE: { emoji: "🟢", label: "Có thể nhận việc", bg: "#eaf8ee", fg: "#1e8a4c" },
};

const BUSY_LEVEL_MAP = {
  0: { emoji: "🟢", label: "Rảnh" },
  1: { emoji: "🟡", label: "Bận nhẹ" },
  2: { emoji: "🟠", label: "Bận" },
  3: { emoji: "🔴", label: "Không khả dụng" },
};

// Gộp trạng thái thật của 1 thành viên, có fallback cho dữ liệu cũ (is_away)
function resolveMemberStatus(p) {
  // Tương thích ngược: nếu chưa có cột status mới nhưng có is_away cũ
  if (!p.status && p.is_away) {
    return { key: "AWAY", ...STATUS_MAP.AWAY, until: p.away_until, reason: null };
  }
  const key = p.status || "AVAILABLE";
  const base = STATUS_MAP[key] || STATUS_MAP.AVAILABLE;

  // Với BUSY thì nhãn phụ thuộc busy_level chi tiết hơn
  if (key === "BUSY" && p.busy_level != null && BUSY_LEVEL_MAP[p.busy_level]) {
    const lvl = BUSY_LEVEL_MAP[p.busy_level];
    return {
      key,
      emoji: p.busy_level >= 2 ? "🔴" : lvl.emoji,
      label: p.busy_level >= 2 ? "Không thể nhận việc" : "Hạn chế nhận việc",
      bg: base.bg,
      fg: base.fg,
      until: p.busy_until,
      reason: p.busy_reason,
    };
  }

  return { key, ...base, until: p.busy_until || p.away_until, reason: p.busy_reason };
}

// Ước tính "độ sẵn sàng" (%) — chỗ này là heuristic đơn giản dựa trên
// status/busy_level + số việc đang treo, KHÔNG phải thuật toán chấm điểm
// đầy đủ có lịch học/di chuyển thật (phần đó nằm ở auto-assign.js).
function estimateAvailability(p, pendingCount) {
  const key = p.status || (p.is_away ? "AWAY" : "AVAILABLE");
  if (key === "SICK" || key === "AWAY") return 0;
  if (key === "STUDYING") return 10;
  const level = p.busy_level ?? 0;
  const base = { 0: 100, 1: 65, 2: 30, 3: 5 }[level] ?? 100;
  const penalty = Math.min(30, pendingCount * 10);
  return Math.max(0, base - penalty);
}

function memberStatusBadgeHTML(status) {
  const untilTxt = status.until ? \` đến \${formatDateShort(status.until)}\` : "";
  const reasonTxt = status.reason ? \` · \${escapeHTML(status.reason)}\` : "";
  return \`<span class="status-badge" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:\${status.bg};color:\${status.fg};font-size:11.5px;font-weight:600;line-height:1.3;">
    <span>\${status.emoji}</span>
    <span>\${status.label}\${reasonTxt}\${untilTxt}</span>
  </span>\`;
}

async function renderMembers() {
  const container = document.getElementById("members-grid");
  const [tasks, pointsMap] = await Promise.all([fetchTasks(), fetchMemberPointsMap()]);

  const html = STATE.profiles
    .map((p) => {
      const assigned = tasks.filter((t) => t.assigned_to === p.id);
      const done = assigned.filter((t) => t.status === "hoan_thanh");
      const missed = assigned.filter((t) => t.status === "bo_lo");
      const pending = assigned.filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo");
      const points = pointsMap[p.id] || 0;

      const status = resolveMemberStatus(p);
      const availability = estimateAvailability(p, pending.length);

      const universityLine = p.university
        ? \`<div class="m-line">📚 \${escapeHTML(p.university)}</div>\`
        : "";

      return \`
      <div class="card member-card">
        <div class="member-head">
          \${avatarHTML(p)}
          <div class="member-identity">
            <div class="m-name-text">\${escapeHTML(p.name)}</div>
          </div>
          <div class="m-points"><div class="n">\${points}</div><div class="l">điểm</div></div>
        </div>
        <div class="member-details">
          \${memberStatusBadgeHTML(status)}
          \${universityLine}
          <div class="m-sub">\${assigned.length} việc • \${done.length} hoàn thành\${missed.length ? \` • \${missed.length} bỏ việc\` : ""}</div>
          <div class="m-sub m-availability">
            <span class="availability-bar">
              <span class="availability-fill" style="width:\${availability}%;background:\${availability >= 60 ? "#1e8a4c" : availability >= 25 ? "#a86b16" : "#b3261e"};"></span>
            </span>
            <span>Độ sẵn sàng: \${availability}%</span>
          </div>
        </div>
      </div>\`;
    })
    .join("");

  container.innerHTML = html || \`<p class="empty-state">Chưa có thành viên nào.</p>\`;
}

async function loadMembersSection() {
  await renderMembers();
}


/* =========================================================================
   js/shopping.js — Module "Nhà cần gì?" (Đồ dùng / Mua sắm / Dự phòng / Định kỳ)
   -------------------------------------------------------------------------
   BẢN SUPABASE: dữ liệu lưu ở bảng shopping_items / shopping_purchase_log /
   expenses (xem sql/007_shopping_and_expenses.sql) — cả nhà cùng thấy 1 bộ
   dữ liệu, không còn mỗi máy 1 kiểu như bản localStorage trước.

   🔧 GIẢ ĐỊNH CẦN KIỂM TRA: file này gọi client Supabase qua sbClient() bên
   dưới, đang thử lần lượt window.sb / window.supabaseClient / window.db.
   Nếu supabase-client.js của bạn đặt tên global khác, sửa 1 dòng trong
   hàm sbClient() cho đúng là chạy được ngay, không cần sửa gì khác.

   Giữ nguyên mọi id/class HTML + API window.TTBK_SHOPPING như bản cũ để
   js/shopping-ai.js không cần sửa gì.
   ========================================================================= */
(function () {
  "use strict";

  function sbClient() {
    return window.sb || window.supabaseClient || window.ttbkSupabase || window.db || null;
  }

  var CATEGORY_LABEL = {
    thuc_pham: "🥦 Thực phẩm",
    tieu_hao: "🧻 Tiêu hao",
    du_phong: "🔋 Dự phòng",
    dinh_ky: "🔧 Định kỳ thay",
    phat_sinh: "⚡ Phát sinh"
  };

  var PLACE_LABEL = {
    sieu_thi: "🛒 Siêu thị",
    cho: "🥬 Chợ",
    tien_loi: "🏪 Tiện lợi",
    online: "🛍️ Online"
  };

  var PRIORITY_LABEL = {
    cao: "🔴 Cao",
    binh_thuong: "🟡 Bình thường",
    thap: "🟢 Thấp"
  };

  function categoryLabel(category) {
    return CATEGORY_LABEL[category] || "📦 Khác";
  }

  function placeLabel(place) {
    return PLACE_LABEL[place] || "Nơi mua chưa chọn";
  }

  /* ------------------------------------------------------------------ *
   * STATE (bộ nhớ đệm trong trình duyệt — nguồn thật là Supabase)       *
   * ------------------------------------------------------------------ */
  var state = { items: [], purchaseLog: [] };
  var profiles = [];       // [{id, name}] — 4 thành viên, lấy từ bảng profiles
  var activeCatFilter = "all";
  var activePlaceFilter = "all";

  /* ------------------------------------------------------------------ *
   * TIỆN ÍCH NGÀY THÁNG / SỐ (giữ nguyên như bản cũ)                    *
   * ------------------------------------------------------------------ */
  function uid() { return "tmp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function daysSince(iso) { return daysBetween(iso, todayISO()); }
  function fmtQty(n) {
    if (n === null || n === undefined) return "";
    var r = Math.round(n * 100) / 100;
    return String(r);
  }
  function currentUserName() {
    var el = document.getElementById("topbar-user");
    var t = el && el.textContent ? el.textContent.trim() : "";
    return t || "Ai đó";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------ *
   * LỚP DỮ LIỆU — Supabase                                              *
   * ------------------------------------------------------------------ */
  function rowToItem(r) {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit || "",
      qty: Number(r.qty) || 0,
      min: Number(r.min) || 0,
      ideal: r.ideal != null ? Number(r.ideal) : null,
      cycleDays: r.cycle_days != null ? Number(r.cycle_days) : null,
      lastRestock: r.last_restock,
      expiryDate: r.expiry_date || null,
      buyPlace: r.buy_place || null,
      manualLevel: r.manual_level,
      manualBy: r.manual_by,
      manualAt: r.manual_at,
      inCart: !!r.in_cart,
      cartPriority: r.cart_priority,
      note: r.note || ""
    };
  }
  function rowToPurchase(r) {
    return {
      id: r.id,
      itemId: r.item_id,
      itemName: r.item_name,
      qty: Number(r.qty),
      cost: r.cost != null ? Number(r.cost) : null,
      paidBy: r.paid_by,
      paidByName: (r.profiles && r.profiles.name) || null,
      date: r.purchase_date
    };
  }

  var SHOP_DB = {
    loadAll: function () {
      var sb = sbClient();
      if (!sb) {
        console.error('[shopping.js] Không tìm thấy Supabase client. Sửa hàm sbClient() ở đầu file js/shopping.js cho đúng tên global bạn đang dùng.');
        return Promise.resolve();
      }
      return Promise.all([
        sb.from("shopping_items").select("*").order("created_at", { ascending: true }),
        sb.from("shopping_purchase_log").select("*, profiles:paid_by(name)").order("purchase_date", { ascending: false }).limit(300),
        sb.from("profiles").select("id,name").order("name", { ascending: true })
      ]).then(function (results) {
        var itemsRes = results[0], logsRes = results[1], profRes = results[2];
        if (itemsRes.error) console.error("[shopping.js] load items:", itemsRes.error.message);
        if (logsRes.error) console.error("[shopping.js] load purchase log:", logsRes.error.message);
        if (profRes.error) console.error("[shopping.js] load profiles:", profRes.error.message);
        state.items = (itemsRes.data || []).map(rowToItem);
        state.purchaseLog = (logsRes.data || []).map(rowToPurchase);
        profiles = profRes.data || [];
      });
    },
    insertItem: function (data) {
      var sb = sbClient(); if (!sb) return Promise.resolve(null);
      var payload = {
        name: data.name, category: data.category, unit: data.unit || null,
        qty: data.qty, min: data.min, ideal: data.ideal, cycle_days: data.cycleDays,
        expiry_date: data.expiryDate || null, buy_place: data.buyPlace || null,
        note: data.note || null
      };
      if (data.category === "dinh_ky") payload.last_restock = todayISO();
      if (data.category === "phat_sinh") { payload.in_cart = true; payload.cart_priority = data.cartPriority || "binh_thuong"; }
      return sb.from("shopping_items").insert(payload).select().single().then(function (res) {
        if (res.error) { alert("Lỗi lưu Supabase: " + res.error.message); return null; }
        return rowToItem(res.data);
      });
    },
    updateItem: function (id, patch) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      return sb.from("shopping_items").update(patch).eq("id", id).then(function (res) {
        if (res.error) alert("Lỗi cập nhật Supabase: " + res.error.message);
      });
    },
    deleteItem: function (id) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      return sb.from("shopping_items").delete().eq("id", id).then(function (res) {
        if (res.error) alert("Lỗi xoá trên Supabase: " + res.error.message);
      });
    },
    insertPurchase: function (entry) {
      var sb = sbClient(); if (!sb) return Promise.resolve(null);
      var payload = {
        item_id: entry.itemId || null, item_name: entry.itemName, qty: entry.qty,
        cost: entry.cost, paid_by: entry.paidBy || null, purchase_date: entry.date || todayISO()
      };
      return sb.from("shopping_purchase_log").insert(payload).select("*, profiles:paid_by(name)").single().then(function (res) {
        if (res.error) { alert("Lỗi lưu lịch sử mua: " + res.error.message); return null; }
        return rowToPurchase(res.data);
      });
    },
    insertExpense: function (entry) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      var payload = {
        description: entry.description, category: entry.category || "shopping",
        amount: entry.amount, paid_by: entry.paidBy || null, expense_date: entry.date || todayISO(),
        source: "shopping", shopping_purchase_id: entry.purchaseId || null
      };
      return sb.from("expenses").insert(payload).then(function (res) {
        if (res.error) console.error("[shopping.js] Không ghi được vào expenses:", res.error.message);
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * LOGIC TRẠNG THÁI / DỰ ĐOÁN (giữ nguyên logic bản cũ)                *
   * ------------------------------------------------------------------ */
  function computeStatus(item) {
    var base = computeBaseStatus(item);
    return applyExpiry(item, base);
  }

  function computeBaseStatus(item) {
    if (item.category === "dinh_ky") {
      if (!item.lastRestock || !item.cycleDays) {
        return { level: "unknown", emoji: "⚪", label: "Chưa có dữ liệu chu kỳ" };
      }
      var elapsed = daysSince(item.lastRestock);
      var remain = item.cycleDays - elapsed;
      if (remain <= 0) return { level: "het", emoji: "🔴", label: "Đã quá hạn thay " + Math.abs(remain) + " ngày" };
      if (remain <= Math.max(7, Math.round(item.cycleDays * 0.15))) return { level: "sap_het", emoji: "🟡", label: "Còn khoảng " + remain + " ngày là đến hạn thay" };
      return { level: "on", emoji: "🟢", label: "Còn khoảng " + remain + " ngày" };
    }

    if (item.manualLevel) {
      var map = {
        on: { level: "on", emoji: "🟢", label: "Còn nhiều (báo tay)" },
        sap_het: { level: "sap_het", emoji: "🟡", label: "Sắp hết (báo tay)" },
        het: { level: "het", emoji: "🔴", label: "Đã hết (báo tay)" }
      };
      return map[item.manualLevel];
    }

    if (item.qty <= 0) return { level: "het", emoji: "🔴", label: "Đã hết" };
    if (item.qty <= item.min) return { level: "sap_het", emoji: "🟡", label: "Sắp hết" };
    return { level: "on", emoji: "🟢", label: "Còn đủ" };
  }

  // Hạn sử dụng chỉ LÀM NẶNG THÊM trạng thái (không bao giờ làm nhẹ đi):
  // quá hạn -> luôn 🔴 dù còn số lượng; sắp hết hạn -> ít nhất 🟡.
  function applyExpiry(item, base) {
    if (!item.expiryDate || item.category === "dinh_ky") return base;
    var remain = daysBetween(todayISO(), item.expiryDate);
    if (remain < 0) {
      return { level: "het", emoji: "🔴", label: "Đã hết hạn dùng " + Math.abs(remain) + " ngày trước" };
    }
    if (remain <= 2 && base.level === "on") {
      return { level: "sap_het", emoji: "🟡", label: "Sắp hết hạn (còn " + remain + " ngày)" };
    }
    return base;
  }

  function needsBackup(item) {
    return item.category === "du_phong" && computeStatus(item).level !== "on";
  }

  function avgCycleDays(item) {
    var logs = state.purchaseLog
      .filter(function (l) { return l.itemId === item.id; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (logs.length < 2) return item.cycleDays || null;
    var gaps = [];
    for (var i = 1; i < logs.length; i++) gaps.push(daysBetween(logs[i - 1].date, logs[i].date));
    var sum = gaps.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / gaps.length);
  }

  function predictedNudge(item) {
    if (item.category === "dinh_ky" || item.category === "phat_sinh") return null;
    if (!item.lastRestock) return null;
    var cyc = avgCycleDays(item);
    if (!cyc) return null;
    var remain = cyc - daysSince(item.lastRestock);
    if (remain <= 0) return null;
    if (remain <= Math.max(3, Math.round(cyc * 0.2))) {
      return "🟡 Có vẻ sẽ hết trong khoảng " + remain + " ngày nữa (theo chu kỳ mua trung bình " + cyc + " ngày).";
    }
    return null;
  }

  function suggestedBuyQty(item) {
    var target = item.ideal || (item.min * 2) || 1;
    var need = target - item.qty;
    return need > 0 ? Math.ceil(need * 10) / 10 : 1;
  }

  function isSuggested(item) {
    if (item.inCart) return false;
    var st = computeStatus(item);
    return st.level === "het" || st.level === "sap_het" || needsBackup(item);
  }

  function suggestedPriority(item) {
    var st = computeStatus(item);
    return (st.level === "het") ? "cao" : "binh_thuong";
  }

  /* ------------------------------------------------------------------ *
   * RENDER: TỔNG QUAN                                                   *
   * ------------------------------------------------------------------ */
  function renderOverview() {
    var host = document.getElementById("shop-overview");
    if (!host) return;

    var hetCount = 0, sapHetCount = 0, duPhongThieu = 0, canThay = 0;
    state.items.forEach(function (it) {
      var st = computeStatus(it);
      if (it.category === "dinh_ky") {
        if (st.level !== "on") canThay++;
      } else if (it.category === "du_phong") {
        if (st.level !== "on") duPhongThieu++;
      } else {
        if (st.level === "het") hetCount++;
        else if (st.level === "sap_het") sapHetCount++;
      }
    });
    var dangChoMua = state.items.filter(function (it) { return it.inCart; }).length;

    host.innerHTML =
      '<div class="shop-overview-grid">' +
        overviewCell(hetCount, "🔴 Đã hết") +
        overviewCell(sapHetCount, "🟡 Sắp hết") +
        overviewCell(duPhongThieu, "⚠️ Thiếu dự phòng") +
        overviewCell(canThay, "🔧 Cần thay") +
        overviewCell(dangChoMua, "🛒 Đang chờ mua") +
      "</div>";

    var badge = document.getElementById("shop-nav-badge");
    if (badge) {
      var total = hetCount + sapHetCount + duPhongThieu + canThay;
      if (total > 0) { badge.style.display = "inline-block"; badge.textContent = String(total); }
      else badge.style.display = "none";
    }
  }
  function overviewCell(n, label) {
    return '<div class="shop-overview-cell"><b>' + n + "</b><span>" + label + "</span></div>";
  }

  /* ------------------------------------------------------------------ *
   * RENDER: DANH SÁCH ĐỒ DÙNG                                           *
   * ------------------------------------------------------------------ */
  function renderItemsGrid() {
    var host = document.getElementById("shop-items-grid");
    if (!host) return;
    var list = state.items.filter(function (it) {
      return activeCatFilter === "all" || it.category === activeCatFilter;
    });
    if (!list.length) { host.innerHTML = '<p class="empty-state">Chưa có món nào trong mục này.</p>'; return; }

    host.innerHTML = list.map(function (it) {
      var st = computeStatus(it);
      var nudge = predictedNudge(it);
      var isQtyBased = it.category !== "dinh_ky";
      var qtyLine = isQtyBased
        ? ("Hiện có: <b>" + fmtQty(it.qty) + " " + escapeHtml(it.unit || "") + "</b>"
           + " · Ngưỡng: " + fmtQty(it.min)
           + (it.ideal ? " · Nên có: " + fmtQty(it.ideal) : ""))
        : ("Đã dùng " + (it.lastRestock ? daysSince(it.lastRestock) : "?") + " ngày"
           + (it.cycleDays ? " / chu kỳ " + it.cycleDays + " ngày" : ""));

      var manualRow = isQtyBased
        ? '<div class="shop-quickrow">' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="on">🟢 Còn nhiều</button>' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="sap_het">🟡 Sắp hết</button>' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="het">🔴 Hết</button>' +
          "</div>"
        : "";

      var qtyButtons = isQtyBased
        ? '<div class="shop-quickrow">' +
            '<button class="qty-btn" data-act="dec" data-id="' + it.id + '">－1</button>' +
            '<button class="qty-btn" data-act="inc" data-id="' + it.id + '">＋1</button>' +
          "</div>"
        : '<div class="shop-quickrow"><button data-act="replaced" data-id="' + it.id + '">✅ Vừa thay</button></div>';

      var reporter = it.manualLevel && it.manualBy
        ? '<div class="shop-reporter">🧑 ' + escapeHtml(it.manualBy) + " báo lúc " + escapeHtml(it.manualAt || "") + "</div>"
        : "";

      var placeTag = it.buyPlace ? (" · " + placeLabel(it.buyPlace)) : "";
      var expiryTag = it.expiryDate ? (" · HSD: " + it.expiryDate) : "";

      return (
        '<div class="shop-item-card">' +
          '<div class="shop-item-top">' +
            "<h4>" + escapeHtml(it.name) + "</h4>" +
            '<span class="shop-badge shop-badge-' + st.level + '">' + st.emoji + " " + st.label + "</span>" +
          "</div>" +
          '<div class="shop-meta">' + categoryLabel(it.category) + " · " + qtyLine + placeTag + expiryTag + "</div>" +
          (nudge ? '<div class="shop-note">' + nudge + "</div>" : "") +
          (it.note ? '<div class="shop-note">📝 ' + escapeHtml(it.note) + "</div>" : "") +
          reporter +
          manualRow +
          qtyButtons +
          '<div class="shop-actrow">' +
            (it.inCart
              ? '<button class="btn btn-ghost btn-sm" disabled>Đã trong danh sách mua</button>'
              : '<button class="btn btn-ghost btn-sm" data-act="addcart" data-id="' + it.id + '">🛒 Thêm vào danh sách mua</button>') +
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + it.id + '">✏️ Sửa</button>' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + it.id + '">🗑️</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER: DANH SÁCH MUA (CART)                                        *
   * ------------------------------------------------------------------ */
  function lastKnownCost(itemId) {
    var logs = state.purchaseLog.filter(function (l) { return l.itemId === itemId && l.cost != null; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return logs.length ? logs[0].cost : null;
  }

  function renderCart() {
    var host = document.getElementById("shop-cart-list");
    var summaryEl = document.getElementById("shop-cart-summary");
    if (!host) return;

    var inCart = state.items.filter(function (it) { return it.inCart; });
    var filtered = inCart.filter(function (it) {
      return activePlaceFilter === "all" || it.buyPlace === activePlaceFilter;
    });

    if (summaryEl) {
      if (!inCart.length) {
        summaryEl.textContent = "";
      } else {
        var estTotal = filtered.reduce(function (s, it) {
          var c = lastKnownCost(it.id);
          return c ? s + c : s;
        }, 0);
        summaryEl.textContent = filtered.length + " món" +
          (activePlaceFilter !== "all" ? " ở " + placeLabel(activePlaceFilter) : "") +
          (estTotal > 0 ? " — khoảng " + Math.round(estTotal).toLocaleString("vi-VN") + "đ (ước tính theo giá lần mua gần nhất)" : "");
      }
    }

    if (!inCart.length) { host.innerHTML = '<p class="empty-state">Chưa có gì trong danh sách mua. Bấm "Đưa tất cả gợi ý vào danh sách mua" ở trên nếu có món sắp hết.</p>'; return; }
    if (!filtered.length) { host.innerHTML = '<p class="empty-state">Không có món nào ở nơi mua này. Chọn "Tất cả nơi mua" để xem hết.</p>'; return; }

    var cao = filtered.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) === "cao"; });
    var thuong = filtered.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) !== "cao"; });

    function row(it) {
      var qtyNeed = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
      var placeTag = it.buyPlace ? (" · " + placeLabel(it.buyPlace)) : "";
      return (
        '<div class="task-card shop-cart-row" data-id="' + it.id + '">' +
          "<div><b>" + escapeHtml(it.name) + "</b> — cần khoảng " + fmtQty(qtyNeed) + " " + escapeHtml(it.unit || "") +
          '<div class="shop-note">' + categoryLabel(it.category) + placeTag + "</div></div>" +
          '<div class="btn-row" style="margin:0;">' +
            '<button class="btn btn-primary btn-sm" data-act="buy" data-id="' + it.id + '">✅ Đã mua</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="uncart" data-id="' + it.id + '">Bỏ khỏi danh sách</button>' +
          "</div>" +
        "</div>"
      );
    }

    var html = "";
    if (cao.length) html += '<div class="shop-cart-group-title">Ưu tiên cao</div>' + cao.map(row).join("");
    if (thuong.length) html += '<div class="shop-cart-group-title">Có thể mua cùng</div>' + thuong.map(row).join("");
    host.innerHTML = html;
  }

  /* ------------------------------------------------------------------ *
   * RENDER: LỊCH THAY                                                   *
   * ------------------------------------------------------------------ */
  function renderReplace() {
    var host = document.getElementById("shop-replace-list");
    if (!host) return;
    var list = state.items.filter(function (it) { return it.category === "dinh_ky"; });
    if (!list.length) { host.innerHTML = '<p class="empty-state">Chưa có đồ định kỳ thay. Thêm ở mục "Đồ dùng" với loại "Định kỳ thay".</p>'; return; }

    host.innerHTML = list.map(function (it) {
      var st = computeStatus(it);
      return (
        '<div class="task-card shop-cart-row">' +
          "<div><b>" + escapeHtml(it.name) + "</b> — " + st.label +
          '<div class="shop-note">Chu kỳ ' + (it.cycleDays || "?") + " ngày · lần cuối: " + (it.lastRestock || "chưa có") + "</div></div>" +
          '<button class="btn btn-primary btn-sm" data-act="replaced" data-id="' + it.id + '">✅ Vừa thay</button>' +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER: LỊCH SỬ — giờ hiện thêm luôn người trả tiền                 *
   * ------------------------------------------------------------------ */
  function renderHistory() {
    var host = document.getElementById("shop-history-list");
    if (!host) return;
    var logs = state.purchaseLog.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!logs.length) { host.innerHTML = '<p class="empty-state">Chưa có lịch sử mua/thay đồ nào.</p>'; return; }
    host.innerHTML = logs.slice(0, 100).map(function (l) {
      return (
        '<div class="task-card shop-cart-row">' +
          "<div><b>" + escapeHtml(l.itemName) + "</b> — số lượng " + fmtQty(l.qty) +
          (l.cost ? " · " + Number(l.cost).toLocaleString("vi-VN") + "đ" : "") +
          (l.paidByName ? " · 🧑 " + escapeHtml(l.paidByName) + " trả" : "") +
          '<div class="shop-note">' + l.date + "</div></div>" +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER TỔNG                                                         *
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderOverview();
    renderItemsGrid();
    renderCart();
    renderReplace();
    renderHistory();
    injectDashboardCard();
  }

  /* ------------------------------------------------------------------ *
   * THẺ TÓM TẮT TRÊN TRANG "TỔNG QUAN" (giữ nguyên như bản cũ)          *
   * ------------------------------------------------------------------ */
  function injectDashboardCard() {
    var host = document.getElementById("dashboard-content");
    if (!host) return;

    var hetCount = 0, sapHetCount = 0, duPhongThieu = 0;
    state.items.forEach(function (it) {
      var st = computeStatus(it);
      if (it.category === "du_phong") { if (st.level !== "on") duPhongThieu++; }
      else if (it.category !== "dinh_ky") {
        if (st.level === "het") hetCount++;
        else if (st.level === "sap_het") sapHetCount++;
      }
    });
    var cartCount = state.items.filter(function (it) { return it.inCart; }).length;

    var card = document.getElementById("shop-dashboard-card");
    if (!card) {
      card = document.createElement("div");
      card.className = "card";
      card.id = "shop-dashboard-card";
      card.style.marginTop = "18px";
    }
    card.innerHTML =
      '<h3 style="font-size:15px;margin-bottom:10px;">🏠 Tình trạng đồ dùng</h3>' +
      '<div class="shop-overview-grid">' +
        overviewCell(hetCount, "🔴 Đã hết") +
        overviewCell(sapHetCount, "🟡 Sắp hết") +
        overviewCell(duPhongThieu, "⚠️ Thiếu dự phòng") +
      "</div>" +
      '<div class="btn-row" style="margin-top:14px;">' +
        '<button class="btn btn-ghost btn-sm" id="shop-dash-goto">Xem danh sách →</button>' +
      "</div>" +
      (cartCount ? '<p class="shop-note" style="margin-top:8px;">🛒 ' + cartCount + " món đang chờ mua.</p>" : "");

    if (card.parentElement !== host) host.appendChild(card);

    var goto = document.getElementById("shop-dash-goto");
    if (goto) goto.onclick = function () {
      var navBtn = document.querySelector('.nav-item[data-section="shopping"]');
      if (navBtn) navBtn.click();
    };
  }

  (function watchDashboard() {
    var host = document.getElementById("dashboard-content");
    if (!host || !window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!document.getElementById("shop-dashboard-card")) injectDashboardCard();
    });
    obs.observe(host, { childList: true });
  })();

  /* ------------------------------------------------------------------ *
   * HÀNH ĐỘNG (event delegation) — giờ hầu hết là async (gọi Supabase)  *
   * ------------------------------------------------------------------ */
  function findItem(id) { return state.items.filter(function (it) { return it.id === id; })[0]; }

  function onGridClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    var it = findItem(id);
    if (!it) return;

    switch (act) {
      case "inc": {
        var q1 = Math.round((it.qty + 1) * 100) / 100;
        it.qty = q1; it.manualLevel = null; renderAll();
        SHOP_DB.updateItem(id, { qty: q1, manual_level: null });
        break;
      }
      case "dec": {
        var q2 = Math.max(0, Math.round((it.qty - 1) * 100) / 100);
        it.qty = q2; it.manualLevel = null; renderAll();
        SHOP_DB.updateItem(id, { qty: q2, manual_level: null });
        break;
      }
      case "lvl": {
        var lvl = btn.getAttribute("data-lvl");
        var by = currentUserName();
        var at = new Date().toLocaleString("vi-VN");
        it.manualLevel = lvl; it.manualBy = by; it.manualAt = at;
        var patch = { manual_level: lvl, manual_by: by, manual_at: at };
        if (lvl !== "on" && !it.inCart) {
          it.inCart = true;
          it.cartPriority = lvl === "het" ? "cao" : "binh_thuong";
          patch.in_cart = true; patch.cart_priority = it.cartPriority;
        }
        renderAll();
        SHOP_DB.updateItem(id, patch);
        break;
      }
      case "replaced": {
        var today = todayISO();
        it.lastRestock = today;
        renderAll();
        SHOP_DB.updateItem(id, { last_restock: today }).then(function () {
          return SHOP_DB.insertPurchase({ itemId: it.id, itemName: it.name, qty: 1, cost: null, paidBy: null, date: today });
        }).then(function (p) { if (p) { state.purchaseLog.unshift(p); renderAll(); } });
        break;
      }
      case "addcart": {
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        renderAll();
        SHOP_DB.updateItem(id, { in_cart: true, cart_priority: it.cartPriority });
        if (typeof showToast === "function") showToast("🛒 Đã thêm vào danh sách mua");
        break;
      }
      case "uncart": {
        it.inCart = false;
        renderAll();
        SHOP_DB.updateItem(id, { in_cart: false });
        if (typeof showToast === "function") showToast("Đã bỏ khỏi danh sách mua");
        break;
      }
      case "edit":
        openItemForm(it);
        break;
      case "del":
        if (confirm('Xoá "' + it.name + '" khỏi danh sách đồ dùng?')) {
          state.items = state.items.filter(function (x) { return x.id !== it.id; });
          renderAll();
          SHOP_DB.deleteItem(id);
          if (typeof showToast === "function") showToast("🗑 Đã xoá \\"" + it.name + "\\"", "error");
        }
        break;
      case "buy":
        openBuyForm(it);
        break;
    }
  }

  /* ------------------------------------------------------------------ *
   * FORM: XÁC NHẬN ĐÃ MUA — nhập số lượng, giá, VÀ ai trả tiền          *
   * (thay cho chuỗi prompt() cũ — giờ ghi thẳng vào bảng expenses)      *
   * ------------------------------------------------------------------ */
  function fillPayerSelect() {
    var sel = document.getElementById("buy-payer");
    if (!sel) return;
    sel.innerHTML = '<option value="">— Chọn người trả —</option>' +
      profiles.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>"; }).join("");
  }

  function openBuyForm(it) {
    fillPayerSelect();
    document.getElementById("buy-item-id").value = it.id;
    document.getElementById("buy-item-name").textContent = it.name;
    var suggestion = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
    document.getElementById("buy-qty").value = fmtQty(suggestion);
    document.getElementById("buy-cost").value = "";
    document.getElementById("buy-payer").value = "";
    var form = document.getElementById("shop-buy-form");
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeBuyForm() { document.getElementById("shop-buy-form").style.display = "none"; }

  function confirmBuy() {
    var id = document.getElementById("buy-item-id").value;
    var it = findItem(id);
    if (!it) return;

    var qty = parseFloat(document.getElementById("buy-qty").value.toString().replace(",", "."));
    if (isNaN(qty) || qty <= 0) { alert("Số lượng không hợp lệ."); return; }

    var costStr = document.getElementById("buy-cost").value;
    var cost = costStr && !isNaN(parseFloat(costStr)) ? parseFloat(costStr) : null;
    var payerId = document.getElementById("buy-payer").value || null;

    if (cost && !payerId) { alert("Bạn đã nhập giá tiền — chọn giúp ai là người trả nhé."); return; }

    var today = todayISO();
    var newQty = Math.round((it.qty + qty) * 100) / 100;

    it.qty = newQty; it.lastRestock = today; it.inCart = false; it.manualLevel = null;
    closeBuyForm();
    renderAll();

    SHOP_DB.updateItem(id, { qty: newQty, last_restock: today, in_cart: false, manual_level: null })
      .then(function () {
        return SHOP_DB.insertPurchase({ itemId: it.id, itemName: it.name, qty: qty, cost: cost, paidBy: payerId, date: today });
      })
      .then(function (purchase) {
        if (purchase) { state.purchaseLog.unshift(purchase); renderAll(); }
        if (typeof showToast === "function") showToast("✅ Đã ghi nhận mua \\"" + it.name + "\\"");
        if (cost && payerId) {
          return SHOP_DB.insertExpense({
            description: it.name, category: "shopping", amount: cost,
            paidBy: payerId, date: today, purchaseId: purchase ? purchase.id : null
          });
        }
      });
  }

  /* ------------------------------------------------------------------ *
   * FORM: THÊM / SỬA ĐỒ DÙNG                                            *
   * ------------------------------------------------------------------ */
  function openItemForm(item) {
    var form = document.getElementById("shop-item-form");
    document.getElementById("shop-adhoc-form").style.display = "none";
    document.getElementById("shop-buy-form").style.display = "none";
    document.getElementById("shop-item-form-title").textContent = item ? "Sửa đồ dùng" : "Thêm đồ dùng";
    document.getElementById("si-id").value = item ? item.id : "";
    document.getElementById("si-name").value = item ? item.name : "";
    document.getElementById("si-category").value = item ? item.category : "tieu_hao";
    document.getElementById("si-qty").value = item ? item.qty : 1;
    document.getElementById("si-unit").value = item ? item.unit : "";
    document.getElementById("si-min").value = item ? item.min : 1;
    document.getElementById("si-ideal").value = item && item.ideal ? item.ideal : "";
    document.getElementById("si-cycle").value = item && item.cycleDays ? item.cycleDays : "";
    document.getElementById("si-expiry").value = item && item.expiryDate ? item.expiryDate : "";
    document.getElementById("si-place").value = item && item.buyPlace ? item.buyPlace : "";
    document.getElementById("si-note").value = item ? item.note : "";
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeItemForm() { document.getElementById("shop-item-form").style.display = "none"; }

  function saveItemForm() {
    var id = document.getElementById("si-id").value;
    var name = document.getElementById("si-name").value.trim();
    if (!name) { alert("Nhập tên món đã."); return; }
    var data = {
      name: name,
      category: document.getElementById("si-category").value,
      qty: parseFloat(document.getElementById("si-qty").value) || 0,
      unit: document.getElementById("si-unit").value.trim(),
      min: parseFloat(document.getElementById("si-min").value) || 0,
      ideal: document.getElementById("si-ideal").value ? parseFloat(document.getElementById("si-ideal").value) : null,
      cycleDays: document.getElementById("si-cycle").value ? parseInt(document.getElementById("si-cycle").value, 10) : null,
      expiryDate: document.getElementById("si-expiry").value || null,
      buyPlace: document.getElementById("si-place").value || null,
      note: document.getElementById("si-note").value.trim()
    };
    if (id) {
      var it = findItem(id);
      Object.assign(it, data);
      closeItemForm();
      renderAll();
      SHOP_DB.updateItem(id, {
        name: data.name, category: data.category, qty: data.qty, unit: data.unit || null,
        min: data.min, ideal: data.ideal, cycle_days: data.cycleDays,
        expiry_date: data.expiryDate, buy_place: data.buyPlace, note: data.note || null
      });
      if (typeof showToast === "function") showToast("Đã lưu \\"" + data.name + "\\"");
    } else {
      closeItemForm();
      SHOP_DB.insertItem(data).then(function (newItem) {
        if (newItem) { state.items.push(newItem); renderAll(); }
        if (typeof showToast === "function") showToast("Đã thêm \\"" + data.name + "\\"");
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * FORM: PHÁT SINH NHANH                                               *
   * ------------------------------------------------------------------ */
  function openAdhocForm() {
    document.getElementById("shop-item-form").style.display = "none";
    document.getElementById("shop-buy-form").style.display = "none";
    document.getElementById("sa-name").value = "";
    document.getElementById("sa-qty").value = 1;
    document.getElementById("sa-priority").value = "binh_thuong";
    document.getElementById("sa-note").value = "";
    var form = document.getElementById("shop-adhoc-form");
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeAdhocForm() { document.getElementById("shop-adhoc-form").style.display = "none"; }

  function saveAdhoc() {
    var name = document.getElementById("sa-name").value.trim();
    if (!name) { alert("Nhập tên món đã."); return; }
    var qty = parseFloat(document.getElementById("sa-qty").value) || 1;
    var priority = document.getElementById("sa-priority").value;
    var note = document.getElementById("sa-note").value.trim();
    var data = { name: name, category: "phat_sinh", qty: qty, unit: "", min: 0, ideal: null, cycleDays: null, note: note, cartPriority: priority };
    closeAdhocForm();
    SHOP_DB.insertItem(data).then(function (newItem) {
      if (newItem) { state.items.push(newItem); switchShopTab("cart"); renderAll(); }
      if (typeof showToast === "function") showToast("Đã thêm \\"" + name + "\\" vào danh sách mua");
    });
  }

  /* ------------------------------------------------------------------ *
   * TABS / FILTER                                                       *
   * ------------------------------------------------------------------ */
  function switchShopTab(tab) {
    document.querySelectorAll(".shop-tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-shoptab") === tab);
    });
    ["items", "cart", "ai", "replace", "history"].forEach(function (t) {
      var panel = document.getElementById("shop-panel-" + t);
      if (panel) panel.style.display = (t === tab) ? "block" : "none";
    });
  }

  function addAllSuggested() {
    var added = [];
    state.items.forEach(function (it) {
      if (isSuggested(it)) {
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        added.push(it);
      }
    });
    renderAll();
    switchShopTab("cart");
    added.forEach(function (it) {
      SHOP_DB.updateItem(it.id, { in_cart: true, cart_priority: it.cartPriority });
    });
    if (typeof showToast === "function") {
      showToast(added.length ? ("🛒 Đã thêm " + added.length + " món vào danh sách mua") : "Không có món nào cần thêm");
    }
  }

  /* ------------------------------------------------------------------ *
   * ĐỒNG BỘ TRỰC TIẾP GIỮA CÁC THÀNH VIÊN (Supabase Realtime)           *
   * ------------------------------------------------------------------ */
  function subscribeRealtime() {
    var sb = sbClient();
    if (!sb || !sb.channel) return;
    var pending = null;
    function debouncedReload() {
      if (pending) clearTimeout(pending);
      pending = setTimeout(function () {
        SHOP_DB.loadAll().then(renderAll);
      }, 400);
    }
    sb.channel("shopping-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_purchase_log" }, debouncedReload)
      .subscribe();
  }

  /* ------------------------------------------------------------------ *
   * KHỞI TẠO                                                            *
   * ------------------------------------------------------------------ */
  function init() {
    if (!document.getElementById("section-shopping")) return; // trang không có module này

    document.getElementById("shop-btn-additem").addEventListener("click", function () { openItemForm(null); });
    document.getElementById("shop-btn-adhoc").addEventListener("click", openAdhocForm);
    document.getElementById("shop-item-save").addEventListener("click", saveItemForm);
    document.getElementById("shop-item-cancel").addEventListener("click", closeItemForm);
    document.getElementById("shop-adhoc-save").addEventListener("click", saveAdhoc);
    document.getElementById("shop-adhoc-cancel").addEventListener("click", closeAdhocForm);
    document.getElementById("shop-btn-addall").addEventListener("click", addAllSuggested);
    document.getElementById("buy-confirm").addEventListener("click", confirmBuy);
    document.getElementById("buy-cancel").addEventListener("click", closeBuyForm);

    document.getElementById("shop-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-shoptab]");
      if (b) switchShopTab(b.getAttribute("data-shoptab"));
    });

    document.getElementById("shop-cat-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      activeCatFilter = b.getAttribute("data-cat");
      document.querySelectorAll("#shop-cat-filter .shop-chip").forEach(function (c) { c.classList.remove("active"); });
      b.classList.add("active");
      renderItemsGrid();
    });

    document.getElementById("shop-place-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-place]");
      if (!b) return;
      activePlaceFilter = b.getAttribute("data-place");
      document.querySelectorAll("#shop-place-filter .shop-chip").forEach(function (c) { c.classList.remove("active"); });
      b.classList.add("active");
      renderCart();
    });

    document.getElementById("shop-items-grid").addEventListener("click", onGridClick);
    document.getElementById("shop-cart-list").addEventListener("click", onGridClick);
    document.getElementById("shop-replace-list").addEventListener("click", onGridClick);

    // Giai đoạn 2 — vuốt phải để mở form "Đã mua", vuốt trái để bỏ khỏi
    // danh sách mua, ngay trên từng dòng (chỉ hoạt động bằng cảm ứng).
    if (typeof enableSwipeActions === "function") {
      enableSwipeActions(document.getElementById("shop-cart-list"), {
        itemSelector: ".shop-cart-row",
        rightSelector: '[data-act="buy"]',
        leftSelector: '[data-act="uncart"]',
        rightLabel: "✅ Đã mua",
        leftLabel: "✕ Bỏ khỏi ds",
      });
    }

    SHOP_DB.loadAll().then(function () {
      fillPayerSelect();
      renderAll();
      subscribeRealtime();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose để shopping-ai.js và các module khác móc vào — giữ đúng hình dạng như bản cũ.
  window.TTBK_SHOPPING = {
    state: state,
    renderAll: renderAll,
    computeStatus: computeStatus,
    addAllSuggested: addAllSuggested
  };
})();


/* =========================================================================
   js/shopping-ai.js — Lớp bổ sung cho module "Nhà cần gì?"
   -------------------------------------------------------------------------
   KHÔNG sửa js/shopping.js. Chỉ đọc window.TTBK_SHOPPING.state (đã được
   shopping.js tự expose ở cuối file) để:
     1) Tính số chi tiêu đồ dùng thật (từ state.purchaseLog[].cost) cho thẻ
        "Liên kết Chi tiêu" (#shop-expense-*).
     2) Tính gợi ý AI thật (#shop-ai-grid) — dự đoán sắp hết, cặp món hay
        mua cùng nhau, thiếu đồ dự phòng, ngân sách trung bình — thay cho
        4 thẻ ví dụ tĩnh trước đây.

   Cách tự cập nhật: shopping.js gọi renderOverview() (ghi lại #shop-overview)
   sau MỌI thao tác (renderAll()). Ta gắn MutationObserver lên #shop-overview
   để "ăn theo" mốc đó, không cần sửa hay gọi lại gì trong shopping.js.
   ========================================================================= */
(function () {
  "use strict";

  function getState() {
    return window.TTBK_SHOPPING && window.TTBK_SHOPPING.state;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtVND(n) { return Math.round(n).toLocaleString("vi-VN") + "đ"; }
  function monthKey(iso) { return iso ? iso.slice(0, 7) : ""; }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function daysSince(iso) { return daysBetween(iso, new Date().toISOString().slice(0, 10)); }

  /* ---------------------------------------------------------------- *
   * Thẻ "Liên kết Chi tiêu" — tính từ state.purchaseLog[].cost thật   *
   * ---------------------------------------------------------------- */
  function updateExpenseCard() {
    var st = getState();
    var amountEl = document.getElementById("shop-expense-month-amount");
    var noteEl = document.getElementById("shop-expense-avg-note");
    if (!st || !amountEl || !noteEl) return;

    var logs = (st.purchaseLog || []).filter(function (l) { return l.cost; });
    var curKey = new Date().toISOString().slice(0, 7);
    var thisMonthTotal = logs
      .filter(function (l) { return monthKey(l.date) === curKey; })
      .reduce(function (s, l) { return s + Number(l.cost); }, 0);

    var byMonth = {};
    logs.forEach(function (l) {
      var k = monthKey(l.date);
      byMonth[k] = (byMonth[k] || 0) + Number(l.cost);
    });
    var months = Object.keys(byMonth);

    amountEl.innerHTML = thisMonthTotal > 0
      ? "<b>" + fmtVND(thisMonthTotal) + "</b><span>tháng này</span>"
      : "<b>—</b><span>chưa có khoản nào tháng này</span>";

    if (months.length >= 2) {
      var avg = months.reduce(function (s, k) { return s + byMonth[k]; }, 0) / months.length;
      noteEl.textContent = "Trung bình " + fmtVND(avg) + "/tháng, tính trên " + months.length + " tháng đã có giá.";
    } else if (months.length === 1) {
      noteEl.textContent = "Mới có dữ liệu 1 tháng — mua thêm vài lần có ghi giá để tính được trung bình.";
    } else {
      noteEl.textContent = 'Bấm "✅ Đã mua" ở Danh sách mua và nhập giá tiền để bắt đầu theo dõi chi phí ở đây.';
    }
  }

  /* ---------------------------------------------------------------- *
   * Tab "🧠 AI gợi ý" — tính từ state.items + state.purchaseLog thật  *
   * ---------------------------------------------------------------- */
  function avgCycle(item, logs) {
    var mine = logs.filter(function (l) { return l.itemId === item.id; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (mine.length < 2) return item.cycleDays || null;
    var gaps = [];
    for (var i = 1; i < mine.length; i++) gaps.push(daysBetween(mine[i - 1].date, mine[i].date));
    return Math.round(gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length);
  }

  function buildInsights() {
    var st = getState();
    if (!st || !window.TTBK_SHOPPING.computeStatus) return [];
    var items = st.items || [], logs = st.purchaseLog || [];
    var insights = [];

    // 1) Dự đoán sắp hết — dựa trên chu kỳ mua trung bình thật (>=2 lần mua)
    items.filter(function (it) {
      return it.category !== "dinh_ky" && it.category !== "phat_sinh" && it.lastRestock && !it.inCart;
    }).forEach(function (it) {
      var cyc = avgCycle(it, logs);
      if (!cyc) return;
      var elapsed = daysSince(it.lastRestock);
      var remain = cyc - elapsed;
      if (remain > 0 && remain <= Math.max(3, Math.round(cyc * 0.25))) {
        insights.push({
          type: "predict", icon: "⏳", title: "Sắp hết trong vài ngày",
          html: "<strong>" + escapeHtml(it.name) + "</strong> thường được mua lại sau khoảng <strong>" + cyc + " ngày</strong>. " +
                "Lần gần nhất cách đây <strong>" + elapsed + " ngày</strong> → có thể hết trong khoảng <strong>" + remain + " ngày tới</strong>.",
          actId: it.id
        });
      }
    });

    // 2) Sắp hết hạn / đã hết hạn dùng (đồ ăn, mỹ phẩm... có ghi hạn dùng)
    items.filter(function (it) { return it.expiryDate; }).forEach(function (it) {
      var remain = daysBetween(new Date().toISOString().slice(0, 10), it.expiryDate);
      if (remain < 0) {
        insights.push({
          type: "warn", icon: "⏰", title: "Đã hết hạn dùng",
          html: "<strong>" + escapeHtml(it.name) + "</strong> đã hết hạn dùng được <strong>" + Math.abs(remain) + " ngày</strong> — kiểm tra và bỏ đi nếu cần."
        });
      } else if (remain <= 3) {
        insights.push({
          type: "warn", icon: "⏰", title: "Sắp hết hạn dùng",
          html: "<strong>" + escapeHtml(it.name) + "</strong> còn <strong>" + remain + " ngày</strong> nữa là hết hạn — ưu tiên dùng trước."
        });
      }
    });

    // 3) Cặp món hay được mua cùng ngày (từ lịch sử mua thật)
    var byDate = {};
    logs.forEach(function (l) { (byDate[l.date] = byDate[l.date] || []).push(l.itemName); });
    var pairCount = {};
    Object.keys(byDate).forEach(function (d) {
      var names = byDate[d].filter(function (n, i, arr) { return arr.indexOf(n) === i; });
      for (var i = 0; i < names.length; i++) {
        for (var j = i + 1; j < names.length; j++) {
          var key = [names[i], names[j]].sort().join(" + ");
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });
    var bestPair = Object.keys(pairCount).filter(function (k) { return pairCount[k] >= 2; })
      .sort(function (a, b) { return pairCount[b] - pairCount[a]; })[0];
    if (bestPair) {
      insights.push({
        type: "pair", icon: "🔗", title: "Thường mua cùng nhau",
        html: "<strong>" + escapeHtml(bestPair) + "</strong> đã được mua cùng đợt <strong>" + pairCount[bestPair] + " lần</strong> gần đây. Lần mua tới có thể gộp chung cho tiện."
      });
    }

    // 4) Thiếu đồ dự phòng
    items.filter(function (it) { return it.category === "du_phong"; }).forEach(function (it) {
      var s = window.TTBK_SHOPPING.computeStatus(it);
      if (s.level !== "on") {
        insights.push({
          type: "warn", icon: "⚠️", title: "Thiếu đồ dự phòng",
          html: "Nhà hiện <strong>" + (s.level === "het" ? "không còn" : "sắp hết") + "</strong> " + escapeHtml(it.name) + " dự phòng — nếu cần gấp sẽ không có sẵn."
        });
      }
    });

    // 5) Ngân sách trung bình — từ purchaseLog có giá
    var byMonth = {};
    logs.forEach(function (l) { if (!l.cost) return; var k = monthKey(l.date); byMonth[k] = (byMonth[k] || 0) + Number(l.cost); });
    var months = Object.keys(byMonth);
    if (months.length >= 1) {
      var avg = months.reduce(function (s, k) { return s + byMonth[k]; }, 0) / months.length;
      insights.push({
        type: "budget", icon: "📊", title: "Ngân sách mua sắm trung bình",
        html: "Trung bình mỗi tháng nhà chi khoảng <strong>" + fmtVND(avg) + "</strong> cho đồ dùng sinh hoạt (tính trên " + months.length + " tháng đã có giá).",
        link: true
      });
    }

    return insights;
  }

  function renderAI() {
    var host = document.getElementById("shop-ai-grid");
    if (!host) return;
    var insights = buildInsights();
    if (!insights.length) {
      host.innerHTML = '<p class="empty-state">Chưa đủ dữ liệu để gợi ý. Cứ dùng bình thường — báo sắp hết, đánh dấu "Đã mua" kèm giá — sau vài lần mua mỗi món, gợi ý thật sẽ xuất hiện ở đây.</p>';
      return;
    }
    host.innerHTML = insights.map(function (ins) {
      var btn = ins.type === "predict"
        ? '<button class="btn btn-ghost btn-sm" data-ai-act="addcart" data-id="' + ins.actId + '">Thêm vào danh sách mua</button>'
        : ins.link
          ? '<button class="btn btn-ghost btn-sm" onclick="(window.ttbkNavigate||function(u){window.location.href=u;})(\\'Chi tiêu TTBK.html\\')">Xem trong Chi tiêu →</button>'
          : "";
      return (
        '<div class="ai-card ' + ins.type + '">' +
          '<div class="ai-card-head"><span class="ic">' + ins.icon + "</span><h4>" + ins.title + "</h4></div>" +
          "<p>" + ins.html + "</p>" +
          btn +
        "</div>"
      );
    }).join("");
  }

  // Nút "Thêm vào danh sách mua" ngay trong thẻ AI — gọi thẳng qua
  // window.TTBK_SHOPPING rồi nhờ shopping.js tự vẽ lại (renderAll bên đó
  // sẽ kích hoạt MutationObserver của ta để làm mới lại tab AI).
  document.addEventListener("click", function (e) {
    var btn = e.target.closest('[data-ai-act="addcart"]');
    if (!btn) return;
    var st = getState();
    if (!st) return;
    var it = st.items.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
    if (!it || it.inCart) return;
    it.inCart = true;
    it.cartPriority = it.cartPriority || "binh_thuong";
    if (window.TTBK_SHOPPING.renderAll) window.TTBK_SHOPPING.renderAll();
  });

  function refreshAll() { updateExpenseCard(); renderAI(); }

  function init() {
    if (!window.TTBK_SHOPPING) { setTimeout(init, 150); return; } // chờ shopping.js chạy xong
    refreshAll();
    var overviewHost = document.getElementById("shop-overview");
    if (overviewHost && window.MutationObserver) {
      new MutationObserver(refreshAll).observe(overviewHost, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();


// ============================================================
// SETTINGS.JS — trang "Cài đặt" (hồ sơ cá nhân)
// ============================================================

// ---- Cắt ảnh đại diện thành hình vuông theo ý người dùng ----
// Trước đây ảnh tải lên bị CSS (object-fit: cover) tự động cắt theo tâm ảnh,
// nên với ảnh không vuông người dùng không tự chọn được phần muốn giữ lại.
// Cách xử lý: khi chọn ảnh, mở 1 khung cắt hình vuông (kéo để di chuyển,
// thanh trượt để phóng to/thu nhỏ), rồi xuất ra 1 ảnh vuông thật sự trước khi upload.
const AVATAR_CROP_OUTPUT_SIZE = 512; // kích thước (px) ảnh vuông xuất ra để upload

function ensureAvatarCropModal() {
  if (document.getElementById("avatar-crop-modal")) return;
  const modal = document.createElement("div");
  modal.className = "calendar-detail-modal avatar-crop-modal";
  modal.id = "avatar-crop-modal";
  modal.innerHTML = \`
    <div class="calendar-detail-backdrop" id="avatar-crop-backdrop"></div>
    <div class="calendar-detail-panel avatar-crop-panel">
      <div class="calendar-detail-head">
        <div>
          <span class="calendar-detail-kicker">Ảnh đại diện</span>
          <h3>Chọn vùng ảnh</h3>
        </div>
        <button type="button" class="calendar-detail-close" id="avatar-crop-close">×</button>
      </div>
      <div class="avatar-crop-stage-wrap">
        <div class="avatar-crop-stage" id="avatar-crop-stage">
          <img id="avatar-crop-img" draggable="false" alt="" />
        </div>
      </div>
      <div class="avatar-crop-zoom-row">
        <span>−</span>
        <input type="range" id="avatar-crop-zoom" min="1" max="3" step="0.01" value="1" />
        <span>+</span>
      </div>
      <p class="avatar-crop-hint">Kéo ảnh để di chuyển, dùng thanh trượt để phóng to / thu nhỏ vùng chọn.</p>
      <div class="avatar-crop-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="avatar-crop-cancel">Huỷ</button>
        <button type="button" class="btn btn-primary btn-sm" id="avatar-crop-confirm">Dùng ảnh này</button>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);
}

// Mở khung cắt ảnh cho 1 file đã chọn, trả về Promise<Blob|null>
// (null nếu người dùng bấm Huỷ/đóng mà không xác nhận).
function openAvatarCropper(file) {
  return new Promise((resolve) => {
    ensureAvatarCropModal();
    const modal = document.getElementById("avatar-crop-modal");
    const stage = document.getElementById("avatar-crop-stage");
    const img = document.getElementById("avatar-crop-img");
    let zoomInput = document.getElementById("avatar-crop-zoom");
    let closeBtn = document.getElementById("avatar-crop-close");
    let cancelBtn = document.getElementById("avatar-crop-cancel");
    let confirmBtn = document.getElementById("avatar-crop-confirm");
    let backdrop = document.getElementById("avatar-crop-backdrop");

    const objectUrl = URL.createObjectURL(file);
    let baseScale = 1;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let naturalW = 0;
    let naturalH = 0;
    let stageSize = 0;
    let dragging = false;
    let dragStart = null;
    let settled = false;

    function applyTransform() {
      img.style.width = \`\${naturalW * scale}px\`;
      img.style.height = \`\${naturalH * scale}px\`;
      img.style.transform = \`translate(\${offsetX}px, \${offsetY}px)\`;
    }

    // Không cho kéo/zoom làm lộ viền trắng ngoài ảnh
    function clampOffset() {
      const w = naturalW * scale;
      const h = naturalH * scale;
      offsetX = Math.min(0, Math.max(stageSize - w, offsetX));
      offsetY = Math.min(0, Math.max(stageSize - h, offsetY));
    }

    function onLoad() {
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;
      stageSize = stage.clientWidth;
      // baseScale = mức zoom nhỏ nhất để ảnh luôn phủ kín khung vuông
      baseScale = Math.max(stageSize / naturalW, stageSize / naturalH);
      scale = baseScale;
      offsetX = (stageSize - naturalW * scale) / 2;
      offsetY = (stageSize - naturalH * scale) / 2;
      zoomInput.value = "1";
      clampOffset();
      applyTransform();
    }
    img.addEventListener("load", onLoad, { once: true });
    img.src = objectUrl;

    function onZoom() {
      const factor = parseFloat(zoomInput.value); // 1 = baseScale, tối đa 3x
      const prevScale = scale;
      scale = baseScale * factor;
      // Giữ nguyên tâm khung khi phóng to/thu nhỏ để không bị "nhảy" ảnh
      const cx = stageSize / 2;
      const cy = stageSize / 2;
      offsetX = cx - ((cx - offsetX) / prevScale) * scale;
      offsetY = cy - ((cy - offsetY) / prevScale) * scale;
      clampOffset();
      applyTransform();
    }
    zoomInput.addEventListener("input", onZoom);

    function pointerDown(e) {
      dragging = true;
      const p = e.touches ? e.touches[0] : e;
      dragStart = { x: p.clientX - offsetX, y: p.clientY - offsetY };
      stage.classList.add("dragging");
    }
    function pointerMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      offsetX = p.clientX - dragStart.x;
      offsetY = p.clientY - dragStart.y;
      clampOffset();
      applyTransform();
      if (e.cancelable) e.preventDefault();
    }
    function pointerUp() {
      dragging = false;
      stage.classList.remove("dragging");
    }
    stage.addEventListener("mousedown", pointerDown);
    window.addEventListener("mousemove", pointerMove);
    window.addEventListener("mouseup", pointerUp);
    stage.addEventListener("touchstart", pointerDown, { passive: true });
    window.addEventListener("touchmove", pointerMove, { passive: false });
    window.addEventListener("touchend", pointerUp);

    function cleanup() {
      modal.classList.remove("show");
      img.removeEventListener("load", onLoad);
      stage.removeEventListener("mousedown", pointerDown);
      window.removeEventListener("mousemove", pointerMove);
      window.removeEventListener("mouseup", pointerUp);
      stage.removeEventListener("touchstart", pointerDown);
      window.removeEventListener("touchmove", pointerMove);
      window.removeEventListener("touchend", pointerUp);
      // Thay các nút bằng bản sao "sạch" để gỡ hết listener,
      // tránh cộng dồn listener nếu người dùng mở khung cắt nhiều lần.
      zoomInput.replaceWith(zoomInput.cloneNode(true));
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      backdrop.replaceWith(backdrop.cloneNode(true));
      URL.revokeObjectURL(objectUrl);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    closeBtn.addEventListener("click", () => finish(null));
    cancelBtn.addEventListener("click", () => finish(null));
    backdrop.addEventListener("click", () => finish(null));

    confirmBtn.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_CROP_OUTPUT_SIZE;
      canvas.height = AVATAR_CROP_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      const ratio = AVATAR_CROP_OUTPUT_SIZE / stageSize;
      ctx.drawImage(
        img,
        0, 0, naturalW, naturalH,
        offsetX * ratio, offsetY * ratio, naturalW * scale * ratio, naturalH * scale * ratio
      );
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.92);
    });

    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

function renderColorPicker() {
  const wrap = document.getElementById("st-colors");
  wrap.innerHTML = AVATAR_COLORS.map(
    (c) => \`<button type="button" class="color-dot \${c === STATE.me.avatar_color ? "on" : ""}" style="background:\${c}" data-color="\${c}"></button>\`
  ).join("");
}

function renderAvatarPreview() {
  const wrap = document.getElementById("st-avatar-preview");
  if (!wrap) return;
  wrap.innerHTML = avatarHTML(STATE.me);
  const removeBtn = document.getElementById("st-avatar-remove");
  if (removeBtn) removeBtn.style.display = STATE.me.avatar_url ? "inline-flex" : "none";
}

function bindSettingsEvents() {
  const avatarInput = document.getElementById("st-avatar-input");
  const avatarPickBtn = document.getElementById("st-avatar-pick");
  const avatarRemoveBtn = document.getElementById("st-avatar-remove");
  const avatarStatus = document.getElementById("st-avatar-status");

  if (avatarPickBtn && !avatarPickBtn.dataset.bound) {
    avatarPickBtn.dataset.bound = "1";
    avatarPickBtn.addEventListener("click", () => avatarInput.click());
  }

  if (avatarInput && !avatarInput.dataset.bound) {
    avatarInput.dataset.bound = "1";
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      avatarInput.value = ""; // cho phép chọn lại đúng file này lần sau nếu cần
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn một tệp hình ảnh (jpg, png, ...).");
        return;
      }
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        alert("Ảnh quá lớn, vui lòng chọn ảnh dưới 5MB.");
        return;
      }

      // Cho người dùng tự chọn vùng ảnh (kéo/zoom) thay vì để CSS tự cắt theo tâm.
      const croppedBlob = await openAvatarCropper(file);
      if (!croppedBlob) return; // người dùng bấm Huỷ

      if (avatarPickBtn) avatarPickBtn.disabled = true;
      if (avatarStatus) avatarStatus.textContent = "Đang tải ảnh lên...";

      // Ảnh cắt luôn xuất ra dạng jpg (xem openAvatarCropper / canvas.toBlob).
      const path = \`\${STATE.me.id}/avatar_\${Date.now()}.jpg\`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, croppedBlob, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });
      if (uploadError) {
        if (avatarPickBtn) avatarPickBtn.disabled = false;
        if (avatarStatus) avatarStatus.textContent = "";
        return alert("Lỗi tải ảnh lên: " + uploadError.message);
      }

      const { data: publicUrlData } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", STATE.me.id);

      if (avatarPickBtn) avatarPickBtn.disabled = false;

      if (updateError) {
        if (avatarStatus) avatarStatus.textContent = "";
        return alert("Lỗi lưu ảnh đại diện: " + updateError.message);
      }

      STATE.me.avatar_url = avatarUrl;
      STATE.profiles = await getAllProfiles();
      renderAvatarPreview();
      updateTopbar();
      if (avatarStatus) avatarStatus.textContent = "Đã cập nhật ảnh đại diện.";
    });
  }

  if (avatarRemoveBtn && !avatarRemoveBtn.dataset.bound) {
    avatarRemoveBtn.dataset.bound = "1";
    avatarRemoveBtn.addEventListener("click", async () => {
      if (!STATE.me.avatar_url) return;
      if (!confirm("Xoá ảnh đại diện và quay lại avatar màu mặc định?")) return;

      const { error } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.avatar_url = null;
      STATE.profiles = await getAllProfiles();
      renderAvatarPreview();
      updateTopbar();
      if (avatarStatus) avatarStatus.textContent = "Đã xoá ảnh đại diện.";
    });
  }

  const wrap = document.getElementById("st-colors");
  if (!wrap.dataset.bound) {
    wrap.dataset.bound = "1";
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".color-dot");
      if (!btn) return;
      wrap.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("on"));
      btn.classList.add("on");
    });
  }

  const saveBtn = document.getElementById("save-settings");
  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const name = document.getElementById("st-name").value.trim();
      const household = document.getElementById("st-household").value.trim();
      const universityEl = document.getElementById("st-university");
      const university = universityEl ? universityEl.value : STATE.me.university || "";
      const activeDot = document.querySelector("#st-colors .color-dot.on");
      const color = activeDot ? activeDot.dataset.color : STATE.me.avatar_color;
      if (!name) return alert("Tên không được để trống.");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ name, household, avatar_color: color, university: university || null })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.name = name;
      STATE.me.household = household;
      STATE.me.avatar_color = color;
      STATE.me.university = university || null;
      STATE.profiles = await getAllProfiles();
      updateTopbar();
      alert("Đã lưu thay đổi.");
    });
  }

  const awayToggle = document.getElementById("st-away-toggle");
  const awayDatesWrap = document.getElementById("st-away-dates");
  if (awayToggle && !awayToggle.dataset.bound) {
    awayToggle.dataset.bound = "1";
    awayToggle.addEventListener("change", () => {
      awayDatesWrap.style.display = awayToggle.checked ? "block" : "none";
      if (awayToggle.checked && !document.getElementById("st-away-from").value) {
        document.getElementById("st-away-from").value = todayStr();
      }
    });
  }

  const saveAwayBtn = document.getElementById("save-away-status");
  if (saveAwayBtn && !saveAwayBtn.dataset.bound) {
    saveAwayBtn.dataset.bound = "1";
    saveAwayBtn.addEventListener("click", async () => {
      const isAway = document.getElementById("st-away-toggle").checked;
      const awayFrom = isAway ? (document.getElementById("st-away-from").value || todayStr()) : null;
      const awayUntil = isAway ? (document.getElementById("st-away-until").value || null) : null;

      if (isAway && STATE.me.status === "SICK") {
        alert("Bạn đang ở trạng thái Ốm — hãy tắt trạng thái ốm trước nếu muốn bật Đi vắng.");
        return;
      }
      const newStatus = isAway ? "AWAY" : (STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ is_away: isAway, away_from: awayFrom, away_until: awayUntil, status: newStatus })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.is_away = isAway;
      STATE.me.away_from = awayFrom;
      STATE.me.away_until = awayUntil;
      STATE.me.status = newStatus;
      STATE.profiles = await getAllProfiles();

      await logHistory(
        null,
        STATE.me.id,
        isAway ? "bat_dau_vang" : "ket_thuc_vang",
        isAway
          ? \`\${STATE.me.name} bật chế độ đi vắng\${awayUntil ? " đến " + formatDateShort(awayUntil) : ""}.\`
          : \`\${STATE.me.name} đã tắt chế độ đi vắng (quay lại).\`
      );

      // Khi bật đi vắng: đưa việc chưa xong vào hàng chờ để người khác "Nhận thay"
      // (giữ đúng hành vi cũ, chỉ tách ra thành hàm dùng chung với Sick Mode).
      if (isAway && typeof reassignTasksForUnavailableUser === "function") {
        await reassignTasksForUnavailableUser(STATE.me.id);
      }

      alert(isAway ? "Đã bật chế độ đi vắng." : "Đã tắt chế độ đi vắng.");
    });
  }

  // ---------- Phương tiện & tốc độ di chuyển ----------
  const saveLocationBtn = document.getElementById("save-location");
  if (saveLocationBtn && !saveLocationBtn.dataset.bound) {
    saveLocationBtn.dataset.bound = "1";
    saveLocationBtn.addEventListener("click", async () => {
      const payload = {
        transport_type: document.getElementById("st-transport").value,
        average_speed_kmh:
          Number(document.getElementById("st-speed").value) || DEFAULT_TRAVEL_SPEED_KMH[document.getElementById("st-transport").value] || 25,
      };

      const { error } = await supabaseClient.from("profiles").update(payload).eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      Object.assign(STATE.me, payload);
      STATE.profiles = await getAllProfiles();
      const statusEl = document.getElementById("st-location-status");
      if (statusEl) statusEl.textContent = "Đã lưu phương tiện & tốc độ di chuyển.";
    });
  }

  const transportEl = document.getElementById("st-transport");
  const speedEl = document.getElementById("st-speed");
  if (transportEl && speedEl && !transportEl.dataset.speedBound) {
    transportEl.dataset.speedBound = "1";
    transportEl.addEventListener("change", () => {
      const defaultSpeed = DEFAULT_TRAVEL_SPEED_KMH[transportEl.value];
      if (defaultSpeed) speedEl.value = defaultSpeed;
    });
  }

  // ---------- Mức độ bận (Status Engine) ----------
  const saveBusyBtn = document.getElementById("save-busy-level");
  if (saveBusyBtn && !saveBusyBtn.dataset.bound) {
    saveBusyBtn.dataset.bound = "1";
    saveBusyBtn.addEventListener("click", async () => {
      const level = Number(document.getElementById("st-busy-level").value) || 0;
      const reason = document.getElementById("st-busy-reason").value.trim() || null;

      // Không ghi đè trạng thái nếu đang Ốm/Đi vắng — 2 trạng thái đó ưu tiên cao hơn.
      if (STATE.me.status === "SICK" || STATE.me.status === "AWAY" || STATE.me.is_away) {
        alert("Bạn đang ở trạng thái Ốm/Đi vắng — hãy tắt trạng thái đó trước nếu muốn đổi mức độ bận.");
        return;
      }

      const { error } = await supabaseClient
        .from("profiles")
        .update({ status: level > 0 ? "BUSY" : "AVAILABLE", busy_level: level, busy_reason: reason })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.status = level > 0 ? "BUSY" : "AVAILABLE";
      STATE.me.busy_level = level;
      STATE.me.busy_reason = reason;
      STATE.profiles = await getAllProfiles();
      alert("Đã lưu mức độ bận.");
    });
  }

  // ---------- Sick Mode ----------
  const sickToggle = document.getElementById("st-sick-toggle");
  const sickDatesWrap = document.getElementById("st-sick-dates");
  if (sickToggle && !sickToggle.dataset.bound) {
    sickToggle.dataset.bound = "1";
    sickToggle.addEventListener("change", () => {
      sickDatesWrap.style.display = sickToggle.checked ? "block" : "none";
      if (sickToggle.checked && !document.getElementById("st-sick-from").value) {
        document.getElementById("st-sick-from").value = todayStr();
      }
    });
  }

  const saveSickBtn = document.getElementById("save-sick-status");
  if (saveSickBtn && !saveSickBtn.dataset.bound) {
    saveSickBtn.dataset.bound = "1";
    saveSickBtn.addEventListener("click", async () => {
      const isSick = document.getElementById("st-sick-toggle").checked;
      const sickFrom = isSick ? (document.getElementById("st-sick-from").value || todayStr()) : null;
      const sickUntil = isSick ? (document.getElementById("st-sick-until").value || null) : null;
      const newStatus = isSick ? "SICK" : (STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ status: newStatus, sick_from: sickFrom, sick_until: sickUntil })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.status = newStatus;
      STATE.me.sick_from = sickFrom;
      STATE.me.sick_until = sickUntil;
      STATE.profiles = await getAllProfiles();

      await logHistory(
        null,
        STATE.me.id,
        isSick ? "bat_dau_om" : "khoi_om",
        isSick
          ? \`\${STATE.me.name} báo ốm\${sickUntil ? ", dự kiến khỏi " + formatDateShort(sickUntil) : ""}.\`
          : \`\${STATE.me.name} đã tắt trạng thái ốm (quay lại làm việc).\`
      );

      // Khi báo ốm: đưa việc chưa xong (không tính việc luân phiên) vào hàng chờ
      // để người khác nhận thay, đúng như đề xuất "Không phạt điểm khi ốm".
      if (isSick && typeof reassignTasksForUnavailableUser === "function") {
        await reassignTasksForUnavailableUser(STATE.me.id);
      }

      alert(isSick ? "Đã bật chế độ ốm — việc chưa xong của bạn sẽ không bị phạt và được đưa vào hàng chờ chia lại." : "Đã tắt chế độ ốm, chúc mừng bạn khoẻ lại!");
    });
  }

  const logoutBtn = document.getElementById("st-logout");
  if (!logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "1";
    logoutBtn.addEventListener("click", logout);
  }
}

// Nếu ngày dự kiến khỏi đã qua mà vẫn đang để chế độ Ốm, hỏi lại xem đã khoẻ
// chưa trước khi tự tắt — đúng đề xuất "Sau ngày khỏi hệ thống hỏi bạn đã khoẻ chưa".
async function checkSickRecoveryPrompt() {
  if (STATE.me.status !== "SICK" || !STATE.me.sick_until) return;
  if (STATE.me.sick_until >= todayStr()) return; // chưa tới/qua ngày dự kiến khỏi

  const recovered = confirm(\`Đã quá ngày bạn dự kiến khỏi ốm (\${formatDateShort(STATE.me.sick_until)}). Bạn đã khoẻ chưa?\`);
  if (!recovered) return; // vẫn còn ốm -> giữ nguyên, hỏi lại lần load sau

  const newStatus = STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE";
  const { error } = await supabaseClient
    .from("profiles")
    .update({ status: newStatus, sick_from: null, sick_until: null })
    .eq("id", STATE.me.id);
  if (error) return alert("Lỗi: " + error.message);

  STATE.me.status = newStatus;
  STATE.me.sick_from = null;
  STATE.me.sick_until = null;
  STATE.profiles = await getAllProfiles();

  await logHistory(null, STATE.me.id, "khoi_om", \`\${STATE.me.name} xác nhận đã khoẻ, quay lại làm việc.\`);

  const sickToggle = document.getElementById("st-sick-toggle");
  if (sickToggle) {
    sickToggle.checked = false;
    document.getElementById("st-sick-dates").style.display = "none";
  }
}

async function loadSettingsSection() {
  document.getElementById("st-name").value = STATE.me.name;
  document.getElementById("st-household").value = STATE.me.household || "Nhà TTBK";
  const universityEl = document.getElementById("st-university");
  if (universityEl) universityEl.value = STATE.me.university || "";
  renderColorPicker();
  renderAvatarPreview();

  const awayToggle = document.getElementById("st-away-toggle");
  if (awayToggle) {
    awayToggle.checked = !!STATE.me.is_away;
    document.getElementById("st-away-dates").style.display = STATE.me.is_away ? "block" : "none";
    document.getElementById("st-away-from").value = STATE.me.away_from || "";
    document.getElementById("st-away-until").value = STATE.me.away_until || "";
  }

  const sickToggle = document.getElementById("st-sick-toggle");
  if (sickToggle) {
    sickToggle.checked = STATE.me.status === "SICK";
    document.getElementById("st-sick-dates").style.display = STATE.me.status === "SICK" ? "block" : "none";
    document.getElementById("st-sick-from").value = STATE.me.sick_from || "";
    document.getElementById("st-sick-until").value = STATE.me.sick_until || "";
  }

  const busyLevelEl = document.getElementById("st-busy-level");
  if (busyLevelEl) busyLevelEl.value = String(STATE.me.busy_level ?? 0);
  const busyReasonEl = document.getElementById("st-busy-reason");
  if (busyReasonEl) busyReasonEl.value = STATE.me.busy_reason || "";

  const transportEl = document.getElementById("st-transport");
  if (transportEl) transportEl.value = STATE.me.transport_type || "motorbike";
  const speedEl = document.getElementById("st-speed");
  if (speedEl) speedEl.value = STATE.me.average_speed_kmh ?? DEFAULT_TRAVEL_SPEED_KMH[transportEl?.value] ?? 25;
  const distanceEl = document.getElementById("st-travel-distance");
  const distance = UNIVERSITY_TRAVEL_DISTANCE_KM[STATE.me.university];
  if (distanceEl) {
    distanceEl.textContent = distance == null
      ? "Chưa chọn trường nên hệ thống dùng thời gian đệm mặc định."
      : \`Khoảng cách áp dụng: \${String(distance).replace(".", ",")} km từ nhà đến \${STATE.me.university}.\`;
  }

  bindSettingsEvents();
  await checkSickRecoveryPrompt();
}


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
  document.getElementById("topbar-user").innerHTML = \`\${avatarHTML(STATE.me, "avatar-sm")}<span>\${escapeHTML(STATE.me.name)}</span>\`;
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
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === \`section-\${name}\`));
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

  await logHistory(null, STATE.me.id, "ket_thuc_vang", \`\${STATE.me.name} đã tự động được khôi phục trạng thái có mặt (hết hạn đi vắng).\`);

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


// js/push-notifications.js
// Xin quyền + đăng ký thiết bị nhận thông báo đẩy (Web Push), lưu subscription vào Supabase.
//
// ⚠️ CẦN SỬA 2 CHỖ CHO KHỚP VỚI PHẦN CODE HIỆN CÓ CỦA BẠN:
//   1) \`getSupabaseClient()\` bên dưới — trỏ đúng biến client bạn tạo trong js/supabase-client.js
//   2) \`getCurrentUserId()\` bên dưới — trỏ đúng nơi bạn lưu user đang đăng nhập (thường ở js/auth.js)

const VAPID_PUBLIC_KEY = 'BCWBh0KLHKyR-ULt1mlaR4oHQefPFryHd7osKGKZ4bGz3WxzagVAOGkcfDlIXCyrajukDrsktgUBz5aC8R4QcE0';

function getSupabaseClient() {
  return typeof supabaseClient !== 'undefined' ? supabaseClient : null;
}

function getCurrentUserId() {
  return typeof STATE !== 'undefined' ? STATE.me?.id || null : null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const serviceWorkerUrl = new URL('sw.js', document.baseURI);
    return await navigator.serviceWorker.register(serviceWorkerUrl);
  } catch (err) {
    console.error('Không đăng ký được service worker:', err);
    return null;
  }
}

async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

async function enablePush() {
  const statusEl = document.getElementById('st-push-status');

  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    if (statusEl) statusEl.textContent = 'Trình duyệt này không hỗ trợ thông báo đẩy.';
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (statusEl) statusEl.textContent = 'Bạn chưa cấp quyền thông báo.';
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    if (statusEl) statusEl.textContent = 'Lỗi đăng ký service worker.';
    return false;
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const supabase = getSupabaseClient();
    const userId = getCurrentUserId();

    if (!supabase || !userId) {
      console.warn('Chưa kết nối được Supabase client hoặc user id — xem TODO ở đầu file push-notifications.js');
      if (statusEl) statusEl.textContent = 'Thiếu cấu hình (xem console).';
      return false;
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Lỗi lưu subscription:', error);
      if (statusEl) statusEl.textContent = 'Lỗi khi lưu đăng ký. Xem console.';
      return false;
    }

    if (statusEl) statusEl.textContent = 'Đã bật thông báo đẩy trên thiết bị này.';
    return true;
  } catch (err) {
    console.error('Không tạo được đăng ký push:', err);
    if (statusEl) statusEl.textContent = 'Không tạo được đăng ký push. Kiểm tra VAPID key và quyền thông báo.';
    return false;
  }
}

async function disablePush() {
  const statusEl = document.getElementById('st-push-status');
  const subscription = await getExistingSubscription();
  const supabase = getSupabaseClient();

  if (subscription) {
    if (supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
    await subscription.unsubscribe();
  }

  if (statusEl) statusEl.textContent = 'Đã tắt thông báo đẩy trên thiết bị này.';
  return true;
}

async function refreshPushButtons() {
  const btnEnable = document.getElementById('st-push-enable');
  const btnDisable = document.getElementById('st-push-disable');
  if (!btnEnable || !btnDisable) return;

  const subscription = await getExistingSubscription();
  const active = !!subscription && Notification.permission === 'granted';
  btnEnable.style.display = active ? 'none' : '';
  btnDisable.style.display = active ? '' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const btnEnable = document.getElementById('st-push-enable');
  const btnDisable = document.getElementById('st-push-disable');

  if (btnEnable) {
    btnEnable.addEventListener('click', async () => {
      await enablePush();
      await refreshPushButtons();
    });
  }
  if (btnDisable) {
    btnDisable.addEventListener('click', async () => {
      await disablePush();
      await refreshPushButtons();
    });
  }

  refreshPushButtons();
});


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


if ("serviceWorker" in navigator) {\r
  window.addEventListener("load", () => {\r
    navigator.serviceWorker.register("./sw.js").then((registration) => {\r
      registration.addEventListener("updatefound", () => {\r
        const worker = registration.installing;\r
        if (!worker) return;\r
        worker.addEventListener("statechange", () => {\r
          if (worker.state === "installed" && navigator.serviceWorker.controller && typeof showToast === "function") {\r
            showToast("Có bản cập nhật mới — tải lại trang để dùng bản mới nhất", "info", 5000);\r
          }\r
        });\r
      });\r
    }).catch((error) => console.warn("Không đăng ký được service worker:", error));\r
  });\r
}`;function i(){new Function(a)()}window.supabase={createClient:e};i();document.querySelectorAll("[data-navigate]").forEach(n=>{n.addEventListener("click",()=>{const t=n.dataset.navigate;typeof window.ttbkNavigate=="function"?window.ttbkNavigate(t):window.location.href=t})});
