// ============================================================
// DASHBOARD.JS — trang "Tổng quan"
// ============================================================

async function renderDashboard() {
  const container = document.getElementById("dashboard-content");
  const tasks = await fetchTasks();
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

  // Điểm công bằng: chỉ tính việc hoàn thành từ thứ 2 tuần này trở đi
  const weekStart = new Date(mondayOfWeek(today) + "T00:00:00").getTime();
  const weekly = STATE.profiles.map((p) => {
    const points = tasks
      .filter((t) => t.assigned_to === p.id && t.status === "hoan_thanh" && t.completed_at && new Date(t.completed_at).getTime() >= weekStart)
      .reduce((sum, t) => sum + (t.points || 0), 0);
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
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round((w.points / maxPoints) * 100)}%;background:${w.profile.avatar_color}"></div></div>
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

  container.innerHTML = statsHTML + fairnessHTML + progressHTML + pendingHTML;
  bindTaskEvents("dashboard-content"); // để nút "Nhận việc" trong khối trên hoạt động luôn
}

async function loadDashboardSection() {
  await renderDashboard();
}
