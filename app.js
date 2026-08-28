// ============================================================
// SỔ TAY NHÓM — app.js
// Toàn bộ logic: đăng nhập, công việc (tasks), chi tiêu (expenses)
// ============================================================

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;   // auth user
let currentProfile = null; // row in profiles
let profiles = [];        // tất cả 4 thành viên
let tasks = [];
let expenses = [];
let expenseShares = [];

// tiny helpers
const $ = (id) => document.getElementById(id);
const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
const todayISO = () => new Date().toISOString().slice(0, 10);

// decorative spiral dots
(function drawSpiral(){
  const el = $('spiralEdge');
  for (let i = 0; i < 16; i++) el.innerHTML += '<span></span>';
})();

// ============================================================
// AUTH
// ============================================================
function showSignup(){
  $('loginForm').style.display = 'none';
  $('signupForm').style.display = 'block';
  $('toggleToSignup').style.display = 'none';
  $('toggleToLogin').style.display = 'block';
  hideAuthError();
}
function showLogin(){
  $('loginForm').style.display = 'block';
  $('signupForm').style.display = 'none';
  $('toggleToSignup').style.display = 'block';
  $('toggleToLogin').style.display = 'none';
  hideAuthError();
}
function showAuthError(msg){
  const el = $('authError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideAuthError(){ $('authError').style.display = 'none'; }

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAuthError();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) showAuthError('Đăng nhập thất bại: ' + error.message);
});

$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAuthError();
  const full_name = $('signupName').value.trim();
  const email = $('signupEmail').value.trim();
  const password = $('signupPassword').value;
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name } }
  });
  if (error) return showAuthError('Đăng ký thất bại: ' + error.message);
  showAuthError('');
  alert('Tạo tài khoản thành công! Nếu Supabase yêu cầu xác nhận email, hãy kiểm tra hộp thư rồi đăng nhập lại.');
  showLogin();
});

$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session && session.user) {
    currentUser = session.user;
    boot();
  } else {
    currentUser = null;
    currentProfile = null;
    $('authWrap').style.display = 'flex';
    $('appWrap').style.display = 'none';
  }
});

// ============================================================
// BOOT: load profile + data sau khi đăng nhập
// ============================================================
async function boot(){
  $('authWrap').style.display = 'none';
  $('appWrap').style.display = 'block';

  await loadProfiles();
  currentProfile = profiles.find(p => p.id === currentUser.id) || null;
  if (currentProfile) {
    $('meName').textContent = currentProfile.full_name;
    $('meAvatar').textContent = currentProfile.avatar_emoji || '🧑‍🎓';
  }

  fillAssigneeSelects();
  await Promise.all([loadTasks(), loadExpensesAndShares()]);
  renderTasks();
  renderExpensesTab();
  subscribeRealtime();
}

async function loadProfiles(){
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) { console.error(error); return; }
  profiles = data || [];
}

function fillAssigneeSelects(){
  const opts = profiles.map(p => `<option value="${p.id}">${p.full_name}</option>`).join('');
  $('taskAssignee').innerHTML = opts;
  $('expPaidBy').innerHTML = opts;
  $('expShareChecks').innerHTML = profiles.map(p => `
    <label>
      <input type="checkbox" class="share-check" value="${p.id}" checked>
      ${p.avatar_emoji || '🧑‍🎓'} ${p.full_name}
    </label>
  `).join('');
}

// ============================================================
// TABS
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ============================================================
// TASKS
// ============================================================
async function loadTasks(){
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  tasks = data || [];
}

function profileName(id){
  const p = profiles.find(p => p.id === id);
  return p ? p.full_name : '—';
}
function profileEmoji(id){
  const p = profiles.find(p => p.id === id);
  return p ? (p.avatar_emoji || '🧑‍🎓') : '❓';
}

