// ============================================================
// AUTO-ASSIGN.JS — "🤖 Chia việc tự động" trong trang Công việc
//
// Luồng hoạt động:
// 1. Người dùng chọn việc có sẵn (chip) và/hoặc gõ thêm việc mới (mỗi dòng 1 việc).
// 2. Bấm "⚖️ Chia công bằng ngay": thuật toán tự chọn người đang có ÍT việc
//    đang mở (open workload, tính theo điểm) hơn để giao việc mới — không cần
//    gọi dịch vụ ngoài, luôn chạy được.
// 3. Bấm "🤖 Hỏi AI gợi ý cách chia": gọi 1 Supabase Edge Function (proxy tới
//    Claude API) để AI xem xét tên/điểm từng việc và gợi ý cách chia hợp lý hơn
//    (vd việc nặng nên ưu tiên né người đã có nhiều việc khó). Nếu gọi lỗi/chưa
//    triển khai Edge Function, tự động rơi về thuật toán công bằng ở bước 2 và
//    báo cho người dùng biết.
// 4. Cả 2 cách đều ra 1 bảng xem trước — người dùng có thể sửa tay người làm/điểm
//    trước khi bấm "✅ Tạo tất cả việc" để ghi vào Supabase.
//
// LƯU Ý TRIỂN KHAI AI (bước 3): xem file
// supabase/functions/ai-assign-tasks/index.ts để biết cách triển khai Edge
// Function. Không gọi thẳng api.anthropic.com từ trình duyệt vì sẽ lộ API key.
//
// BỔ SUNG (v2) — dùng chung Status Engine với class-schedule.js:
// - Điều kiện nhận việc giờ dựa trên getEffectiveStatus() (Ốm / Đi xa / Đang
//   học / bận tự khai) thay vì chỉ is_away + đang trong giờ học.
// - Mức "Bận nhẹ" (busy_level 1) vẫn được nhận, nhưng CHỈ với việc nhỏ
//   (<= SMALL_TASK_POINT_THRESHOLD điểm) — đúng quy tắc Level 1 trong đề xuất.
// - "Bận" (busy_level 2) trở lên: không tự động giao, chỉ giao được nếu ép tay
//   qua preset (đổi người làm trong bảng xem trước).
// ============================================================

const PRESET_CHORES = [
  { title: "Quét nhà", points: 10 },
  { title: "Lau nhà", points: 15 },
  { title: "Nấu ăn trưa", points: 30 },
  { title: "Nấu ăn tối", points: 30 },
  { title: "Lấy quần áo", points: 10 },
];

// Việc có điểm <= ngưỡng này được coi là "việc nhỏ" (đổ rác, rửa bát...) —
// người đang bận nhẹ (busy_level 1) vẫn có thể nhận được.
const SMALL_TASK_POINT_THRESHOLD = 15;

// Kết quả chia việc đang xem trước (chưa lưu vào Supabase)
let aaPreviewItems = [];

// ---------------- Dựng UI ----------------

function renderPresetChips() {
  const wrap = document.getElementById("aa-presets");
  wrap.innerHTML = PRESET_CHORES.map(
    (c, i) =>
      `<button type="button" class="chore-chip on" data-idx="${i}">${escapeHTML(c.title)}</button>`
  ).join("");
}

function collectSelectedItems() {
  const items = [];

  document.querySelectorAll("#aa-presets .chore-chip.on").forEach((btn) => {
    const chore = PRESET_CHORES[Number(btn.dataset.idx)];
    if (chore) items.push({ title: chore.title, points: chore.points });
  });

  const defaultPoints = Number(document.getElementById("aa-points").value) || 10;
  const customLines = document
    .getElementById("aa-custom")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  customLines.forEach((title) => items.push({ title, points: defaultPoints }));

  return items;
}

// ---------------- Thuật toán chia công bằng ----------------

