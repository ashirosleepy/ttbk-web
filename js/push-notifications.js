// js/push-notifications.js
// Xin quyền + đăng ký thiết bị nhận thông báo đẩy (Web Push), lưu subscription vào Supabase.
//
// ⚠️ CẦN SỬA 2 CHỖ CHO KHỚP VỚI PHẦN CODE HIỆN CÓ CỦA BẠN:
//   1) `getSupabaseClient()` bên dưới — trỏ đúng biến client bạn tạo trong js/supabase-client.js
//   2) `getCurrentUserId()` bên dưới — trỏ đúng nơi bạn lưu user đang đăng nhập (thường ở js/auth.js)

const VAPID_PUBLIC_KEY = 'DÁN_VAPID_PUBLIC_KEY_CỦA_BẠN_VÀO_ĐÂY';

function getSupabaseClient() {
  // Thử vài tên biến phổ biến — sửa lại thành đúng tên bạn dùng trong supabase-client.js
  return window.sb || window.supabaseClient || window.db || window._supabase || null;
}

function getCurrentUserId() {
  // Sửa lại theo cách auth.js của bạn lưu user hiện tại, ví dụ:
  // return window.currentUser?.id;
  return window.currentUser?.id || window.CURRENT_USER_ID || null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('Không đăng ký được service worker:', err);
    return null;
  }
}

async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

async function enablePush() {
  const statusEl = document.getElementById('st-push-status');

  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    if (statusEl) statusEl.textContent = 'Trình duyệt này không hỗ trợ thông báo đẩy.';
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (statusEl) statusEl.textContent = 'Bạn chưa cấp quyền thông báo.';
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    if (statusEl) statusEl.textContent = 'Lỗi đăng ký service worker.';
    return false;
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();

  if (!supabase || !userId) {
    console.warn('Chưa kết nối được Supabase client hoặc user id — xem TODO ở đầu file push-notifications.js');
    if (statusEl) statusEl.textContent = 'Thiếu cấu hình (xem console).';
    return false;
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('Lỗi lưu subscription:', error);
    if (statusEl) statusEl.textContent = 'Lỗi khi lưu đăng ký. Xem console.';
    return false;
  }

  if (statusEl) statusEl.textContent = 'Đã bật thông báo đẩy trên thiết bị này.';
  return true;
}

async function disablePush() {
  const statusEl = document.getElementById('st-push-status');
  const subscription = await getExistingSubscription();
  const supabase = getSupabaseClient();

  if (subscription) {
    if (supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
    await subscription.unsubscribe();
  }

  if (statusEl) statusEl.textContent = 'Đã tắt thông báo đẩy trên thiết bị này.';
  return true;
}

async function refreshPushButtons() {
  const btnEnable = document.getElementById('st-push-enable');
  const btnDisable = document.getElementById('st-push-disable');
  if (!btnEnable || !btnDisable) return;

  const subscription = await getExistingSubscription();
  const active = !!subscription && Notification.permission === 'granted';
  btnEnable.style.display = active ? 'none' : '';
  btnDisable.style.display = active ? '' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const btnEnable = document.getElementById('st-push-enable');
  const btnDisable = document.getElementById('st-push-disable');

  if (btnEnable) {
    btnEnable.addEventListener('click', async () => {
      await enablePush();
      await refreshPushButtons();
    });
  }
  if (btnDisable) {
    btnDisable.addEventListener('click', async () => {
      await disablePush();
      await refreshPushButtons();
    });
  }

  refreshPushButtons();
});
