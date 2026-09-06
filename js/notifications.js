// ============================================================
// NOTIFICATIONS.JS — trang "Thông báo" ở menu bên trái + realtime
// ============================================================

// Gọi hàm này ở bất cứ đâu cần báo cho 1 người: đến lượt, xin đổi việc...
async function createNotification(userId, message, opts = {}) {
  const payload = {
    user_id: userId,
    message,
    type: opts.type || "thong_bao",
    task_id: opts.taskId || null,
    exchange_id: opts.exchangeId || null,
  };
  const { error } = await supabaseClient.from("notifications").insert(payload);
  if (error) console.error("Không gửi được thông báo:", error.message);
}

async function fetchNotifications() {
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", STATE.me.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("Không lấy được thông báo:", error.message);
    return [];
  }
  return data;
}

// Cập nhật số thông báo chưa đọc hiện ở mục "Thông báo" trên thanh menu
async function refreshNotifBadge() {
  const list = await fetchNotifications();
  const unread = list.filter((n) => !n.is_read).length;
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (unread > 0) {
    badge.style.display = "inline-flex";
    badge.textContent = unread > 9 ? "9+" : String(unread);
  } else {
    badge.style.display = "none";
  }
}

function notifIconForType(type) {
  const map = { den_luot: "🔁", xin_doi: "🔄", thong_bao: "🔔" };
  return map[type] || "🔔";
}

async function renderNotifSection() {
  const list = await fetchNotifications();
  const container = document.getElementById("notif-list");

  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">Chưa có thông báo nào.</p>`;
    return;
  }

  container.innerHTML = list
    .map((n) => {
      let actionBtn = "";
      if (n.type === "den_luot" && n.task_id) {
        actionBtn = `<button class="btn btn-primary btn-sm" data-action="accept-task" data-task="${n.task_id}">Nhận việc</button>`;
      } else if (n.type === "xin_doi" && n.exchange_id) {
        actionBtn = `<button class="btn btn-primary btn-sm" data-action="accept-exchange" data-exchange="${n.exchange_id}" data-task="${n.task_id || ""}">Nhận đổi việc</button>`;
      }
      return `
      <div class="task-ticket ${n.is_read ? "done" : ""}" style="border-left-color:${n.is_read ? "#ccc" : "var(--accent)"}" data-id="${n.id}">
        <div class="task-check" style="border:none; font-size:16px;">${notifIconForType(n.type)}</div>
        <div class="task-body">
          <div class="task-title" style="font-weight:${n.is_read ? "500" : "700"}">${escapeHTML(n.message)}</div>
          <div class="task-meta"><span>${timeAgo(n.created_at)}</span></div>
        </div>
        <div class="task-actions">
          ${actionBtn}
          ${!n.is_read ? `<button class="icon-btn" data-action="mark-read" title="Đánh dấu đã đọc">✓</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

async function markNotificationRead(id) {
  await supabaseClient.from("notifications").update({ is_read: true }).eq("id", id);
}

async function markAllNotificationsRead() {
  await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", STATE.me.id).eq("is_read", false);
  renderNotifSection();
  refreshNotifBadge();
}

// Người đầu tiên bấm "Nhận đổi việc" thì được — người sau sẽ thấy báo "đã có người nhận"
async function acceptExchangeFromNotif(exchangeId, taskId, notifId) {
  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .update({ status: "accepted", to_user: STATE.me.id, resolved_at: new Date().toISOString() })
    .eq("id", exchangeId)
    .eq("status", "open")
    .select()
    .single();

  if (error || !data) {
    alert("Việc này có người nhận trước bạn rồi.");
    await markNotificationRead(notifId);
    renderNotifSection();
    refreshNotifBadge();
    return;
  }

  await supabaseClient.from("tasks").update({ assigned_to: STATE.me.id }).eq("id", taskId);
  await logHistory(taskId, STATE.me.id, "doi_viec", `${STATE.me.name} nhận đổi việc`);
  await createNotification(data.from_user, `✅ ${STATE.me.name} đã nhận đổi việc giúp bạn.`, { type: "thong_bao", taskId });
  await markNotificationRead(notifId);

  renderNotifSection();
  refreshNotifBadge();
  alert("Bạn đã nhận việc này.");
}

function bindNotifEvents() {
  const container = document.getElementById("notif-list");
  if (!container.dataset.bound) {
    container.dataset.bound = "1";
    container.addEventListener("click", async (e) => {
      const ticket = e.target.closest(".task-ticket");
      if (!ticket) return;
      const notifId = ticket.dataset.id;
      const action = e.target.dataset.action;

      if (action === "accept-task") {
        await acceptTask(e.target.dataset.task);
        await markNotificationRead(notifId);
        renderNotifSection();
        refreshNotifBadge();
      }
      if (action === "accept-exchange") {
        await acceptExchangeFromNotif(e.target.dataset.exchange, e.target.dataset.task, notifId);
      }
      if (action === "mark-read") {
        await markNotificationRead(notifId);
        renderNotifSection();
        refreshNotifBadge();
      }
    });
  }

  const markAllBtn = document.getElementById("notif-mark-all");
  if (markAllBtn && !markAllBtn.dataset.bound) {
    markAllBtn.dataset.bound = "1";
    markAllBtn.addEventListener("click", markAllNotificationsRead);
  }
}

async function loadNotificationsSection() {
  bindNotifEvents();
  await renderNotifSection();
  refreshNotifBadge();
}

// ---------------------------------------------------------------
// REALTIME: tự cập nhật cho mọi người khi có ai đó thay đổi dữ liệu,
// không cần bấm F5. Cần bật Realtime cho bảng tasks/notifications
// trong Supabase (đã có sẵn trong sql/schema.sql, mục 10).
// ---------------------------------------------------------------
function subscribeRealtime() {
  supabaseClient
    .channel("notifications-" + STATE.me.id)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${STATE.me.id}` },
      () => {
        refreshNotifBadge();
        const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
        if (activeSection === "notifications") renderNotifSection();
      }
    )
    .subscribe();

  supabaseClient
    .channel("tasks-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      const activeSection = document.querySelector(".nav-item.active")?.dataset.section;
      if (activeSection === "tasks") renderTasksView();
      if (activeSection === "dashboard") renderDashboard();
      if (activeSection === "schedule") renderScheduleView();
    })
    .subscribe();
}
