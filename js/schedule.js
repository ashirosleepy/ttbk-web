// ============================================================
// SCHEDULE.JS — trang "Lịch" (việc lặp lại) + tự sinh việc mỗi ngày
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

// Gọi hàm này 1 lần mỗi khi mở app: tự tạo việc của "hôm nay" từ các lịch đang chạy,
// và không tạo trùng nếu việc của lịch đó, ngày đó đã có rồi.
async function generateTodayTasks() {
  const today = todayStr();
  const todayObj = new Date(today + "T00:00:00");
  const schedules = await fetchSchedules();
  const matching = schedules.filter((s) => scheduleMatchesDate(s, todayObj, today));
  if (matching.length === 0) return;

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
  const toInsert = matching
    .filter((s) => !already.has(s.id))
    .map((s) => ({
      title: s.title,
      description: s.description || null,
      assigned_to: s.assigned_to,
      created_by: s.assigned_to,
      schedule_id: s.id,
      due_date: today,
      status: "chua_lam",
      priority: "binh_thuong",
      points: s.points,
    }));

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabaseClient.from("tasks").insert(toInsert);
    if (insertErr) console.error("Không tạo được việc từ lịch:", insertErr.message);
  }
}

function scheduleChipHTML(schedule) {
  const p = findProfile(STATE.profiles, schedule.assigned_to);
  const color = p ? p.avatar_color : "#999";
  return `<span class="week-chip" style="background:${color}">${escapeHTML(schedule.title)}</span>`;
}

async function renderScheduleView() {
  const schedules = await fetchSchedules();

  // Lưới cả tuần: cột Thứ 2 -> Chủ Nhật, hàng theo từng thành viên
  const order = [1, 2, 3, 4, 5, 6, 0];
  const thead = `<tr><th>Thành viên</th>${order.map((d) => `<th>${WEEKDAY_LABEL[d]}</th>`).join("")}</tr>`;
  const rows = STATE.profiles
    .map((p) => {
      const cells = order
        .map((d) => {
          const chips = schedules
            .filter(
              (s) =>
                s.active &&
                s.assigned_to === p.id &&
                (s.repeat_type === "daily" || (s.repeat_type === "weekly" && (s.repeat_days || []).includes(d)))
            )
            .map(scheduleChipHTML)
            .join("");
          return `<td>${chips || "—"}</td>`;
        })
        .join("");
      return `<tr><td><span style="display:flex;align-items:center;gap:6px">${avatarHTML(p, "avatar-sm")}${escapeHTML(p.name)}</span></td>${cells}</tr>`;
    })
    .join("");

  document.getElementById("schedule-grid").innerHTML = `<table class="week-table"><thead>${thead}</thead><tbody>${rows}</tbody></table>`;

  const listEl = document.getElementById("schedule-list");
  if (schedules.length === 0) {
    listEl.innerHTML = `<p class="empty-state">Chưa có lịch lặp lại nào.</p>`;
    return;
  }
  listEl.innerHTML = schedules
    .map((s) => {
      const p = findProfile(STATE.profiles, s.assigned_to);
      const when = s.repeat_type === "daily" ? "Mỗi ngày" : "Mỗi " + (s.repeat_days || []).map((d) => WEEKDAY_LABEL[d]).join(", ");
      return `
      <div class="task-ticket" style="border-left-color:${p ? p.avatar_color : "#ccc"}" data-id="${s.id}">
        <div class="task-body">
          <div class="task-title">${escapeHTML(s.title)}</div>
          <div class="task-meta"><span>${when}</span><span>${p ? escapeHTML(p.name) : "?"}</span><span>${s.points} điểm</span></div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="del-schedule" title="Xoá lịch">🗑</button>
        </div>
      </div>`;
    })
    .join("");
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

  const saveBtn = document.getElementById("save-schedule");
  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const title = document.getElementById("sc-title").value.trim();
      if (!title) return alert("Nhập tên việc lặp lại.");

      const repeatType = repeatTypeSel.value;
      const days = Array.from(daysPicker.querySelectorAll(".day-toggle.on")).map((b) => Number(b.dataset.day));
      if (repeatType === "weekly" && days.length === 0) return alert("Chọn ít nhất 1 ngày trong tuần.");

      const payload = {
        title,
        assigned_to: document.getElementById("sc-assigned").value,
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
  document.getElementById("sc-assigned").innerHTML = STATE.profiles
    .map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`)
    .join("");
  bindScheduleEvents();
  await renderScheduleView();
}
