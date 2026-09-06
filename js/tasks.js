// ============================================================
// TASKS.JS — trang "Công việc" (Đã tích hợp Tab & Tự động luân phiên)
// ============================================================

// Biến lưu trữ ID người dùng đang được chọn xem (Mặc định sẽ gán là người đang đăng nhập)
let selectedUserId = null;

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

// Lấy danh sách các việc luân phiên đang active
async function fetchRotations() {
  const { data, error } = await supabaseClient
    .from("rotation_queues")
    .select("*")
    .eq("active", true);
  if (error) {
    console.error("Không lấy được hàng đợi luân phiên:", error.message);
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

async function buildTaskFrequencyMap({ title, rotation_queue_id, excludeUserIds = [] }) {
  const eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id));
  if (eligible.length === 0) return {};

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("assigned_to, title, rotation_queue_id")
    .eq("status", "hoan_thanh")
    .in("assigned_to", eligible.map((p) => p.id));

  if (error || !Array.isArray(data)) return {};

  const map = {};
  for (const row of data) {
    const matches = rotation_queue_id
      ? row.rotation_queue_id === rotation_queue_id
      : row.title === title;
    if (!matches) continue;
    map[row.assigned_to] = (map[row.assigned_to] || 0) + 1;
  }
  return map;
}

async function pickLeastFrequentAssignee({ title, rotation_queue_id, excludeUserIds = [] }) {
  const eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id));
  if (eligible.length === 0) return null;

  const frequencyMap = await buildTaskFrequencyMap({ title, rotation_queue_id, excludeUserIds });
  return [...eligible].sort((a, b) => {
    const diff = (frequencyMap[a.id] || 0) - (frequencyMap[b.id] || 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  })[0] || null;
}

// ================= GIAO DIỆN PHIẾU VIỆC =================

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
                 <button class="icon-btn" data-action="handoff" title="Bận — gửi yêu cầu cho 3 người còn lại">😅</button>`
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
        <button class="icon-btn" data-action="handoff" title="Bận — gửi yêu cầu cho 3 người còn lại">😅</button>
        <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>`;
}

// ================= XỬ LÝ GIAO DIỆN LỚN (TABS & LIST) =================

// Tạo HTML cho thanh Tabs 4 người
function renderTabsHTML() {
  let html = '<div class="tabs-container" style="display:flex; gap:10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">';
  STATE.profiles.forEach(p => {
      const isActive = p.id === selectedUserId;
      // Dùng màu của từng người để làm nổi bật tab
      const style = isActive 
        ? `background: ${p.avatar_color}; color: white; border: 1px solid ${p.avatar_color};` 
        : `background: transparent; color: ${p.avatar_color}; border: 1px solid ${p.avatar_color};`;
        
      html += `<button class="btn-tab" style="padding: 6px 16px; border-radius: 20px; cursor: pointer; font-weight: bold; white-space: nowrap; ${style}" data-user="${p.id}">${escapeHTML(p.name)}</button>`;
  });
  html += '</div>';
  return html;
}

// Render "Phiếu việc ảo" cho việc luân phiên TỰ ĐỘNG ĐẾN LƯỢT
function renderAutoRotationsHTML(rotations) {
  let html = '<div class="rotations-section" style="margin-bottom: 20px;">';
  html += '<h3 style="font-size: 0.9rem; text-transform: uppercase; color: var(--ink-faint);">Tới lượt luân phiên (Chưa làm)</h3>';
  
  // Lọc ra các queue mà current_index trỏ đúng vào người đang được chọn ở Tab
  const myRotations = rotations.filter(r => {
      if (!r.member_order || r.member_order.length === 0) return false;
      const currentTurnUserId = r.member_order[r.current_index];
      return currentTurnUserId === selectedUserId;
  });

  if (myRotations.length === 0) {
      html += '<p class="empty-state" style="padding: 10px; background: var(--bg-faint); border-radius: 8px;">Không có việc luân phiên nào đang chờ.</p>';
  } else {
      const assignee = findProfile(STATE.profiles, selectedUserId);
      const borderColor = assignee ? assignee.avatar_color : "#ccc";

      myRotations.forEach(r => {
          html += `
          <div class="task-ticket" style="border-left-color: ${borderColor}" data-queue-id="${r.id}">
              <button class="task-check" data-action="complete-rotation" title="Đánh dấu đã làm xong"></button>
              <div class="task-body">
                  <div class="task-title">${r.icon} ${escapeHTML(r.label)}</div>
                  <div class="task-meta">
                      <span style="background: #ff9800; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Đến lượt</span>
                      <span>+${r.points} điểm</span>
                  </div>
              </div>
              <div class="task-actions">
                  <button class="icon-btn" data-action="skip-rotation" title="Bận — Chuyển lượt cho người kế tiếp">😅</button>
              </div>
          </div>`;
      });
  }
  html += '</div>';
  return html;
}