// "Mức độ bận" của mỗi thành viên = tổng điểm các việc CHƯA XONG hiện tại
// + tổng điểm đã có (chấm điểm công bằng hơn: ưu tiên việc mới cho người đang ít điểm hơn).
// Việc đã bị đánh dấu "bo_lo" (bỏ việc) không tính vào việc đang mở nữa.
async function computeCurrentLoad() {
  const tasks = await fetchTasks();
  const load = {};
  STATE.profiles.forEach((p) => (load[p.id] = 0));
  tasks
    .filter((t) => t.status !== "hoan_thanh" && t.status !== "bo_lo")
    .forEach((t) => {
      if (load[t.assigned_to] !== undefined) load[t.assigned_to] += t.points || 0;
    });

  if (typeof fetchMemberPointsMap === "function") {
    const pointsMap = await fetchMemberPointsMap();
    STATE.profiles.forEach((p) => {
      load[p.id] = (load[p.id] || 0) + (pointsMap[p.id] || 0);
    });
  }

  return load;
}

// Trạng thái thật (Ốm/Đi xa/Đang học/bận tự khai) của TẤT CẢ thành viên,
// lấy 1 lần cho cả lượt chia việc. Nếu getEffectiveStatus chưa tồn tại (chưa
// nạp class-schedule.js bản mới) thì fallback về is_away như bản cũ.
async function computeStatusMap() {
  const map = {};
  for (const p of STATE.profiles || []) {
    if (typeof getEffectiveStatus === "function") {
      map[p.id] = await getEffectiveStatus(p.id);
    } else {
      map[p.id] = p.is_away
        ? { status: "AWAY", busy_level: 3, reason: "Đi vắng" }
        : { status: "AVAILABLE", busy_level: 0, reason: null };
    }
  }
  return map;
}

// 1 người có nhận được ĐÚNG việc "item" cụ thể này không, theo busy_level:
// level 3 (ốm/đi xa/đang học/không khả dụng) -> không bao giờ tự động giao
// level 2 (bận) -> không tự động giao
// level 1 (bận nhẹ) -> chỉ nhận việc nhỏ (<= SMALL_TASK_POINT_THRESHOLD điểm)
// level 0 (rảnh) -> nhận mọi việc
function isEligibleForItem(status, item) {
  if (!status) return true;
  if (status.busy_level >= 2) return false;
  if (status.busy_level === 1) return (item.points || 0) <= SMALL_TASK_POINT_THRESHOLD;
  return true;
}

// Danh sách người CÓ THỂ nhận ít nhất 1 việc nào đó ngay bây giờ (dùng để báo
// cho người dùng biết ai đang bị tạm né và vì sao).
function summarizeExcluded(statusMap) {
  return (STATE.profiles || [])
    .filter((p) => statusMap[p.id] && statusMap[p.id].busy_level >= 2)
    .map((p) => `${p.name} (${statusMap[p.id].reason || statusMap[p.id].status})`);
}

// Chia items cho người đang có mức độ bận thấp nhất trong số những người ĐỦ
// ĐIỀU KIỆN cho đúng việc đó, việc điểm cao chia trước để cân bằng tốt hơn
// (giống bin-packing kiểu "largest first"). Nếu 1 việc không còn ai đủ điều
// kiện, nới lỏng dần: bỏ level 2, rồi mới tới bỏ hẳn kiểm tra (để không kẹt).
function fairDistribute(items, load, statusMap, presetAssignments = {}) {
  const runningLoad = { ...load };
  const sorted = [...items].sort((a, b) => b.points - a.points);
  const allProfiles = STATE.profiles || [];

  return sorted.map((item) => {
    const preset = presetAssignments[item.title];
    if (preset && runningLoad[preset] !== undefined) {
      runningLoad[preset] += item.points;
      return { ...item, assigned_to: preset, reason: presetAssignments.__reason?.[item.title] || "" };
    }

    let candidates = allProfiles.filter((p) => isEligibleForItem(statusMap[p.id], item));
    if (candidates.length === 0) {
      // nới lỏng: cho phép cả busy_level 2 (nhưng vẫn né ốm/đi xa/đang học/level 3)
      candidates = allProfiles.filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
    }
    if (candidates.length === 0) candidates = allProfiles; // vẫn không có ai -> chia hết cho tất cả để không kẹt

    let best = candidates[0];
    candidates.forEach((p) => {
      if (runningLoad[p.id] < runningLoad[best.id]) best = p;
    });
    runningLoad[best.id] += item.points;
    return { ...item, assigned_to: best?.id || null, reason: "" };
  });
}

// Giữ lại tên hàm cũ để tương thích nếu file khác (vd tasks.js) có gọi tới —
// trả về danh sách người không ở mức "không khả dụng" (busy_level 3).
async function getEligibleAssignees() {
  const statusMap = await computeStatusMap();
  const free = (STATE.profiles || []).filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
  return free.length > 0 ? free : STATE.profiles || [];
}

