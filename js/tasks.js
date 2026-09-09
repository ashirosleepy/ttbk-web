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
  // Người đang đi vắng không được coi là ứng cử viên nhận việc mới.
  let eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id) && !p.is_away);
  if (eligible.length === 0) {
    // Nếu chỉ vì loại người đi vắng mà hết ứng viên thì đành bỏ ràng buộc đó để không bị kẹt.
    eligible = (STATE.profiles || []).filter((p) => !excludeUserIds.includes(p.id));
  }
  if (eligible.length === 0) return null;

  const [frequencyMap, pointsMap] = await Promise.all([
    buildTaskFrequencyMap({ title, rotation_queue_id, excludeUserIds }),
    typeof fetchMemberPointsMap === "function" ? fetchMemberPointsMap() : Promise.resolve({}),
  ]);

  return [...eligible].sort((a, b) => {
    const freqDiff = (frequencyMap[a.id] || 0) - (frequencyMap[b.id] || 0);
    if (freqDiff !== 0) return freqDiff;
    // Làm ít bằng nhau -> ưu tiên người đang có ít điểm hơn (chấm điểm công bằng hơn)
    const pointsDiff = (pointsMap[a.id] || 0) - (pointsMap[b.id] || 0);
    if (pointsDiff !== 0) return pointsDiff;
    return a.name.localeCompare(b.name);
  })[0] || null;
}

// ================= GIAO DIỆN PHIẾU VIỆC =================

