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
  const isPending = task.status === "cho_nhan";
  const isDone = task.status === "hoan_thanh";
  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";

  // Việc phát sinh / luân phiên đang chờ người được gán xác nhận
  if (isPending) {
    const isMine = task.assigned_to === STATE.me.id;
    return `
      <div class="task-ticket" style="border-left-color:${borderColor}" data-id="${task.id}">
        <div class="task-check" style="border-style:dashed;"></div>
        <div class="task-body">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            ${statusBadgeHTML(task.status)}
            <span>Đang chờ ${assignee ? escapeHTML(assignee.name) : "?"} nhận</span>
          </div>
        </div>
        <div class="task-actions">
          ${
            isMine
              ? `<button class="btn btn-primary btn-sm" data-action="accept">Nhận việc</button>
                 <button class="icon-btn" data-action="handoff" title="Không làm được — chuyển cho người kế tiếp">😅</button>`
              : ""
          }
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>`;
  }

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
        <button class="icon-btn" data-action="handoff" title="Không làm được — chuyển việc">😅</button>
        <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>`;
}

// Hiện/ẩn lịch sử thay đổi của 1 việc ngay bên dưới phiếu việc đó
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
        .map((r) => `<div class="history-row"><span class="history-time">${timeAgo(r.created_at)}</span><span>${escapeHTML(r.detail || r.action)}</span></div>`)
        .join("")
    : `<div class="history-row"><span style="color:var(--ink-faint)">Chưa có lịch sử thay đổi cho việc này.</span></div>`;
  ticketEl.insertAdjacentElement("afterend", panel);
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

// Sau khi thao tác xong 1 việc, làm mới đúng màn hình đang mở
// (vì cùng 1 phiếu việc có thể xuất hiện ở cả Tổng quan lẫn Công việc)
function refreshActiveView() {
  const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
  if (activeSection === "dashboard" && typeof renderDashboard === "function") return renderDashboard();
  renderTasksView();
}

// ---------------- Hành động trên 1 việc ----------------

async function toggleTaskDone(id) {
  const ticket = document.querySelector(`.task-ticket[data-id="${id}"]`);
  const isDone = ticket.classList.contains("done");
  const newStatus = isDone ? "chua_lam" : "hoan_thanh";

  const { data, error } = await supabaseClient
    .from("tasks")
    .update({ status: newStatus, completed_at: newStatus === "hoan_thanh" ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(
    id,
    STATE.me.id,
    newStatus === "hoan_thanh" ? "hoan_thanh" : "mo_lai",
    newStatus === "hoan_thanh" ? `${STATE.me.name} đánh dấu hoàn thành` : `${STATE.me.name} mở lại việc`
  );

  // Việc này thuộc 1 hàng đợi luân phiên -> xong thì chuyển lượt cho người kế tiếp
  if (newStatus === "hoan_thanh" && data.rotation_queue_id) {
    await advanceQueueByCompleter(data.rotation_queue_id, data.assigned_to);
  }

  refreshActiveView();
}

// Người được gán bấm "Nhận việc" cho việc đang ở trạng thái chờ nhận
async function acceptTask(id) {
  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "chua_lam" })
    .eq("id", id)
    .eq("status", "cho_nhan")
    .eq("assigned_to", STATE.me.id);
  if (error) return alert("Lỗi: " + error.message);
  await logHistory(id, STATE.me.id, "nhan_viec", `${STATE.me.name} đã nhận việc`);
  refreshActiveView();
  if (typeof refreshNotifBadge === "function") refreshNotifBadge();
}

async function reassignTask(id, newUserId) {
  const newProfile = findProfile(STATE.profiles, newUserId);
  const { error } = await supabaseClient.from("tasks").update({ assigned_to: newUserId }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "doi_nguoi", `${STATE.me.name} đổi người làm thành ${newProfile ? newProfile.name : "?"}`);
  refreshActiveView();
}

async function changeDueDate(id, newDate) {
  const { error } = await supabaseClient.from("tasks").update({ due_date: newDate }).eq("id", id);
  if (error) return alert("Lỗi: " + error.message);

  await logHistory(id, STATE.me.id, "gia_han", `${STATE.me.name} đổi hạn thành ${formatDateShort(newDate)}`);
  refreshActiveView();
}

// "Không làm được, chuyển việc" — hợp nhất báo bận + xin đổi việc:
// - Nếu việc thuộc 1 hàng đợi luân phiên: chuyển thẳng cho người kế tiếp trong hàng đợi.
// - Nếu là việc thường: tạo yêu cầu đổi việc, gửi thông báo cho mọi người, ai nhận trước thì được.
async function handoffTask(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");

  if (task.rotation_queue_id) {
    const { data: queue, error: qErr } = await supabaseClient
      .from("rotation_queues")
      .select("*")
      .eq("id", task.rotation_queue_id)
      .single();
    if (qErr || !queue) return alert("Không tìm thấy hàng đợi luân phiên.");

    const next = nextAfterUser(queue, task.assigned_to);
    if (!next) return alert("Không tìm được người kế tiếp trong hàng đợi.");

    const { error: updErr } = await supabaseClient.from("tasks").update({ assigned_to: next.id }).eq("id", id);
    if (updErr) return alert("Lỗi: " + updErr.message);

    await logHistory(id, STATE.me.id, "bao_ban_chuyen", `${STATE.me.name} báo bận, chuyển "${task.title}" cho ${next.name}`);
    await createNotification(next.id, `😅 ${STATE.me.name} báo bận, đến lượt bạn: "${task.title}".`, {
      type: "den_luot",
      taskId: id,
    });
    alert(`Đã chuyển việc cho ${next.name}.`);
    refreshActiveView();
    return;
  }

  const reason = prompt("Lý do (không bắt buộc):", "Bận việc khác") || "";
  const { data: exch, error: exErr } = await supabaseClient
    .from("task_exchanges")
    .insert({ task_id: id, from_user: STATE.me.id, reason, status: "open" })
    .select()
    .single();
  if (exErr) return alert("Lỗi: " + exErr.message);

  await logHistory(id, STATE.me.id, "xin_doi", `${STATE.me.name} xin đổi việc "${task.title}"${reason ? " — " + reason : ""}`);

  const others = STATE.profiles.filter((p) => p.id !== STATE.me.id);
  for (const p of others) {
    await createNotification(p.id, `🔄 ${STATE.me.name} muốn đổi việc "${task.title}". Ai nhận giúp?`, {
      type: "xin_doi",
      taskId: id,
      exchangeId: exch.id,
    });
  }
  alert("Đã gửi yêu cầu đổi việc tới mọi người.");
}

async function deleteTask(id) {
  if (!confirm("Xoá việc này? Không thể hoàn tác.")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) return alert("Lỗi: " + error.message);
  refreshActiveView();
}

// ---------------- Gắn sự kiện (chỉ gắn 1 lần) ----------------

function bindTaskEvents(containerId = "tasks-container") {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "1";

  container.addEventListener("click", (e) => {
    const ticket = e.target.closest(".task-ticket");
    if (!ticket) return;
    const id = ticket.dataset.id;
    const action = e.target.dataset.action;
    if (action === "toggle") toggleTaskDone(id);
    if (action === "accept") acceptTask(id);
    if (action === "handoff") handoffTask(id);
    if (action === "history") toggleTaskHistory(id, ticket);
    if (action === "delete") deleteTask(id);
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
