// js/push-notifications.js
// Xin quyền + đăng ký thiết bị nhận thông báo đẩy (Web Push), lưu subscription vào Supabase.

const VAPID_PUBLIC_KEY = 'BCWBh0KLHKyR-ULt1mlaR4oHQefPFryHd7osKGKZ4bGz3WxzagVAOGkcfDlIXCyrajukDrsktgUBz5aC8R4QcE0';

function getSupabaseClient() {
  return typeof supabaseClient !== 'undefined' ? supabaseClient : null;
}

function getCurrentUserId() {
  return typeof STATE !== 'undefined' ? STATE.me?.id || null : null;
}

function isIosDevice() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function vapidApplicationServerKey() {
  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  return key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
}

function setPushStatus(text) {
  const statusEl = document.getElementById('st-push-status');
  if (statusEl) statusEl.textContent = text;
}

function pushUnsupportedReason() {
  if (!window.isSecureContext) {
    return 'Thông báo đẩy cần mở app bằng HTTPS (không dùng file://).';
  }
  if (!('serviceWorker' in navigator)) {
    return 'Trình duyệt này không hỗ trợ service worker.';
  }
  if (isIosDevice() && !isStandalonePwa()) {
    return 'Trên iPhone/iPad: bấm Chia sẻ → Thêm vào Màn hình chính, mở app từ icon đó, rồi bật thông báo.';
  }
  if (!('Notification' in window) || !('PushManager' in window)) {
    if (isIosDevice()) {
      return 'iOS cần bản 16.4 trở lên và phải mở từ icon trên Màn hình chính.';
    }
    return 'Trình duyệt này không hỗ trợ thông báo đẩy.';
  }
  return null;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const serviceWorkerUrl = new URL('sw.js', document.baseURI);
    await navigator.serviceWorker.register(serviceWorkerUrl);
    return await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('Không đăng ký được service worker:', err);
    return null;
  }
}

async function getExistingSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  if (!reg.active) {
    try {
      reg = await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }
  return reg.pushManager.getSubscription();
}

async function saveSubscription(subscription) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  if (!supabase || !userId || !subscription) return { error: { message: 'Thiếu đăng nhập hoặc subscription' } };

  return supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
}

async function subscribePush(registration) {
  const options = {
    userVisibleOnly: true,
    applicationServerKey: vapidApplicationServerKey(),
  };
  try {
    return await registration.pushManager.subscribe(options);
  } catch (err) {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
      return registration.pushManager.subscribe(options);
    }
    throw err;
  }
}

async function enablePush() {
  const unsupported = pushUnsupportedReason();
  if (unsupported) {
    setPushStatus(unsupported);
    return false;
  }

  const userId = getCurrentUserId();
  if (!getSupabaseClient() || !userId) {
    setPushStatus('Hãy đăng nhập xong rồi bật thông báo đẩy.');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setPushStatus('Bạn chưa cấp quyền thông báo. Kiểm tra Cài đặt của điện thoại / trình duyệt.');
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    setPushStatus('Lỗi đăng ký service worker.');
    return false;
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await subscribePush(registration);

    const { error } = await saveSubscription(subscription);
    if (error) {
      console.error('Lỗi lưu subscription:', error);
      setPushStatus('Lỗi khi lưu đăng ký. Xem console.');
      return false;
    }

    setPushStatus('Đã bật thông báo đẩy trên thiết bị này.');
    return true;
  } catch (err) {
    console.error('Không tạo được đăng ký push:', err);
    setPushStatus('Không tạo được đăng ký push. Kiểm tra quyền thông báo và VAPID key.');
    return false;
  }
}

async function disablePush() {
  const subscription = await getExistingSubscription();
  const supabase = getSupabaseClient();

  if (subscription) {
    if (supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
    await subscription.unsubscribe();
  }

  setPushStatus('Đã tắt thông báo đẩy trên thiết bị này.');
  return true;
}

async function syncPushSubscription() {
  if (pushUnsupportedReason()) return;
  if (Notification.permission !== 'granted') return;
  if (!getCurrentUserId()) return;

  const subscription = await getExistingSubscription();
  if (!subscription) return;
  await saveSubscription(subscription);
}

async function refreshPushButtons() {
  const btnEnable = document.getElementById('st-push-enable');
  const btnDisable = document.getElementById('st-push-disable');
  if (!btnEnable || !btnDisable) return;

  const unsupported = pushUnsupportedReason();
  if (unsupported) {
    btnEnable.style.display = '';
    btnDisable.style.display = 'none';
    setPushStatus(unsupported);
    return;
  }

  const subscription = await getExistingSubscription();
  const active = !!subscription && Notification.permission === 'granted';
  btnEnable.style.display = active ? 'none' : '';
  btnDisable.style.display = active ? '' : 'none';
  if (active) setPushStatus('Đã bật thông báo đẩy trên thiết bị này.');
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

  if ('serviceWorker' in navigator) {
    registerServiceWorker();
  }
  refreshPushButtons();
});