// ---------------- Gợi ý từ AI (qua Edge Function proxy) ----------------

async function askAIForAssignment(items, load, eligibleProfiles, statusMap) {
  if (typeof SUPABASE_URL !== "string" || !SUPABASE_URL) return null;
  const endpoint = `${SUPABASE_URL}/functions/v1/ai-assign-tasks`;

  try {
    let authToken = SUPABASE_ANON_KEY;
    if (supabaseClient?.auth?.getSession) {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session?.access_token) authToken = data.session.access_token;
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tasks: items,
        members: eligibleProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          busy_level: statusMap[p.id]?.busy_level ?? 0,
          status_reason: statusMap[p.id]?.reason || null,
        })),
        current_load: load,
      }),
    });

    if (!resp.ok) throw new Error(`Edge Function trả về lỗi ${resp.status}`);
    const result = await resp.json();
    if (!Array.isArray(result?.assignments)) throw new Error("Phản hồi AI không đúng định dạng.");

    const byTitle = {};
    const reasons = {};
    const eligibleIds = new Set(eligibleProfiles.map((p) => p.id));
    result.assignments.forEach((a) => {
      if (!a || !a.title) return;
      const validMember = eligibleIds.has(a.assigned_to);
      if (validMember) {
        byTitle[a.title] = a.assigned_to;
        if (a.reason) reasons[a.title] = a.reason;
      }
    });
    byTitle.__reason = reasons;
    return byTitle;
  } catch (err) {
    console.error("Không gọi được AI để chia việc:", err);
    return null;
  }
}

// ---------------- Bảng xem trước ----------------

function renderPreview() {
  const listEl = document.getElementById("aa-preview-list");
  const previewWrap = document.getElementById("aa-preview");

  if (aaPreviewItems.length === 0) {
    previewWrap.style.display = "none";
    return;
  }
  previewWrap.style.display = "block";

  listEl.innerHTML = aaPreviewItems
    .map((item, idx) => {
      const assignee = findProfile(STATE.profiles, item.assigned_to);
      const borderColor = assignee ? assignee.avatar_color : "#ccc";
      const options = STATE.profiles
        .map((p) => `<option value="${p.id}" ${p.id === item.assigned_to ? "selected" : ""}>${escapeHTML(p.name)}</option>`)
        .join("");
      return `
      <div class="task-ticket" style="border-left-color:${borderColor}" data-idx="${idx}">
        <div class="task-body">
          <div class="task-title">${escapeHTML(item.title)}</div>
          <div class="task-meta">
            <select data-action="aa-reassign" class="task-mini-select" title="Đổi người làm">${options}</select>
            <input type="number" min="0" data-action="aa-points" value="${item.points}" class="task-mini-date" style="width:64px" title="Điểm thưởng" />
            ${item.reason ? `<span style="font-style:italic">${escapeHTML(item.reason)}</span>` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="aa-remove" title="Bỏ việc này khỏi danh sách">🗑</button>
        </div>
      </div>`;
    })
    .join("");
}

async function runDistribution(mode) {
  const items = collectSelectedItems();
  if (items.length === 0) {
    alert("Chọn ít nhất 1 việc có sẵn hoặc gõ thêm việc mới.");
    return;
  }

  const load = await computeCurrentLoad();
  const statusMap = await computeStatusMap();
  const eligible = (STATE.profiles || []).filter((p) => (statusMap[p.id]?.busy_level ?? 0) < 3);
  const eligibleForAI = eligible.length > 0 ? eligible : STATE.profiles || [];

  if (mode === "ai") {
    const aiBtn = document.getElementById("aa-ai-btn");
    const oldLabel = aiBtn.textContent;
    aiBtn.textContent = "Đang hỏi AI...";
    aiBtn.disabled = true;

    const aiMap = await askAIForAssignment(items, load, eligibleForAI, statusMap);
    aiBtn.textContent = oldLabel;
    aiBtn.disabled = false;

    if (!aiMap) {
      alert(
        "Chưa gọi được AI (có thể Edge Function chưa được triển khai). Đã tự động dùng thuật toán chia công bằng thay thế."
      );
      aaPreviewItems = fairDistribute(items, load, statusMap, {});
    } else {
      aaPreviewItems = fairDistribute(items, load, statusMap, aiMap);
    }
  } else {
    aaPreviewItems = fairDistribute(items, load, statusMap, {});
  }

  const noteEl = document.getElementById("aa-class-note");
  if (noteEl) {
    const excluded = summarizeExcluded(statusMap);
    if (excluded.length > 0) {
      noteEl.style.display = "block";
      noteEl.textContent = "📚🤒✈️ Đã tạm né giao việc lớn cho: " + excluded.join(", ") + ".";
    } else {
      noteEl.style.display = "none";
      noteEl.textContent = "";
    }
  }

  renderPreview();
}