function taskTicketHTML(task) {
  const isPending = task.status === "cho_nhan";
  const isDone = task.status === "hoan_thanh";
  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";

  // Việc cố định rơi vào ngày người phụ trách đang đi vắng: không có ai làm, hiện cho
  // TẤT CẢ mọi người thấy để ai đó bấm "Nhận thay" (được cộng thêm điểm thưởng).
  if (task.status === "vo_chu") {
    return `
      <div class="task-ticket" style="border-left-color:#c9932e; border-left-style:dashed;" data-id="${task.id}">
        <div class="task-check" style="border-style:dashed;">✈️</div>
        <div class="task-body">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            ${statusBadgeHTML(task.status)}
            <span>Người phụ trách đang đi vắng — chưa có ai làm việc này</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" data-action="claim-unassigned">🙋 Nhận thay (+${AWAY_COVER_BONUS}đ)</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>`;
  }

  const isMissed = task.status === "bo_lo";

  // Việc bị đánh dấu "Không hoàn thành" — vẫn hiện trong danh sách (gạch ngang),
  // có thể huỷ đánh dấu để hoàn lại điểm nếu đánh dấu nhầm.
  if (isMissed) {
    return `
      <div class="task-ticket missed" style="border-left-color:${borderColor}; opacity:0.7;" data-id="${task.id}">
        <div class="task-check" style="border-style:solid; border-color:#c0392b; color:#c0392b;">✕</div>
        <div class="task-body">
          <div class="task-title" style="text-decoration:line-through;">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            ${statusBadgeHTML(task.status)}
            <span>${assignee ? escapeHTML(assignee.name) : "?"} đã bỏ việc này</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="undo-miss" title="Huỷ đánh dấu bỏ việc, hoàn lại điểm">↺</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>`;
  }

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
                 <button class="icon-btn" data-action="handoff" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>`
              : ""
          }
          <button class="icon-btn" data-action="miss" title="Đánh dấu không hoàn thành (trừ điểm)">✕</button>
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>`;
  }

  const isRotationLinked = !!task.rotation_queue_id;

  // Phiếu việc ĐÃ HOÀN THÀNH: không cần sửa người làm / hạn nữa — chỉ cần biết
  // hoàn thành lúc nào, và nếu có hạn thì có trễ hay không.
  if (isDone) {
    const late = task.due_date ? daysOverdue(task.due_date, (task.completed_at || "").slice(0, 10)) : 0;
    return `
      <div class="task-ticket done" style="border-left-color:${borderColor}" data-id="${task.id}">
        <button class="task-check done" data-action="toggle" title="Mở lại việc này">✓</button>
        <div class="task-body">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            <span class="task-done-meta">✅ Hoàn thành lúc ${formatDateTimeShort(task.completed_at)}</span>
            ${late > 0 ? `<span class="task-overdue-tag">⚠️ Trễ ${late} ngày so với hạn ${formatDateShort(task.due_date)}</span>` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
          <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
        </div>
      </div>`;
  }

  const options = STATE.profiles
    .map((p) => `<option value="${p.id}" ${p.id === task.assigned_to ? "selected" : ""}>${escapeHTML(p.name)}</option>`)
    .join("");

  const late = !isRotationLinked ? daysOverdue(task.due_date) : 0;
  const dueControl = isRotationLinked
    ? `<span class="task-no-due">🔁 Việc luân phiên — không có hạn</span>`
    : `<input type="date" data-action="due" value="${task.due_date}" class="task-mini-date" title="Đổi hạn" />`;

  return `
    <div class="task-ticket" style="border-left-color:${borderColor}" data-id="${task.id}">
      <button class="task-check" data-action="toggle" title="Đánh dấu hoàn thành"></button>
      <div class="task-body">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          ${statusBadgeHTML(task.status)}
          ${late > 0 ? `<span class="task-overdue-tag">⚠️ Trễ ${late} ngày</span>` : ""}
          <select data-action="reassign" class="task-mini-select" title="Đổi người làm">${options}</select>
          ${dueControl}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="handoff" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>
        <button class="icon-btn" data-action="miss" title="Đánh dấu không hoàn thành (trừ điểm)">✕</button>
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

// Việc luân phiên chỉ có 1 trạng thái đáng quan tâm khi CHƯA XONG: "đang tới lượt ai".
// Trước đây trang này tách làm 2 khu vực (thẻ ảo "Tới lượt luân phiên" + thẻ thật
// "Việc luân phiên — chưa làm") dù về bản chất là cùng 1 loại dữ liệu, gây trùng lặp.
// Hàm này gộp lại thành DUY NHẤT 1 danh sách "🔁 Đang tới lượt", không hiển thị ngày hạn.
//
// - rotations: tất cả hàng đợi luân phiên đang active
// - queueHasTaskToday: các queue đã có 1 việc thật cho hôm nay rồi (vd vừa "xin chuyển việc")
//   -> không hiện thẻ ảo trùng, vì việc thật của queue đó đã nằm trong rotationPinnedTasks
// - rotationPinnedTasks: các việc thật (đã tạo), gắn với hàng đợi, của người đang được chọn,
//   mà chưa hoàn thành / chưa bị đánh dấu bỏ
function rotationTaskTicketHTML(task, queue) {
  if (!queue) return taskTicketHTML(task);

  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";
  return `
    <div class="task-ticket" style="border-left-color:${borderColor}" data-id="${task.id}">
      <button class="task-check" data-action="toggle" title="Đánh dấu hoàn thành"></button>
      <div class="task-body">
        <div class="task-title">${queue.icon} ${escapeHTML(queue.label)}</div>
        <div class="task-meta">
          <span class="badge badge-wait">Đến lượt</span>
          <span class="task-no-due">Không có ngày</span>
          <span>+${queue.points} điểm</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="handoff" title="Xin chuyển việc">😅</button>
        <button class="icon-btn" data-action="miss" title="Không hoàn thành">✕</button>
        <button class="icon-btn" data-action="history" title="Xem lịch sử">🕘</button>
        <button class="icon-btn" data-action="delete" title="Xoá việc">🗑</button>
      </div>
    </div>`;
}

function renderRotationSectionHTML(rotations, queueHasTaskToday, rotationPinnedTasks, queueMap) {
  const myVirtualTurns = rotations.filter((r) => {
    if (!r.member_order || r.member_order.length === 0) return false;
    const currentTurnUserId = r.member_order[r.current_index];
    if (currentTurnUserId !== selectedUserId) return false;
    return !queueHasTaskToday.has(r.id);
  });

  if (myVirtualTurns.length === 0 && rotationPinnedTasks.length === 0) return "";

  let html = '<div class="section-title rotation">🔁 Đang tới lượt</div><div class="task-list">';

  const assignee = findProfile(STATE.profiles, selectedUserId);
  const borderColor = assignee ? assignee.avatar_color : "#ccc";

  myVirtualTurns.forEach((r) => {
    html += `
      <div class="task-ticket" style="border-left-color: ${borderColor}" data-queue-id="${r.id}">
          <button class="task-check" data-action="complete-rotation" title="Đánh dấu đã làm xong"></button>
          <div class="task-body">
              <div class="task-title">${r.icon} ${escapeHTML(r.label)}</div>
              <div class="task-meta">
                  <span class="badge badge-wait">Đến lượt</span>
                  <span class="task-no-due">Không có ngày</span>
                  <span>+${r.points} điểm</span>
              </div>
          </div>
          <div class="task-actions">
              <button class="icon-btn" data-action="request-handoff" data-queue="${r.id}" title="Xin chuyển việc — gửi yêu cầu cho 3 người còn lại">😅</button>
              <button class="icon-btn" data-action="miss-rotation" data-queue="${r.id}" title="Không hoàn thành — trừ điểm và chuyển lượt cho người kế tiếp">✕</button>
          </div>
      </div>`;
  });

  rotationPinnedTasks.forEach((t) => (html += rotationTaskTicketHTML(t, queueMap[t.rotation_queue_id])));

  html += "</div>";
  return html;
}

// Việc vừa hoàn thành vẫn hiện ở đây (có ghi giờ) trong vài ngày, sau đó mới coi là
// "cũ" và chỉ còn nằm trong Nhật ký hoạt động — tránh vừa bấm xong là biến mất luôn.
const RECENT_DONE_DAYS = 3;

// Bộ lọc nhanh đang chọn cho trang Công việc: all | today | rotation | overdue | done
let taskDisplayFilter = "all";

function renderTaskFilterBarHTML() {
  const filters = [
    { key: "all", label: "Tất cả" },
    { key: "today", label: "🔥 Hôm nay" },
    { key: "rotation", label: "🔁 Luân phiên" },
    { key: "overdue", label: "⚠️ Trễ hạn" },
    { key: "done", label: "✅ Đã xong" },
  ];
  const chips = filters
    .map(
      (f) =>
        `<button type="button" class="filter-chip ${taskDisplayFilter === f.key ? "on" : ""}" data-filter="${f.key}">${f.label}</button>`
    )
    .join("");
  return `<div class="task-filter-bar">${chips}</div>`;
}

async function renderTasksView() {
  const container = document.getElementById("tasks-container");

  // Mặc định chọn người đang đăng nhập nếu chưa chọn ai
  if (!selectedUserId) {
    selectedUserId = STATE.me.id;
  }

  // Tải song song cả danh sách task truyền thống và danh sách luân phiên
  const [tasks, rotations] = await Promise.all([fetchTasks(), fetchRotations()]);
  const queueMap = Object.fromEntries(rotations.map((queue) => [queue.id, queue]));

  // Lọc task theo người đang được chọn ở Tab
  const filteredTasks = tasks.filter((t) => t.assigned_to === selectedUserId);

  const today = todayStr();

  // Những hàng đợi đã có 1 việc thật cho hôm nay (vd vừa "xin chuyển việc")
  // thì không hiện thẻ ảo "Đang tới lượt" nữa, tránh hiện trùng.
  const queueHasTaskToday = new Set(
    tasks
      .filter((t) => t.rotation_queue_id && t.due_date === today && t.status !== "hoan_thanh")
      .map((t) => t.rotation_queue_id)
  );

  // Việc gắn với hàng đợi luân phiên, chưa xong / chưa bị đánh dấu bỏ -> không có hạn,
  // luôn nằm trong nhóm "Đang tới lượt" (không chôn theo ngày như việc thường).
  const rotationPinned = filteredTasks.filter(
    (t) => t.rotation_queue_id && t.status !== "hoan_thanh" && t.status !== "bo_lo"
  );
  const rest = filteredTasks.filter((t) => !rotationPinned.includes(t));

  const todayTasks = rest.filter((t) => t.status !== "hoan_thanh" && t.due_date === today);
  const overdueTasks = rest
    .filter((t) => t.status !== "hoan_thanh" && t.due_date < today)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1)); // trễ lâu nhất lên trước
  const upcomingTasks = rest.filter((t) => t.status !== "hoan_thanh" && t.due_date > today);

  // Hoàn thành gần đây: gồm cả việc thường lẫn việc luân phiên đã xong, mới nhất lên trước.
  const doneCutoffMs = Date.now() - RECENT_DONE_DAYS * 86400000;
  const recentDone = filteredTasks
    .filter((t) => t.status === "hoan_thanh" && t.completed_at && new Date(t.completed_at).getTime() >= doneCutoffMs)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

  const rotationSectionHTML = renderRotationSectionHTML(rotations, queueHasTaskToday, rotationPinned, queueMap);
  const hasRotationTurn = rotationSectionHTML !== "";

  const sections = [];

  if (todayTasks.length > 0) {
    sections.push({
      key: "today",
      html: `<div class="section-title today">🔥 Hôm nay</div><div class="task-list">${todayTasks
        .map((t) => taskTicketHTML(t))
        .join("")}</div>`,
    });
  }
  if (hasRotationTurn) {
    sections.push({ key: "rotation", html: rotationSectionHTML });
  }
  if (overdueTasks.length > 0) {
    sections.push({
      key: "overdue",
      html: `<div class="section-title overdue">⚠️ Cần xử lý</div><div class="task-list">${overdueTasks
        .map((t) => taskTicketHTML(t))
        .join("")}</div>`,
    });
  }
  if (upcomingTasks.length > 0) {
    const groups = groupTasksByDate(upcomingTasks);
    const dates = Object.keys(groups).sort();
    const body = dates
      .map((date) => `<div class="day-label">${formatDateShort(date)}</div><div class="task-list">${groups[date].map((t) => taskTicketHTML(t)).join("")}</div>`)
      .join("");
    sections.push({ key: "upcoming", html: `<div class="section-title upcoming">📅 Sắp tới</div>${body}` });
  }
  if (recentDone.length > 0) {
    sections.push({
      key: "done",
      html: `<div class="section-title done">✅ Hoàn thành gần đây</div><div class="task-list">${recentDone
        .map((t) => taskTicketHTML(t))
        .join("")}</div>`,
    });
  }

  let html = renderTabsHTML() + renderTaskFilterBarHTML();

  // Bộ lọc nhanh: "Tất cả" hiện mọi nhóm, còn lại chỉ hiện đúng 1 nhóm tương ứng.
  // "Trễ hạn" hiện nhóm "Cần xử lý", "Luân phiên" hiện nhóm "Đang tới lượt".
  const filterToSection = { today: "today", rotation: "rotation", overdue: "overdue", done: "done" };
  const visibleSections =
    taskDisplayFilter === "all" ? sections : sections.filter((s) => s.key === filterToSection[taskDisplayFilter]);

  if (sections.length === 0) {
    html += `<p class="empty-state">Chưa có việc nào. Bấm "+ Thêm việc" để tạo việc.</p>`;
  } else if (visibleSections.length === 0) {
    html += `<p class="empty-state">Không có việc nào trong bộ lọc này.</p>`;
  } else {
    html += visibleSections.map((s) => s.html).join("");
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
  const currentTask = await supabaseClient.from("tasks").select("assigned_to, title").eq("id", id).single();
  const assignedProfile = currentTask.data ? findProfile(STATE.profiles, currentTask.data.assigned_to) : null;
  const actingFor = assignedProfile && assignedProfile.id !== STATE.me.id
    ? ` hộ ${assignedProfile.name}`
    : "";

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
    newStatus === "hoan_thanh"
      ? `${STATE.me.name} đánh dấu hoàn thành${actingFor}`
      : `${STATE.me.name} mở lại việc${actingFor}`
  );

  if (newStatus === "hoan_thanh") {
    if (typeof distributeAwayShadowPoints === "function") {
      await distributeAwayShadowPoints(id, data.points);
    }

    if (data.rotation_queue_id) {
      if (typeof advanceQueueByCompleter === "function") {
        await advanceQueueByCompleter(data.rotation_queue_id, data.assigned_to);
      }
    } else {
      // CHỈ gợi ý cho lần giao việc TIẾP THEO — KHÔNG được đổi assigned_to của task vừa
      // hoàn thành này, vì đó là bản ghi lịch sử dùng để tính điểm cho người đã làm.
      const nextAssignee = await pickLeastFrequentAssignee({
        title: data.title,
        rotation_queue_id: data.rotation_queue_id,
        excludeUserIds: [data.assigned_to],
      });
      if (nextAssignee) {
        await createNotification(
          nextAssignee.id,
          `📌 ${STATE.me.name} đánh dấu hoàn thành${actingFor} việc "${data.title}". Lần sau việc này nên ưu tiên giao cho bạn vì bạn làm ít hơn.`,
          { type: "thong_bao", taskId: id }
        );
      }
    }
  } else if (data.rotation_queue_id && typeof restoreQueueToUser === "function") {
    await restoreQueueToUser(data.rotation_queue_id, data.assigned_to);
  }

  refreshActiveView();
}

// NHÂN TÍNH NĂNG MỚI: Xử lý khi bấm hoàn thành việc Tự Động Luân Phiên
async function handleCompleteAutoRotation(queueId) {
    // Lấy thông tin queue
    const { data: queue, error: qErr } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
    if (qErr || !queue) return alert("Lỗi lấy thông tin luân phiên.");
  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

    // Tự động tạo 1 task trạng thái "hoan_thanh" để ghi nhận điểm và lịch sử
    const payload = {
        title: queue.label,
    assigned_to: holder.id, // người đang tới lượt và hoàn thành việc
        created_by: STATE.me.id,
        rotation_queue_id: queue.id,
        status: 'hoan_thanh',
        points: queue.points,
        due_date: todayStr(),
        completed_at: new Date().toISOString()
    };

    const { data: task, error: tErr } = await supabaseClient.from('tasks').insert(payload).select().single();
    if (tErr) return alert("Lỗi ghi nhận công việc: " + tErr.message);

    if (typeof distributeAwayShadowPoints === "function") {
      await distributeAwayShadowPoints(task.id, queue.points);
    }

    // Ghi lịch sử
    await logHistory(task.id, STATE.me.id, "hoan_thanh", `${STATE.me.name} đã làm xong việc luân phiên: ${queue.label}`);

    // Tự động tăng current_index lên người tiếp theo
    const nextIndex = (queue.current_index + 1) % queue.member_order.length;
    const { error: queueError } = await supabaseClient
      .from('rotation_queues')
      .update({ current_index: nextIndex })
      .eq('id', queueId);
    if (!queueError) {
      const nextHolder = currentHolder({ ...queue, current_index: nextIndex });
      if (nextHolder && nextHolder.id !== holder.id) {
        await createNotification(nextHolder.id, `${queue.icon} ${queue.label} — đến lượt bạn.`, {
          type: "den_luot",
        });
      }
    }

    refreshActiveView();
}

// Đánh dấu lượt luân phiên hiện tại là "Không hoàn thành": tạo 1 phiếu việc trạng thái
// bo_lo để lưu lại lịch sử + trừ điểm người đang tới lượt, rồi tự chuyển sang người kế tiếp
// (giống hệt việc họ đã "hoàn thành" về mặt chuyển lượt, chỉ khác là bị trừ điểm thay vì cộng).
async function handleMissRotation(queueId) {
  const { data: queue, error: qErr } = await supabaseClient.from('rotation_queues').select('*').eq('id', queueId).single();
  if (qErr || !queue) return alert("Lỗi lấy thông tin luân phiên.");

  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  const penalty = -Math.round((queue.points || 0) * MISS_PENALTY_RATIO);
  if (!confirm(`Đánh dấu "${queue.label}" là KHÔNG hoàn thành? ${holder.name} sẽ bị trừ ${Math.abs(penalty)} điểm và lượt sẽ chuyển cho người kế tiếp.`)) return;

  const payload = {
    title: queue.label,
    assigned_to: holder.id,
    created_by: STATE.me.id,
    rotation_queue_id: queue.id,
    status: 'bo_lo',
    points: queue.points,
    due_date: todayStr(),
  };

  const { data: task, error: tErr } = await supabaseClient.from('tasks').insert(payload).select().single();
  if (tErr) return alert("Lỗi ghi nhận: " + tErr.message);

  if (penalty !== 0) await addPointAdjustment(holder.id, task.id, penalty, "bo_viec");

  await logHistory(task.id, STATE.me.id, "bo_viec", `${STATE.me.name} đánh dấu "${queue.label}" là không hoàn thành (trừ ${Math.abs(penalty)} điểm của ${holder.name}).`);

  const nextIndex = (queue.current_index + 1) % queue.member_order.length;
  await supabaseClient.from('rotation_queues').update({ current_index: nextIndex }).eq('id', queueId);

  refreshActiveView();
}

// Đánh dấu 1 việc thường/việc phát sinh đã có phiếu thật là "Không hoàn thành": đổi trạng
// thái sang bo_lo và trừ điểm người phụ trách (một nửa điểm thưởng của việc đó).
async function markTaskMissed(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");
  const assignee = findProfile(STATE.profiles, task.assigned_to);

  const penalty = -Math.round((task.points || 0) * MISS_PENALTY_RATIO);
  if (!confirm(`Đánh dấu "${task.title}" là KHÔNG hoàn thành? ${assignee ? assignee.name : "Người phụ trách"} sẽ bị trừ ${Math.abs(penalty)} điểm.`)) return;

  const { error: updErr } = await supabaseClient.from("tasks").update({ status: "bo_lo" }).eq("id", id);
  if (updErr) return alert("Lỗi: " + updErr.message);

  if (penalty !== 0 && task.assigned_to) {
    await addPointAdjustment(task.assigned_to, id, penalty, "bo_viec");
  }

  await logHistory(
    id,
    STATE.me.id,
    "bo_viec",
    `${STATE.me.name} đánh dấu "${task.title}" là không hoàn thành${assignee && assignee.id !== STATE.me.id ? ` hộ ${assignee.name}` : ""}${penalty ? ` (trừ ${Math.abs(penalty)} điểm của ${assignee ? assignee.name : "?"})` : ""}.`
  );
  refreshActiveView();
}

// Huỷ đánh dấu "bỏ việc" nếu lỡ đánh dấu nhầm: trả việc về "chưa làm" và hoàn lại điểm đã trừ.
async function undoMissedTask(id) {
  if (!confirm("Huỷ đánh dấu bỏ việc? Việc sẽ trở lại trạng thái chưa làm và điểm đã trừ sẽ được hoàn lại.")) return;

  const { error: updErr } = await supabaseClient.from("tasks").update({ status: "chua_lam" }).eq("id", id);
  if (updErr) return alert("Lỗi: " + updErr.message);

  const { error: delErr } = await supabaseClient
    .from("point_adjustments")
    .delete()
    .eq("task_id", id)
    .eq("reason", "bo_viec");
  if (delErr) console.error("Không hoàn lại được điểm:", delErr.message);

  await logHistory(id, STATE.me.id, "huy_bo_viec", `${STATE.me.name} huỷ đánh dấu bỏ việc, hoàn lại điểm.`);
  refreshActiveView();
}

// XIN CHUYỂN VIỆC cho việc luân phiên phát sinh (chưa có phiếu việc thật):
// tạo 1 phiếu việc thật gán cho người đang tới lượt, rồi gửi yêu cầu chuyển việc
// cho 3 người còn lại — giống hệt việc thường (ai nhận trước thì được).
// Nếu cả 3 từ chối, người đang tới lượt buộc phải tự làm (xử lý sẵn trong
// rejectExchangeFromNotif ở notifications.js).
async function requestRotationHandoff(queueId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue) return alert("Không tìm thấy hàng đợi.");

  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  const today = todayStr();

  // Nếu đã có sẵn 1 phiếu việc thật cho lượt này hôm nay thì dùng lại, tránh tạo trùng
  const { data: existing, error: findErr } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("rotation_queue_id", queueId)
    .eq("due_date", today)
    .neq("status", "hoan_thanh")
    .maybeSingle();

  let taskId = !findErr && existing ? existing.id : null;

  if (!taskId) {
    const payload = {
      title: queue.label,
      assigned_to: holder.id,
      created_by: holder.id,
      rotation_queue_id: queue.id,
      due_date: today,
      status: "chua_lam",
      priority: "binh_thuong",
      points: queue.points,
    };
    const { data: task, error: insertErr } = await supabaseClient.from("tasks").insert(payload).select().single();
    if (insertErr) return alert("Lỗi tạo việc: " + insertErr.message);
    taskId = task.id;
  }

  await handoffTask(taskId);
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

// Nhận thay 1 việc "vô chủ" (người phụ trách gốc đang đi vắng): người đầu tiên bấm
// "Nhận thay" sẽ được gán việc đó và được cộng thêm điểm thưởng AWAY_COVER_BONUS.
async function claimUnassignedTask(id) {
  const { data: task, error } = await supabaseClient.from("tasks").select("*").eq("id", id).single();
  if (error || !task) return alert("Không tìm thấy việc.");
  if (task.status !== "vo_chu") {
    alert("Việc này đã có người nhận rồi.");
    refreshActiveView();
    return;
  }

  const { data, error: updErr } = await supabaseClient
    .from("tasks")
    .update({ assigned_to: STATE.me.id, status: "chua_lam" })
    .eq("id", id)
    .eq("status", "vo_chu")
    .select()
    .single();

  if (updErr || !data) {
    alert("Việc này vừa có người khác nhận mất rồi.");
    refreshActiveView();
    return;
  }

  await addPointAdjustment(STATE.me.id, id, AWAY_COVER_BONUS, "nhan_thay_vang_mat");
  await logHistory(
    id,
    STATE.me.id,
    "nhan_thay",
    `${STATE.me.name} nhận thay việc "${task.title}" của người đang đi vắng (+${AWAY_COVER_BONUS} điểm thưởng).`
  );

  refreshActiveView();
  if (typeof refreshNotifBadge === "function") refreshNotifBadge();
  alert(`Bạn đã nhận thay việc này (+${AWAY_COVER_BONUS} điểm thưởng).`);
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
  let others = (STATE.profiles || []).filter((p) => p.id !== STATE.me.id && p.id !== task.assigned_to && !p.is_away);
  if (others.length === 0) {
    // Nếu ai cũng đang đi vắng thì đành bỏ ràng buộc đó, còn hơn không gửi được cho ai.
    others = (STATE.profiles || []).filter((p) => p.id !== STATE.me.id && p.id !== task.assigned_to);
  }
  const othersIds = others.map((p) => p.id);

  if (othersIds.length === 0) {
    alert("Không còn ai khác để gửi yêu cầu đổi việc. Bạn phải làm việc này.");
    return;
  }

  const assignee = findProfile(STATE.profiles, task.assigned_to);
  const actingFor = assignee && assignee.id !== STATE.me.id ? ` hộ ${assignee.name}` : "";
  await logHistory(id, STATE.me.id, "xin_doi", `${STATE.me.name} báo bận${actingFor} và xin đổi việc "${task.title}"${reason ? " — " + reason : ""}`);

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

    // 1b. Xử lý click bộ lọc nhanh
    const filterChip = e.target.closest(".filter-chip");
    if (filterChip) {
      taskDisplayFilter = filterChip.dataset.filter;
      renderTasksView();
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
    if (action === "miss") await markTaskMissed(id);
    if (action === "undo-miss") await undoMissedTask(id);
    if (action === "history") toggleTaskHistory(id, ticket);
    if (action === "delete") deleteTask(id);
    if (action === "claim-unassigned") await claimUnassignedTask(id);

    // Xử lý các nút của Phiếu việc luân phiên tự động
    if (action === "complete-rotation") await handleCompleteAutoRotation(queueId);
    if (action === "request-handoff") await requestRotationHandoff(queueId);
    if (action === "miss-rotation") await handleMissRotation(queueId);
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
    await notifyTaskAssignee(data);
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
  if (typeof bindAutoAssignEvents === "function") bindAutoAssignEvents();
  await renderTasksView();
}