function renderTasks(){
  ['todo', 'doing', 'done'].forEach(status => {
    const col = $('col-' + status);
    const items = tasks.filter(t => t.status === status);
    if (items.length === 0) {
      col.innerHTML = '<div class="empty-note">Chưa có việc nào.</div>';
      return;
    }
    col.innerHTML = items.map(t => `
      <div class="task-card">
        <div class="t-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="t-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="t-meta">
          <span class="chip">${profileEmoji(t.assigned_to)} ${profileName(t.assigned_to)}</span>
          ${t.due_date ? `<span>⏰ ${t.due_date}</span>` : ''}
        </div>
        <div class="t-actions">
          ${status !== 'todo' ? `<button onclick="moveTask('${t.id}','${prevStatus(status)}')">◀ Lùi</button>` : '<span></span>'}
          ${status !== 'done' ? `<button onclick="moveTask('${t.id}','${nextStatus(status)}')">Tiến ▶</button>` : ''}
          <button class="t-del" onclick="deleteTask('${t.id}')">Xoá</button>
        </div>
      </div>
    `).join('');
  });
}
function nextStatus(s){ return s === 'todo' ? 'doing' : 'done'; }
function prevStatus(s){ return s === 'done' ? 'doing' : 'todo'; }

async function moveTask(id, newStatus){
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  if (error) return alert('Lỗi: ' + error.message);
  await loadTasks(); renderTasks();
}

async function deleteTask(id){
  if (!confirm('Xoá công việc này?')) return;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return alert('Lỗi: ' + error.message);
  await loadTasks(); renderTasks();
}

$('addTaskBtn').addEventListener('click', () => {
  $('taskModalTitle').textContent = 'Thêm việc mới';
  $('taskForm').reset();
  $('taskId').value = '';
  $('taskModalBg').classList.add('open');
});
function closeTaskModal(){ $('taskModalBg').classList.remove('open'); }

$('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: $('taskTitle').value.trim(),
    description: $('taskDesc').value.trim() || null,
    assigned_to: $('taskAssignee').value,
    due_date: $('taskDue').value || null,
    created_by: currentUser.id
  };
  const { error } = await supabase.from('tasks').insert(payload);
  if (error) return alert('Lỗi: ' + error.message);
  closeTaskModal();
  await loadTasks(); renderTasks();
});

// ============================================================
// EXPENSES
// ============================================================
async function loadExpensesAndShares(){
  const [{ data: exp, error: e1 }, { data: shares, error: e2 }] = await Promise.all([
    supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('expense_shares').select('*')
  ]);
  if (e1) console.error(e1);
  if (e2) console.error(e2);
  expenses = exp || [];
  expenseShares = shares || [];
}

function renderExpensesTab(){
  renderSummary();
  renderSettleUp();
  renderExpenseList();
}

// Số dư mỗi người = tổng đã trả - tổng phần phải chịu
function computeBalances(){
  const balance = {};
  profiles.forEach(p => balance[p.id] = 0);
  expenses.forEach(e => { balance[e.paid_by] = (balance[e.paid_by] || 0) + Number(e.amount); });
  expenseShares.forEach(s => { balance[s.user_id] = (balance[s.user_id] || 0) - Number(s.share_amount); });
  return balance;
}

function renderSummary(){
  const balance = computeBalances();
  $('summaryGrid').innerHTML = profiles.map(p => {
    const b = Math.round(balance[p.id] || 0);
    const cls = b > 0 ? 'pos' : (b < 0 ? 'neg' : '');
    const label = b > 0 ? 'được nhận lại' : (b < 0 ? 'cần trả thêm' : 'huề vốn');
    return `
      <div class="stat-card">
        <div class="stat-label">${p.avatar_emoji || '🧑‍🎓'} ${p.full_name}</div>
        <div class="stat-value ${cls} mono">${vnd(Math.abs(b))}</div>
        <div class="stat-label" style="margin-top:2px;">${label}</div>
      </div>
    `;
  }).join('');
}