async function confirmCreateTasks() {
  if (aaPreviewItems.length === 0) return;
  const dueDate = document.getElementById("aa-due").value || todayStr();

  const payloads = aaPreviewItems
    .filter((item) => item.assigned_to)
    .map((item) => ({
      title: item.title,
      description: "",
      assigned_to: item.assigned_to,
      created_by: STATE.me.id,
      due_date: dueDate,
      status: "chua_lam",
      priority: "binh_thuong",
      points: Number(item.points) || 0,
    }));

  if (payloads.length === 0) {
    alert("Chưa có việc nào được gán người làm hợp lệ.");
    return;
  }

  const { data, error } = await supabaseClient.from("tasks").insert(payloads).select();
  if (error) return alert("Lỗi: " + error.message);

  if (typeof logHistory === "function") {
    for (const row of data) {
      await logHistory(row.id, STATE.me.id, "tao_viec", `${STATE.me.name} tạo việc "${row.title}" (chia tự động)`);
    }
  }

  for (const row of data || []) {
    await notifyTaskAssignee(row, `📌 Bạn được giao việc mới: "${row.title}".`);
  }

  // Dọn form và ẩn bảng
  aaPreviewItems = [];
  document.getElementById("aa-custom").value = "";
  document.querySelectorAll("#aa-presets .chore-chip.on").forEach((b) => b.classList.remove("on"));
  document.getElementById("aa-preview").style.display = "none";
  document.getElementById("auto-assign-form").style.display = "none";

  renderTasksView();
}

// ---------------- Gắn sự kiện ----------------

function bindAutoAssignEvents() {
  const btnOpen = document.getElementById("btn-auto-assign");
  if (!btnOpen || btnOpen.dataset.bound) return;
  btnOpen.dataset.bound = "1";

  renderPresetChips();
  document.getElementById("aa-due").value = todayStr();

  const formCard = document.getElementById("auto-assign-form");

  btnOpen.addEventListener("click", () => {
    const newTaskForm = document.getElementById("new-task-form");
    if (newTaskForm) newTaskForm.style.display = "none";
    formCard.style.display = formCard.style.display === "block" ? "none" : "block";
  });

  document.getElementById("aa-cancel-btn").addEventListener("click", () => {
    formCard.style.display = "none";
    document.getElementById("aa-preview").style.display = "none";
    aaPreviewItems = [];
  });

  document.getElementById("aa-presets").addEventListener("click", (e) => {
    const chip = e.target.closest(".chore-chip");
    if (chip) chip.classList.toggle("on");
  });

  document.getElementById("aa-fair-btn").addEventListener("click", () => runDistribution("fair"));
  document.getElementById("aa-ai-btn").addEventListener("click", () => runDistribution("ai"));
  document.getElementById("aa-redo-btn").addEventListener("click", () => {
    document.getElementById("aa-preview").style.display = "none";
    aaPreviewItems = [];
  });
  document.getElementById("aa-confirm-btn").addEventListener("click", confirmCreateTasks);

  const previewList = document.getElementById("aa-preview-list");
  previewList.addEventListener("change", (e) => {
    const row = e.target.closest(".task-ticket");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target.dataset.action === "aa-reassign") aaPreviewItems[idx].assigned_to = e.target.value;
    if (e.target.dataset.action === "aa-points") aaPreviewItems[idx].points = Number(e.target.value) || 0;
  });
  previewList.addEventListener("click", (e) => {
    if (e.target.dataset.action !== "aa-remove") return;
    const row = e.target.closest(".task-ticket");
    const idx = Number(row.dataset.idx);
    aaPreviewItems.splice(idx, 1);
    renderPreview();
  });
}
