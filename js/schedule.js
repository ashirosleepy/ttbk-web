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
  const { data: activeTasks, error: taskErr } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id, assigned_to, status")
    .in("status", ["cho_nhan", "chua_lam", "dang_cho"])
    .order("created_at", { ascending: false });
  const activeTaskByQueue = taskErr
    ? {}
    : (activeTasks || []).reduce((map, task) => {
        if (task.rotation_queue_id && task.assigned_to && !map[task.rotation_queue_id]) {
          map[task.rotation_queue_id] = task;
        }
        return map;
      }, {});

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

// ============================================================
// LỊCH HỌC — theo tuần thực tế (không lặp cố định theo thứ)
// ============================================================

let clsWeekAnchor = new Date();

function classWeekLabel(weekDates) {
  const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const first = weekDates[0];
  const last = weekDates[6];
  const todayWeekStart = getWeekDates(new Date())[0];
  const weekDifference = Math.round((first - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));
  let relativeLabel = "tuần này";

  if (weekDifference < 0) {
    const weeksAgo = Math.abs(weekDifference);
    relativeLabel = weeksAgo === 1 ? "tuần trước" : `${weeksAgo} tuần trước`;
  } else if (weekDifference > 0) {
    relativeLabel = weekDifference === 1 ? "tuần sau" : `${weekDifference} tuần sau`;
  }

  return `${fmt(first)} - ${fmt(last)}/${last.getFullYear()} (${relativeLabel})`;
}

async function renderClassScheduleCard() {
  const gridEl = document.getElementById("cls-grid");
  const labelEl = document.getElementById("cls-week-label");
  if (!gridEl || !labelEl) return;

  const weekDates = getWeekDates(clsWeekAnchor);
  labelEl.textContent = classWeekLabel(weekDates);

  const university = STATE.me?.university;
  if (!university) {
    gridEl.innerHTML = `<p class="empty-state">Chưa chọn trường học — vào mục Cài đặt để chọn trước.</p>`;
    return;
  }

  gridEl.innerHTML = `<p class="empty-state">Đang tải khung tiết...</p>`;
  const periods = await fetchClassPeriods(university);
  if (periods.length === 0) {
    gridEl.innerHTML = `<p class="empty-state">Chưa có dữ liệu khung tiết cho trường này.</p>`;
    return;
  }

  const rows = await fetchUserClassSchedule(STATE.me.id, { fresh: true });
  const weekKeys = weekDates.map(classDateKey);
  const ticks = new Set(
    rows
      .filter((r) => r.university === university && weekKeys.includes(r.class_date))
      .map((r) => `${r.class_date}-${r.period_number}`)
  );

  const header = `<tr><th style="text-align:left;padding:4px 8px;">Tiết</th>${weekDates
    .map(
      (d) =>
        `<th style="padding:4px 8px;">${CLASS_WEEKDAY_SHORT[d.getDay()]}<br><span style="font-weight:400;font-size:11px;">${String(
          d.getDate()
        ).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}</span></th>`
    )
    .join("")}</tr>`;

  const bodyRows = periods
    .map((p) => {
      const timeLabel = `${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`;
      const cells = weekDates
        .map((d) => {
          const dateKey = classDateKey(d);
          const key = `${dateKey}-${p.period_number}`;
          const checked = ticks.has(key) ? "checked" : "";
          return `<td style="text-align:center;padding:4px 8px;"><input type="checkbox" data-date="${dateKey}" data-period="${p.period_number}" ${checked} /></td>`;
        })
        .join("");
      return `<tr><td style="padding:4px 8px;white-space:nowrap;">Tiết ${p.period_number}<br><span style="font-size:11px;color:var(--ink-faint);">${timeLabel}</span></td>${cells}</tr>`;
    })
    .join("");

  gridEl.innerHTML = `<table class="class-schedule-table" style="width:100%;border-collapse:collapse;font-size:13px;">${header}${bodyRows}</table>`;
}

