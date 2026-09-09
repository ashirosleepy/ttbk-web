/* =========================================================================
   js/shopping.js — Module "Nhà cần gì?" (Đồ dùng / Mua sắm / Dự phòng / Định kỳ)
   -------------------------------------------------------------------------
   Tự chứa (self-contained): lưu dữ liệu ở localStorage nên chạy được ngay,
   không cần sửa schema Supabase. Đặt các hàm đọc/ghi dữ liệu riêng trong
   SHOP_DB để sau này dễ thay bằng Supabase (chỉ cần viết lại các hàm trong
   SHOP_DB, phần render/UI phía dưới không cần đổi).

   Quy ước module dùng lại của app hiện có: .card, .field, .form-row,
   .btn/.btn-primary/.btn-ghost/.btn-sm/.btn-danger, .task-list, .empty-state,
   .view/.view-head, cơ chế chuyển section theo [data-section] + #section-<id>.
   ========================================================================= */
(function () {
  "use strict";

  var LS_KEY = "ttbk_shopping_v1";

  var CATEGORY_LABEL = {
    tieu_hao: "🧻 Tiêu hao",
    du_phong: "🔋 Dự phòng",
    dinh_ky: "🔧 Định kỳ thay",
    phat_sinh: "⚡ Phát sinh"
  };

  var PRIORITY_LABEL = {
    cao: "🔴 Cao",
    binh_thuong: "🟡 Bình thường",
    thap: "🟢 Thấp"
  };

  /* ------------------------------------------------------------------ *
   * LỚP DỮ LIỆU — thay bằng Supabase sau này chỉ cần sửa trong SHOP_DB  *
   * ------------------------------------------------------------------ */
  var SHOP_DB = {
    load: function () {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return SHOP_DB.seed();
    },
    save: function (state) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    },
    seed: function () {
      var today = todayISO();
      return {
        items: [
          mkItem({ name: "Giấy vệ sinh", category: "tieu_hao", unit: "cuộn", qty: 2, min: 3, ideal: 12, cycleDays: 7, lastRestock: daysAgoISO(5) }),
          mkItem({ name: "Nước giặt", category: "tieu_hao", unit: "chai", qty: 1.5, min: 0.5, ideal: 2, cycleDays: 30, lastRestock: daysAgoISO(28) }),
          mkItem({ name: "Kem đánh răng", category: "tieu_hao", unit: "tuýp", qty: 0, min: 1, ideal: 2, cycleDays: 30, lastRestock: daysAgoISO(31) }),
          mkItem({ name: "Nước uống", category: "tieu_hao", unit: "bình", qty: 2, min: 4, ideal: 6, cycleDays: 3, lastRestock: daysAgoISO(3) }),
          mkItem({ name: "Bóng đèn dự phòng", category: "du_phong", unit: "cái", qty: 0, min: 1, ideal: 1 }),
          mkItem({ name: "Pin AA", category: "du_phong", unit: "viên", qty: 2, min: 4, ideal: 8 }),
          mkItem({ name: "Đầu cây lau nhà", category: "dinh_ky", unit: "cái", qty: 1, min: 1, ideal: 1, cycleDays: 30, lastRestock: daysAgoISO(27) }),
          mkItem({ name: "Bàn chải đánh răng", category: "dinh_ky", unit: "cái", qty: 1, min: 1, ideal: 1, cycleDays: 90, lastRestock: daysAgoISO(40) }),
          mkItem({ name: "Lõi lọc nước", category: "dinh_ky", unit: "cái", qty: 1, min: 1, ideal: 1, cycleDays: 180, lastRestock: daysAgoISO(50) })
        ],
        purchaseLog: [],
        activity: [
          { id: uid(), date: today, type: "info", text: "Đã khởi tạo module Nhà cần gì? với vài món mẫu — bạn có thể sửa/xoá tuỳ ý." }
        ]
      };
    }
  };

  function mkItem(partial) {
    return Object.assign({
      id: uid(),
      name: "",
      category: "tieu_hao",
      unit: "",
      qty: 0,
      min: 1,
      ideal: null,
      cycleDays: null,
      lastRestock: null,
      manualLevel: null,     // 'on' | 'sap_het' | 'het' — báo nhanh không cần nhập số
      manualBy: null,
      manualAt: null,
      inCart: false,
      cartPriority: null,
      note: "",
      createdAt: todayISO()
    }, partial);
  }

  /* ------------------------------------------------------------------ *
   * TIỆN ÍCH NGÀY THÁNG / SỐ                                            *
   * ------------------------------------------------------------------ */
  function uid() { return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysAgoISO(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function daysSince(iso) { return daysBetween(iso, todayISO()); }
  function fmtQty(n) {
    if (n === null || n === undefined) return "";
    var r = Math.round(n * 100) / 100;
    return (r % 1 === 0) ? String(r) : String(r);
  }
  function currentUserName() {
    var el = document.getElementById("topbar-user");
    var t = el && el.textContent ? el.textContent.trim() : "";
    return t || "Ai đó";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------ *
   * STATE                                                               *
   * ------------------------------------------------------------------ */
  var state = SHOP_DB.load();
  function persist() { SHOP_DB.save(state); }
  function addActivity(type, text) {
    state.activity.unshift({ id: uid(), date: todayISO(), type: type, text: text });
    state.activity = state.activity.slice(0, 200);
  }

  /* ------------------------------------------------------------------ *
   * LOGIC TRẠNG THÁI / DỰ ĐOÁN                                          *
   * ------------------------------------------------------------------ */
  function computeStatus(item) {
    if (item.category === "dinh_ky") {
      if (!item.lastRestock || !item.cycleDays) {
        return { level: "unknown", emoji: "⚪", label: "Chưa có dữ liệu chu kỳ" };
      }
      var elapsed = daysSince(item.lastRestock);
      var remain = item.cycleDays - elapsed;
      if (remain <= 0) return { level: "het", emoji: "🔴", label: "Đã quá hạn thay " + Math.abs(remain) + " ngày" };
      if (remain <= Math.max(7, Math.round(item.cycleDays * 0.15))) return { level: "sap_het", emoji: "🟡", label: "Còn khoảng " + remain + " ngày là đến hạn thay" };
      return { level: "on", emoji: "🟢", label: "Còn khoảng " + remain + " ngày" };
    }

    // Báo nhanh (3 mức đơn giản) ưu tiên hơn nếu người dùng vừa bấm báo
    if (item.manualLevel) {
      var map = {
        on: { level: "on", emoji: "🟢", label: "Còn nhiều (báo tay)" },
        sap_het: { level: "sap_het", emoji: "🟡", label: "Sắp hết (báo tay)" },
        het: { level: "het", emoji: "🔴", label: "Đã hết (báo tay)" }
      };
      return map[item.manualLevel];
    }

    if (item.qty <= 0) return { level: "het", emoji: "🔴", label: "Đã hết" };
    if (item.qty <= item.min) return { level: "sap_het", emoji: "🟡", label: "Sắp hết" };
    return { level: "on", emoji: "🟢", label: "Còn đủ" };
  }

  function needsBackup(item) {
    return item.category === "du_phong" && computeStatus(item).level !== "on";
  }

  function avgCycleDays(item) {
    var logs = state.purchaseLog
      .filter(function (l) { return l.itemId === item.id; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (logs.length < 2) return item.cycleDays || null;
    var gaps = [];
    for (var i = 1; i < logs.length; i++) gaps.push(daysBetween(logs[i - 1].date, logs[i].date));
    var sum = gaps.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / gaps.length);
  }

  function predictedNudge(item) {
    if (item.category === "dinh_ky" || item.category === "phat_sinh") return null;
    if (!item.lastRestock) return null;
    var cyc = avgCycleDays(item);
    if (!cyc) return null;
    var remain = cyc - daysSince(item.lastRestock);
    if (remain <= 0) return null; // đã tính vào trạng thái sắp hết/hết rồi
    if (remain <= Math.max(3, Math.round(cyc * 0.2))) {
      return "🟡 Có vẻ sẽ hết trong khoảng " + remain + " ngày nữa (theo chu kỳ mua trung bình " + cyc + " ngày).";
    }
    return null;
  }

  function suggestedBuyQty(item) {
    var target = item.ideal || (item.min * 2) || 1;
    var need = target - item.qty;
    return need > 0 ? Math.ceil(need * 10) / 10 : 1;
  }

  function isSuggested(item) {
    if (item.inCart) return false;
    var st = computeStatus(item);
    return st.level === "het" || st.level === "sap_het" || needsBackup(item);
  }

  function suggestedPriority(item) {
    var st = computeStatus(item);
    return (st.level === "het") ? "cao" : "binh_thuong";
  }

  /* ------------------------------------------------------------------ *
   * RENDER: TỔNG QUAN                                                   *
   * ------------------------------------------------------------------ */
  function renderOverview() {
    var host = document.getElementById("shop-overview");
    if (!host) return;

    var hetCount = 0, sapHetCount = 0, duPhongThieu = 0, canThay = 0;
    state.items.forEach(function (it) {
      var st = computeStatus(it);
      if (it.category === "dinh_ky") {
        if (st.level !== "on") canThay++;
      } else if (it.category === "du_phong") {
        if (st.level !== "on") duPhongThieu++;
      } else {
        if (st.level === "het") hetCount++;
        else if (st.level === "sap_het") sapHetCount++;
      }
    });
    var dangChoMua = state.items.filter(function (it) { return it.inCart; }).length;

    host.innerHTML =
      '<div class="shop-overview-grid">' +
        overviewCell(hetCount, "🔴 Đã hết") +
        overviewCell(sapHetCount, "🟡 Sắp hết") +
        overviewCell(duPhongThieu, "⚠️ Thiếu dự phòng") +
        overviewCell(canThay, "🔧 Cần thay") +
        overviewCell(dangChoMua, "🛒 Đang chờ mua") +
      "</div>";

    var badge = document.getElementById("shop-nav-badge");
    if (badge) {
      var total = hetCount + sapHetCount + duPhongThieu + canThay;
      if (total > 0) { badge.style.display = "inline-block"; badge.textContent = String(total); }
      else badge.style.display = "none";
    }
  }
  function overviewCell(n, label) {
    return '<div class="shop-overview-cell"><b>' + n + "</b><span>" + label + "</span></div>";
  }

  /* ------------------------------------------------------------------ *
   * RENDER: DANH SÁCH ĐỒ DÙNG                                           *
   * ------------------------------------------------------------------ */
  var activeCatFilter = "all";

  function renderItemsGrid() {
    var host = document.getElementById("shop-items-grid");
    if (!host) return;
    var list = state.items.filter(function (it) {
      return activeCatFilter === "all" || it.category === activeCatFilter;
    });
    if (!list.length) { host.innerHTML = '<p class="empty-state">Chưa có món nào trong mục này.</p>'; return; }

    host.innerHTML = list.map(function (it) {
      var st = computeStatus(it);
      var nudge = predictedNudge(it);
      var isQtyBased = it.category !== "dinh_ky";
      var qtyLine = isQtyBased
        ? ("Hiện có: <b>" + fmtQty(it.qty) + " " + escapeHtml(it.unit || "") + "</b>"
           + " · Ngưỡng: " + fmtQty(it.min)
           + (it.ideal ? " · Nên có: " + fmtQty(it.ideal) : ""))
        : ("Đã dùng " + (it.lastRestock ? daysSince(it.lastRestock) : "?") + " ngày"
           + (it.cycleDays ? " / chu kỳ " + it.cycleDays + " ngày" : ""));

      var manualRow = isQtyBased
        ? '<div class="shop-quickrow">' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="on">🟢 Còn nhiều</button>' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="sap_het">🟡 Sắp hết</button>' +
            '<button data-act="lvl" data-id="' + it.id + '" data-lvl="het">🔴 Hết</button>' +
          "</div>"
        : "";

      var qtyButtons = isQtyBased
        ? '<div class="shop-quickrow">' +
            '<button class="qty-btn" data-act="dec" data-id="' + it.id + '">－1</button>' +
            '<button class="qty-btn" data-act="inc" data-id="' + it.id + '">＋1</button>' +
          "</div>"
        : '<div class="shop-quickrow"><button data-act="replaced" data-id="' + it.id + '">✅ Vừa thay</button></div>';

      var reporter = it.manualLevel && it.manualBy
        ? '<div class="shop-reporter">🧑 ' + escapeHtml(it.manualBy) + " báo lúc " + it.manualAt + "</div>"
        : "";

      return (
        '<div class="shop-item-card">' +
          '<div class="shop-item-top">' +
            "<h4>" + escapeHtml(it.name) + "</h4>" +
            '<span class="shop-badge shop-badge-' + st.level + '">' + st.emoji + " " + st.label + "</span>" +
          "</div>" +
          '<div class="shop-meta">' + CATEGORY_LABEL[it.category] + " · " + qtyLine + "</div>" +
          (nudge ? '<div class="shop-note">' + nudge + "</div>" : "") +
          (it.note ? '<div class="shop-note">📝 ' + escapeHtml(it.note) + "</div>" : "") +
          reporter +
          manualRow +
          qtyButtons +
          '<div class="shop-actrow">' +
            (it.inCart
              ? '<button class="btn btn-ghost btn-sm" disabled>Đã trong danh sách mua</button>'
              : '<button class="btn btn-ghost btn-sm" data-act="addcart" data-id="' + it.id + '">🛒 Thêm vào danh sách mua</button>') +
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + it.id + '">✏️ Sửa</button>' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + it.id + '">🗑️</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER: DANH SÁCH MUA (CART)                                        *
   * ------------------------------------------------------------------ */
  function renderCart() {
    var host = document.getElementById("shop-cart-list");
    if (!host) return;

    var inCart = state.items.filter(function (it) { return it.inCart; });
    if (!inCart.length) { host.innerHTML = '<p class="empty-state">Chưa có gì trong danh sách mua. Bấm "Đưa tất cả gợi ý vào danh sách mua" ở trên nếu có món sắp hết.</p>'; return; }

    var cao = inCart.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) === "cao"; });
    var thuong = inCart.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) !== "cao"; });

    function row(it) {
      var qtyNeed = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
      return (
        '<div class="task-card shop-cart-row">' +
          "<div><b>" + escapeHtml(it.name) + "</b> — cần khoảng " + fmtQty(qtyNeed) + " " + escapeHtml(it.unit || "") +
          '<div class="shop-note">' + CATEGORY_LABEL[it.category] + "</div></div>" +
          '<div class="btn-row" style="margin:0;">' +
            '<button class="btn btn-primary btn-sm" data-act="buy" data-id="' + it.id + '">✅ Đã mua</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="uncart" data-id="' + it.id + '">Bỏ khỏi danh sách</button>' +
          "</div>" +
        "</div>"
      );
    }

    var html = "";
    if (cao.length) html += '<div class="shop-cart-group-title">Ưu tiên cao</div>' + cao.map(row).join("");
    if (thuong.length) html += '<div class="shop-cart-group-title">Có thể mua cùng</div>' + thuong.map(row).join("");
    host.innerHTML = html;
  }

  /* ------------------------------------------------------------------ *
   * RENDER: LỊCH THAY                                                   *
   * ------------------------------------------------------------------ */
  function renderReplace() {
    var host = document.getElementById("shop-replace-list");
    if (!host) return;
    var list = state.items.filter(function (it) { return it.category === "dinh_ky"; });
    if (!list.length) { host.innerHTML = '<p class="empty-state">Chưa có đồ định kỳ thay. Thêm ở mục "Đồ dùng" với loại "Định kỳ thay".</p>'; return; }

    host.innerHTML = list.map(function (it) {
      var st = computeStatus(it);
      return (
        '<div class="task-card shop-cart-row">' +
          "<div><b>" + escapeHtml(it.name) + "</b> — " + st.label +
          '<div class="shop-note">Chu kỳ ' + (it.cycleDays || "?") + " ngày · lần cuối: " + (it.lastRestock || "chưa có") + "</div></div>" +
          '<button class="btn btn-primary btn-sm" data-act="replaced" data-id="' + it.id + '">✅ Vừa thay</button>' +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER: LỊCH SỬ                                                     *
   * ------------------------------------------------------------------ */
  function renderHistory() {
    var host = document.getElementById("shop-history-list");
    if (!host) return;
    var logs = state.purchaseLog.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!logs.length) { host.innerHTML = '<p class="empty-state">Chưa có lịch sử mua/thay đồ nào.</p>'; return; }
    host.innerHTML = logs.slice(0, 100).map(function (l) {
      return (
        '<div class="task-card shop-cart-row">' +
          "<div><b>" + escapeHtml(l.itemName) + "</b> — số lượng " + fmtQty(l.qty) +
          (l.cost ? " · " + Number(l.cost).toLocaleString("vi-VN") + "đ" : "") +
          '<div class="shop-note">' + l.date + "</div></div>" +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER TỔNG                                                         *
   * ------------------------------------------------------------------ */
  function renderAll() {
    persist();
    renderOverview();
    renderItemsGrid();
    renderCart();
    renderReplace();
    renderHistory();
    injectDashboardCard();
  }

  /* ------------------------------------------------------------------ *
   * THẺ TÓM TẮT TRÊN TRANG "TỔNG QUAN"                                  *
   * (best-effort: chèn thêm 1 card vào #dashboard-content, không đụng   *
   * vào code render sẵn có của dashboard.js)                            *
   * ------------------------------------------------------------------ */
  function injectDashboardCard() {
    var host = document.getElementById("dashboard-content");
    if (!host) return;

    var hetCount = 0, sapHetCount = 0, duPhongThieu = 0;
    state.items.forEach(function (it) {
      var st = computeStatus(it);
      if (it.category === "du_phong") { if (st.level !== "on") duPhongThieu++; }
      else if (it.category !== "dinh_ky") {
        if (st.level === "het") hetCount++;
        else if (st.level === "sap_het") sapHetCount++;
      }
    });
    var cartCount = state.items.filter(function (it) { return it.inCart; }).length;

    var card = document.getElementById("shop-dashboard-card");
    if (!card) {
      card = document.createElement("div");
      card.className = "card";
      card.id = "shop-dashboard-card";
      card.style.marginTop = "18px";
    }
    card.innerHTML =
      '<h3 style="font-size:15px;margin-bottom:10px;">🏠 Tình trạng đồ dùng</h3>' +
      '<div class="shop-overview-grid">' +
        overviewCell(hetCount, "🔴 Đã hết") +
        overviewCell(sapHetCount, "🟡 Sắp hết") +
        overviewCell(duPhongThieu, "⚠️ Thiếu dự phòng") +
      "</div>" +
      '<div class="btn-row" style="margin-top:14px;">' +
        '<button class="btn btn-ghost btn-sm" id="shop-dash-goto">Xem danh sách →</button>' +
      "</div>" +
      (cartCount ? '<p class="shop-note" style="margin-top:8px;">🛒 ' + cartCount + " món đang chờ mua.</p>" : "");

    if (card.parentElement !== host) host.appendChild(card);

    var goto = document.getElementById("shop-dash-goto");
    if (goto) goto.onclick = function () {
      var navBtn = document.querySelector('.nav-item[data-section="shopping"]');
      if (navBtn) navBtn.click();
    };
  }

  // Dashboard có thể tự vẽ lại #dashboard-content định kỳ (polling/subscribe);
  // MutationObserver này chỉ chèn lại thẻ của mình nếu nó bị dashboard.js xoá mất,
  // không can thiệp gì khác vào phần dashboard gốc.
  (function watchDashboard() {
    var host = document.getElementById("dashboard-content");
    if (!host || !window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!document.getElementById("shop-dashboard-card")) injectDashboardCard();
    });
    obs.observe(host, { childList: true });
  })();

  /* ------------------------------------------------------------------ *
   * HÀNH ĐỘNG (event delegation)                                        *
   * ------------------------------------------------------------------ */
  function findItem(id) { return state.items.filter(function (it) { return it.id === id; })[0]; }

  function onGridClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    var it = findItem(id);
    if (!it && act !== "buy") return;

    switch (act) {
      case "inc":
        it.qty = Math.round((it.qty + 1) * 100) / 100;
        it.manualLevel = null;
        renderAll();
        break;
      case "dec":
        it.qty = Math.max(0, Math.round((it.qty - 1) * 100) / 100);
        it.manualLevel = null;
        renderAll();
        break;
      case "lvl":
        it.manualLevel = btn.getAttribute("data-lvl");
        it.manualBy = currentUserName();
        it.manualAt = new Date().toLocaleString("vi-VN");
        addActivity("report", "🧑 " + it.manualBy + " báo: " + it.name + " → " + it.manualLevel);
        if (it.manualLevel !== "on" && !it.inCart) {
          it.inCart = true;
          it.cartPriority = it.manualLevel === "het" ? "cao" : "binh_thuong";
        }
        renderAll();
        break;
      case "replaced":
        it.lastRestock = todayISO();
        state.purchaseLog.push({ id: uid(), itemId: it.id, itemName: it.name, qty: 1, cost: null, date: todayISO() });
        addActivity("replace", "🔧 Đã thay: " + it.name);
        renderAll();
        break;
      case "addcart":
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        renderAll();
        break;
      case "uncart":
        it.inCart = false;
        renderAll();
        break;
      case "edit":
        openItemForm(it);
        break;
      case "del":
        if (confirm('Xoá "' + it.name + '" khỏi danh sách đồ dùng?')) {
          state.items = state.items.filter(function (x) { return x.id !== it.id; });
          renderAll();
        }
        break;
      case "buy":
        handleBuy(it);
        break;
    }
  }

  function handleBuy(it) {
    var suggestion = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
    var qtyStr = prompt('Đã mua bao nhiêu "' + it.name + '" (' + (it.unit || "đơn vị") + ')?', fmtQty(suggestion));
    if (qtyStr === null) return;
    var qty = parseFloat(qtyStr.replace(",", "."));
    if (isNaN(qty) || qty <= 0) { alert("Số lượng không hợp lệ."); return; }
    var costStr = prompt("Giá tiền (đ) — để trống nếu không muốn ghi:", "");
    var cost = costStr && !isNaN(parseFloat(costStr)) ? parseFloat(costStr) : null;

    it.qty = Math.round((it.qty + qty) * 100) / 100;
    it.lastRestock = todayISO();
    it.inCart = false;
    it.manualLevel = null;
    state.purchaseLog.push({ id: uid(), itemId: it.id, itemName: it.name, qty: qty, cost: cost, date: todayISO() });
    addActivity("restock", "🛒 Đã mua " + it.name + " (+" + fmtQty(qty) + " " + (it.unit || "") + ")" + (cost ? " — " + cost.toLocaleString("vi-VN") + "đ" : ""));
    renderAll();

    if (cost) {
      var goExpense = confirm('Đã ghi lại lần mua này. Bạn có muốn mở trang "Chi tiêu" để ghi khoản ' + cost.toLocaleString("vi-VN") + 'đ này không?');
      if (goExpense && window.ttbkNavigate) window.ttbkNavigate("Chi tiêu TTBK.html");
      else if (goExpense) window.location.href = "Chi tiêu TTBK.html";
    }
  }

  /* ------------------------------------------------------------------ *
   * FORM: THÊM / SỬA ĐỒ DÙNG                                            *
   * ------------------------------------------------------------------ */
  function openItemForm(item) {
    var form = document.getElementById("shop-item-form");
    document.getElementById("shop-adhoc-form").style.display = "none";
    document.getElementById("shop-item-form-title").textContent = item ? "Sửa đồ dùng" : "Thêm đồ dùng";
    document.getElementById("si-id").value = item ? item.id : "";
    document.getElementById("si-name").value = item ? item.name : "";
    document.getElementById("si-category").value = item ? item.category : "tieu_hao";
    document.getElementById("si-qty").value = item ? item.qty : 1;
    document.getElementById("si-unit").value = item ? item.unit : "";
    document.getElementById("si-min").value = item ? item.min : 1;
    document.getElementById("si-ideal").value = item && item.ideal ? item.ideal : "";
    document.getElementById("si-cycle").value = item && item.cycleDays ? item.cycleDays : "";
    document.getElementById("si-note").value = item ? item.note : "";
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeItemForm() { document.getElementById("shop-item-form").style.display = "none"; }

  function saveItemForm() {
    var id = document.getElementById("si-id").value;
    var name = document.getElementById("si-name").value.trim();
    if (!name) { alert("Nhập tên món đã."); return; }
    var data = {
      name: name,
      category: document.getElementById("si-category").value,
      qty: parseFloat(document.getElementById("si-qty").value) || 0,
      unit: document.getElementById("si-unit").value.trim(),
      min: parseFloat(document.getElementById("si-min").value) || 0,
      ideal: document.getElementById("si-ideal").value ? parseFloat(document.getElementById("si-ideal").value) : null,
      cycleDays: document.getElementById("si-cycle").value ? parseInt(document.getElementById("si-cycle").value, 10) : null,
      note: document.getElementById("si-note").value.trim()
    };
    if (id) {
      var it = findItem(id);
      Object.assign(it, data);
      addActivity("edit", "✏️ Đã sửa: " + it.name);
    } else {
      var newItem = mkItem(data);
      if (data.category === "dinh_ky" && !newItem.lastRestock) newItem.lastRestock = todayISO();
      state.items.push(newItem);
      addActivity("add", "➕ Đã thêm món mới: " + name);
    }
    closeItemForm();
    renderAll();
  }

  /* ------------------------------------------------------------------ *
   * FORM: PHÁT SINH NHANH                                               *
   * ------------------------------------------------------------------ */
  function openAdhocForm() {
    document.getElementById("shop-item-form").style.display = "none";
    document.getElementById("sa-name").value = "";
    document.getElementById("sa-qty").value = 1;
    document.getElementById("sa-priority").value = "binh_thuong";
    document.getElementById("sa-note").value = "";
    var form = document.getElementById("shop-adhoc-form");
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeAdhocForm() { document.getElementById("shop-adhoc-form").style.display = "none"; }

  function saveAdhoc() {
    var name = document.getElementById("sa-name").value.trim();
    if (!name) { alert("Nhập tên món đã."); return; }
    var qty = parseFloat(document.getElementById("sa-qty").value) || 1;
    var priority = document.getElementById("sa-priority").value;
    var note = document.getElementById("sa-note").value.trim();
    var item = mkItem({ name: name, category: "phat_sinh", qty: qty, min: 0, inCart: true, cartPriority: priority, note: note });
    state.items.push(item);
    addActivity("adhoc", "⚡ Phát sinh: " + name + " (" + PRIORITY_LABEL[priority] + ")");
    closeAdhocForm();
    switchShopTab("cart");
    renderAll();
  }

  /* ------------------------------------------------------------------ *
   * TABS / FILTER                                                       *
   * ------------------------------------------------------------------ */
  function switchShopTab(tab) {
    document.querySelectorAll(".shop-tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-shoptab") === tab);
    });
    ["items", "cart", "replace", "history"].forEach(function (t) {
      var panel = document.getElementById("shop-panel-" + t);
      if (panel) panel.style.display = (t === tab) ? "block" : "none";
    });
  }

  function addAllSuggested() {
    var added = 0;
    state.items.forEach(function (it) {
      if (isSuggested(it)) {
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        added++;
      }
    });
    if (added) addActivity("bulk", "🛒 Đã đưa " + added + " món (gợi ý) vào danh sách mua.");
    renderAll();
    switchShopTab("cart");
  }

  /* ------------------------------------------------------------------ *
   * KHỞI TẠO                                                            *
   * ------------------------------------------------------------------ */
  function init() {
    if (!document.getElementById("section-shopping")) return; // trang không có module này

    document.getElementById("shop-btn-additem").addEventListener("click", function () { openItemForm(null); });
    document.getElementById("shop-btn-adhoc").addEventListener("click", openAdhocForm);
    document.getElementById("shop-item-save").addEventListener("click", saveItemForm);
    document.getElementById("shop-item-cancel").addEventListener("click", closeItemForm);
    document.getElementById("shop-adhoc-save").addEventListener("click", saveAdhoc);
    document.getElementById("shop-adhoc-cancel").addEventListener("click", closeAdhocForm);
    document.getElementById("shop-btn-addall").addEventListener("click", addAllSuggested);

    document.getElementById("shop-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-shoptab]");
      if (b) switchShopTab(b.getAttribute("data-shoptab"));
    });

    document.getElementById("shop-cat-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      activeCatFilter = b.getAttribute("data-cat");
      document.querySelectorAll("#shop-cat-filter .shop-chip").forEach(function (c) { c.classList.remove("active"); });
      b.classList.add("active");
      renderItemsGrid();
    });

    document.getElementById("shop-items-grid").addEventListener("click", onGridClick);
    document.getElementById("shop-cart-list").addEventListener("click", onGridClick);
    document.getElementById("shop-replace-list").addEventListener("click", onGridClick);

    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose để debug / để các module khác (tasks.js, notifications.js...) có thể móc vào sau này.
  window.TTBK_SHOPPING = {
    state: state,
    renderAll: renderAll,
    computeStatus: computeStatus,
    addAllSuggested: addAllSuggested
  };
})();
