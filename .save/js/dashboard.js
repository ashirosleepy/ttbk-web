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

  const statsHTML = `
    <div class="grid-stats">
      <div class="stat wait"><div class="num">${notDoneToday}</div><div class="label">Việc chưa làm hôm nay</div></div>
      <div class="stat ok"><div class="num">${doneToday}</div><div class="label">Việc đã hoàn thành hôm nay</div></div>
      <div class="stat"><div class="num">${tasks.length}</div><div class="label">Tổng số việc trong nhà</div></div>
    </div>`;

  const progressHTML = `
    <div class="card">
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

  container.innerHTML = statsHTML + progressHTML;
}

async function loadDashboardSection() {
  await renderDashboard();
}
