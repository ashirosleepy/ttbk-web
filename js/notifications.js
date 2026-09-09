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
  if (error) {
    console.error("Không gửi được thông báo:", error.message);
    return;
  }

  const { error: pushError } = await supabaseClient.functions.invoke("send-push", {
    body: {
      user_id: userId,
      title: opts.title || "Nhiệm vụ hệ thống",
      body: message,
      url: opts.url || new URL("index.html", document.baseURI).href,
      tag: opts.type || "thong_bao",
    },
  });
  if (pushError) console.error("Không gửi được push notification:", pushError.message);
}

async function notifyTaskAssignee(task, message) {
  if (!task || !task.assigned_to) return;
  await createNotification(
    task.assigned_to,
    message || `📌 Bạn có việc mới: "${task.title}".`,
    { type: "thong_bao", taskId: task.id }
  );
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

function isExchangeNotification(n) {
  if (!n) return false;
  if (n.type === "xin_doi") return true;
  if (n.exchange_id) return true;
  if (!n.task_id || !n.message) return false;
  const msg = String(n.message).toLowerCase();
  if (msg.includes("đã nhận đổi việc") || msg.includes("cả 3 người còn lại")) return false;
  return msg.includes("muốn đổi việc") || msg.includes("ai nhận giúp") || msg.includes("xin đổi việc");
}

async function fetchExchangeStatuses(notifications) {
  const taskIds = [...new Set(notifications.filter((n) => isExchangeNotification(n) && n.task_id).map((n) => n.task_id))];
  if (taskIds.length === 0) return [];

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .select("id, task_id, to_user, status")
    .in("task_id", taskIds)
    .eq("to_user", STATE.me.id);

  if (error) {
    console.error("Không lấy được trạng thái yêu cầu đổi việc:", error.message);
    return [];
  }
  return data || [];
}

async function findOpenExchangeForTask(taskId, userId) {
  if (!taskId || !userId) return null;
  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .select("*")
    .eq("task_id", taskId)
    .eq("to_user", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Không tìm được yêu cầu đổi việc phù hợp:", error.message);
    return null;
  }
  return data || null;
}

async function renderNotifSection() {
  const list = await fetchNotifications();
  const container = document.getElementById("notif-list");

  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">Chưa có thông báo nào.</p>`;
    return;
  }

  const exchangeStatuses = await fetchExchangeStatuses(list);

  container.innerHTML = list
    .map((n) => {
      let actionBtn = "";
      if (n.type === "den_luot" && n.task_id) {
        actionBtn = `<button class="btn btn-primary btn-sm" data-action="accept-task" data-task="${n.task_id}">Nhận việc</button>`;
      } else if (isExchangeNotification(n)) {
        const exchange = exchangeStatuses.find((row) =>
          (n.exchange_id && row.id === n.exchange_id) || (!n.exchange_id && row.task_id === n.task_id)
        );
        if (exchange && exchange.status !== "open") {
          actionBtn = `<button class="btn btn-ghost btn-sm" data-action="mark-read">Đã đọc</button>`;
        } else {
          actionBtn = `
            <button class="btn btn-primary btn-sm" data-action="accept-exchange" data-exchange="${n.exchange_id || ""}" data-task="${n.task_id || ""}">Nhận đổi việc</button>
            <button class="btn btn-ghost btn-sm" data-action="reject-exchange" data-exchange="${n.exchange_id || ""}" data-task="${n.task_id || ""}">Từ chối</button>
          `;
        }
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
async function syncRotationQueueForAssignedUser(queueId, userId) {
  if (!queueId || !userId) return;

  const { data: queue, error } = await supabaseClient
    .from("rotation_queues")
    .select("member_order")
    .eq("id", queueId)
    .single();

  if (error || !queue || !Array.isArray(queue.member_order)) return;

  const idx = queue.member_order.indexOf(userId);
  if (idx === -1) return;

  await supabaseClient.from("rotation_queues").update({ current_index: idx }).eq("id", queueId);
}

async function acceptExchangeFromNotif(exchangeId, taskId, notifId) {
  let resolvedExchangeId = exchangeId;
  if (!resolvedExchangeId && taskId) {
    const exchange = await findOpenExchangeForTask(taskId, STATE.me.id);
    resolvedExchangeId = exchange?.id || null;
  }

  if (!resolvedExchangeId) {
    alert("Không tìm thấy lời mời đổi việc phù hợp.");
    return;
  }

  const { data: taskInfo } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id")
    .eq("id", taskId)
    .maybeSingle();

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .update({ status: "accepted", to_user: STATE.me.id, resolved_at: new Date().toISOString() })
    .eq("id", resolvedExchangeId)
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

  await supabaseClient.from("task_exchanges").update({ status: "cancelled" }).eq("task_id", taskId).eq("from_user", data.from_user).neq("id", resolvedExchangeId).eq("status", "open");
  await supabaseClient.from("tasks").update({ assigned_to: STATE.me.id }).eq("id", taskId);
  if (taskInfo?.rotation_queue_id) {
    await syncRotationQueueForAssignedUser(taskInfo.rotation_queue_id, STATE.me.id);
  }

  // Xin đổi việc thành công (có người nhận) -> trừ điểm người xin đổi, chấm điểm công bằng hơn.
  if (typeof addPointAdjustment === "function") {
    await addPointAdjustment(data.from_user, taskId, -HANDOFF_PENALTY, "xin_doi");
  }

  await logHistory(taskId, STATE.me.id, "doi_viec", `${STATE.me.name} nhận đổi việc (người xin đổi bị trừ ${HANDOFF_PENALTY} điểm)`);
  await createNotification(data.from_user, `✅ ${STATE.me.name} đã nhận đổi việc giúp bạn. Bạn bị trừ ${HANDOFF_PENALTY} điểm vì xin đổi việc.`, { type: "thong_bao", taskId });
  await markNotificationRead(notifId);

  renderNotifSection();
  refreshNotifBadge();
  alert("Bạn đã nhận việc này.");
}

async function rejectExchangeFromNotif(exchangeId, taskId, notifId) {
  let resolvedExchangeId = exchangeId;
  if (!resolvedExchangeId && taskId) {
    const exchange = await findOpenExchangeForTask(taskId, STATE.me.id);
    resolvedExchangeId = exchange?.id || null;
  }

  if (!resolvedExchangeId) {
    alert("Không tìm thấy lời mời đổi việc phù hợp.");
    return;
  }

  const { data: taskInfo } = await supabaseClient
    .from("tasks")
    .select("rotation_queue_id")
    .eq("id", taskId)
    .maybeSingle();

  const { data, error } = await supabaseClient
    .from("task_exchanges")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", resolvedExchangeId)
    .eq("status", "open")
    .select()
    .single();

  if (error || !data) {
    await markNotificationRead(notifId);
    renderNotifSection();
    refreshNotifBadge();
    return;
  }

  const { data: allRows, error: rowsErr } = await supabaseClient
    .from("task_exchanges")
    .select("status")
    .eq("task_id", taskId)
    .eq("from_user", data.from_user);

  if (!rowsErr && Array.isArray(allRows)) {
    const hasOpen = allRows.some((row) => row.status === "open");
    const hasAccepted = allRows.some((row) => row.status === "accepted");

    if (!hasOpen && !hasAccepted) {
      const profile = findProfile(STATE.profiles, data.from_user);
      await supabaseClient.from("tasks").update({ assigned_to: data.from_user }).eq("id", taskId);
      if (taskInfo?.rotation_queue_id) {
        await syncRotationQueueForAssignedUser(taskInfo.rotation_queue_id, data.from_user);
      }
      await logHistory(taskId, data.from_user, "bat_buoc_lam", `${profile ? profile.name : "Người yêu cầu"} phải làm việc vì cả 3 người còn lại đều từ chối.`);
      await createNotification(data.from_user, `⚠️ Cả 3 người còn lại đều từ chối, nên bạn phải làm việc này.`, { type: "thong_bao", taskId });
    }
  }

  await markNotificationRead(notifId);
  renderNotifSection();
  refreshNotifBadge();
  alert("Bạn đã từ chối nhận việc này.");
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
      if (action === "reject-exchange") {
        await rejectExchangeFromNotif(e.target.dataset.exchange, e.target.dataset.task, notifId);
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
      if (activeSection === "schedule") {
        renderScheduleView();
        if (typeof renderMonthCalendar === "function") renderMonthCalendar();
      }
    })
    .subscribe();
}
