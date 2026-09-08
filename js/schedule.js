// ============================================================
// SCHEDULE.JS — trang "Lịch" (việc lặp lại) + tự sinh việc mỗi ngày
// Mỗi lịch có thể gán CỐ ĐỊNH (1 người) hoặc LUÂN PHIÊN (1 hàng đợi)
// ============================================================

async function fetchSchedules() {
  const { data, error } = await supabaseClient.from("schedules").select("*").order("created_at");
  if (error) {
    console.error("Không lấy được lịch:", error.message);
    return [];
  }
  return data;
}

function scheduleMatchesDate(schedule, dateObj, dateStr) {
  if (!schedule.active) return false;
  if (schedule.start_date && dateStr < schedule.start_date) return false;
  if (schedule.end_date && dateStr > schedule.end_date) return false;
  if (schedule.repeat_type === "daily") return true;
  if (schedule.repeat_type === "weekly") return (schedule.repeat_days || []).includes(dateObj.getDay());
  return false;
}

// Ai sẽ là người thực hiện lịch này hôm nay: cố định thì lấy assigned_to,
// luân phiên thì lấy người đang đứng đầu hàng đợi liên kết
function effectiveAssigneeId(schedule, queueMap) {
  if (schedule.rotation_queue_id) {
    const queue = queueMap[schedule.rotation_queue_id];
    const holder = currentHolder(queue);
    return holder ? holder.id : null;
  }
  return schedule.assigned_to;
}

// Gọi hàm này 1 lần mỗi khi mở app: tự tạo việc của "hôm nay" từ các lịch đang chạy,
// không tạo trùng nếu việc của lịch đó, ngày đó đã có rồi.
async function generateTodayTasks() {
  const today = todayStr();
  const todayObj = new Date(today + "T00:00:00");
  const schedules = await fetchSchedules();
  const matching = schedules.filter((s) => scheduleMatchesDate(s, todayObj, today));
  if (matching.length === 0) return;

  const queues = await fetchRotationQueues();
  const queueMap = Object.fromEntries(queues.map((q) => [q.id, q]));

  const scheduleIds = matching.map((s) => s.id);
  const { data: existing, error } = await supabaseClient
    .from("tasks")
    .select("schedule_id")
    .eq("due_date", today)
    .in("schedule_id", scheduleIds);
  if (error) {
    console.error("Không kiểm tra được việc đã tạo:", error.message);
    return;
  }

  const already = new Set((existing || []).map((t) => t.schedule_id));
  const toInsert = [];
  // Lịch cố định (không luân phiên) mà người phụ trách đang đi vắng hôm nay -> ghi lại
  // để sau khi tạo xong, báo cho các thành viên còn lại biết ai có thể nhận thay.
  const unownedBySchedule = new Map(); // schedule.id -> { title, awayName }

  matching
    .filter((s) => !already.has(s.id))
    .forEach((s) => {
      const isRotation = !!s.rotation_queue_id;
      const fixedProfile = !isRotation ? findProfile(STATE.profiles, s.assigned_to) : null;

      // Việc luân phiên: currentHolder() ở rotations.js đã tự bỏ qua người đang đi vắng rồi.
      if (!isRotation && fixedProfile && fixedProfile.is_away) {
        toInsert.push({
          title: s.title,
          description: s.description || null,
          assigned_to: null,
          created_by: s.assigned_to,
          schedule_id: s.id,
          rotation_queue_id: null,
          due_date: today,
          status: "vo_chu",
          priority: "binh_thuong",
          points: s.points,
        });
        unownedBySchedule.set(s.id, { title: s.title, awayName: fixedProfile.name });
        return;
      }

      const assignee = effectiveAssigneeId(s, queueMap);
      if (!assignee) return; // lịch luân phiên nhưng hàng đợi rỗng -> bỏ qua
      toInsert.push({
        title: s.title,
        description: s.description || null,
        assigned_to: assignee,
        created_by: assignee,
        schedule_id: s.id,
        rotation_queue_id: s.rotation_queue_id || null,
        due_date: today,
        status: "chua_lam",
        priority: "binh_thuong",
        points: s.points,
      });
    });

  if (toInsert.length === 0) return;

  const { data: insertedRows, error: insertErr } = await supabaseClient.from("tasks").insert(toInsert).select();
  if (insertErr) {
    console.error("Không tạo được việc từ lịch:", insertErr.message);
    return;
  }

  if (unownedBySchedule.size > 0) {
    const presentMembers = (STATE.profiles || []).filter((p) => !p.is_away);
    const rowByScheduleId = new Map((insertedRows || []).map((row) => [row.schedule_id, row]));

    for (const [scheduleId, info] of unownedBySchedule) {
      const row = rowByScheduleId.get(scheduleId);
      for (const member of presentMembers) {
        await createNotification(
          member.id,
          `📣 ${info.awayName} đang đi vắng — ai có thể nhận thay việc "${info.title}" hôm nay?`,
          { type: "thong_bao", taskId: row ? row.id : null }
        );
      }
    }
  }

  for (const row of insertedRows || []) {
    if (row.assigned_to) {
      await notifyTaskAssignee(row, `📌 Bạn có việc mới hôm nay: "${row.title}".`);
    }
  }
}

