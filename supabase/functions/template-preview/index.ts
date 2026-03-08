import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paper, outline } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const systemPrompt = `你是一个学术PPT模板预览生成助手。根据论文信息和大纲，为4种不同的汇报模板各生成3页PPT预览，让用户能明确看出每种模板的差异。

4种模板：
1. seminar（组会汇报版）：聚焦研究问题、方法细节、实验设计和批判性评价。语言偏学术、直接，多用术语。
2. course（课程Presentation版）：结构清晰、讲解友好。背景解释多，术语有定义，节奏缓和。
3. proposal（开题/综述版）：强调研究脉络、相关工作对比、方法演进、研究启发。
4. crossfield（跨方向交流版）：降低术语密度，多用类比和直觉解释，面向非本领域听众。

每种模板生成3页，每页有：
- title: 页面标题（要体现模板风格差异）
- points: 3-5个要点（内容和语言风格要体现模板特色）
- accent: HSL颜色值（每个模板用不同色调）

重要：4种模板的内容必须有明显差异，不是简单换标题，而是从内容选择、详略程度、语言风格上体现不同。

请用中文回复。`;

    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3-max",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `论文：${JSON.stringify(paper)}\n大纲：${JSON.stringify(outline)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_template_previews",
              description: "Generate preview slides for each template",
              parameters: {
                type: "object",
                properties: {
                  seminar: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        points: { type: "array", items: { type: "string" } },
                        accent: { type: "string" },
                      },
                      required: ["title", "points", "accent"],
                    },
                  },
                  course: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        points: { type: "array", items: { type: "string" } },
                        accent: { type: "string" },
                      },
                      required: ["title", "points", "accent"],
                    },
                  },
                  proposal: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        points: { type: "array", items: { type: "string" } },
                        accent: { type: "string" },
                      },
                      required: ["title", "points", "accent"],
                    },
                  },
                  crossfield: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        points: { type: "array", items: { type: "string" } },
                        accent: { type: "string" },
                      },
                      required: ["title", "points", "accent"],
                    },
                  },
                },
                required: ["seminar", "course", "proposal", "crossfield"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_template_previews" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("DashScope API error:", status, text);
      return new Response(JSON.stringify({ error: `AI 服务出错 (${status})` }), {
        status: status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "AI 未返回有效结果" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("template-preview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