async function saveClassScheduleWeek() {
  const university = STATE.me?.university;
  const statusEl = document.getElementById("cls-status");
  const saveBtn = document.getElementById("cls-save");
  if (!university) return;

  const weekDates = getWeekDates(clsWeekAnchor);
  const weekKeys = weekDates.map(classDateKey);

  const ticked = Array.from(document.querySelectorAll("#cls-grid input[type=checkbox]:checked")).map((cb) => ({
    user_id: STATE.me.id,
    university,
    class_date: cb.dataset.date,
    period_number: Number(cb.dataset.period),
  }));

  if (saveBtn) saveBtn.disabled = true;
  if (statusEl) statusEl.textContent = "Đang lưu...";

  // Chỉ xoá + ghi lại đúng các ngày trong tuần đang sửa, không đụng tới tuần khác.
  const { error: delErr } = await supabaseClient
    .from("user_class_schedule")
    .delete()
    .eq("user_id", STATE.me.id)
    .eq("university", university)
    .in("class_date", weekKeys);
  if (delErr) {
    if (saveBtn) saveBtn.disabled = false;
    if (statusEl) statusEl.textContent = "";
    return alert("Lỗi: " + delErr.message);
  }

  if (ticked.length > 0) {
    const { error: insErr } = await supabaseClient.from("user_class_schedule").insert(ticked);
    if (insErr) {
      if (saveBtn) saveBtn.disabled = false;
      if (statusEl) statusEl.textContent = "";
      return alert("Lỗi: " + insErr.message);
    }
  }

  invalidateUserClassScheduleCache(STATE.me.id);
  if (saveBtn) saveBtn.disabled = false;
  if (statusEl) statusEl.textContent = "Đã lưu lịch học tuần này.";
}

// Chép các tiết đã tick của tuần trước sang đúng cùng thứ của tuần đang xem
// (chỉ tick lên lưới hiện tại — vẫn phải bấm "Lưu lịch học tuần này" để ghi lại).
async function copyClassScheduleFromPrevWeek() {
  const university = STATE.me?.university;
  const statusEl = document.getElementById("cls-status");
  if (!university) return;

  const thisWeek = getWeekDates(clsWeekAnchor);
  const prevAnchor = new Date(clsWeekAnchor);
  prevAnchor.setDate(prevAnchor.getDate() - 7);
  const prevWeek = getWeekDates(prevAnchor);
  const prevKeys = prevWeek.map(classDateKey);

  const rows = await fetchUserClassSchedule(STATE.me.id, { fresh: true });
  const prevTicks = rows.filter((r) => r.university === university && prevKeys.includes(r.class_date));

  if (prevTicks.length === 0) {
    if (statusEl) statusEl.textContent = "Tuần trước chưa có lịch học nào để sao chép.";
    return;
  }

  prevWeek.forEach((prevDate, idx) => {
    const prevKey = classDateKey(prevDate);
    const periodsThatDay = prevTicks.filter((r) => r.class_date === prevKey).map((r) => r.period_number);
    const targetKey = classDateKey(thisWeek[idx]);
    periodsThatDay.forEach((periodNum) => {
      const cb = document.querySelector(`#cls-grid input[data-date="${targetKey}"][data-period="${periodNum}"]`);
      if (cb) cb.checked = true;
    });
  });

  if (statusEl) statusEl.textContent = "Đã điền theo tuần trước — bấm \"Lưu lịch học tuần này\" để ghi lại.";
}

function bindClassScheduleEvents() {
  const prevBtn = document.getElementById("cls-week-prev");
  if (!prevBtn || prevBtn.dataset.bound) return;
  prevBtn.dataset.bound = "1";

  prevBtn.addEventListener("click", () => {
    clsWeekAnchor.setDate(clsWeekAnchor.getDate() - 7);
    renderClassScheduleCard();
  });
  document.getElementById("cls-week-next").addEventListener("click", () => {
    clsWeekAnchor.setDate(clsWeekAnchor.getDate() + 7);
    renderClassScheduleCard();
  });
  document.getElementById("cls-week-today").addEventListener("click", () => {
    clsWeekAnchor = new Date();
    renderClassScheduleCard();
  });
  document.getElementById("cls-save").addEventListener("click", saveClassScheduleWeek);
  document.getElementById("cls-copy-prev").addEventListener("click", copyClassScheduleFromPrevWeek);
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
  bindClassScheduleEvents();
  await renderScheduleView();
  await renderClassScheduleCard();
  await loadRotationAdmin();
  await loadMonthCalendar();
}
