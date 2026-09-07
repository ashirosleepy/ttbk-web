// ============================================================
// MEMBERS.JS — trang "Thành viên"
// ============================================================

async function renderMembers() {
  const container = document.getElementById("members-grid");
  const [tasks, pointsMap] = await Promise.all([fetchTasks(), fetchMemberPointsMap()]);

  const html = STATE.profiles
    .map((p) => {
      const assigned = tasks.filter((t) => t.assigned_to === p.id);
      const done = assigned.filter((t) => t.status === "hoan_thanh");
      const missed = assigned.filter((t) => t.status === "bo_lo");
      const points = pointsMap[p.id] || 0;
      return `
      <div class="card member-card">
        ${avatarHTML(p)}
        <div>
          <div class="m-name">${escapeHTML(p.name)}</div>
          <div class="m-sub">${assigned.length} việc • ${done.length} hoàn thành${missed.length ? ` • ${missed.length} bỏ việc` : ""}</div>
        </div>
        <div class="m-points"><div class="n">${points}</div><div class="l">điểm</div></div>
      </div>`;
    })
    .join("");

  container.innerHTML = html || `<p class="empty-state">Chưa có thành viên nào.</p>`;
}

async function loadMembersSection() {
  await renderMembers();
}
