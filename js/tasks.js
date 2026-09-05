// ============================================================
// TASKS.JS — trang "Công việc"
// ============================================================

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

function groupTasksByDate(tasks) {
  const groups = {};
  tasks.forEach((t) => {
    if (!groups[t.due_date]) groups[t.due_date] = [];
    groups[t.due_date].push(t);
  });
  return groups;
}

function taskTicketHTML(task) {
  const isDone = task.status === "hoan_thanh";
  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";
  const options = STATE.profiles
    .map((p) => `<option value="${p.id}" ${p.id === task.assigned_to ? "selected" : ""}>${escapeHTML(p.name)}</option>`)
    .join("");

  return `
    <div class="task-ticket ${isDone ? "done" : ""}" style="border-left-color:${borderColor}" data-id="${task.id}">
      <button class="task-check ${isDone ? "done" : ""}" data-action="toggle" title="Đánh dấu hoàn thành">${isDone ? "✓" : ""}</button>
      <div class="task-body">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          ${statusBadgeHTML(task.status)}
          <select data-action="reassign" class="task-mini-select" title="Đổi người làm">${options}</select>
          <input type="date" data-action="due" value="${task.due_date}" class="task-mini-date" title="Đổi hạn" />
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="busy" title="Báo bận, nhờ đổi người">😅</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>`;
}

async function renderTasksView() {
  const container = document.getElementById("tasks-container");
  const tasks = await fetchTasks();

  if (tasks.length === 0) {
    container.innerHTML = `<p class="empty-state">Chưa có việc nào. Bấm "+ Thêm việc" để tạo việc đầu tiên.</p>`;
    return;
  }

  const today = todayStr();
  const groups = groupTasksByDate(tasks);
  const dates = Object.keys(groups).sort();

  let html = "";
  dates.forEach((date) => {
    let label;
    if (date === today) label = "Hôm nay";
    else if (date < today) label = `Trễ hạn — ${formatDateShort(date)}`;
    else label = formatDateShort(date);

    html += `<div class="day-label">${label}</div><div class="task-list">`;
    groups[date].forEach((t) => (html += taskTicketHTML(t)));
    html += `</div>`;
  });

  container.innerHTML = html;
}

// ---------------- Hành động trên 1 việc ----------------

async function toggleTaskDone(id) {
  const ticket = document.querySelector(`.task-ticket[data-id="${id}"]`);
  const isDone = ticket.classList.contains("done");
  const newStatus = isDone ? "chua_lam" : "hoan_thanh";

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: newStatus, completed_at: newStatus === "hoan_thanh" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(
    id,
    STATE.me.id,
    newStatus === "hoan_thanh" ? "hoan_thanh" : "mo_lai",
    newStatus === "hoan_thanh" ? `${STATE.me.name} đánh dấu hoàn thành` : `${STATE.me.name} mở lại việc`
  );
  renderTasksView();
}

async function reassignTask(id, newUserId) {
  const newProfile = findProfile(STATE.profiles, newUserId);
  const { error } = await supabaseClient.from("tasks").update({ assigned_to: newUserId }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "doi_nguoi", `${STATE.me.name} đổi người làm thành ${newProfile ? newProfile.name : "?"}`);
  renderTasksView();
}

async function changeDueDate(id, newDate) {
  const { error } = await supabaseClient.from("tasks").update({ due_date: newDate }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "gia_han", `${STATE.me.name} đổi hạn thành ${formatDateShort(newDate)}`);
  renderTasksView();
}

async function markBusy(id) {
  await logHistory(id, STATE.me.id, "bao_ban", `${STATE.me.name} báo bận, nhờ đổi người`);
  alert("Đã báo. Mọi người có thể xem lịch sử và đổi giúp bạn.");
}

async function deleteTask(id) {
  if (!confirm("Xoá việc này? Không thể hoàn tác.")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) return alert("Lỗi: " + error.message);
  renderTasksView();
}

// ---------------- Gắn sự kiện (chỉ gắn 1 lần) ----------------

function bindTaskEvents() {
  const container = document.getElementById("tasks-container");
  if (container.dataset.bound) return;
  container.dataset.bound = "1";

  container.addEventListener("click", (e) => {
    const ticket = e.target.closest(".task-ticket");
    if (!ticket) return;
    const id = ticket.dataset.id;
    const action = e.target.dataset.action;
    if (action === "toggle") toggleTaskDone(id);
    if (action === "delete") deleteTask(id);
    if (action === "busy") markBusy(id);
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
      .map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`)
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

    await logHistory(data.id, STATE.me.id, "tao_viec", `${STATE.me.name} tạo việc "${title}"`);
    formCard.style.display = "none";
    document.getElementById("nt-title").value = "";
    document.getElementById("nt-desc").value = "";
    renderTasksView();
  });
}

async function loadTasksSection() {
  bindNewTaskForm();
  bindTaskEvents();
  await renderTasksView();
}
