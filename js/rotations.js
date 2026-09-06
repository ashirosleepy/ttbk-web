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

function currentHolder(queue) {
  if (!queue || !queue.member_order || queue.member_order.length === 0) return null;
  const id = queue.member_order[queue.current_index % queue.member_order.length];
  return findProfile(STATE.profiles, id);
}

// Người kế tiếp NGAY SAU 1 người cụ thể trong hàng đợi (dùng khi báo bận, chuyển việc)
function nextAfterUser(queue, userId) {
  const order = queue.member_order || [];
  const idx = order.indexOf(userId);
  if (idx === -1 || order.length === 0) return null;
  const nextId = order[(idx + 1) % order.length];
  return findProfile(STATE.profiles, nextId);
}

// Gọi khi 1 việc thuộc hàng đợi được hoàn thành: chuyển lượt cho người SAU người vừa làm xong
async function advanceQueueByCompleter(queueId, completedUserId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue || !queue.member_order || queue.member_order.length === 0) return;

  const order = queue.member_order;
  const idx = order.indexOf(completedUserId);
  const newIndex = idx === -1 ? (queue.current_index + 1) % order.length : (idx + 1) % order.length;

  await supabaseClient.from("rotation_queues").update({ current_index: newIndex }).eq("id", queueId);
}

// Tạo 1 việc phát sinh (đổ rác, thay bình nước...) giao cho người đang tới lượt
async function reportAdhocTask(queueId) {
  const { data: queue, error } = await supabaseClient.from("rotation_queues").select("*").eq("id", queueId).single();
  if (error || !queue) return alert("Không tìm thấy hàng đợi.");

  const holder = currentHolder(queue);
  if (!holder) return alert("Hàng đợi chưa có ai trong danh sách.");

  const { data: task, error: taskErr } = await supabaseClient
    .from("tasks")
    .insert({
      title: queue.label,
      assigned_to: holder.id,
      created_by: STATE.me.id,
      rotation_queue_id: queue.id,
      due_date: todayStr(),
      status: "cho_nhan",
      points: queue.points,
    })
    .select()
    .single();
  if (taskErr) return alert("Lỗi: " + taskErr.message);

  await logHistory(task.id, STATE.me.id, "bao_phat_sinh", `${STATE.me.name} báo có việc "${queue.label}", đến lượt ${holder.name}`);
  await createNotification(holder.id, `${queue.icon} ${queue.label} — đến lượt bạn. Bấm "Nhận việc" để xác nhận.`, {
    type: "den_luot",
    taskId: task.id,
  });

  alert(`Đã báo cho ${holder.name}.`);
  renderRotationAdmin();
}

function renderOrderPicker() {
  const wrap = document.getElementById("rq-order-picker");
  if (!wrap) return;
  wrap.innerHTML = STATE.profiles
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

  if (queues.length === 0) {
    listEl.innerHTML = `<p class="empty-state">Chưa có hàng đợi nào. Thử tạo cho "Đổ rác" hoặc "Thay bình nước".</p>`;
    return;
  }

  listEl.innerHTML = queues
    .map((q) => {
      const holder = currentHolder(q);
      const orderNames = (q.member_order || [])
        .map((id) => {
          const p = findProfile(STATE.profiles, id);
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
  if (!wrap.dataset.bound) {
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
  if (!listEl.dataset.bound) {
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
  if (!saveBtn.dataset.bound) {
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
