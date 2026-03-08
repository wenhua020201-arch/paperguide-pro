import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, slideContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `你是一个学术论文导读助手 AI。你帮助用户编辑和优化 PPT 演示文稿内容。

你的任务是根据用户的指令，修改当前 PPT 页面的内容。

规则：
- 返回修改后的 JSON 格式内容，包含 title 和 contentBlocks 数组
- contentBlocks 中每个元素有 id, type (point/subpoint/finding/summary/text), content
- 保持学术严谨性
- 中文回复
- 如果用户要求精简，减少要点数量但保留核心信息
- 如果用户要求更适合讲解，让语言更口语化
- 如果用户要求换排版，改变 contentBlocks 的 type 分布
- 同时返回更新后的 notes 对象（mainTalk, extraExplanation, transitionSentence）

当前页面上下文：
${slideContext ? JSON.stringify(slideContext) : '无'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_slide",
              description: "Update the slide content based on user instructions",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Updated slide title" },
                  contentBlocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["point", "subpoint", "finding", "summary", "text", "heading"] },
                        content: { type: "string" },
                      },
                      required: ["id", "type", "content"],
                    },
                  },
                  notes: {
                    type: "object",
                    properties: {
                      mainTalk: { type: "string" },
                      extraExplanation: { type: "string" },
                      transitionSentence: { type: "string" },
                    },
                  },
                },
                required: ["title", "contentBlocks"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "update_slide" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI 额度已用完，请充值后再试" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI 服务出错" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "AI 未返回有效结果" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("slide-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
