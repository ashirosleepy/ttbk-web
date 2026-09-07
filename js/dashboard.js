// ============================================================
// DASHBOARD.JS — trang "Tổng quan"
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
    const date = new Date(row.created_at);
    const key = date.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const orderedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  return orderedDates
    .map((dateKey) => {
      const dayRows = groups[dateKey].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const dateObj = new Date(dateKey + "T00:00:00");
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let label = dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
      if (dateKey === today) label = "Hôm nay";
      else if (dateKey === yesterday) label = "Hôm qua";

      return `
        <div>
          <div class="day-label">${label}</div>
          <div class="task-list">
            ${dayRows
              .map((row) => {
                const actorName = row.actor ? escapeHTML(row.actor.name) : "Ai đó";
                const taskName = escapeHTML(row.taskTitle || "công việc");
                const detail = escapeHTML(row.detail || row.action || "Hoạt động");
                const timeLabel = new Date(row.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                return `
                  <div class="task-ticket" style="border-left-color:${row.actor?.avatar_color || "#ccc"}">
                    <div class="task-check" style="border:none; font-size:16px;">🕘</div>
                    <div class="task-body">
                      <div class="task-title">${actorName}: ${detail}</div>
                      <div class="task-meta">
                        <span>${taskName}</span>
                        <span>${timeLabel}</span>
                      </div>
                    </div>
                  </div>`;
              })
              .join("")}
          </div>
        </div>`;
    })
    .join("");
}

async function renderActivitySection() {
  const container = document.getElementById("activity-log");
  if (!container) return;

  const recentActivity = await fetchRecentActivity(50);
  if (recentActivity.length === 0) {
    container.innerHTML = `<p class="empty-state">Chưa có hoạt động nào.</p>`;
    return;
  }

  container.innerHTML = renderActivityLogGroup(recentActivity);
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

  const statsHTML = `
    <div class="grid-stats">
      <div class="stat wait"><div class="num">${notDoneToday}</div><div class="label">Việc chưa làm hôm nay</div></div>
      <div class="stat ok"><div class="num">${doneToday}</div><div class="label">Việc đã hoàn thành hôm nay</div></div>
      <div class="stat"><div class="num">${tasks.length}</div><div class="label">Tổng số việc trong nhà</div></div>
    </div>`;

  const fairnessHTML = `
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">⚖️ Công bằng tuần này</h3>
      ${weekly
        .map(
          (w) => `
        <div class="progress-row">
          <span class="name">${escapeHTML(w.profile.name)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.round((w.points / maxPoints) * 100))}%;background:${w.profile.avatar_color}"></div></div>
          <span class="progress-pct">${w.points} đ</span>
        </div>`
        )
        .join("")}
    </div>`;

  const progressHTML = `
    <div class="card" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">Tiến độ từng người (tổng số việc đã hoàn thành)</h3>
      ${perPerson
        .map(
          (pp) => `
        <div class="progress-row">
          <span class="name">${escapeHTML(pp.profile.name)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${pp.pct}%;background:${pp.profile.avatar_color}"></div></div>
          <span class="progress-pct">${pp.pct}%</span>
        </div>`
        )
        .join("")}
    </div>`;

  // Việc phát sinh / luân phiên đang chờ người được gán bấm "Nhận việc"
  const pending = tasks.filter((t) => t.status === "cho_nhan");
  const pendingHTML = `
    <div class="card">
      <h3 style="margin-bottom:14px;font-size:15px;">⚡ Việc phát sinh đang chờ nhận</h3>
      ${
        pending.length === 0
          ? `<p class="empty-state" style="padding:10px 0;">Không có việc nào đang chờ.</p>`
          : `<div class="task-list">${pending.map((t) => taskTicketHTML(t)).join("")}</div>`
      }
    </div>`;

  const activityHTML = `
    <div class="card" style="margin-top:22px;">
      <h3 style="margin-bottom:14px;font-size:15px;">📝 Nhật ký hoạt động gần đây</h3>
      ${
        recentActivity.length === 0
          ? `<p class="empty-state" style="padding:10px 0;">Chưa có hoạt động nào.</p>`
          : renderActivityLogGroup(recentActivity.slice(0, 6))
      }
    </div>`;

  container.innerHTML = statsHTML + fairnessHTML + progressHTML + pendingHTML + activityHTML;
  bindTaskEvents("dashboard-content"); // để nút "Nhận việc" trong khối trên hoạt động luôn
}

async function loadActivitySection() {
  await renderActivitySection();
}

async function loadDashboardSection() {
  await renderDashboard();
}