async function renderTasksView() {
  const container = document.getElementById("tasks-container");
  
  // Mặc định chọn người đang đăng nhập nếu chưa chọn ai
  if (!selectedUserId) {
    selectedUserId = STATE.me.id;
  }

  // Tải song song cả danh sách task truyền thống và danh sách luân phiên
  const [tasks, rotations] = await Promise.all([fetchTasks(), fetchRotations()]);

  // Lọc task theo người đang được chọn ở Tab
  const filteredTasks = tasks.filter(t => t.assigned_to === selectedUserId);

  // Dựng giao diện: Tabs -> Việc Luân Phiên (Auto) -> Các việc cụ thể
  let html = renderTabsHTML();
  html += renderAutoRotationsHTML(rotations);

  html += '<h3 style="font-size: 0.9rem; text-transform: uppercase; color: var(--ink-faint); margin-top: 20px;">Công việc được gán</h3>';
  
  if (filteredTasks.length === 0) {
    html += `<p class="empty-state">Chưa có việc nào. Bấm "+ Thêm việc" để tạo việc.</p>`;
  } else {
    const today = todayStr();
    const groups = groupTasksByDate(filteredTasks);
    const dates = Object.keys(groups).sort();

    dates.forEach((date) => {
      let label;
      if (date === today) label = "Hôm nay";
      else if (date < today) label = `Trễ hạn — ${formatDateShort(date)}`;
      else label = formatDateShort(date);

      html += `<div class="day-label">${label}</div><div class="task-list">`;
      groups[date].forEach((t) => (html += taskTicketHTML(t)));
      html += `</div>`;
    });
  }

  container.innerHTML = html;
}

// Sau khi thao tác xong 1 việc, làm mới đúng màn hình đang mở
function refreshActiveView() {
  const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
  if (activeSection === "dashboard" && typeof renderDashboard === "function") return renderDashboard();
  renderTasksView();
}


// ================= XỬ LÝ HÀNH ĐỘNG =================

// Hiện/ẩn lịch sử thay đổi của 1 việc
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

// Hoàn thành task truyền thống
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

  if (newStatus === "hoan_thanh") {
    if (data.rotation_queue_id) {
      if (typeof advanceQueueByCompleter === "function") {
        await advanceQueueByCompleter(data.rotation_queue_id, data.assigned_to);
      }
    } else {
      const nextAssignee = await pickLeastFrequentAssignee({
        title: data.title,
        rotation_queue_id: data.rotation_queue_id,
        excludeUserIds: [data.assigned_to],
      });
      if (nextAssignee) {
        const { error: assignErr } = await supabaseClient
          .from("tasks")
          .update({ assigned_to: nextAssignee.id })
          .eq("id", id);
        if (!assignErr) {
          await logHistory(id, STATE.me.id, "giao_tiep", `${STATE.me.name} ưu tiên giao việc "${data.title}" cho ${nextAssignee.name} do tần suất làm ít hơn.`);
          await createNotification(nextAssignee.id, `📌 ${STATE.me.name} đã hoàn thành việc "${data.title}". Hệ thống ưu tiên giao tiếp cho bạn vì bạn làm ít hơn.` , { type: "thong_bao", taskId: id });
        }
      }
    }
  }

  refreshActiveView();
}

// NHÂN TÍNH NĂNG MỚI: Xử lý khi bấm hoàn thành việc Tự Động Luân Phiên
async function handleCompleteAutoRotation(queueId) {
    // Lấy thông tin queue
    const { data: queue, error: qErr } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
    if (qErr || !queue) return alert("Lỗi lấy thông tin luân phiên.");

    // Tự động tạo 1 task trạng thái "hoan_thanh" để ghi nhận điểm và lịch sử
    const payload = {
        title: queue.label,
        assigned_to: selectedUserId, // người đang làm
        created_by: STATE.me.id,
        rotation_queue_id: queue.id,
        status: 'hoan_thanh',
        points: queue.points,
        due_date: todayStr(),
        completed_at: new Date().toISOString()
    };

    const { data: task, error: tErr } = await supabaseClient.from('tasks').insert(payload).select().single();
    if (tErr) return alert("Lỗi ghi nhận công việc: " + tErr.message);

    // Ghi lịch sử
    await logHistory(task.id, STATE.me.id, "hoan_thanh", `${STATE.me.name} đã làm xong việc luân phiên: ${queue.label}`);

    // Tự động tăng current_index lên người tiếp theo
    const nextIndex = (queue.current_index + 1) % queue.member_order.length;
    await supabaseClient.from('rotation_queues').update({ current_index: nextIndex }).eq('id', queueId);

    refreshActiveView();
}

