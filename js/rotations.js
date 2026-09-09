// ============================================================
// ROTATIONS.JS — hàng đợi luân phiên dùng cho việc phát sinh
// và việc lặp lại xoay vòng (thay vì gán cứng "Tiến luôn thứ 2")
// ============================================================

let rqOrder = []; // thứ tự đang chọn khi tạo hàng đợi mới (mảng id thành viên)
let editingRotationId = null;

function resetRotationForm() {
  editingRotationId = null;
  document.getElementById("rq-label").value = "";
  document.getElementById("rq-icon").value = "🔁";
  document.getElementById("rq-points").value = 10;
  rqOrder = [];
  renderOrderPicker();

  const saveBtn = document.getElementById("rq-save");
  if (saveBtn) saveBtn.textContent = "Tạo hàng đợi";
}

async function fetchRotationQueues() {
  const { data, error } = await supabaseClient.from("rotation_queues").select("*").order("created_at");
  if (error) {
    console.error("Không lấy được hàng đợi:", error.message);
    return [];
  }
  return data;
}

// Người đang tới lượt trong hàng đợi. Nếu người đó đang đi vắng, tự động bỏ qua (skip)
// và chuyển cho người kế tiếp trong hàng đợi — không cần đổi current_index lưu trong DB,
// vì lần "hoàn thành/không hoàn thành" tiếp theo sẽ tự dựa trên người thực sự đã làm.
function currentHolder(queue) {
  if (!queue || !queue.member_order || queue.member_order.length === 0) return null;
  const order = queue.member_order;
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const id = order[(queue.current_index + i) % n];
    const profile = findProfile(STATE.profiles, id);
    if (profile && !profile.is_away) return profile;
  }
  // Cả hàng đợi đều đang đi vắng -> đành trả về người theo lượt gốc để không bị kẹt.
  return findProfile(STATE.profiles, order[queue.current_index % n]);
}

// Người kế tiếp NGAY SAU 1 người cụ thể trong hàng đợi (dùng khi báo bận, chuyển việc),
// cũng bỏ qua những người đang đi vắng.
function nextAfterUser(queue, userId) {
  const order = queue.member_order || [];
  const idx = order.indexOf(userId);
  if (idx === -1 || order.length === 0) return null;
  const n = order.length;
  for (let i = 1; i <= n; i++) {
    const id = order[(idx + i) % n];
    const profile = findProfile(STATE.profiles, id);
    if (profile && !profile.is_away) return profile;
  }
  return findProfile(STATE.profiles, order[(idx + 1) % n]);
}

// Gọi khi 1 việc thuộc hàng đợi được hoàn thành: chuyển lượt cho người SAU người vừa làm xong
async function advanceQueueByCompleter(queueId, completedUserId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue || !queue.member_order || queue.member_order.length === 0) return;

  const order = queue.member_order;
  const idx = order.indexOf(completedUserId);
  const newIndex = idx === -1 ? (queue.current_index + 1) % order.length : (idx + 1) % order.length;

  const { error: updateError } = await supabaseClient
    .from("rotation_queues")
    .update({ current_index: newIndex })
    .eq("id", queueId);
  if (updateError) return;

  const nextQueue = { ...queue, current_index: newIndex };
  const nextHolder = currentHolder(nextQueue);
  if (nextHolder && nextHolder.id !== completedUserId) {
    await createNotification(nextHolder.id, `${queue.icon} ${queue.label} — đến lượt bạn.`, {
      type: "den_luot",
    });
  }
}

async function restoreQueueToUser(queueId, userId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("member_order").eq("id", queueId).single();
  if (error || !queue || !Array.isArray(queue.member_order)) return;

  const userIndex = queue.member_order.indexOf(userId);
  if (userIndex === -1) return;
  await supabaseClient.from("rotation_queues").update({ current_index: userIndex }).eq("id", queueId);
}

// Tạo 1 việc phát sinh (đổ rác, thay bình nước...) giao cho người đang tới lượt
async function reportAdhocTask(queueId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue) return alert("Không tìm thấy hàng đợi.");

  const { data: activeTask } = await supabaseClient
    .from("tasks")
    .select("assigned_to")
    .eq("rotation_queue_id", queueId)
    .eq("due_date", todayStr())
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const holder = activeTask?.assigned_to
    ? findProfile(STATE.profiles, activeTask.assigned_to)
    : currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  // Chỉ gửi thông báo nhắc người tới lượt, không tạo thêm task mới.
  await createNotification(holder.id, `${queue.icon} ${queue.label} — đến lượt bạn.`, {
    type: "den_luot",
  });

  await logHistory(
    null,
    STATE.me.id,
    "bao_phat_sinh",
    `${STATE.me.name} báo có việc "${queue.label}", đến lượt ${holder.name}`
  );

  alert(`Đã thông báo cho ${holder.name}.`);
  renderRotationAdmin();
}

function renderOrderPicker() {
  const wrap = document.getElementById("rq-order-picker");
  if (!wrap) return;

  const profiles = Array.isArray(STATE.profiles) ? STATE.profiles : [];
  wrap.innerHTML = profiles
    .map((p) => {
      const idx = rqOrder.indexOf(p.id);
      const label = idx === -1 ? escapeHTML(p.name) : `${idx + 1}. ${escapeHTML(p.name)}`;
      return `<button type="button" class="day-toggle ${idx !== -1 ? "on" : ""}" style="width:auto;padding:8px 12px;" data-member="${p.id}">${label}</button>`;
    })
    .join("");
}

