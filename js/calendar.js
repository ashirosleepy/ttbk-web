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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    pattern.rows.sort((a, b) => `${a.due_date}-${a.created_at}`.localeCompare(`${b.due_date}-${b.created_at}`));
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
    else cls = "cal-chip-todo";
  }

  const titleAttr = `${item.title}${assignee ? " — " + assignee.name : ""}`;
  const label = nameShort ? `${escapeHTML(item.title)} · ${escapeHTML(nameShort)}` : escapeHTML(item.title);
  return `<div class="cal-chip ${cls}" title="${escapeHTML(titleAttr)}">${label}</div>`;
}

async function renderMonthCalendar() {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month-label");
  if (!grid || !label) return;

  if (calViewYear === undefined) calInitState();
  label.textContent = `${CAL_MONTH_LABEL[calViewMonth]}, ${calViewYear}`;

  const daysInMonth = calDaysInMonth(calViewYear, calViewMonth);
  const offset = calMondayOffset(calViewYear, calViewMonth);
  // Giữ thêm 7 ngày sau cuối tháng để thấy trước lượt luân phiên ở tuần đầu tháng sau.
  const totalCells = Math.ceil((offset + daysInMonth + 7) / 7) * 7;

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
    if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = [];
    tasksByDate[t.due_date].push(t);
  });

  const futureByDate = projectFutureOccurrences(schedules, queues, rangeStart, rangeEnd, today, tasks);

  const weekdayHeader = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    .map((d) => `<div class="cal-weekday">${d}</div>`)
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
      chipsHTML = dayTasks
        .map((t) =>
          calChipHTML({
            title: t.title,
            status: t.status,
            assigneeId: t.assigned_to,
            missedByDate: dStr < today && t.status !== "hoan_thanh" && t.status !== "bo_lo",
          })
        )
        .join("");
    } else if (dStr > today) {
      // Chiếu cả tuần đầu tháng sau để không mất lượt ngay sau cuối tháng.
      const dayFuture = futureByDate[dStr] || [];
      chipsHTML = dayFuture.map((f) => calChipHTML(f)).join("");
    }

    const cls = ["cal-day", isOutside ? "outside" : "", isToday ? "today" : ""].filter(Boolean).join(" ");
    cellsHTML += `
      <div class="${cls}">
        <div class="cal-day-num">${cellDate.getDate()}</div>
        <div class="cal-day-chips">${chipsHTML}</div>
      </div>`;
  }

  grid.innerHTML = weekdayHeader + cellsHTML;
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
