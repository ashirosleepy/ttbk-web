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
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "YYYY-MM-DD" theo giờ địa phương (không dùng toISOString vì lệch múi giờ)
function classDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
        reason: `Học ${zone.classStart}-${zone.classEnd}${zone.university ? ` (${zone.university})` : ""}`,
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
