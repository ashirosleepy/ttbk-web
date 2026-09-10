/* =========================================================================
   js/shopping.js — Module "Nhà cần gì?" (Đồ dùng / Mua sắm / Dự phòng / Định kỳ)
   -------------------------------------------------------------------------
   BẢN SUPABASE: dữ liệu lưu ở bảng shopping_items / shopping_purchase_log /
   expenses (xem sql/007_shopping_and_expenses.sql) — cả nhà cùng thấy 1 bộ
   dữ liệu, không còn mỗi máy 1 kiểu như bản localStorage trước.

   🔧 GIẢ ĐỊNH CẦN KIỂM TRA: file này gọi client Supabase qua sbClient() bên
   dưới, đang thử lần lượt window.sb / window.supabaseClient / window.db.
   Nếu supabase-client.js của bạn đặt tên global khác, sửa 1 dòng trong
   hàm sbClient() cho đúng là chạy được ngay, không cần sửa gì khác.

   Giữ nguyên mọi id/class HTML + API window.TTBK_SHOPPING như bản cũ để
   js/shopping-ai.js không cần sửa gì.
   ========================================================================= */
(function () {
  "use strict";

  function sbClient() {
    return window.sb || window.supabaseClient || window.ttbkSupabase || window.db || null;
  }

  var CATEGORY_LABEL = {
    thuc_pham: "🥦 Thực phẩm",
    tieu_hao: "🧻 Tiêu hao",
    du_phong: "🔋 Dự phòng",
    dinh_ky: "🔧 Định kỳ thay",
    phat_sinh: "⚡ Phát sinh"
  };

  var PLACE_LABEL = {
    sieu_thi: "🛒 Siêu thị",
    cho: "🥬 Chợ",
    tien_loi: "🏪 Tiện lợi",
    online: "🛍️ Online"
  };

  var PRIORITY_LABEL = {
    cao: "🔴 Cao",
    binh_thuong: "🟡 Bình thường",
    thap: "🟢 Thấp"
  };

  /* ------------------------------------------------------------------ *
   * STATE (bộ nhớ đệm trong trình duyệt — nguồn thật là Supabase)       *
   * ------------------------------------------------------------------ */
  var state = { items: [], purchaseLog: [] };
  var profiles = [];       // [{id, name}] — 4 thành viên, lấy từ bảng profiles
  var activeCatFilter = "all";
  var activePlaceFilter = "all";

  /* ------------------------------------------------------------------ *
   * TIỆN ÍCH NGÀY THÁNG / SỐ (giữ nguyên như bản cũ)                    *
   * ------------------------------------------------------------------ */
  function uid() { return "tmp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function daysSince(iso) { return daysBetween(iso, todayISO()); }
  function fmtQty(n) {
    if (n === null || n === undefined) return "";
    var r = Math.round(n * 100) / 100;
    return String(r);
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
   * LỚP DỮ LIỆU — Supabase                                              *
   * ------------------------------------------------------------------ */
  function rowToItem(r) {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit || "",
      qty: Number(r.qty) || 0,
      min: Number(r.min) || 0,
      ideal: r.ideal != null ? Number(r.ideal) : null,
      cycleDays: r.cycle_days != null ? Number(r.cycle_days) : null,
      lastRestock: r.last_restock,
      expiryDate: r.expiry_date || null,
      buyPlace: r.buy_place || null,
      manualLevel: r.manual_level,
      manualBy: r.manual_by,
      manualAt: r.manual_at,
      inCart: !!r.in_cart,
      cartPriority: r.cart_priority,
      note: r.note || ""
    };
  }
  function rowToPurchase(r) {
    return {
      id: r.id,
      itemId: r.item_id,
      itemName: r.item_name,
      qty: Number(r.qty),
      cost: r.cost != null ? Number(r.cost) : null,
      paidBy: r.paid_by,
      paidByName: (r.profiles && r.profiles.name) || null,
      date: r.purchase_date
    };
  }

  var SHOP_DB = {
    loadAll: function () {
      var sb = sbClient();
      if (!sb) {
        console.error('[shopping.js] Không tìm thấy Supabase client. Sửa hàm sbClient() ở đầu file js/shopping.js cho đúng tên global bạn đang dùng.');
        return Promise.resolve();
      }
      return Promise.all([
        sb.from("shopping_items").select("*").order("created_at", { ascending: true }),
        sb.from("shopping_purchase_log").select("*, profiles:paid_by(name)").order("purchase_date", { ascending: false }).limit(300),
        sb.from("profiles").select("id,name").order("name", { ascending: true })
      ]).then(function (results) {
        var itemsRes = results[0], logsRes = results[1], profRes = results[2];
        if (itemsRes.error) console.error("[shopping.js] load items:", itemsRes.error.message);
        if (logsRes.error) console.error("[shopping.js] load purchase log:", logsRes.error.message);
        if (profRes.error) console.error("[shopping.js] load profiles:", profRes.error.message);
        state.items = (itemsRes.data || []).map(rowToItem);
        state.purchaseLog = (logsRes.data || []).map(rowToPurchase);
        profiles = profRes.data || [];
      });
    },
    insertItem: function (data) {
      var sb = sbClient(); if (!sb) return Promise.resolve(null);
      var payload = {
        name: data.name, category: data.category, unit: data.unit || null,
        qty: data.qty, min: data.min, ideal: data.ideal, cycle_days: data.cycleDays,
        expiry_date: data.expiryDate || null, buy_place: data.buyPlace || null,
        note: data.note || null
      };
      if (data.category === "dinh_ky") payload.last_restock = todayISO();
      if (data.category === "phat_sinh") { payload.in_cart = true; payload.cart_priority = data.cartPriority || "binh_thuong"; }
      return sb.from("shopping_items").insert(payload).select().single().then(function (res) {
        if (res.error) { alert("Lỗi lưu Supabase: " + res.error.message); return null; }
        return rowToItem(res.data);
      });
    },
    updateItem: function (id, patch) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      return sb.from("shopping_items").update(patch).eq("id", id).then(function (res) {
        if (res.error) alert("Lỗi cập nhật Supabase: " + res.error.message);
      });
    },
    deleteItem: function (id) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      return sb.from("shopping_items").delete().eq("id", id).then(function (res) {
        if (res.error) alert("Lỗi xoá trên Supabase: " + res.error.message);
      });
    },
    insertPurchase: function (entry) {
      var sb = sbClient(); if (!sb) return Promise.resolve(null);
      var payload = {
        item_id: entry.itemId || null, item_name: entry.itemName, qty: entry.qty,
        cost: entry.cost, paid_by: entry.paidBy || null, purchase_date: entry.date || todayISO()
      };
      return sb.from("shopping_purchase_log").insert(payload).select("*, profiles:paid_by(name)").single().then(function (res) {
        if (res.error) { alert("Lỗi lưu lịch sử mua: " + res.error.message); return null; }
        return rowToPurchase(res.data);
      });
    },
    insertExpense: function (entry) {
      var sb = sbClient(); if (!sb) return Promise.resolve();
      var payload = {
        description: entry.description, category: entry.category || "shopping",
        amount: entry.amount, paid_by: entry.paidBy || null, expense_date: entry.date || todayISO(),
        source: "shopping", shopping_purchase_id: entry.purchaseId || null
      };
      return sb.from("expenses").insert(payload).then(function (res) {
        if (res.error) console.error("[shopping.js] Không ghi được vào expenses:", res.error.message);
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * LOGIC TRẠNG THÁI / DỰ ĐOÁN (giữ nguyên logic bản cũ)                *
   * ------------------------------------------------------------------ */
  function computeStatus(item) {
    var base = computeBaseStatus(item);
    return applyExpiry(item, base);
  }

  function computeBaseStatus(item) {
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

  // Hạn sử dụng chỉ LÀM NẶNG THÊM trạng thái (không bao giờ làm nhẹ đi):
  // quá hạn -> luôn 🔴 dù còn số lượng; sắp hết hạn -> ít nhất 🟡.
  function applyExpiry(item, base) {
    if (!item.expiryDate || item.category === "dinh_ky") return base;
    var remain = daysBetween(todayISO(), item.expiryDate);
    if (remain < 0) {
      return { level: "het", emoji: "🔴", label: "Đã hết hạn dùng " + Math.abs(remain) + " ngày trước" };
    }
    if (remain <= 2 && base.level === "on") {
      return { level: "sap_het", emoji: "🟡", label: "Sắp hết hạn (còn " + remain + " ngày)" };
    }
    return base;
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
    if (remain <= 0) return null;
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
        ? '<div class="shop-reporter">🧑 ' + escapeHtml(it.manualBy) + " báo lúc " + escapeHtml(it.manualAt || "") + "</div>"
        : "";

      var placeTag = it.buyPlace ? (" · " + PLACE_LABEL[it.buyPlace]) : "";
      var expiryTag = it.expiryDate ? (" · HSD: " + it.expiryDate) : "";

      return (
        '<div class="shop-item-card">' +
          '<div class="shop-item-top">' +
            "<h4>" + escapeHtml(it.name) + "</h4>" +
            '<span class="shop-badge shop-badge-' + st.level + '">' + st.emoji + " " + st.label + "</span>" +
          "</div>" +
          '<div class="shop-meta">' + CATEGORY_LABEL[it.category] + " · " + qtyLine + placeTag + expiryTag + "</div>" +
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
  function lastKnownCost(itemId) {
    var logs = state.purchaseLog.filter(function (l) { return l.itemId === itemId && l.cost != null; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return logs.length ? logs[0].cost : null;
  }

  function renderCart() {
    var host = document.getElementById("shop-cart-list");
    var summaryEl = document.getElementById("shop-cart-summary");
    if (!host) return;

    var inCart = state.items.filter(function (it) { return it.inCart; });
    var filtered = inCart.filter(function (it) {
      return activePlaceFilter === "all" || it.buyPlace === activePlaceFilter;
    });

    if (summaryEl) {
      if (!inCart.length) {
        summaryEl.textContent = "";
      } else {
        var estTotal = filtered.reduce(function (s, it) {
          var c = lastKnownCost(it.id);
          return c ? s + c : s;
        }, 0);
        summaryEl.textContent = filtered.length + " món" +
          (activePlaceFilter !== "all" ? " ở " + PLACE_LABEL[activePlaceFilter] : "") +
          (estTotal > 0 ? " — khoảng " + Math.round(estTotal).toLocaleString("vi-VN") + "đ (ước tính theo giá lần mua gần nhất)" : "");
      }
    }

    if (!inCart.length) { host.innerHTML = '<p class="empty-state">Chưa có gì trong danh sách mua. Bấm "Đưa tất cả gợi ý vào danh sách mua" ở trên nếu có món sắp hết.</p>'; return; }
    if (!filtered.length) { host.innerHTML = '<p class="empty-state">Không có món nào ở nơi mua này. Chọn "Tất cả nơi mua" để xem hết.</p>'; return; }

    var cao = filtered.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) === "cao"; });
    var thuong = filtered.filter(function (it) { return (it.cartPriority || suggestedPriority(it)) !== "cao"; });

    function row(it) {
      var qtyNeed = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
      var placeTag = it.buyPlace ? (" · " + PLACE_LABEL[it.buyPlace]) : "";
      return (
        '<div class="task-card shop-cart-row" data-id="' + it.id + '">' +
          "<div><b>" + escapeHtml(it.name) + "</b> — cần khoảng " + fmtQty(qtyNeed) + " " + escapeHtml(it.unit || "") +
          '<div class="shop-note">' + CATEGORY_LABEL[it.category] + placeTag + "</div></div>" +
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
   * RENDER: LỊCH SỬ — giờ hiện thêm luôn người trả tiền                 *
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
          (l.paidByName ? " · 🧑 " + escapeHtml(l.paidByName) + " trả" : "") +
          '<div class="shop-note">' + l.date + "</div></div>" +
        "</div>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * RENDER TỔNG                                                         *
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderOverview();
    renderItemsGrid();
    renderCart();
    renderReplace();
    renderHistory();
    injectDashboardCard();
  }

  /* ------------------------------------------------------------------ *
   * THẺ TÓM TẮT TRÊN TRANG "TỔNG QUAN" (giữ nguyên như bản cũ)          *
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

  (function watchDashboard() {
    var host = document.getElementById("dashboard-content");
    if (!host || !window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!document.getElementById("shop-dashboard-card")) injectDashboardCard();
    });
    obs.observe(host, { childList: true });
  })();

  /* ------------------------------------------------------------------ *
   * HÀNH ĐỘNG (event delegation) — giờ hầu hết là async (gọi Supabase)  *
   * ------------------------------------------------------------------ */
  function findItem(id) { return state.items.filter(function (it) { return it.id === id; })[0]; }

  function onGridClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    var it = findItem(id);
    if (!it) return;

    switch (act) {
      case "inc": {
        var q1 = Math.round((it.qty + 1) * 100) / 100;
        it.qty = q1; it.manualLevel = null; renderAll();
        SHOP_DB.updateItem(id, { qty: q1, manual_level: null });
        break;
      }
      case "dec": {
        var q2 = Math.max(0, Math.round((it.qty - 1) * 100) / 100);
        it.qty = q2; it.manualLevel = null; renderAll();
        SHOP_DB.updateItem(id, { qty: q2, manual_level: null });
        break;
      }
      case "lvl": {
        var lvl = btn.getAttribute("data-lvl");
        var by = currentUserName();
        var at = new Date().toLocaleString("vi-VN");
        it.manualLevel = lvl; it.manualBy = by; it.manualAt = at;
        var patch = { manual_level: lvl, manual_by: by, manual_at: at };
        if (lvl !== "on" && !it.inCart) {
          it.inCart = true;
          it.cartPriority = lvl === "het" ? "cao" : "binh_thuong";
          patch.in_cart = true; patch.cart_priority = it.cartPriority;
        }
        renderAll();
        SHOP_DB.updateItem(id, patch);
        break;
      }
      case "replaced": {
        var today = todayISO();
        it.lastRestock = today;
        renderAll();
        SHOP_DB.updateItem(id, { last_restock: today }).then(function () {
          return SHOP_DB.insertPurchase({ itemId: it.id, itemName: it.name, qty: 1, cost: null, paidBy: null, date: today });
        }).then(function (p) { if (p) { state.purchaseLog.unshift(p); renderAll(); } });
        break;
      }
      case "addcart": {
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        renderAll();
        SHOP_DB.updateItem(id, { in_cart: true, cart_priority: it.cartPriority });
        if (typeof showToast === "function") showToast("🛒 Đã thêm vào danh sách mua");
        break;
      }
      case "uncart": {
        it.inCart = false;
        renderAll();
        SHOP_DB.updateItem(id, { in_cart: false });
        if (typeof showToast === "function") showToast("Đã bỏ khỏi danh sách mua");
        break;
      }
      case "edit":
        openItemForm(it);
        break;
      case "del":
        if (confirm('Xoá "' + it.name + '" khỏi danh sách đồ dùng?')) {
          state.items = state.items.filter(function (x) { return x.id !== it.id; });
          renderAll();
          SHOP_DB.deleteItem(id);
          if (typeof showToast === "function") showToast("🗑 Đã xoá \"" + it.name + "\"", "error");
        }
        break;
      case "buy":
        openBuyForm(it);
        break;
    }
  }

  /* ------------------------------------------------------------------ *
   * FORM: XÁC NHẬN ĐÃ MUA — nhập số lượng, giá, VÀ ai trả tiền          *
   * (thay cho chuỗi prompt() cũ — giờ ghi thẳng vào bảng expenses)      *
   * ------------------------------------------------------------------ */
  function fillPayerSelect() {
    var sel = document.getElementById("buy-payer");
    if (!sel) return;
    sel.innerHTML = '<option value="">— Chọn người trả —</option>' +
      profiles.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>"; }).join("");
  }

  function openBuyForm(it) {
    fillPayerSelect();
    document.getElementById("buy-item-id").value = it.id;
    document.getElementById("buy-item-name").textContent = it.name;
    var suggestion = it.category === "phat_sinh" ? (it.qty || 1) : suggestedBuyQty(it);
    document.getElementById("buy-qty").value = fmtQty(suggestion);
    document.getElementById("buy-cost").value = "";
    document.getElementById("buy-payer").value = "";
    var form = document.getElementById("shop-buy-form");
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeBuyForm() { document.getElementById("shop-buy-form").style.display = "none"; }

  function confirmBuy() {
    var id = document.getElementById("buy-item-id").value;
    var it = findItem(id);
    if (!it) return;

    var qty = parseFloat(document.getElementById("buy-qty").value.toString().replace(",", "."));
    if (isNaN(qty) || qty <= 0) { alert("Số lượng không hợp lệ."); return; }

    var costStr = document.getElementById("buy-cost").value;
    var cost = costStr && !isNaN(parseFloat(costStr)) ? parseFloat(costStr) : null;
    var payerId = document.getElementById("buy-payer").value || null;

    if (cost && !payerId) { alert("Bạn đã nhập giá tiền — chọn giúp ai là người trả nhé."); return; }

    var today = todayISO();
    var newQty = Math.round((it.qty + qty) * 100) / 100;

    it.qty = newQty; it.lastRestock = today; it.inCart = false; it.manualLevel = null;
    closeBuyForm();
    renderAll();

    SHOP_DB.updateItem(id, { qty: newQty, last_restock: today, in_cart: false, manual_level: null })
      .then(function () {
        return SHOP_DB.insertPurchase({ itemId: it.id, itemName: it.name, qty: qty, cost: cost, paidBy: payerId, date: today });
      })
      .then(function (purchase) {
        if (purchase) { state.purchaseLog.unshift(purchase); renderAll(); }
        if (typeof showToast === "function") showToast("✅ Đã ghi nhận mua \"" + it.name + "\"");
        if (cost && payerId) {
          return SHOP_DB.insertExpense({
            description: it.name, category: "shopping", amount: cost,
            paidBy: payerId, date: today, purchaseId: purchase ? purchase.id : null
          });
        }
      });
  }

  /* ------------------------------------------------------------------ *
   * FORM: THÊM / SỬA ĐỒ DÙNG                                            *
   * ------------------------------------------------------------------ */
  function openItemForm(item) {
    var form = document.getElementById("shop-item-form");
    document.getElementById("shop-adhoc-form").style.display = "none";
    document.getElementById("shop-buy-form").style.display = "none";
    document.getElementById("shop-item-form-title").textContent = item ? "Sửa đồ dùng" : "Thêm đồ dùng";
    document.getElementById("si-id").value = item ? item.id : "";
    document.getElementById("si-name").value = item ? item.name : "";
    document.getElementById("si-category").value = item ? item.category : "tieu_hao";
    document.getElementById("si-qty").value = item ? item.qty : 1;
    document.getElementById("si-unit").value = item ? item.unit : "";
    document.getElementById("si-min").value = item ? item.min : 1;
    document.getElementById("si-ideal").value = item && item.ideal ? item.ideal : "";
    document.getElementById("si-cycle").value = item && item.cycleDays ? item.cycleDays : "";
    document.getElementById("si-expiry").value = item && item.expiryDate ? item.expiryDate : "";
    document.getElementById("si-place").value = item && item.buyPlace ? item.buyPlace : "";
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
      expiryDate: document.getElementById("si-expiry").value || null,
      buyPlace: document.getElementById("si-place").value || null,
      note: document.getElementById("si-note").value.trim()
    };
    if (id) {
      var it = findItem(id);
      Object.assign(it, data);
      closeItemForm();
      renderAll();
      SHOP_DB.updateItem(id, {
        name: data.name, category: data.category, qty: data.qty, unit: data.unit || null,
        min: data.min, ideal: data.ideal, cycle_days: data.cycleDays,
        expiry_date: data.expiryDate, buy_place: data.buyPlace, note: data.note || null
      });
      if (typeof showToast === "function") showToast("Đã lưu \"" + data.name + "\"");
    } else {
      closeItemForm();
      SHOP_DB.insertItem(data).then(function (newItem) {
        if (newItem) { state.items.push(newItem); renderAll(); }
        if (typeof showToast === "function") showToast("Đã thêm \"" + data.name + "\"");
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * FORM: PHÁT SINH NHANH                                               *
   * ------------------------------------------------------------------ */
  function openAdhocForm() {
    document.getElementById("shop-item-form").style.display = "none";
    document.getElementById("shop-buy-form").style.display = "none";
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
    var data = { name: name, category: "phat_sinh", qty: qty, unit: "", min: 0, ideal: null, cycleDays: null, note: note, cartPriority: priority };
    closeAdhocForm();
    SHOP_DB.insertItem(data).then(function (newItem) {
      if (newItem) { state.items.push(newItem); switchShopTab("cart"); renderAll(); }
      if (typeof showToast === "function") showToast("Đã thêm \"" + name + "\" vào danh sách mua");
    });
  }

  /* ------------------------------------------------------------------ *
   * TABS / FILTER                                                       *
   * ------------------------------------------------------------------ */
  function switchShopTab(tab) {
    document.querySelectorAll(".shop-tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-shoptab") === tab);
    });
    ["items", "cart", "ai", "replace", "history"].forEach(function (t) {
      var panel = document.getElementById("shop-panel-" + t);
      if (panel) panel.style.display = (t === tab) ? "block" : "none";
    });
  }

  function addAllSuggested() {
    var added = [];
    state.items.forEach(function (it) {
      if (isSuggested(it)) {
        it.inCart = true;
        it.cartPriority = suggestedPriority(it);
        added.push(it);
      }
    });
    renderAll();
    switchShopTab("cart");
    added.forEach(function (it) {
      SHOP_DB.updateItem(it.id, { in_cart: true, cart_priority: it.cartPriority });
    });
    if (typeof showToast === "function") {
      showToast(added.length ? ("🛒 Đã thêm " + added.length + " món vào danh sách mua") : "Không có món nào cần thêm");
    }
  }

  /* ------------------------------------------------------------------ *
   * ĐỒNG BỘ TRỰC TIẾP GIỮA CÁC THÀNH VIÊN (Supabase Realtime)           *
   * ------------------------------------------------------------------ */
  function subscribeRealtime() {
    var sb = sbClient();
    if (!sb || !sb.channel) return;
    var pending = null;
    function debouncedReload() {
      if (pending) clearTimeout(pending);
      pending = setTimeout(function () {
        SHOP_DB.loadAll().then(renderAll);
      }, 400);
    }
    sb.channel("shopping-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_purchase_log" }, debouncedReload)
      .subscribe();
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
    document.getElementById("buy-confirm").addEventListener("click", confirmBuy);
    document.getElementById("buy-cancel").addEventListener("click", closeBuyForm);

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

    document.getElementById("shop-place-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-place]");
      if (!b) return;
      activePlaceFilter = b.getAttribute("data-place");
      document.querySelectorAll("#shop-place-filter .shop-chip").forEach(function (c) { c.classList.remove("active"); });
      b.classList.add("active");
      renderCart();
    });

    document.getElementById("shop-items-grid").addEventListener("click", onGridClick);
    document.getElementById("shop-cart-list").addEventListener("click", onGridClick);
    document.getElementById("shop-replace-list").addEventListener("click", onGridClick);

    // Giai đoạn 2 — vuốt phải để mở form "Đã mua", vuốt trái để bỏ khỏi
    // danh sách mua, ngay trên từng dòng (chỉ hoạt động bằng cảm ứng).
    if (typeof enableSwipeActions === "function") {
      enableSwipeActions(document.getElementById("shop-cart-list"), {
        itemSelector: ".shop-cart-row",
        rightSelector: '[data-act="buy"]',
        leftSelector: '[data-act="uncart"]',
        rightLabel: "✅ Đã mua",
        leftLabel: "✕ Bỏ khỏi ds",
      });
    }

    SHOP_DB.loadAll().then(function () {
      fillPayerSelect();
      renderAll();
      subscribeRealtime();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose để shopping-ai.js và các module khác móc vào — giữ đúng hình dạng như bản cũ.
  window.TTBK_SHOPPING = {
    state: state,
    renderAll: renderAll,
    computeStatus: computeStatus,
    addAllSuggested: addAllSuggested
  };
})();
