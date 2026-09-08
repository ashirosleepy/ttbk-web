// supabase/functions/send-push/index.ts
// Deploy: supabase functions deploy send-push
// Cần đặt 2 secret trước khi deploy:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:ban@vidu.com
//
// Gọi hàm này bằng POST, body dạng:
//   { "user_id": "uuid-cua-nguoi-nhan", "title": "Đến lượt bạn!", "body": "Rửa bát hôm nay", "url": "/index.html" }
// hoặc gửi cho nhiều người: { "user_ids": ["uuid1","uuid2"], "title": "...", "body": "..." }

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  try {
    const { user_id, user_ids, title, body, url, tag } = await req.json();
    const targetIds: string[] = user_ids ?? (user_id ? [user_id] : []);

    if (targetIds.length === 0 || !title) {
      return new Response(JSON.stringify({ error: 'Thiếu user_id/user_ids hoặc title' }), { status: 400 });
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, subscription')
      .in('user_id', targetIds);

    if (error) throw error;

    const payload = JSON.stringify({ title, body, url, tag });

    const results = await Promise.allSettled(
      (subs ?? []).map((row) => webpush.sendNotification(row.subscription, payload))
    );

    // Dọn các subscription đã hết hạn (410 Gone / 404 Not Found)
    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = r.reason?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(subs![i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.status === 'fulfilled').length, total: results.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
