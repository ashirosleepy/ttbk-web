// ============================================================
// Supabase Edge Function: ai-assign-tasks
//
// Nhận: { tasks: [{title, points}], members: [{id, name}], current_load: {id: number} }
// Trả:  { assignments: [{title, assigned_to, reason}] }
//
// Function này giữ ANTHROPIC_API_KEY ở phía server (Supabase secrets),
// không bao giờ lộ ra trình duyệt.
//
// CÁCH TRIỂN KHAI:
// 1. Cài Supabase CLI: npm install -g supabase
// 2. Đăng nhập & liên kết project:
//      supabase login
//      supabase link --project-ref <project-ref-của-bạn>
// 3. Đặt secret (lấy API key tại https://console.anthropic.com/settings/keys):
//      supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
// 4. Deploy:
//      supabase functions deploy ai-assign-tasks
//
// Sau khi deploy, app sẽ tự gọi tới:
//   https://<project-ref>.supabase.co/functions/v1/ai-assign-tasks
// (đã được cấu hình sẵn trong js/auto-assign.js, không cần sửa gì thêm).
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Chưa cấu hình ANTHROPIC_API_KEY trên server." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { tasks, members, current_load } = await req.json();

    if (!Array.isArray(tasks) || !Array.isArray(members) || tasks.length === 0 || members.length === 0) {
      return new Response(JSON.stringify({ error: "Thiếu dữ liệu tasks/members." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const prompt = `Bạn là trợ lý chia việc nhà công bằng cho một hộ gia đình.

Danh sách thành viên (id, tên, mức độ đang bận — tổng điểm việc chưa xong):
${members.map((m) => `- id="${m.id}", tên="${m.name}", đang bận=${current_load?.[m.id] ?? 0} điểm`).join("\n")}

Danh sách việc cần chia (tên việc, điểm/độ khó):
${tasks.map((t) => `- "${t.title}" (${t.points} điểm)`).join("\n")}

Hãy chia MỖI việc cho ĐÚNG MỘT thành viên, ưu tiên:
1. Người đang bận ít hơn (tổng điểm hiện có + việc mới được giao) nên được cân bằng ở mức thấp nhất có thể giữa mọi người.
2. Việc nặng, đòi hỏi sức hơn (điểm cao) nên tránh dồn hết cho 1 người nếu có lựa chọn khác.
3. Nếu 1 việc rõ ràng phù hợp với 1 người hơn (ví dụ theo tên việc), có thể ưu tiên hợp lý, nhưng vẫn phải đảm bảo tổng điểm cuối cùng giữa mọi người không lệch nhau quá nhiều.

CHỈ trả lời bằng JSON, không thêm chữ nào khác, đúng định dạng:
{"assignments":[{"title":"<tên việc y hệt đề bài>","assigned_to":"<id thành viên>","reason":"<lý do ngắn gọn 1 câu, tiếng Việt>"}]}`;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      throw new Error(`Claude API lỗi ${anthropicResp.status}: ${errText}`);
    }

    const data = await anthropicResp.json();
    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    const raw = (textBlock?.text || "").trim().replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
