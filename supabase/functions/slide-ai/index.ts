import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, slideContext } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const systemPrompt = `你是一个学术论文导读助手 AI。你帮助用户编辑和优化 PPT 演示文稿内容。

你的任务是根据用户的指令，修改当前 PPT 页面的内容。

## 可用的布局类型
- title-points：标题+要点列表（最常用）
- title-subpoints：标题+要点+子要点（有层级的内容）
- title-two-column：双栏对比（优缺点对比、方法对比等）
- title-findings：核心发现（高亮重要结论）
- title-summary：总结页
- title-quad：四分框布局（4个并列概念/组件）
- title-timeline：时间线布局（研究脉络、方法演进）
- title-method-flow：方法流程图布局（方法步骤）
- title-results：结果展示页（数据对比）
- cover：封面页

## 可用的内容块类型
- point：普通要点（带圆点标记）
- subpoint：子要点（缩进显示）
- finding：核心发现（高亮卡片）
- summary：总结性文字（斜体+分隔线）
- text：普通文本
- heading：小标题（粗体）
- quad-item：四分框中的一项
- timeline-item：时间线中的节点

## 规则
- 返回修改后的 JSON，包含 title, layout, contentBlocks
- contentBlocks 中每个元素有 id, type, content
- **内容要充实详细**：每个要点不能只是几个词，要有完整的说明句子，包含数据、对比、解释
- **善用多种布局**：如果用户要求换排版，必须同时改变 layout 和 contentBlocks 的 type
- 保持学术严谨性，中文回复
- 如果用户要求改成某种布局，你必须：1) 改变 layout 字段  2) 改变 contentBlocks 的 type 来匹配新布局
- 每页至少 4-6 个内容块，确保信息量充足
- 同时返回更新后的 notes 对象（mainTalk, extraExplanation, transitionSentence）

当前页面上下文：
${slideContext ? JSON.stringify(slideContext) : '无'}`;

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
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_slide",
              description: "Update the slide content, layout and notes based on user instructions",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Updated slide title" },
                  layout: { 
                    type: "string", 
                    enum: ["cover", "title-points", "title-subpoints", "title-two-column", "title-findings", "title-summary", "title-quad", "title-timeline", "title-method-flow", "title-results"],
                    description: "Slide layout type" 
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
        ],
        tool_choice: { type: "function", function: { name: "update_slide" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("DashScope API error:", status, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "API 额度已用完，请充值后再试" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI 服务出错 (${status})` }), {
        status: 500,
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

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {}
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
