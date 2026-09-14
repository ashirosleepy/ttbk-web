// supabase/functions/process-reminders/index.ts
// Chạy theo cron mỗi giờ. Deploy: supabase functions deploy process-reminders
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const supabase = createClient(supabaseUrl, serviceRoleKey);
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function businessDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now.getTime() - 3 * 60 * 60 * 1000));
}

function vietnamHour(now: Date) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }).format(now));
}

async function sendPush(userIds: string[], title: string, body: string, tag: string) {
  if (userIds.length === 0) return;
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .in('user_id', userIds);
  await Promise.allSettled((subscriptions || []).map((row) => webpush.sendNotification(
    row.subscription,
    JSON.stringify({ title, body, url: '/index.html?section=tasks', tag }),
  )));
}

async function alreadySent(taskId: string, userId: string, type: string, since: string) {
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since)
    .limit(1);
  return (data || []).length > 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const startedAt = new Date();
  try {
    await supabase.rpc('process_overdue_tasks');
    const today = businessDate(startedAt);
    const hour = vietnamHour(startedAt);
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, points, due_date, status')
      .eq('due_date', today)
      .in('status', ['chua_lam', 'dang_cho', 'cho_nhan']);
    if (taskError) throw taskError;

    const { data: profiles } = await supabase.from('profiles').select('id, name');
    const names = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.name]));
    const since = new Date(startedAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const notifications = [];

    for (const task of tasks || []) {
      if (!task.assigned_to) continue;
      const type = hour === 22 ? 'xac_nhan_toi' : hour === 1 ? 'nhac_2h' : null;
      if (!type || await alreadySent(task.id, task.assigned_to, type, since)) continue;
      const message = type === 'nhac_2h'
        ? `⏰ Sắp hết ngày, bạn còn việc "${task.title}" chưa làm nhé!`
        : `🔔 Bạn đã làm "${task.title}" chưa? Tick ngay nhé!`;
      await supabase.from('notifications').insert({ user_id: task.assigned_to, task_id: task.id, type, message });
      notifications.push({ userId: task.assigned_to, title: type === 'nhac_2h' ? 'Sắp quá hạn' : 'Nhắc xác nhận', message, type });
    }

    const { data: overdueNotifications } = await supabase
      .from('notifications')
      .select('user_id, message, type')
      .in('type', ['qua_han', 'lam_ho'])
      .gte('created_at', startedAt.toISOString());
    for (const notification of overdueNotifications || []) {
      notifications.push({ userId: notification.user_id, title: notification.type === 'lam_ho' ? 'Có người làm hộ' : 'Việc quá hạn', message: notification.message, type: notification.type });
    }

    for (const notification of notifications) {
      await sendPush([notification.userId], notification.title, notification.message, notification.type);
    }

    return new Response(JSON.stringify({ sent: notifications.length, hour, today }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