async function renderRotationAdmin() {
  const queues = await fetchRotationQueues();
  const listEl = document.getElementById("rotation-list");

  if (!listEl) return;

  // Nếu task hôm nay đã được tạo, task.assigned_to là nguồn chính xác hơn
  // current_index vì lượt có thể đã được chuyển sau khi task được tạo.
  const { data: todayTasks, error: taskErr } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id, assigned_to, status")
    .eq("due_date", todayStr())
    .neq("status", "hoan_thanh");
  const activeTaskByQueue = taskErr
    ? {}
    : Object.fromEntries(
        (todayTasks || [])
          .filter((task) => task.rotation_queue_id && task.assigned_to)
          .map((task) => [task.rotation_queue_id, task])
      );

  const safeQueues = Array.isArray(queues) ? queues : [];
  if (safeQueues.length === 0) {
    listEl.innerHTML = `<p class="empty-state">Chưa có hàng đợi nào. Thử tạo cho "Đổ rác" hoặc "Thay bình nước".</p>`;
    return;
  }

  listEl.innerHTML = safeQueues
    .map((q) => {
      const activeTask = activeTaskByQueue[q.id];
      const holder = activeTask
        ? findProfile(STATE.profiles, activeTask.assigned_to)
        : currentHolder(q);
      const orderNames = (q.member_order || [])
        .map((id) => {
          const p = findProfile(Array.isArray(STATE.profiles) ? STATE.profiles : [], id);
          return p ? p.name : "?";
        })
        .join(" → ");
      return `
      <div class="task-ticket" style="border-left-color:${holder ? holder.avatar_color : "#ccc"}" data-id="${q.id}">
        <div class="task-body">
          <div class="task-title">${q.icon} ${escapeHTML(q.label)}</div>
          <div class="task-meta">
            <span>Thứ tự: ${escapeHTML(orderNames)}</span>
            <span>Đang tới lượt: <strong>${holder ? escapeHTML(holder.name) : "?"}</strong></span>
            <span>${q.points} điểm</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" data-action="report-adhoc">Báo có việc</button>
          <button class="icon-btn" data-action="edit-rotation" title="Sửa hàng đợi">✏️</button>
          <button class="icon-btn" data-action="del-rotation" title="Xoá hàng đợi">🗑</button>
        </div>
      </div>`;
    })
    .join("");
}

function bindRotationEvents() {
  const wrap = document.getElementById("rq-order-picker");
  if (wrap && !wrap.dataset.bound) {
    wrap.dataset.bound = "1";
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-member]");
      if (!btn) return;
      const id = btn.dataset.member;
      const idx = rqOrder.indexOf(id);
      if (idx === -1) rqOrder.push(id);
      else rqOrder.splice(idx, 1);
      renderOrderPicker();
    });
  }

  const listEl = document.getElementById("rotation-list");
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = "1";
    listEl.addEventListener("click", async (e) => {
      const ticket = e.target.closest(".task-ticket");
      if (!ticket) return;
      const id = ticket.dataset.id;
      if (e.target.dataset.action === "report-adhoc") await reportAdhocTask(id);
      if (e.target.dataset.action === "edit-rotation") {
        const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", id).single();
        if (error || !queue) return alert("Không tìm thấy hàng đợi để sửa.");

        editingRotationId = queue.id;
        document.getElementById("rq-label").value = queue.label || "";
        document.getElementById("rq-icon").value = queue.icon || "🔁";
        document.getElementById("rq-points").value = queue.points ?? 10;
        rqOrder = Array.isArray(queue.member_order) ? [...queue.member_order] : [];
        renderOrderPicker();

        const saveBtn = document.getElementById("rq-save");
        if (saveBtn) saveBtn.textContent = "Lưu thay đổi";
        document.getElementById("rq-label").focus();
      }
      if (e.target.dataset.action === "del-rotation") {
        if (!confirm("Xoá hàng đợi luân phiên này? Các lịch đang dùng hàng đợi này sẽ không còn tự gán được nữa.")) return;
        const { error } = await supabaseClient.from("rotation_queues").delete().eq("id", id);
        if (error) return alert("Lỗi: " + error.message);
        if (editingRotationId === id) resetRotationForm();
        renderRotationAdmin();
      }
    });
  }

  const saveBtn = document.getElementById("rq-save");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const label = document.getElementById("rq-label").value.trim();
      if (!label) return alert("Nhập tên việc.");
      if (rqOrder.length < 2) return alert("Chọn ít nhất 2 người theo đúng thứ tự luân phiên.");

      const payload = {
        label,
        icon: document.getElementById("rq-icon").value.trim() || "🔁",
        member_order: rqOrder,
        points: Number(document.getElementById("rq-points").value) || 10,
      };

      if (editingRotationId) {
        const { error } = await supabaseClient.from("rotation_queues").update(payload).eq("id", editingRotationId);
        if (error) return alert("Lỗi: " + error.message);
      } else {
        const { error } = await supabaseClient.from("rotation_queues").insert(payload);
        if (error) return alert("Lỗi: " + error.message);
      }

      resetRotationForm();
      renderRotationAdmin();
      if (typeof refreshScheduleRotationOptions === "function") refreshScheduleRotationOptions();
    });
  }
}

async function loadRotationAdmin() {
  renderOrderPicker();
  bindRotationEvents();
  await renderRotationAdmin();
}