// NHÂN TÍNH NĂNG MỚI: Xử lý bỏ qua / chuyển lượt cho người sau
async function handleSkipAutoRotation(queueId) {
    const { data: queue } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
    if(!queue) return;

    const nextIndex = (queue.current_index + 1) % queue.member_order.length;
    await supabaseClient.from('rotation_queues').update({ current_index: nextIndex }).eq('id', queueId);
    
    const nextUserId = queue.member_order[nextIndex];
    if (typeof createNotification === "function") {
        await createNotification(nextUserId, `😅 ${STATE.me.name} bận, luân phiên "${queue.label}" đã chuyển đến lượt bạn!`, { type: "den_luot" });
    }
    refreshActiveView();
}

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

async function handoffTask(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");

  const reason = prompt("Lý do (không bắt buộc):", "Bận việc khác") || "";
  const others = (STATE.profiles || []).filter((p) => p.id !== STATE.me.id && p.id !== task.assigned_to);
  const othersIds = others.map((p) => p.id);

  if (othersIds.length === 0) {
    alert("Không còn ai khác để gửi yêu cầu đổi việc. Bạn phải làm việc này.");
    return;
  }

  await logHistory(id, STATE.me.id, "xin_doi", `${STATE.me.name} xin đổi việc "${task.title}"${reason ? " — " + reason : ""}`);

  let frequencyMap = {};
  if (othersIds.length) {
    const { data: doneTasks, error: countErr } = await supabaseClient
      .from("tasks")
      .select("assigned_to, title, rotation_queue_id")
      .eq("status", "hoan_thanh")
      .in("assigned_to", othersIds);

    if (!countErr && Array.isArray(doneTasks)) {
      for (const row of doneTasks) {
        const matches =
          task.rotation_queue_id && row.rotation_queue_id
            ? row.rotation_queue_id === task.rotation_queue_id
            : row.title === task.title;

        if (matches) {
          frequencyMap[row.assigned_to] = (frequencyMap[row.assigned_to] || 0) + 1;
        }
      }
    }
  }

  const orderedOthers = [...others].sort((a, b) => {
    const diff = (frequencyMap[a.id] || 0) - (frequencyMap[b.id] || 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  const createdExchangeIds = [];
  for (const p of orderedOthers) {
    const { data: exch, error: exErr } = await supabaseClient
      .from("task_exchanges")
      .insert({ task_id: id, from_user: STATE.me.id, to_user: p.id, reason, status: "open" })
      .select()
      .single();

    if (!exErr && exch) {
      createdExchangeIds.push(exch.id);
      await createNotification(p.id, `🔄 ${STATE.me.name} muốn đổi việc "${task.title}". Ai nhận giúp?`, {
        type: "xin_doi",
        taskId: id,
        exchangeId: exch.id,
      });
    }
  }

  alert(`Đã gửi yêu cầu đổi việc cho ${createdExchangeIds.length} người còn lại. Nếu cả 3 từ chối thì bạn phải làm việc này.`);
}

async function deleteTask(id) {
  if (!confirm("Xoá việc này? Không thể hoàn tác.")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) return alert("Lỗi: " + error.message);
  refreshActiveView();
}


// ================= GẮN SỰ KIỆN (CHỈ CHẠY 1 LẦN) =================

function bindTaskEvents(containerId = "tasks-container") {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "1";

  container.addEventListener("click", async (e) => {
    // 1. Xử lý click chuyển Tab User
    const tab = e.target.closest(".btn-tab");
    if (tab) {
        selectedUserId = tab.dataset.user;
        renderTasksView(); // Render lại danh sách
        return;
    }

    // 2. Xử lý click phiếu việc
    const ticket = e.target.closest(".task-ticket");
    if (!ticket) return;
    const id = ticket.dataset.id;
    const queueId = ticket.dataset.queueId; // Chứa ID của việc luân phiên tự động
    const action = e.target.dataset.action;

    // Phân luồng hành động:
    if (action === "toggle") toggleTaskDone(id);
    if (action === "accept") acceptTask(id);
    if (action === "handoff") handoffTask(id);
    if (action === "history") toggleTaskHistory(id, ticket);
    if (action === "delete") deleteTask(id);

    // Xử lý các nút của Phiếu việc luân phiên tự động
    if (action === "complete-rotation") await handleCompleteAutoRotation(queueId);
    if (action === "skip-rotation") await handleSkipAutoRotation(queueId);
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
      .map((p) => `<option value="${p.id}" ${p.id === selectedUserId ? 'selected' : ''}>${escapeHTML(p.name)}</option>`)
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
  // Gán tab mặc định là người dùng đang đăng nhập lúc load trang lần đầu
  if(!selectedUserId && STATE.me) {
      selectedUserId = STATE.me.id;
  }
  bindNewTaskForm();
  bindTaskEvents();
  await renderTasksView();
}