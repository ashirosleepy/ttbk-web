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
// ============================================================

const PRESET_CHORES = [
  { title: "Quét nhà", points: 10 },
  { title: "Lau nhà", points: 15 },
  { title: "Nấu ăn trưa", points: 30 },
  { title: "Nấu ăn tối", points: 30 },
  { title: "Lấy quần áo", points: 10 },
];

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

// Thành viên đủ điều kiện nhận việc tự động = không đang đi vắng.
// Nếu vô tình cả nhà đều đi vắng thì đành rơi về danh sách đầy đủ để không bị kẹt.
function getEligibleAssignees() {
  const eligible = (STATE.profiles || []).filter((p) => !p.is_away);
  return eligible.length > 0 ? eligible : STATE.profiles || [];
}

// Chia items cho người đang có mức độ bận thấp nhất, việc điểm cao chia trước
// để cân bằng tốt hơn (giống bin-packing kiểu "largest first").
// Người đang đi vắng bị loại khỏi danh sách ứng cử viên (trừ khi được ép gán qua presetAssignments).
function fairDistribute(items, load, presetAssignments = {}, eligibleProfiles = getEligibleAssignees()) {
  const runningLoad = { ...load };
  const sorted = [...items].sort((a, b) => b.points - a.points);
  const candidates = eligibleProfiles.length > 0 ? eligibleProfiles : STATE.profiles;

  return sorted.map((item) => {
    const preset = presetAssignments[item.title];
    if (preset && runningLoad[preset] !== undefined) {
      runningLoad[preset] += item.points;
      return { ...item, assigned_to: preset, reason: presetAssignments.__reason?.[item.title] || "" };
    }
    let best = candidates[0];
    candidates.forEach((p) => {
      if (runningLoad[p.id] < runningLoad[best.id]) best = p;
    });
    runningLoad[best.id] += item.points;
    return { ...item, assigned_to: best?.id || null, reason: "" };
  });
}

// ---------------- Gợi ý từ AI (qua Edge Function proxy) ----------------

async function askAIForAssignment(items, load) {
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
        members: getEligibleAssignees().map((p) => ({ id: p.id, name: p.name })),
        current_load: load,
      }),
    });

    if (!resp.ok) throw new Error(`Edge Function trả về lỗi ${resp.status}`);
    const result = await resp.json();
    if (!Array.isArray(result?.assignments)) throw new Error("Phản hồi AI không đúng định dạng.");

    const byTitle = {};
    const reasons = {};
    const eligibleIds = new Set(getEligibleAssignees().map((p) => p.id));
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

  if (mode === "ai") {
    const aiBtn = document.getElementById("aa-ai-btn");
    const oldLabel = aiBtn.textContent;
    aiBtn.textContent = "Đang hỏi AI...";
    aiBtn.disabled = true;

    const aiMap = await askAIForAssignment(items, load);
    aiBtn.textContent = oldLabel;
    aiBtn.disabled = false;

    if (!aiMap) {
      alert(
        "Chưa gọi được AI (có thể Edge Function chưa được triển khai). Đã tự động dùng thuật toán chia công bằng thay thế."
      );
      aaPreviewItems = fairDistribute(items, load);
    } else {
      aaPreviewItems = fairDistribute(items, load, aiMap);
    }
  } else {
    aaPreviewItems = fairDistribute(items, load);
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
