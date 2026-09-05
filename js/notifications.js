// js/notifications.js

// Lấy element
const notifBtn = document.getElementById('notification-btn');
const notifDropdown = document.getElementById('notif-dropdown');
const notifBadge = document.getElementById('notif-badge');
const notifList = document.getElementById('notif-list');

// Trạng thái cục bộ
let notifications = [];

// 1. Toggle hiển thị Menu Thông báo
notifBtn.addEventListener('click', (e) => {
    // Ngăn chặn nổi bọt để không trigger click ra ngoài
    if(e.target.closest('.notif-dropdown')) return; 
    notifDropdown.classList.toggle('hidden');
});

// 2. Lắng nghe Realtime từ Supabase
function subscribeToNotifications(currentUserId) {
    supabase
        .channel('public:notifications')
        .on(
            'postgres_changes',
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${currentUserId}` 
            },
            (payload) => {
                // Nhận thông báo mới
                notifications.unshift(payload.new);
                updateNotificationUI();
            }
        )
        .subscribe();
}

// 3. Render UI Thông báo
function updateNotificationUI() {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    
    // Cập nhật số lượng đỏ
    if (unreadCount > 0) {
        notifBadge.textContent = unreadCount;
        notifBadge.classList.remove('hidden');
    } else {
        notifBadge.classList.add('hidden');
    }

    // Render danh sách
    if (notifications.length === 0) {
        notifList.innerHTML = '<div class="notif-empty">Không có thông báo nào</div>';
        return;
    }

    notifList.innerHTML = notifications.map(notif => `
        <div class="notif-item ${notif.is_read ? '' : 'unread'}" data-id="${notif.id}">
            <strong>${notif.title}</strong>
            <p>${notif.message}</p>
            ${renderActions(notif)}
        </div>
    `).join('');
}

// 4. Render Nút tùy theo loại thông báo (Loại Xin đổi việc)
function renderActions(notif) {
    if (notif.type === 'EXCHANGE_REQUEST') {
        // Giả sử payload lưu task_id trong cột metadata (hoặc message)
        return `
            <div class="notif-actions">
                <button class="btn-accept" onclick="acceptTask('${notif.task_id}', '${notif.id}')">
                    [Nhận việc]
                </button>
            </div>
        `;
    }
    return '';
}

// 5. Logic xử lý khi Bách bấm "Nhận"
async function acceptTask(taskId, notifId) {
    const currentUser = await getCurrentUser(); // Hàm tự viết ở auth.js lấy user hiện tại
    
    // Bắt đầu Transaction / RPC hoặc chuỗi Promise để update
    try {
        // A. Cập nhật task sang người mới (Bách)
        const { error: taskErr } = await supabase
            .from('tasks')
            .update({ assigned_to: currentUser.id })
            .eq('id', taskId);

        if (taskErr) throw taskErr;

        // B. Cập nhật trạng thái xin đổi việc thành 'accepted'
        await supabase
            .from('task_exchanges')
            .update({ status: 'accepted', to_user: currentUser.id })
            .eq('task_id', taskId);

        // C. Ghi Log hệ thống
        await supabase
            .from('activity_logs')
            .insert({
                user_id: currentUser.id,
                action: 'ACCEPT_EXCHANGE',
                task_id: taskId,
                new_value: `Bách nhận thay Tiến`
            });

        // D. Đánh dấu thông báo là đã đọc
        await markAsRead(notifId);
        
        alert("Bạn đã nhận việc thành công!");
        
        // Load lại Dashboard (tùy kiến trúc app của bạn)
        if(typeof loadDashboard === 'function') loadDashboard();

    } catch (error) {
        console.error("Lỗi khi nhận việc:", error);
        alert("Có lỗi xảy ra, vui lòng thử lại.");
    }
}

// Gắn vào luồng khởi tạo (gọi trong app.js)
// fetchInitialNotifications(currentUser.id);
// subscribeToNotifications(currentUser.id);