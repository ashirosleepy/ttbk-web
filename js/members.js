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

let memberWeekOffset = 0;

function memberWeekRange(offset = memberWeekOffset) {
  const currentMonday = new Date(`${mondayOfWeek(todayStr())}T00:00:00Z`);
  currentMonday.setUTCDate(currentMonday.getUTCDate() + offset * 7);
  const nextMonday = new Date(currentMonday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const startDate = currentMonday.toISOString().slice(0, 10);
  const endDate = nextMonday.toISOString().slice(0, 10);
  return {
    start: new Date(`${startDate}T03:00:00+07:00`),
    end: new Date(`${endDate}T03:00:00+07:00`),
    startDate,
    endDate,
  };
}

function memberWeekLabel(startDate, endDate) {
  const endDisplay = new Date(`${endDate}T00:00:00Z`);
  endDisplay.setUTCDate(endDisplay.getUTCDate() - 1);
  return `${formatDateShort(startDate)} 03:00 - ${formatDateShort(endDisplay.toISOString().slice(0, 10))} 02:59`;
}

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
  const untilTxt = status.until ? ` đến ${formatDateShort(status.until)}` : "";
  const reasonTxt = status.reason ? ` · ${escapeHTML(status.reason)}` : "";
  return `<span class="status-badge" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:${status.bg};color:${status.fg};font-size:11.5px;font-weight:600;line-height:1.3;">
    <span>${status.emoji}</span>
    <span>${status.label}${reasonTxt}${untilTxt}</span>
  </span>`;
}

async function renderMembers() {
  const container = document.getElementById("members-grid");
  const [tasks, pointsMap, penaltyMap] = await Promise.all([fetchTasks(), fetchMemberPointsMap(), fetchPointPenaltyMap()]);
  const weekRange = memberWeekRange();
  const weekStart = weekRange.start.getTime();
  const weekEnd = weekRange.end.getTime();
  const weekStartDate = weekRange.startDate;
  const weekEndDate = weekRange.endDate;
  const weeklyAdjustments = await fetchPointAdjustmentsBetween(vietnamBusinessWeekStartISO(weekStartDate), vietnamBusinessWeekStartISO(weekEndDate));
  const weeklyPoints = {};
  STATE.profiles.forEach((p) => (weeklyPoints[p.id] = weeklyAdjustments[p.id] || 0));
  tasks
    .filter((task) => task.status === "hoan_thanh" && task.completed_at && new Date(task.completed_at).getTime() >= weekStart && new Date(task.completed_at).getTime() < weekEnd)
    .forEach((task) => {
      const creditedUserId = task.assigned_to;
      if (weeklyPoints[creditedUserId] !== undefined) weeklyPoints[creditedUserId] += task.points || 0;
    });

  const ranking = STATE.profiles
    .map((p) => {
      const assigned = tasks.filter((t) => t.assigned_to === p.id);
      const done = assigned.filter((t) => t.status === "hoan_thanh").length;
      return {
        profile: p,
        completion: assigned.length ? Math.round((done / assigned.length) * 100) : 100,
        penalty: penaltyMap[p.id] || 0,
        weeklyPoints: weeklyPoints[p.id] || 0,
      };
    })
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.penalty - a.penalty || a.completion - b.completion);

  const maxWeeklyPoints = Math.max(1, ...ranking.map((row) => row.weeklyPoints));

  const leaderboardHTML = `
    <div class="card" style="grid-column:1/-1;margin-bottom:18px;border-left:4px solid var(--accent);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <h3 style="margin:0;font-size:15px;">⚖️ Điểm công bằng ${memberWeekOffset === 0 ? "tuần này" : memberWeekOffset < 0 ? "tuần trước" : "tuần sau"}</h3>
        <div class="btn-row" style="margin:0;">
          <button type="button" class="btn btn-ghost btn-sm" data-member-week="prev">← Tuần trước</button>
          ${memberWeekOffset !== 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-member-week="current">Tuần này</button>` : ""}
          <button type="button" class="btn btn-ghost btn-sm" data-member-week="next">Tuần sau →</button>
        </div>
      </div>
      <div class="m-sub" style="margin-bottom:10px;">${memberWeekLabel(weekRange.startDate, weekRange.endDate)}</div>
      ${ranking.map((row, index) => `
        <div class="progress-row">
          <span class="name">${index + 1}. ${escapeHTML(row.profile.name)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.round((row.weeklyPoints / maxWeeklyPoints) * 100))}%;background:${row.profile.avatar_color};"></div></div>
          <span class="progress-pct">${row.weeklyPoints} đ</span>
        </div>`).join("")}
      <div class="m-sub" style="margin-top:8px;">Xếp theo điểm thực nhận trong tuần, gồm điểm hoàn thành và các khoản cộng/trừ.</div>
    </div>`;

  const html = STATE.profiles
    .map((p) => {
      const assigned = tasks.filter((t) => t.assigned_to === p.id);
      const done = assigned.filter((t) => t.status === "hoan_thanh");
      const missed = assigned.filter((t) => t.status === "bo_lo");
      const pending = assigned.filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo");
      const points = pointsMap[p.id] || 0;
      const thisWeekPoints = weeklyPoints[p.id] || 0;

      const status = resolveMemberStatus(p);
      const availability = estimateAvailability(p, pending.length);

      const universityLine = p.university
        ? `<div class="m-line">📚 ${escapeHTML(p.university)}</div>`
        : "";

      return `
      <div class="card member-card">
        <div class="member-head">
          ${avatarHTML(p)}
          <div class="member-identity">
            <div class="m-name-text">${escapeHTML(p.name)}</div>
          </div>
          <div class="m-points"><div class="n">${points}</div><div class="l">điểm</div></div>
        </div>
        <div class="member-details">
          ${memberStatusBadgeHTML(status)}
          ${universityLine}
          <div class="m-sub">${assigned.length} việc • ${done.length} hoàn thành${missed.length ? ` • ${missed.length} bỏ việc` : ""}</div>
          <div class="m-sub"><strong>Tuần này: ${thisWeekPoints} điểm</strong> • Tổng: ${points} điểm</div>
          <div class="m-sub m-availability">
            <span class="availability-bar">
              <span class="availability-fill" style="width:${availability}%;background:${availability >= 60 ? "#1e8a4c" : availability >= 25 ? "#a86b16" : "#b3261e"};"></span>
            </span>
            <span>Độ sẵn sàng: ${availability}%</span>
          </div>
        </div>
      </div>`;
    })
    .join("");

  container.innerHTML = html ? leaderboardHTML + html : `<p class="empty-state">Chưa có thành viên nào.</p>`;
}

async function loadMembersSection() {
  const container = document.getElementById("members-grid");
  if (container && !container.dataset.weekBound) {
    container.dataset.weekBound = "1";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-member-week]");
      if (!button) return;
      const action = button.dataset.memberWeek;
      if (action === "prev") memberWeekOffset -= 1;
      if (action === "next") memberWeekOffset += 1;
      if (action === "current") memberWeekOffset = 0;
      renderMembers();
    });
  }
  await renderMembers();
}