async function renderScheduleView() {
  const schedules = await fetchSchedules();
  const queues = await fetchRotationQueues();
  const queueMap = Object.fromEntries(queues.map((q) => [q.id, q]));
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

  const displayHolder = (queueId) => {
    const activeTask = activeTaskByQueue[queueId];
    return activeTask
      ? findProfile(STATE.profiles, activeTask.assigned_to)
      : currentHolder(queueMap[queueId]);
  };

  const listEl = document.getElementById("schedule-list");
  if (schedules.length === 0) {
    listEl.innerHTML = `<p class="empty-state">Chưa có lịch lặp lại nào.</p>`;
    return;
  }
  listEl.innerHTML = schedules
    .map((s) => {
      const rotating = !!s.rotation_queue_id;
      const who = rotating
        ? `🔁 luân phiên — hôm nay: ${(() => {
            const holder = displayHolder(s.rotation_queue_id);
            return holder ? escapeHTML(holder.name) : "?";
          })()}`
        : escapeHTML(findProfile(STATE.profiles, s.assigned_to)?.name || "?");
      const when = s.repeat_type === "daily" ? "Mỗi ngày" : "Mỗi " + (s.repeat_days || []).map((d) => WEEKDAY_LABEL[d]).join(", ");
      const holderColor = rotating
        ? displayHolder(s.rotation_queue_id)?.avatar_color || "#ccc"
        : findProfile(STATE.profiles, s.assigned_to)?.avatar_color || "#ccc";
      return `
      <div class="task-ticket" style="border-left-color:${holderColor}" data-id="${s.id}">
        <div class="task-body">
          <div class="task-title">${escapeHTML(s.title)}</div>
          <div class="task-meta"><span>${when}</span><span>${who}</span><span>${s.points} điểm</span></div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="del-schedule" title="Xoá lịch">🗑</button>
        </div>
      </div>`;
    })
    .join("");
}

function toggleAssignModeUI() {
  const mode = document.getElementById("sc-assign-mode").value;
  document.getElementById("sc-fixed-wrap").style.display = mode === "fixed" ? "block" : "none";
  document.getElementById("sc-rotation-wrap").style.display = mode === "rotation" ? "block" : "none";
}

async function refreshScheduleRotationOptions() {
  const sel = document.getElementById("sc-rotation-queue");
  if (!sel) return;
  const queues = await fetchRotationQueues();
  sel.innerHTML = queues.map((q) => `<option value="${q.id}">${q.icon} ${escapeHTML(q.label)}</option>`).join("");
}

function bindScheduleEvents() {
  const listEl = document.getElementById("schedule-list");
  if (!listEl.dataset.bound) {
    listEl.dataset.bound = "1";
    listEl.addEventListener("click", async (e) => {
      if (e.target.dataset.action !== "del-schedule") return;
      const id = e.target.closest(".task-ticket").dataset.id;
      if (!confirm("Xoá lịch lặp lại này? Các việc đã tạo trước đó vẫn giữ nguyên.")) return;
      const { error } = await supabaseClient.from("schedules").delete().eq("id", id);
      if (error) return alert("Lỗi: " + error.message);
      renderScheduleView();
    });
  }

  const repeatTypeSel = document.getElementById("sc-repeat-type");
  const daysPicker = document.getElementById("sc-days-picker");
  const assignModeSel = document.getElementById("sc-assign-mode");
  const saveBtn = document.getElementById("save-schedule");
  if (!repeatTypeSel || !daysPicker || !assignModeSel || !saveBtn) return;

  if (!repeatTypeSel.dataset.bound) {
    repeatTypeSel.dataset.bound = "1";
    repeatTypeSel.addEventListener("change", () => {
      daysPicker.style.display = repeatTypeSel.value === "weekly" ? "flex" : "none";
    });
  }

  if (!daysPicker.dataset.bound) {
    daysPicker.dataset.bound = "1";
    daysPicker.querySelectorAll(".day-toggle").forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("on"));
    });
  }

  if (!assignModeSel.dataset.bound) {
    assignModeSel.dataset.bound = "1";
    assignModeSel.addEventListener("change", toggleAssignModeUI);
  }

  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const title = document.getElementById("sc-title").value.trim();
      if (!title) return alert("Nhập tên việc lặp lại.");

      const repeatType = repeatTypeSel.value;
      const days = Array.from(daysPicker.querySelectorAll(".day-toggle.on")).map((b) => Number(b.dataset.day));
      if (repeatType === "weekly" && days.length === 0) return alert("Chọn ít nhất 1 ngày trong tuần.");

      const assignMode = assignModeSel.value;
      if (assignMode === "rotation" && !document.getElementById("sc-rotation-queue").value) {
        return alert("Chưa có hàng đợi luân phiên nào. Tạo 1 hàng đợi ở mục bên dưới trước đã.");
      }

      const payload = {
        title,
        assigned_to: assignMode === "fixed" ? document.getElementById("sc-assigned").value : null,
        rotation_queue_id: assignMode === "rotation" ? document.getElementById("sc-rotation-queue").value : null,
        repeat_type: repeatType,
        repeat_days: repeatType === "weekly" ? days : [],
        start_date: document.getElementById("sc-start").value || todayStr(),
        end_date: document.getElementById("sc-end").value || null,
        points: Number(document.getElementById("sc-points").value) || 10,
      };

      const { error } = await supabaseClient.from("schedules").insert(payload);
      if (error) return alert("Lỗi: " + error.message);

      document.getElementById("sc-title").value = "";
      await renderScheduleView();
      generateTodayTasks();
    });
  }
}

async function loadScheduleSection() {
  const assignedSelect = document.getElementById("sc-assigned");
  if (assignedSelect) {
    assignedSelect.innerHTML = STATE.profiles
      .map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`)
      .join("");
  }
  await refreshScheduleRotationOptions();
  if (document.getElementById("sc-assign-mode")) toggleAssignModeUI();
  bindScheduleEvents();
  await renderScheduleView();
  await loadRotationAdmin();
  await loadMonthCalendar();
}