// Thuật toán rút gọn: ai nợ trả thẳng cho ai, ít giao dịch nhất
function renderSettleUp(){
  const balance = computeBalances();
  let debtors = [], creditors = [];
  profiles.forEach(p => {
    const b = Math.round(balance[p.id] || 0);
    if (b < -100) debtors.push({ id: p.id, name: p.full_name, amt: -b });
    else if (b > 100) creditors.push({ id: p.id, name: p.full_name, amt: b });
  });
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const rows = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    rows.push(`
      <div class="settle-row">
        <span>${profileEmoji(debtors[i].id)} ${debtors[i].name}</span>
        <span class="arrow">→</span>
        <span>${profileEmoji(creditors[j].id)} ${creditors[j].name}</span>
        <span class="amt mono">${vnd(pay)}</span>
      </div>
    `);
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt <= 100) i++;
    if (creditors[j].amt <= 100) j++;
  }
  $('settleList').innerHTML = rows.length ? rows.join('') : '<div class="empty-note">🎉 Mọi người đã sòng phẳng, không ai nợ ai!</div>';
}

function renderExpenseList(){
  if (expenses.length === 0) {
    $('expenseList').innerHTML = '<div class="empty-note">Chưa có khoản chi nào.</div>';
    return;
  }
  $('expenseList').innerHTML = expenses.map(e => {
    const shares = expenseShares.filter(s => s.expense_id === e.id);
    const sharedWith = shares.map(s => profileEmoji(s.user_id)).join(' ');
    return `
      <div class="expense-row">
        <div>
          <div class="e-desc">${escapeHtml(e.description)}</div>
          <div class="e-meta">${profileEmoji(e.paid_by)} ${profileName(e.paid_by)} đã trả · ${e.expense_date} · chia cho ${sharedWith || '—'}</div>
        </div>
        <div class="e-amt mono">${vnd(e.amount)}</div>
        <button class="e-del" title="Xoá khoản chi" onclick="deleteExpense('${e.id}')">✕</button>
      </div>
    `;
  }).join('');
}

async function deleteExpense(id){
  if (!confirm('Xoá khoản chi này? (các phần chia liên quan cũng sẽ bị xoá)')) return;
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return alert('Lỗi: ' + error.message);
  await loadExpensesAndShares(); renderExpensesTab();
}

$('addExpenseBtn').addEventListener('click', () => {
  $('expenseForm').reset();
  $('expDate').value = todayISO();
  document.querySelectorAll('.share-check').forEach(c => c.checked = true);
  $('expenseModalBg').classList.add('open');
});
function closeExpenseModal(){ $('expenseModalBg').classList.remove('open'); }

$('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = $('expDesc').value.trim();
  const amount = Number($('expAmount').value);
  const paid_by = $('expPaidBy').value;
  const expense_date = $('expDate').value || todayISO();
  const checked = Array.from(document.querySelectorAll('.share-check:checked')).map(c => c.value);

  if (checked.length === 0) return alert('Chọn ít nhất 1 người để chia khoản chi.');

  const { data: newExp, error: e1 } = await supabase.from('expenses')
    .insert({ description, amount, paid_by, expense_date, created_by: currentUser.id })
    .select().single();
  if (e1) return alert('Lỗi: ' + e1.message);

  const per = Math.round((amount / checked.length) * 100) / 100;
  const shareRows = checked.map(uid => ({ expense_id: newExp.id, user_id: uid, share_amount: per }));
  const { error: e2 } = await supabase.from('expense_shares').insert(shareRows);
  if (e2) return alert('Lỗi khi chia tiền: ' + e2.message);

  closeExpenseModal();
  await loadExpensesAndShares(); renderExpensesTab();
});

// ============================================================
// REALTIME — tự cập nhật khi thành viên khác thêm/sửa/xoá
// ============================================================
function subscribeRealtime(){
  supabase.channel('sotaynhom-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async () => { await loadTasks(); renderTasks(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async () => { await loadExpensesAndShares(); renderExpensesTab(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_shares' }, async () => { await loadExpensesAndShares(); renderExpensesTab(); })
    .subscribe();
}

// ============================================================
// UTIL
// ============================================================
function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
