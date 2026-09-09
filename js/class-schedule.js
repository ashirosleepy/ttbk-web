// ============================================================
// CLASS-SCHEDULE.JS — lịch học cá nhân theo trường + tự tính "vùng bận"
//
// Ý tưởng (theo đúng đề xuất): giờ bận do học KHÔNG chỉ là giờ học,
// mà là: đệm chuẩn bị/di chuyển trước + giờ học + đệm về nhà/nghỉ sau.
// Toàn bộ khoảng từ tiết sớm nhất -> tiết muộn nhất trong ngày được coi
// là 1 "vùng bận" liền mạch (kể cả nếu giữa các tiết có tiết trống).
// ============================================================

const CLASS_BUFFER_BEFORE_MIN = 20; // chuẩn bị + di chuyển tới trường
const CLASS_BUFFER_AFTER_MIN = 30;  // di chuyển về nhà + nghỉ sau khi tan học

const CLASS_GRID_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Thứ 2 -> Chủ nhật (0 = CN theo Date.getDay())
const CLASS_WEEKDAY_SHORT = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 0: "CN" };

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

// Tính "vùng bận do học" của 1 người trong 1 ngày cụ thể (Date object).
// Trả về {start, end, classStart, classEnd, university} hoặc null nếu hôm đó không có lịch học.
async function computeClassBusyZone(userId, dateObj) {
  const profile = findProfile(STATE.profiles, userId);
  if (!profile || !profile.university) return null;

  const dayOfWeek = dateObj.getDay();
  const rows = await fetchUserClassSchedule(userId);
  const todayRows = rows.filter((r) => r.day_of_week === dayOfWeek && r.university === profile.university);
  if (todayRows.length === 0) return null;

  const periods = await fetchClassPeriods(profile.university);
  if (periods.length === 0) return null;

  const periodMap = Object.fromEntries(periods.map((p) => [p.period_number, p]));
  const matched = todayRows.map((r) => periodMap[r.period_number]).filter(Boolean);
  if (matched.length === 0) return null;

  const startMin = Math.min(...matched.map((p) => classTimeToMinutes(p.start_time)));
  const endMin = Math.max(...matched.map((p) => classTimeToMinutes(p.end_time)));

  return {
    start: classMinutesToTime(startMin - CLASS_BUFFER_BEFORE_MIN),
    end: classMinutesToTime(endMin + CLASS_BUFFER_AFTER_MIN),
    classStart: classMinutesToTime(startMin),
    classEnd: classMinutesToTime(endMin),
    university: profile.university,
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
