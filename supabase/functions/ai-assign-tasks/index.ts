// Supabase Edge Function: ai-assign-tasks
// Deploy: supabase functions deploy ai-assign-tasks
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: "Chưa cấu hình ANTHROPIC_API_KEY trên server." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tasks, members, current_load } = await req.json();

    if (!Array.isArray(tasks) || !Array.isArray(members) || tasks.length === 0 || members.length === 0) {
      return new Response(JSON.stringify({ error: "Thiếu dữ liệu tasks/members." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Bạn là trợ lý chia việc nhà công bằng cho một hộ gia đình.

Danh sách thành viên (id, tên, mức độ đang bận — tổng điểm việc chưa xong):
${members.map((member) => `- id="${member.id}", tên="${member.name}", đang bận=${current_load?.[member.id] ?? 0} điểm`).join("\n")}

Danh sách việc cần chia (tên việc, điểm/độ khó):
${tasks.map((task) => `- "${task.title}" (${task.points} điểm)`).join("\n")}

Hãy chia MỖI việc cho ĐÚNG MỘT thành viên, ưu tiên:
1. Người đang bận ít hơn nên được cân bằng ở mức thấp nhất có thể giữa mọi người.
2. Việc nặng, đòi hỏi sức hơn nên tránh dồn hết cho một người nếu có lựa chọn khác.
3. Nếu một việc rõ ràng phù hợp với một người hơn, có thể ưu tiên hợp lý nhưng vẫn phải giữ cân bằng.

CHỈ trả lời bằng JSON, đúng định dạng:
{"assignments":[{"title":"<tên việc y hệt đề bài>","assigned_to":"<id thành viên>","reason":"<lý do ngắn gọn 1 câu, tiếng Việt>"}]}`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicResponse.ok) {
      throw new Error(`Claude API lỗi ${anthropicResponse.status}: ${await anthropicResponse.text()}`);
    }

    const data = await anthropicResponse.json();
    const textBlock = (data.content || []).find((block: any) => block.type === "text");
    const raw = (textBlock?.text || "").trim().replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
