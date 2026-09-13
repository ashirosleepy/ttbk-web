import"./style-C_uAb6-X.js";import"./theme-preload-Cz4vKcn8.js";const r=`/* ==========================================================\r
   TTBK - Hieu ung chuyen trang muot\r
   Dung chung cho index.html va "Chi tieu TTBK.html".\r
   ========================================================== */\r
(function () {\r
  var FADE_OUT_MS = 220;\r
  var root = document.documentElement;\r
\r
  function showPage() {\r
    requestAnimationFrame(function () {\r
      requestAnimationFrame(function () {\r
        root.classList.add("pg-ready");\r
      });\r
    });\r
  }\r
\r
  function isLocalHtmlLink(href) {\r
    if (!href) return false;\r
    try {\r
      var url = new URL(href, window.location.href);\r
      if (url.origin !== window.location.origin) return false;\r
      if (url.href.split("#")[0] === window.location.href.split("#")[0]) return false;\r
      return /\\.html?$/i.test(url.pathname) || href.slice(-5).toLowerCase() === ".html";\r
    } catch (e) {\r
      return false;\r
    }\r
  }\r
\r
  window.ttbkNavigate = function (href) {\r
    root.classList.remove("pg-ready");\r
    root.classList.add("pg-leave");\r
    window.setTimeout(function () {\r
      window.location.href = href;\r
    }, FADE_OUT_MS);\r
  };\r
\r
  document.addEventListener("click", function (e) {\r
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;\r
    var el = e.target.closest("a[href]");\r
    if (!el || el.target === "_blank") return;\r
    var href = el.getAttribute("href");\r
    if (!isLocalHtmlLink(href)) return;\r
    e.preventDefault();\r
    window.ttbkNavigate(href);\r
  }, true);\r
\r
  window.addEventListener("pageshow", function (e) {\r
    if (e.persisted) {\r
      root.classList.remove("pg-leave");\r
      root.classList.add("pg-fade");\r
      showPage();\r
    }\r
  });\r
\r
  if (document.readyState === "loading") {\r
    document.addEventListener("DOMContentLoaded", showPage);\r
  } else {\r
    showPage();\r
  }\r
})();\r


// ============================================================
// CẤU HÌNH SUPABASE
// 1. Vào https://supabase.com/dashboard -> chọn project của bạn
// 2. Vào Project Settings (biểu tượng bánh răng) -> API
// 3. Copy "Project URL" và "anon public" key, dán thay vào 2 dòng dưới
// ============================================================
const SUPABASE_URL = "https://vxkcamaaqpdcyapzcoxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4a2NhbWFhcXBkY3lhcHpjb3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzE2MTEsImV4cCI6MjEwNDIwNzYxMX0.TGWaO9bQmp4NtAg7ZghjjDZCobXeSWrVH9X9qGXXLVA";

// Tạo 1 client dùng chung cho cả app (login.html và index.html đều nạp file này)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

// Màu mặc định gán cho từng người khi chưa tự chọn màu riêng ở trang Cài đặt
const AVATAR_COLORS = ["#3B6E8F", "#C77B2E", "#2F8F6B", "#A24E6B", "#6B5B95", "#4A7A96"];

// Nhãn tiếng Việt cho trạng thái việc
const STATUS_LABEL = {
  cho_nhan: "Chờ nhận",
  chua_lam: "Chưa làm",
  dang_cho: "Đang chờ",
  hoan_thanh: "Hoàn thành",
  vo_chu: "Vô chủ — cần người nhận thay",
};

// Điểm thưởng thêm khi 1 người nhận thay việc của thành viên đang đi vắng
const AWAY_COVER_BONUS = 5;

const WEEKDAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];


// ============================================================
// AUTH.JS — đăng nhập / đăng xuất / lấy hồ sơ người dùng
// ============================================================

// Kiểm tra đã đăng nhập chưa. Nếu chưa -> đá về trang login.
async function requireSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Đăng nhập bằng email + mật khẩu
async function login(email, password) {
  return await supabaseClient.auth.signInWithPassword({ email, password });
}

// Đăng xuất
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Lấy hồ sơ (profiles) của người đang đăng nhập
async function getCurrentProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Không lấy được hồ sơ:", error.message);
    return null;
  }
  return data;
}

// Lấy hồ sơ của tất cả thành viên trong nhà (để hiện tên, gán việc...)
async function getAllProfiles() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("name");

  if (error) {
    console.error("Không lấy được danh sách thành viên:", error.message);
    return [];
  }
  return data;
}


/* Theme toggle — sáng / tối, lưu lựa chọn vào localStorage */
(function () {
  var STORAGE_KEY = 'ttbk-theme';
  var root = document.documentElement;

  function getPreferred() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#171B15' : '#A13F52');
    var btn = document.getElementById('theme-switch');
    if (btn) btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // Áp dụng ngay (đề phòng script head bị bỏ qua / chạy muộn)
  apply(getPreferred());

  document.addEventListener('DOMContentLoaded', function () {
    apply(getPreferred());
    var btn = document.getElementById('theme-switch');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        apply(next);
      });
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) {}
      if (!saved) apply(e.matches ? 'dark' : 'light');
    });
  }
})();


    (function () {
      var switchBtn = document.getElementById('theme-switch');

      function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      }

      function reflectButton() {
        if (switchBtn) switchBtn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
      }

      function applyTheme(theme, persist) {
        document.documentElement.setAttribute('data-theme', theme);
        if (persist) {
          try { localStorage.setItem('ttbk-theme', theme); } catch (e) {}
        }
        reflectButton();
        if (typeof syncChartsTheme === 'function') syncChartsTheme();
      }

      reflectButton();
      if (switchBtn) {
        switchBtn.addEventListener('click', function () {
          applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
        });
      }
      window.addEventListener('storage', function (e) {
        if (e.key === 'ttbk-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
          applyTheme(e.newValue, false);
        }
      });
    })();

    // --- LOGIC APP CHI TIÊU ---
    const members = ["Tiến", "Tài", "Bách", "Khoa"];
    const categoryLabels = { 'food': 'Ăn uống', 'rent': 'Tiền nhà/Điện nước', 'entertainment': 'Giải trí', 'shopping': 'Mua sắm', 'other': 'Khác' };
    
    let currentYear = 2026;
    let currentMonth = 1;
    let yearsData = {};
    let categoryChartInstance = null;
    let trendChartInstance = null;

    function createEmptyYearData() {
      let data = {};
      for (let m = 1; m <= 12; m++) {
        data[m] = { initValues: { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 }, expenses: [], transfers: [] };
      }
      return data;
    }

    function ensureLegacyDataFormat() {
      for (let y in yearsData) {
        for (let m = 1; m <= 12; m++) {
          if (!yearsData[y][m].transfers) yearsData[y][m].transfers = [];
          yearsData[y][m].expenses.forEach(e => {
            if (!e.shares) {
              e.shares = {};
              members.forEach(mbr => e.shares[mbr] = 1);
            }
          });
        }
      }
    }

    function formatVND(val) {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    }

    function renderYearSelect() {
      const select = document.getElementById('year-select');
      select.innerHTML = '';
      const sortedYears = Object.keys(yearsData).map(Number).sort((a, b) => a - b);
      sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = \`Năm \${y}\`;
        if (y === currentYear) opt.selected = true;
        select.appendChild(opt);
      });
    }

    function switchYear(year) {
      currentYear = year;
      if (!yearsData[currentYear]) yearsData[currentYear] = createEmptyYearData();
      updateUI();
    }

    function addNewYear() {
      const years = Object.keys(yearsData).map(Number);
      const nextSuggestedYear = years.length > 0 ? Math.max(...years) + 1 : 2026;
      const userInput = prompt("Nhập năm bạn muốn thêm mới:", nextSuggestedYear);
      if (userInput === null) return;
      const newYear = parseInt(userInput.trim(), 10);
      if (isNaN(newYear) || newYear < 2000 || newYear > 2100) return alert("Vui lòng nhập năm hợp lệ!");
      
      if (yearsData[newYear]) {
        currentYear = newYear; updateUI(); return;
      }
      yearsData[newYear] = createEmptyYearData();
      currentYear = newYear; currentMonth = 1;
      updateUI(); saveData();
    }

    function initMonthTabs() {
      const container = document.getElementById('month-tabs-container');
      container.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const btn = document.createElement('div');
        btn.className = \`month-btn \${m === currentMonth ? 'active' : ''}\`;
        btn.textContent = \`Tháng \${m}\`;
        btn.onclick = () => { currentMonth = m; updateUI(); };
        container.appendChild(btn);
      }
    }

    function updateUI() {
      ensureLegacyDataFormat();
      renderYearSelect();
      document.getElementById('current-month-title').textContent = \`Chi Tiêu Tháng \${currentMonth} / \${currentYear}\`;
      document.getElementById('summary-month-label').textContent = \`\${currentMonth}/\${currentYear}\`;
      document.getElementById('yearly-summary-title').textContent = \`5. Tổng Quan Chi Tiêu & Chốt Sổ Năm \${currentYear}\`;
      document.getElementById('yearly-grand-label').textContent = \`TỔNG CHI TIÊU NĂM \${currentYear}\`;
      initMonthTabs();
      
      const initVals = yearsData[currentYear][currentMonth].initValues;
      members.forEach(m => document.getElementById(\`init-\${m}\`).value = initVals[m] || 0);
      
      renderExpenses();
      renderTransfers();
      calculate();
      updateCharts();
    }

    function updateInitValue(member, val) {
      yearsData[currentYear][currentMonth].initValues[member] = parseFloat(val) || 0;
      calculate();
    }
    
    function saveInitFund() {
      saveData();
      const btn = document.getElementById('btn-save-fund');
      const originalText = btn.innerHTML;
      const originalColor = btn.style.backgroundColor;
      btn.innerHTML = "✔️ Đã Lưu Thành Công!";
      btn.style.backgroundColor = "#28a745";
      setTimeout(() => { btn.innerHTML = originalText; btn.style.backgroundColor = originalColor; }, 2000);
    }

    function getPreviousFundBalance(targetYear, targetMonth) {
      let balance = 0;
      const sortedYears = Object.keys(yearsData).map(Number).sort((a, b) => a - b);
      for (let y of sortedYears) {
        for (let m = 1; m <= 12; m++) {
          if (y > targetYear || (y === targetYear && m >= targetMonth)) return balance;
          const md = yearsData[y][m];
          members.forEach(mbr => balance += (md.initValues[mbr] || 0));
          md.expenses.forEach(e => { if (e.payer === "Quỹ ban đầu") balance -= e.amount; });
          md.transfers.forEach(t => {
            if (t.from === "Quỹ ban đầu") balance -= t.amount;
            if (t.to === "Quỹ ban đầu") balance += t.amount;
          });
        }
      }
      return balance;
    }

    function addExpense() {
      const desc = document.getElementById('exp-desc').value.trim();
      const cat = document.getElementById('exp-category').value;
      const amount = parseFloat(document.getElementById('exp-amount').value);
      const payer = document.getElementById('exp-payer').value;
      
      let shares = {};
      let totalShares = 0;
      members.forEach(m => {
        const val = parseFloat(document.getElementById(\`share-\${m}\`).value) || 0;
        shares[m] = val;
        totalShares += val;
      });

      if (!desc || isNaN(amount) || amount <= 0) return alert("Vui lòng nhập tên khoản chi và số tiền hợp lệ!");
      if (totalShares <= 0) return alert("Tổng số phần chia phải lớn hơn 0!");

      yearsData[currentYear][currentMonth].expenses.push({ desc, category: cat, amount, payer, shares });
      
      document.getElementById('exp-desc').value = ''; 
      document.getElementById('exp-amount').value = '';
      members.forEach(m => document.getElementById(\`share-\${m}\`).value = 1);
      updateUI(); saveData();
    }

    function deleteExpense(index) {
      if(confirm("Bạn có chắc muốn xóa khoản chi này?")) {
        yearsData[currentYear][currentMonth].expenses.splice(index, 1);
        updateUI(); saveData();
      }
    }

    function renderExpenses() {
      const tbody = document.getElementById('expense-list');
      tbody.innerHTML = '';

      yearsData[currentYear][currentMonth].expenses.forEach((item, index) => {
        const catLabel = categoryLabels[item.category || 'other'];
        let partsBadge = "";
        members.forEach(m => {
          const s = item.shares && item.shares[m] !== undefined ? item.shares[m] : 1;
          if (s > 0) partsBadge += \`<span class="badge member-badge">\${m}: \${s}p</span> \`;
        });
        const payerDisplay = item.payer === "Quỹ ban đầu" ? \`<span class="badge" style="background-color: #6f42c1;">Quỹ chung</span>\` : \`<strong>\${item.payer}</strong>\`;
        
        let actionTd = \`
          <td class="no-print">
            <button class="btn-warning" data-expense-action="edit-expense" data-index="\${index}" style="padding: 5px; font-size: 0.8em;">Sửa</button>
            <button class="btn-danger" data-expense-action="delete-expense" data-index="\${index}" style="padding: 5px; font-size: 0.8em;">Xóa</button>
          </td>
        \`;

        tbody.innerHTML += \`
          <tr>
            <td>\${item.desc}</td>
            <td><span class="badge cat-\${item.category || 'other'}">\${catLabel}</span></td>
            <td>\${payerDisplay}</td>
            <td>\${formatVND(item.amount)}</td>
            <td>\${partsBadge}</td>
            \${actionTd}
          </tr>
        \`;
      });
    }

    function addTransfer() {
      const from = document.getElementById('transfer-from').value;
      const to = document.getElementById('transfer-to').value;
      const amount = parseFloat(document.getElementById('transfer-amount').value);

      if (from === to) return alert("Người chuyển và người nhận không được trùng nhau!");
      if (isNaN(amount) || amount <= 0) return alert("Vui lòng nhập số tiền hợp lệ!");

      yearsData[currentYear][currentMonth].transfers.push({ from, to, amount });
      document.getElementById('transfer-amount').value = '';
      updateUI(); saveData();
    }

    function deleteTransfer(index) {
      if(confirm("Xóa khoản chuyển tiền này?")) {
        yearsData[currentYear][currentMonth].transfers.splice(index, 1);
        updateUI(); saveData();
      }
    }

    function renderTransfers() {
      const tbody = document.getElementById('transfer-list');
      tbody.innerHTML = '';

      if(yearsData[currentYear][currentMonth].transfers.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="4" style="color: #666;">Chưa có lịch sử chuyển tiền trong tháng này</td></tr>\`;
        return;
      }
      yearsData[currentYear][currentMonth].transfers.forEach((item, index) => {
        const fromDisplay = item.from === "Quỹ ban đầu" ? \`<span class="badge" style="background-color: #6f42c1;">Quỹ chung</span>\` : \`<strong>\${item.from}</strong>\`;
        const toDisplay = item.to === "Quỹ ban đầu" ? \`<span class="badge" style="background-color: #6f42c1;">Quỹ chung</span>\` : \`<strong>\${item.to}</strong>\`;
        
        let actionTd = \`
          <td class="no-print">
            <button class="btn-warning" data-expense-action="edit-transfer" data-index="\${index}" style="padding: 5px; font-size: 0.8em;">Sửa</button>
            <button class="btn-danger" data-expense-action="delete-transfer" data-index="\${index}" style="padding: 5px; font-size: 0.8em;">Xóa</button>
          </td>
        \`;

        tbody.innerHTML += \`
          <tr>
            <td>\${fromDisplay}</td><td>\${toDisplay}</td>
            <td style="color: #28a745; font-weight: bold;">\${formatVND(item.amount)}</td>
            \${actionTd}
          </tr>
        \`;
      });
    }

    function openEditModal(index) {
      const exp = yearsData[currentYear][currentMonth].expenses[index];
      document.getElementById('edit-index').value = index;
      document.getElementById('edit-desc').value = exp.desc;
      document.getElementById('edit-category').value = exp.category || 'other';
      document.getElementById('edit-amount').value = exp.amount;
      document.getElementById('edit-payer').value = exp.payer;
      members.forEach(m => {
        const s = exp.shares && exp.shares[m] !== undefined ? exp.shares[m] : 1;
        document.getElementById(\`edit-share-\${m}\`).value = s;
      });
      document.getElementById('editModal').style.display = 'block';
    }
    
    function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
    
    function saveEditExpense() {
      const index = document.getElementById('edit-index').value;
      const desc = document.getElementById('edit-desc').value.trim();
      const cat = document.getElementById('edit-category').value;
      const amount = parseFloat(document.getElementById('edit-amount').value);
      const payer = document.getElementById('edit-payer').value;
      let shares = {}, totalShares = 0;
      members.forEach(m => {
        const val = parseFloat(document.getElementById(\`edit-share-\${m}\`).value) || 0;
        shares[m] = val; totalShares += val;
      });
      if (!desc || isNaN(amount) || amount <= 0 || totalShares <= 0) return alert("Thông tin không hợp lệ!");
      yearsData[currentYear][currentMonth].expenses[index] = { desc, category: cat, amount, payer, shares };
      closeEditModal(); updateUI(); saveData();
    }

    function openEditTransferModal(index) {
      const t = yearsData[currentYear][currentMonth].transfers[index];
      document.getElementById('edit-transfer-index').value = index;
      document.getElementById('edit-transfer-from').value = t.from;
      document.getElementById('edit-transfer-to').value = t.to;
      document.getElementById('edit-transfer-amount').value = t.amount;
      document.getElementById('editTransferModal').style.display = 'block';
    }
    
    function closeEditTransferModal() { document.getElementById('editTransferModal').style.display = 'none'; }
    
    function saveEditTransfer() {
      const index = document.getElementById('edit-transfer-index').value;
      const from = document.getElementById('edit-transfer-from').value;
      const to = document.getElementById('edit-transfer-to').value;
      const amount = parseFloat(document.getElementById('edit-transfer-amount').value);
      if (from === to) return alert("Người chuyển và nhận không được trùng nhau!");
      if (isNaN(amount) || amount <= 0) return alert("Vui lòng nhập số tiền hợp lệ!");
      yearsData[currentYear][currentMonth].transfers[index] = { from, to, amount };
      closeEditTransferModal(); updateUI(); saveData();
    }

    function getPreviousDebtBalance(targetYear, targetMonth) {
      let previousBalances = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      
      // Tính cộng dồn các tháng trước trong cùng năm
      for (let m = 1; m < targetMonth; m++) {
        const monthData = yearsData[targetYear][m];
        
        let mPaid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
        let mOwed = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
        let mTransferPaid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
        let mTransferReceived = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };

        // 1. Tiền ứng/quỹ ban đầu
        members.forEach(mbr => mPaid[mbr] += (monthData.initValues[mbr] || 0));

        // 2. Chi phí
        monthData.expenses.forEach(item => {
          if (members.includes(item.payer)) mPaid[item.payer] += item.amount;
          
          let totalShares = 0;
          members.forEach(mbr => totalShares += (item.shares && item.shares[mbr] !== undefined ? item.shares[mbr] : 1));
          
          if (totalShares > 0) {
            members.forEach(p => {
              const pShares = item.shares && item.shares[p] !== undefined ? item.shares[p] : 1;
              mOwed[p] += (item.amount * pShares) / totalShares;
            });
          }
        });

        // 3. Chuyển tiền/Thanh toán nợ
        monthData.transfers.forEach(t => {
          if (members.includes(t.from)) mTransferPaid[t.from] += t.amount;
          if (members.includes(t.to)) mTransferReceived[t.to] += t.amount;
        });

        // Tổng hợp số dư của tháng đó
        members.forEach(mbr => {
           previousBalances[mbr] += (mPaid[mbr] - mOwed[mbr] + mTransferPaid[mbr] - mTransferReceived[mbr]);
        });
      }
      return previousBalances;
    }

    function calculate() {
      let paid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let owed = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let transferPaid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let transferReceived = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let fundIn = 0, fundOut = 0;

      // --- LẤY SỐ DƯ NỢ TỪ CÁC THÁNG TRƯỚC (CÙNG NĂM) ---
      let previousDebt = getPreviousDebtBalance(currentYear, currentMonth);

      const currentInit = yearsData[currentYear][currentMonth].initValues;
      members.forEach(m => { paid[m] += (currentInit[m] || 0); fundIn += (currentInit[m] || 0); });

      yearsData[currentYear][currentMonth].expenses.forEach(item => {
        if (members.includes(item.payer)) paid[item.payer] += item.amount;
        if (item.payer === "Quỹ ban đầu") fundOut += item.amount;
        let totalShares = 0;
        members.forEach(m => totalShares += (item.shares && item.shares[m] !== undefined ? item.shares[m] : 1));
        if (totalShares > 0) {
          members.forEach(p => {
            const pShares = item.shares && item.shares[p] !== undefined ? item.shares[p] : 1;
            owed[p] += (item.amount * pShares) / totalShares;
          });
        }
      });

      yearsData[currentYear][currentMonth].transfers.forEach(t => {
        if (members.includes(t.from)) transferPaid[t.from] += t.amount;
        if (members.includes(t.to)) transferReceived[t.to] += t.amount;
        if (t.from === "Quỹ ban đầu") fundOut += t.amount;
        if (t.to === "Quỹ ban đầu") fundIn += t.amount;
      });

      let prevFund = getPreviousFundBalance(currentYear, currentMonth);
      let currentFundBalance = prevFund + fundIn - fundOut;

      document.getElementById('fund-month-label').textContent = \`\${currentMonth}/\${currentYear}\`;
      document.getElementById('fund-prev').textContent = formatVND(prevFund);
      document.getElementById('fund-in').textContent = formatVND(fundIn);
      document.getElementById('fund-out').textContent = formatVND(fundOut);
      document.getElementById('fund-balance').textContent = formatVND(currentFundBalance);

      const resultBody = document.getElementById('result-body');
      resultBody.innerHTML = '';
      let balances = {};

      members.forEach(m => {
        const diff = previousDebt[m] + paid[m] - owed[m] + transferPaid[m] - transferReceived[m];
        balances[m] = diff;
        
        let isExactZero = Math.abs(diff) < 0.01; // Số không tuyệt đối (khử nhiễu số thập phân của JS)
        let diffClass = '';
        let diffText = '';

        if (isExactZero) {
            diffText = \`<span style="color: #28a745; font-weight: bold;">0 ₫</span> <br><span class="badge" style="background-color: #28a745; font-size: 0.75em;">Hòa tiền 🎉</span>\`;
        } else {
            diffClass = diff > 0 ? 'positive' : 'negative';
            diffText = diff > 0 ? \`+\${formatVND(diff)}\` : \`\${formatVND(diff)}\`;
        }
        
        const prevText = previousDebt[m] !== 0 ? \`<br><span style="font-size: 0.8em; color: #666;">(Kỳ trước: \${formatVND(previousDebt[m])})</span>\` : '';
        
        resultBody.innerHTML += \`
          <tr>
            <td><strong>\${m}</strong></td>
            <td>\${formatVND(paid[m])}</td>
            <td>\${formatVND(owed[m])}</td>
            <td style="color: #28a745;">\${formatVND(transferPaid[m])}</td>
            <td style="color: #6f42c1;">\${formatVND(transferReceived[m])}</td>
            <td class="\${diffClass}">\${diffText}\${prevText}</td>
          </tr>
        \`;
      });
      
      document.getElementById('settlement-plan').innerHTML = generateSettlementHTML(balances, currentFundBalance);
      renderYearlySummary();
    }

    function generateSettlementHTML(balances, fundBalance = 0) {
      let debtors = [], creditors = [], settled = [];
      let cloneBal = { ...balances };
      
      for (let m in cloneBal) {
        let exactBalance = cloneBal[m];
        
        if (Math.abs(exactBalance) < 0.01) {
            settled.push(m); // Bằng đúng 0 tròn trĩnh
        } else if (exactBalance < -1) {
            debtors.push({ name: m, amount: -exactBalance }); // Dư nợ âm (>1đ lệch)
        } else if (exactBalance > 1) {
            creditors.push({ name: m, amount: exactBalance }); // Dư nợ dương (>1đ lệch)
        }
      }

      let planHtml = '';
      if (debtors.length === 0 && creditors.length === 0) {
        planHtml = '<li>Mọi người đều đã hòa tiền (Không ai nợ ai cá nhân)! 🎉</li>';
      } else {
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
          let payment = Math.min(debtors[i].amount, creditors[j].amount);
          
          if (Math.round(payment) > 0) {
              planHtml += \`<li>Người nộp: <strong>\${debtors[i].name}</strong> ➔ Chuyển cho: <strong>\${creditors[j].name}</strong> số tiền: <strong style="color:#d35400">\${formatVND(payment)}</strong></li>\`;
          }
          
          debtors[i].amount -= payment; creditors[j].amount -= payment;
          if (debtors[i].amount < 1) i++;
          if (creditors[j].amount < 1) j++;
        }
        
        // HIỂN THỊ DANH SÁCH NHỮNG NGƯỜI ĐÃ HÒA TIỀN TRÒN TRĨNH
        if (settled.length > 0) {
          planHtml += \`<li style="background: #d4edda; border-left-color: #28a745; margin-top: 15px;">🎉 <strong>Thành viên đã hòa tiền (0 ₫):</strong> \${settled.join(', ')} <span style="font-size: 0.9em; color: #555;">(Không cần chuyển/nhận thêm)</span></li>\`;
        }
      }

      if (fundBalance > 0.01) {
        planHtml += \`<li style="background: #fff3cd; border-left-color: #ffc107; margin-top: 15px;">💼 <strong>Quỹ chung đang dư: <span style="color: #d35400;">\${formatVND(fundBalance)}</span></strong><br><span style="font-size: 0.9em; color: #555;">(Số tiền quỹ dư này sẽ tự động mang sang làm tiền quỹ cho tháng tiếp theo).</span></li>\`;
      } else if (fundBalance < -0.01) {
        planHtml += \`<li style="background: #f8d7da; border-left-color: #dc3545; margin-top: 15px;">⚠️ <strong>Quỹ chung đang âm: <span style="color: #dc3545;">\${formatVND(-fundBalance)}</span></strong><br><span style="font-size: 0.9em; color: #555;">(Quỹ đã chi lố, cần nộp thêm tiền vào quỹ để cân bằng).</span></li>\`;
      }
      return planHtml;
    }

    function renderYearlySummary() {
      let grandTotal = 0;
      let yPaid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let yOwed = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let yTransferPaid = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let yTransferReceived = { "Tiến": 0, "Tài": 0, "Bách": 0, "Khoa": 0 };
      let yFundIn = 0, yFundOut = 0, yPrevFund = getPreviousFundBalance(currentYear, 1);
      const monthlyBody = document.getElementById('yearly-summary-body');
      monthlyBody.innerHTML = '';

      for (let m = 1; m <= 12; m++) {
        const monthData = yearsData[currentYear][m];
        members.forEach(mbr => { yPaid[mbr] += (monthData.initValues[mbr] || 0); yFundIn += (monthData.initValues[mbr] || 0); });

        let totalExpMonth = 0;
        let monthCatTotals = { 'food':0, 'rent':0, 'entertainment':0, 'shopping':0, 'other':0 };

        monthData.expenses.forEach(item => {
          totalExpMonth += item.amount;
          monthCatTotals[item.category || 'other'] += item.amount;
          if (members.includes(item.payer)) yPaid[item.payer] += item.amount;
          if (item.payer === "Quỹ ban đầu") yFundOut += item.amount;
          
          let totalShares = 0;
          members.forEach(mbr => totalShares += (item.shares && item.shares[mbr] !== undefined ? item.shares[mbr] : 1));
          if (totalShares > 0) {
            members.forEach(p => {
              const pShares = item.shares && item.shares[p] !== undefined ? item.shares[p] : 1;
              yOwed[p] += (item.amount * pShares) / totalShares;
            });
          }
        });
        grandTotal += totalExpMonth;

        monthData.transfers.forEach(t => {
          if (members.includes(t.from)) yTransferPaid[t.from] += t.amount;
          if (members.includes(t.to)) yTransferReceived[t.to] += t.amount;
          if (t.from === "Quỹ ban đầu") yFundOut += t.amount;
          if (t.to === "Quỹ ban đầu") yFundIn += t.amount;
        });

        let breakdownHTML = '';
        if (totalExpMonth > 0) {
          ['food', 'rent', 'entertainment', 'shopping', 'other'].forEach(cat => {
            if(monthCatTotals[cat] > 0) {
              const percent = Math.round((monthCatTotals[cat] / totalExpMonth) * 100);
              breakdownHTML += \`<span class="badge cat-\${cat}" style="font-size: 0.75em; margin-right: 4px;" title="\${formatVND(monthCatTotals[cat])}">\${categoryLabels[cat]}: \${percent}%</span>\`;
            }
          });
        }

        const isCurrent = (m === currentMonth);
        monthlyBody.innerHTML += \`
          <tr style="\${isCurrent ? 'background-color: #e7f5ff; font-weight: bold;' : ''}">
            <td>Tháng \${m} \${isCurrent ? '(Đang xem)' : ''}</td>
            <td><div>\${formatVND(totalExpMonth)}</div><div style="margin-top: 5px;">\${breakdownHTML}</div></td>
          </tr>
        \`;
      }
      
      document.getElementById('yearly-grand-total').textContent = formatVND(grandTotal);

      let yEndFundBalance = yPrevFund + yFundIn - yFundOut;
      document.getElementById('yearly-fund-label').textContent = currentYear;
      document.getElementById('y-fund-prev').textContent = formatVND(yPrevFund);
      document.getElementById('y-fund-in').textContent = formatVND(yFundIn);
      document.getElementById('y-fund-out').textContent = formatVND(yFundOut);
      document.getElementById('y-fund-balance').textContent = formatVND(yEndFundBalance);

      const yBody = document.getElementById('yearly-balance-body');
      yBody.innerHTML = '';
      let yearlyBalances = {};

      members.forEach(m => {
        const diff = yPaid[m] - yOwed[m] + yTransferPaid[m] - yTransferReceived[m];
        yearlyBalances[m] = diff;
        
        let isExactZero = Math.abs(diff) < 0.01;
        let diffClass = '';
        let diffText = '';

        if (isExactZero) {
            diffText = \`<span style="color: #28a745; font-weight: bold;">0 ₫</span> <br><span class="badge" style="background-color: #28a745; font-size: 0.75em;">Hòa tiền 🎉</span>\`;
        } else {
            diffClass = diff > 0 ? 'positive' : 'negative';
            diffText = diff > 0 ? \`+\${formatVND(diff)} (Thu về)\` : \`\${formatVND(diff)} (Cần nộp)\`;
        }

        const transferText = \`Trả: \${formatVND(yTransferPaid[m])}<br>Nhận: \${formatVND(yTransferReceived[m])}\`;
        
        yBody.innerHTML += \`
          <tr>
            <td><strong>\${m}</strong></td>
            <td>\${formatVND(yPaid[m])}</td><td>\${formatVND(yOwed[m])}</td>
            <td style="font-size: 0.85em; color: #555;">\${transferText}</td>
            <td class="\${diffClass}">\${diffText}</td>
          </tr>
        \`;
      });
      
      document.getElementById('yearly-settlement-plan').innerHTML = generateSettlementHTML(yearlyBalances, yEndFundBalance);
    }

    function updateCharts() {
      if (typeof Chart === 'undefined') return;
      Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim() || '#495057';
      Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e0e0e0';
      const catTotals = { 'food':0, 'rent':0, 'entertainment':0, 'shopping':0, 'other':0 };
      yearsData[currentYear][currentMonth].expenses.forEach(e => catTotals[e.category || 'other'] += e.amount);
      const catCtx = document.getElementById('categoryChart').getContext('2d');
      if(categoryChartInstance) categoryChartInstance.destroy();
      categoryChartInstance = new Chart(catCtx, {
        type: 'doughnut',
        data: { labels: Object.values(categoryLabels), datasets: [{ data: Object.values(catTotals), backgroundColor: ['#ff9f43', '#54a0ff', '#ff6b6b', '#1dd1a1', '#8395a7'] }] },
        options: { plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#333' } } } }
      });

      const categories = ['food', 'rent', 'entertainment', 'shopping', 'other'];
      const categoryColors = { 'food': '#ff9f43', 'rent': '#54a0ff', 'entertainment': '#ff6b6b', 'shopping': '#1dd1a1', 'other': '#8395a7' };
      const monthlyDataByCategory = { 'food': Array(12).fill(0), 'rent': Array(12).fill(0), 'entertainment': Array(12).fill(0), 'shopping': Array(12).fill(0), 'other': Array(12).fill(0) };

      for(let m = 1; m <= 12; m++) {
        yearsData[currentYear][m].expenses.forEach(e => {
          monthlyDataByCategory[e.category || 'other'][m-1] += e.amount;
        });
      }

      const datasets = categories.map(cat => ({
        label: categoryLabels[cat], backgroundColor: categoryColors[cat], data: monthlyDataByCategory[cat]
      }));
      
      const trendCtx = document.getElementById('trendChart').getContext('2d');
      if(trendChartInstance) trendChartInstance.destroy();
      trendChartInstance = new Chart(trendCtx, {
        type: 'bar',
        data: { labels: ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'], datasets: datasets },
        options: {
          responsive: true,
          scales: {
            x: { stacked: true, ticks: { color: Chart.defaults.color }, grid: { color: Chart.defaults.borderColor } },
            y: { stacked: true, ticks: { color: Chart.defaults.color }, grid: { color: Chart.defaults.borderColor } }
          },
          plugins: {
            legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#333' } },
            tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y); } return label; } } }
          }
        }
      });
    }

    function syncChartsTheme() {
      if (categoryChartInstance || trendChartInstance) updateCharts();
    }

async function loadData() {
      try {
        // Dùng maybeSingle() để tránh sập web nếu database lỡ bị trống
        const { data, error } = await supabaseClient
          .from('finances')
          .select('data')
          .eq('id', 1)
          .maybeSingle(); 

        if (error) {
          console.error("Lỗi Supabase khi tải:", error);
        }

        // Nếu lấy được dữ liệu thành công
        if (data && data.data && Object.keys(data.data).length > 0) {
          const parsed = data.data;
          yearsData = parsed.yearsData || {};
          currentYear = parsed.currentYear || 2026;
          currentMonth = parsed.currentMonth || 1;
          ensureLegacyDataFormat();
        } else {
          // Nếu bảng rỗng, tạo dữ liệu trống mặc định
          yearsData[2026] = createEmptyYearData();
        }
      } catch (err) {
        console.error("Lỗi không xác định khi tải:", err);
        yearsData[2026] = createEmptyYearData();
      }
      
      // Gọi cập nhật giao diện
      updateUI();
    }

    async function saveData() {
      const statusEl = document.getElementById('save-status');
      statusEl.textContent = 'Đang đồng bộ lên máy chủ... ⏳';
      
      const payload = { currentYear, currentMonth, yearsData };
      
      // Dùng upsert: nếu mất dòng id=1 thì nó tự tạo lại
      const { error } = await supabaseClient
        .from('finances')
        .upsert({ id: 1, data: payload, updated_at: new Date() });

      if (error) {
        console.error("Lỗi Supabase khi lưu:", error);
        statusEl.textContent = '❌ Không thể lưu! (Xem Console F12 để biết chi tiết)';
        statusEl.style.color = '#dc3545';
      } else {
        statusEl.textContent = '✓ Đã đồng bộ lên máy chủ chung lúc ' + new Date().toLocaleTimeString();
        statusEl.style.color = '#28a745';
      }
    }
    
    function exportJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({yearsData}));
      const el = document.createElement('a'); el.setAttribute("href", dataStr); el.setAttribute("download", \`chi-tieu-nhom-backup-\${new Date().getTime()}.json\`);
      document.body.appendChild(el); el.click(); el.remove();
    }
    
    function importJSON(event) {
      const file = event.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          if(parsed.yearsData) { yearsData = parsed.yearsData; currentYear = parseInt(Object.keys(yearsData)[0], 10) || 2026; currentMonth = 1; updateUI(); saveData(); alert("Phục hồi dữ liệu thành công!"); }
        } catch (err) { alert("File không hợp lệ!"); }
      }; reader.readAsText(file);
    }
    
    function exportCSV() {
      let csvContent = "data:text/csv;charset=utf-8,\\uFEFFThang,Noi_Dung,Danh_Muc,Nguoi_Tra,So_Tien,Chi_Tiet_Phan\\n";
      for(let m=1; m<=12; m++) {
        yearsData[currentYear][m].expenses.forEach(e => {
          let shareStr = members.map(mbr => \`\${mbr}:\${e.shares[mbr]}\`).join("-");
          csvContent += \`\${m},\${e.desc},\${categoryLabels[e.category || 'other']},\${e.payer},\${e.amount},\${shareStr}\\n\`;
        });
      }
      const el = document.createElement('a'); el.setAttribute("href", encodeURI(csvContent)); el.setAttribute("download", \`chi-tieu-nhom-\${currentYear}.csv\`);
      document.body.appendChild(el); el.click(); el.remove();
    }
    
    function exportPDF() {
      const element = document.getElementById('pdf-content');
      html2pdf().set({ margin: 0.5, filename: \`Bao-Cao-Chi-Tieu-\${currentYear}.pdf\`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(element).save();
    }

    // 1. Khai báo email của người được quyền chỉnh sửa (khớp với SQL ở trên)
    const ADMIN_EMAIL = "abeshiroanime@gmail.com"; 

    window.onload = async function() {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        window.location.href = "login.html";
        return;
      }
      
      await loadData(); // Tải dữ liệu chung từ Supabase
      
      // Nếu email người đang đăng nhập KHÔNG PHẢI là Admin -> Khóa giao diện
      if (session.user.email !== ADMIN_EMAIL) {
        disableEditingUI();
      }
    };

    function disableEditingUI() {
      // 1. Ẩn nút Backup / Phục hồi
      const topControls = document.querySelector('.top-controls div:first-child');
      if (topControls) topControls.style.display = 'none';

      // 2. Khóa ô nhập quỹ ban đầu và ẩn nút lưu quỹ
      members.forEach(m => {
        const input = document.getElementById(\`init-\${m}\`);
        if (input) input.disabled = true;
      });
      document.getElementById('btn-save-fund').style.display = 'none';
      
      // 3. Ẩn toàn bộ thẻ "2. Thêm Khoản Chi Phát Sinh" (Là thẻ card thứ 3 trong HTML)
      const cards = document.querySelectorAll('.card');
      if (cards.length > 2) cards[2].style.display = 'none';
      
      // 4. Ẩn form chuyển tiền (phần chọn người gửi/nhận)
      const transferForm = document.querySelector('#transfer-amount');
      if (transferForm) transferForm.closest('.grid').style.display = 'none';

      // 5. Ẩn cột Thao tác (chứa nút Sửa/Xóa) bằng CSS
      const style = document.createElement('style');
      style.innerHTML = \`th.no-print, td.no-print { display: none !important; }\`;
      document.head.appendChild(style);

      // Đổi câu thông báo trạng thái
      const statusEl = document.getElementById('save-status');
      statusEl.textContent = '👀 Chế độ Chỉ xem (Chỉ thủ quỹ mới có quyền chỉnh sửa)';
      statusEl.style.color = '#6c757d';
    }

  
Object.assign(window, { updateInitValue, saveInitFund, addExpense, addTransfer, closeEditModal, saveEditExpense, closeEditTransferModal, saveEditTransfer, exportJSON, importJSON, exportPDF, exportCSV, addNewYear, switchYear, openEditModal, deleteExpense, openEditTransferModal, deleteTransfer });
`;function o(){new Function(r)()}const n=(e,...t)=>{const a=window[e];typeof a=="function"&&a(...t)};document.querySelectorAll("[data-navigate]").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.navigate;typeof window.ttbkNavigate=="function"?window.ttbkNavigate(t):window.location.href=t})});document.querySelectorAll("[data-init-member]").forEach(e=>{e.addEventListener("input",()=>n("updateInitValue",e.dataset.initMember,e.value))});document.addEventListener("click",e=>{const t=e.target.closest("[data-expense-action]");if(t)switch(t.dataset.expenseAction){case"export-json":n("exportJSON");break;case"open-import":document.getElementById("importFile")?.click();break;case"export-pdf":n("exportPDF");break;case"export-csv":n("exportCSV");break;case"add-year":n("addNewYear");break;case"save-fund":n("saveInitFund");break;case"add-expense":n("addExpense");break;case"add-transfer":n("addTransfer");break;case"close-expense-modal":n("closeEditModal");break;case"save-edit-expense":n("saveEditExpense");break;case"edit-expense":n("openEditModal",Number(t.dataset.index));break;case"delete-expense":n("deleteExpense",Number(t.dataset.index));break;case"close-transfer-modal":n("closeEditTransferModal");break;case"save-edit-transfer":n("saveEditTransfer");break;case"edit-transfer":n("openEditTransferModal",Number(t.dataset.index));break;case"delete-transfer":n("deleteTransfer",Number(t.dataset.index));break}});document.getElementById("importFile")?.addEventListener("change",e=>{n("importJSON",e)});document.getElementById("year-select")?.addEventListener("change",e=>{n("switchYear",Number.parseInt(e.target.value,10))});o();
