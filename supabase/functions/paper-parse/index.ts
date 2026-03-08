import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paperText } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const systemPrompt = `你是一个学术论文解析助手。用户会给你一篇论文的全文文本，你需要提取结构化信息。

请提取以下信息并通过 tool call 返回：
1. paper: 论文元数据（标题、作者列表、年份、关键词列表、研究主题、摘要）
2. outline: 导读大纲树状结构

大纲要求：
- 根节点是论文标题
- 一级节点为主要导读模块（如：研究背景、研究问题、方法、实验设计、主要结果、讨论与评价、启示与展望）
- 二级节点为具体内容要点
- 三级节点为更细的子要点（如果有必要）
- 每个节点包含 title（标题）和 description（一句简短说明）
- 节点数量根据论文内容自适应，不要过少也不要过多

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
          { role: "user", content: `请解析以下论文：\n\n${paperText.substring(0, 30000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_paper",
              description: "Return parsed paper metadata and outline",
              parameters: {
                type: "object",
                properties: {
                  paper: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      authors: { type: "array", items: { type: "string" } },
                      year: { type: "number" },
                      keywords: { type: "array", items: { type: "string" } },
                      topic: { type: "string" },
                      abstract: { type: "string" },
                    },
                    required: ["title", "authors", "year", "keywords", "topic"],
                  },
                  outline: {
                    type: "object",
                    description: "Root node of the outline tree",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      children: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            children: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  title: { type: "string" },
                                  description: { type: "string" },
                                  children: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        title: { type: "string" },
                                        description: { type: "string" },
                                      },
                                      required: ["title", "description"],
                                    },
                                  },
                                },
                                required: ["title", "description"],
                              },
                            },
                          },
                          required: ["title", "description"],
                        },
                      },
                    },
                    required: ["title", "description", "children"],
                  },
                },
                required: ["paper", "outline"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_paper" } },
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
    console.error("paper-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
