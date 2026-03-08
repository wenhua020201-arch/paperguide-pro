import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, slideContext, mode } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    // mode: 'edit' (default) or 'refresh-notes' (regenerate notes for updated content)
    const isNotesRefresh = mode === 'refresh-notes';

    const systemPrompt = isNotesRefresh
      ? `你是一个学术论文导读助手。用户刚刚手动编辑了 PPT 页面内容，你需要根据更新后的内容重新生成演讲注释。

当前页面内容：
${slideContext ? JSON.stringify(slideContext) : '无'}

请根据页面的最新标题和内容块，生成匹配的演讲注释：
- mainTalk：这页的核心讲解要点（2-3句话概括要讲什么）
- extraExplanation：补充的背景知识或细节（帮助讲者理解更深）
- transitionSentence：过渡到下一页的衔接语

请用中文回复。`
      : `你是一个学术论文导读助手 AI。你帮助用户编辑和优化 PPT 演示文稿内容。

## 可用的布局类型
- title-points：标题+要点列表
- title-subpoints：标题+要点+子要点
- title-two-column：双栏对比
- title-findings：核心发现
- title-summary：总结页
- title-quad：四分框布局
- title-timeline：时间线布局
- title-method-flow：方法流程图布局
- title-results：结果展示页
- cover：封面页

## 可用的内容块类型
- point：普通要点（带圆点标记）
- subpoint：子要点（缩进显示）
- finding：核心发现（高亮卡片）
- summary：总结性文字
- text：普通文本
- heading：小标题
- quad-item：四分框中的一项
- timeline-item：时间线中的节点

## 规则
- 返回修改后的完整 slide 内容
- **内容要充实详细**：每个要点至少15-30字的完整说明
- **善用多种布局**：改布局时同时改 contentBlocks 的 type
- 保持学术严谨性，中文回复
- 每页至少 5 个内容块
- 同时返回更新后的 notes

当前页面上下文：
${slideContext ? JSON.stringify(slideContext) : '无'}`;

    const tools = isNotesRefresh
      ? [
          {
            type: "function",
            function: {
              name: "update_notes",
              description: "Generate updated speaker notes for the edited slide",
              parameters: {
                type: "object",
                properties: {
                  notes: {
                    type: "object",
                    properties: {
                      mainTalk: { type: "string" },
                      extraExplanation: { type: "string" },
                      transitionSentence: { type: "string" },
                    },
                    required: ["mainTalk", "extraExplanation", "transitionSentence"],
                  },
                },
                required: ["notes"],
              },
            },
          },
        ]
      : [
          {
            type: "function",
            function: {
              name: "update_slide",
              description: "Update the slide content, layout and notes",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  layout: {
                    type: "string",
                    enum: ["cover", "title-points", "title-subpoints", "title-two-column", "title-findings", "title-summary", "title-quad", "title-timeline", "title-method-flow", "title-results"],
                  },
                  contentBlocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["point", "subpoint", "finding", "summary", "text", "heading", "quad-item", "timeline-item"] },
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
                required: ["title", "layout", "contentBlocks"],
              },
            },
          },
        ];

    const toolChoice = isNotesRefresh
      ? { type: "function", function: { name: "update_notes" } }
      : { type: "function", function: { name: "update_slide" } };

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
          ...(isNotesRefresh
            ? [{ role: "user", content: "请根据当前页面的最新内容，重新生成演讲注释。" }]
            : messages),
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("DashScope API error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI 服务出错 (${status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("slide-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
