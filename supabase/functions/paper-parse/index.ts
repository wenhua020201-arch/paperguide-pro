import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paperText, language = 'zh' } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const isEn = language === 'en';

    const systemPrompt = isEn
      ? `You are an academic paper parsing assistant. The user provides full text of a paper. Extract structured information.

Please extract:
1. paper: metadata (title, authors, year, keywords, topic, abstract)
2. outline: a reading guide outline tree

## Outline Requirements (CRITICAL!)
- Root node is the paper title
- Level-1 nodes are major reading modules (e.g.: Background, Research Questions, Method, Experimental Design, Results, Discussion, Implications)
- **You MUST faithfully decompose EVERY section and subsection heading from the paper**:
  - If the paper has sections 3.1, 3.2, 3.3, each MUST be a separate node
  - If 3.1 has subsections 3.1.1 and 3.1.2, they MUST be separate children of 3.1, NEVER merge them
  - Every finest-granularity subsection MUST become its own node — each will become a separate PPT slide later
  - When in doubt, split MORE rather than LESS
  - Even paragraphs within a section that cover distinct topics should be separate nodes
- Each node has title (heading) and description (one brief sentence)
- Preserve the paper's original hierarchy — do NOT reorganize
- **Completeness check**: After generating the outline, mentally walk through the paper from start to end. If any section/subsection is missing, add it. Missing content is the #1 error to avoid.

Reply in English.`
      : `你是一个学术论文解析助手。用户会给你一篇论文的全文文本，你需要提取结构化信息。

请提取以下信息并通过 tool call 返回：
1. paper: 论文元数据（标题、作者列表、年份、关键词列表、研究主题、摘要）
2. outline: 导读大纲树状结构

## 大纲要求（极其重要！）
- 根节点是论文标题
- 一级节点为主要导读模块（如：研究背景、研究问题、方法、实验设计、主要结果、讨论与评价、启示与展望）
- **必须忠实地拆解论文的每一个小节标题**：
  - 如果论文有 3.1、3.2、3.3，那么每个都要作为独立节点
  - 如果 3.1 下面有 3.1.1 和 3.1.2，那 3.1.1 和 3.1.2 都要作为 3.1 的子节点，**不要合并**
  - 每个最细粒度的小节都应该成为独立节点，后续会各自生成一页 PPT
  - 不要过度整合，宁可多拆也不要少拆
  - 即使是同一小节内讨论多个不同话题的段落，也应该拆为不同子节点
- 每个节点包含 title（标题）和 description（一句简短说明）
- 保持论文原有的层级结构，不要自行重组
- **完整性检查**：生成大纲后，请从头到尾回顾论文全文。如果有任何章节/小节遗漏，请补充。遗漏内容是最需要避免的错误。

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
          { role: "user", content: `${isEn ? 'Please parse the following paper' : '请解析以下论文'}：\n\n${paperText.substring(0, 30000)}` },
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
                    description: "Root node of the outline tree. Must faithfully decompose every subsection (e.g. 3.1.1, 3.1.2) as separate child nodes. Never merge or skip any section.",
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
