/* =========================================================================
   js/shopping-ai.js — Lớp bổ sung cho module "Nhà cần gì?"
   -------------------------------------------------------------------------
   KHÔNG sửa js/shopping.js. Chỉ đọc window.TTBK_SHOPPING.state (đã được
   shopping.js tự expose ở cuối file) để:
     1) Tính số chi tiêu đồ dùng thật (từ state.purchaseLog[].cost) cho thẻ
        "Liên kết Chi tiêu" (#shop-expense-*).
     2) Tính gợi ý AI thật (#shop-ai-grid) — dự đoán sắp hết, cặp món hay
        mua cùng nhau, thiếu đồ dự phòng, ngân sách trung bình — thay cho
        4 thẻ ví dụ tĩnh trước đây.

   Cách tự cập nhật: shopping.js gọi renderOverview() (ghi lại #shop-overview)
   sau MỌI thao tác (renderAll()). Ta gắn MutationObserver lên #shop-overview
   để "ăn theo" mốc đó, không cần sửa hay gọi lại gì trong shopping.js.
   ========================================================================= */
(function () {
  "use strict";

  function getState() {
    return window.TTBK_SHOPPING && window.TTBK_SHOPPING.state;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtVND(n) { return Math.round(n).toLocaleString("vi-VN") + "đ"; }
  function monthKey(iso) { return iso ? iso.slice(0, 7) : ""; }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function daysSince(iso) { return daysBetween(iso, new Date().toISOString().slice(0, 10)); }

  /* ---------------------------------------------------------------- *
   * Thẻ "Liên kết Chi tiêu" — tính từ state.purchaseLog[].cost thật   *
   * ---------------------------------------------------------------- */
  function updateExpenseCard() {
    var st = getState();
    var amountEl = document.getElementById("shop-expense-month-amount");
    var noteEl = document.getElementById("shop-expense-avg-note");
    if (!st || !amountEl || !noteEl) return;

    var logs = (st.purchaseLog || []).filter(function (l) { return l.cost; });
    var curKey = new Date().toISOString().slice(0, 7);
    var thisMonthTotal = logs
      .filter(function (l) { return monthKey(l.date) === curKey; })
      .reduce(function (s, l) { return s + Number(l.cost); }, 0);

    var byMonth = {};
    logs.forEach(function (l) {
      var k = monthKey(l.date);
      byMonth[k] = (byMonth[k] || 0) + Number(l.cost);
    });
    var months = Object.keys(byMonth);

    amountEl.innerHTML = thisMonthTotal > 0
      ? "<b>" + fmtVND(thisMonthTotal) + "</b><span>tháng này</span>"
      : "<b>—</b><span>chưa có khoản nào tháng này</span>";

    if (months.length >= 2) {
      var avg = months.reduce(function (s, k) { return s + byMonth[k]; }, 0) / months.length;
      noteEl.textContent = "Trung bình " + fmtVND(avg) + "/tháng, tính trên " + months.length + " tháng đã có giá.";
    } else if (months.length === 1) {
      noteEl.textContent = "Mới có dữ liệu 1 tháng — mua thêm vài lần có ghi giá để tính được trung bình.";
    } else {
      noteEl.textContent = 'Bấm "✅ Đã mua" ở Danh sách mua và nhập giá tiền để bắt đầu theo dõi chi phí ở đây.';
    }
  }

  /* ---------------------------------------------------------------- *
   * Tab "🧠 AI gợi ý" — tính từ state.items + state.purchaseLog thật  *
   * ---------------------------------------------------------------- */
  function avgCycle(item, logs) {
    var mine = logs.filter(function (l) { return l.itemId === item.id; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (mine.length < 2) return item.cycleDays || null;
    var gaps = [];
    for (var i = 1; i < mine.length; i++) gaps.push(daysBetween(mine[i - 1].date, mine[i].date));
    return Math.round(gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length);
  }

  function buildInsights() {
    var st = getState();
    if (!st || !window.TTBK_SHOPPING.computeStatus) return [];
    var items = st.items || [], logs = st.purchaseLog || [];
    var insights = [];

    // 1) Dự đoán sắp hết — dựa trên chu kỳ mua trung bình thật (>=2 lần mua)
    items.filter(function (it) {
      return it.category !== "dinh_ky" && it.category !== "phat_sinh" && it.lastRestock && !it.inCart;
    }).forEach(function (it) {
      var cyc = avgCycle(it, logs);
      if (!cyc) return;
      var elapsed = daysSince(it.lastRestock);
      var remain = cyc - elapsed;
      if (remain > 0 && remain <= Math.max(3, Math.round(cyc * 0.25))) {
        insights.push({
          type: "predict", icon: "⏳", title: "Sắp hết trong vài ngày",
          html: "<strong>" + escapeHtml(it.name) + "</strong> thường được mua lại sau khoảng <strong>" + cyc + " ngày</strong>. " +
                "Lần gần nhất cách đây <strong>" + elapsed + " ngày</strong> → có thể hết trong khoảng <strong>" + remain + " ngày tới</strong>.",
          actId: it.id
        });
      }
    });

    // 2) Cặp món hay được mua cùng ngày (từ lịch sử mua thật)
    var byDate = {};
    logs.forEach(function (l) { (byDate[l.date] = byDate[l.date] || []).push(l.itemName); });
    var pairCount = {};
    Object.keys(byDate).forEach(function (d) {
      var names = byDate[d].filter(function (n, i, arr) { return arr.indexOf(n) === i; });
      for (var i = 0; i < names.length; i++) {
        for (var j = i + 1; j < names.length; j++) {
          var key = [names[i], names[j]].sort().join(" + ");
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });
    var bestPair = Object.keys(pairCount).filter(function (k) { return pairCount[k] >= 2; })
      .sort(function (a, b) { return pairCount[b] - pairCount[a]; })[0];
    if (bestPair) {
      insights.push({
        type: "pair", icon: "🔗", title: "Thường mua cùng nhau",
        html: "<strong>" + escapeHtml(bestPair) + "</strong> đã được mua cùng đợt <strong>" + pairCount[bestPair] + " lần</strong> gần đây. Lần mua tới có thể gộp chung cho tiện."
      });
    }

    // 3) Thiếu đồ dự phòng
    items.filter(function (it) { return it.category === "du_phong"; }).forEach(function (it) {
      var s = window.TTBK_SHOPPING.computeStatus(it);
      if (s.level !== "on") {
        insights.push({
          type: "warn", icon: "⚠️", title: "Thiếu đồ dự phòng",
          html: "Nhà hiện <strong>" + (s.level === "het" ? "không còn" : "sắp hết") + "</strong> " + escapeHtml(it.name) + " dự phòng — nếu cần gấp sẽ không có sẵn."
        });
      }
    });

    // 4) Ngân sách trung bình — từ purchaseLog có giá
    var byMonth = {};
    logs.forEach(function (l) { if (!l.cost) return; var k = monthKey(l.date); byMonth[k] = (byMonth[k] || 0) + Number(l.cost); });
    var months = Object.keys(byMonth);
    if (months.length >= 1) {
      var avg = months.reduce(function (s, k) { return s + byMonth[k]; }, 0) / months.length;
      insights.push({
        type: "budget", icon: "📊", title: "Ngân sách mua sắm trung bình",
        html: "Trung bình mỗi tháng nhà chi khoảng <strong>" + fmtVND(avg) + "</strong> cho đồ dùng sinh hoạt (tính trên " + months.length + " tháng đã có giá).",
        link: true
      });
    }

    return insights;
  }

  function renderAI() {
    var host = document.getElementById("shop-ai-grid");
    if (!host) return;
    var insights = buildInsights();
    if (!insights.length) {
      host.innerHTML = '<p class="empty-state">Chưa đủ dữ liệu để gợi ý. Cứ dùng bình thường — báo sắp hết, đánh dấu "Đã mua" kèm giá — sau vài lần mua mỗi món, gợi ý thật sẽ xuất hiện ở đây.</p>';
      return;
    }
    host.innerHTML = insights.map(function (ins) {
      var btn = ins.type === "predict"
        ? '<button class="btn btn-ghost btn-sm" data-ai-act="addcart" data-id="' + ins.actId + '">Thêm vào danh sách mua</button>'
        : ins.link
          ? '<button class="btn btn-ghost btn-sm" onclick="(window.ttbkNavigate||function(u){window.location.href=u;})(\'Chi tiêu TTBK.html\')">Xem trong Chi tiêu →</button>'
          : "";
      return (
        '<div class="ai-card ' + ins.type + '">' +
          '<div class="ai-card-head"><span class="ic">' + ins.icon + "</span><h4>" + ins.title + "</h4></div>" +
          "<p>" + ins.html + "</p>" +
          btn +
        "</div>"
      );
    }).join("");
  }

  // Nút "Thêm vào danh sách mua" ngay trong thẻ AI — gọi thẳng qua
  // window.TTBK_SHOPPING rồi nhờ shopping.js tự vẽ lại (renderAll bên đó
  // sẽ kích hoạt MutationObserver của ta để làm mới lại tab AI).
  document.addEventListener("click", function (e) {
    var btn = e.target.closest('[data-ai-act="addcart"]');
    if (!btn) return;
    var st = getState();
    if (!st) return;
    var it = st.items.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
    if (!it || it.inCart) return;
    it.inCart = true;
    it.cartPriority = it.cartPriority || "binh_thuong";
    if (window.TTBK_SHOPPING.renderAll) window.TTBK_SHOPPING.renderAll();
  });

  function refreshAll() { updateExpenseCard(); renderAI(); }

  function init() {
    if (!window.TTBK_SHOPPING) { setTimeout(init, 150); return; } // chờ shopping.js chạy xong
    refreshAll();
    var overviewHost = document.getElementById("shop-overview");
    if (overviewHost && window.MutationObserver) {
      new MutationObserver(refreshAll).observe(overviewHost, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
