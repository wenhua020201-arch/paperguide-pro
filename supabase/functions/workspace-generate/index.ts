import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { outline, paper, template, density } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const templateDescriptions: Record<string, string> = {
      seminar: '组会汇报版：强调研究问题、方法、实验和批判性评价',
      course: '课程 Presentation 版：结构清晰，讲解友好，背景解释更多',
      proposal: '开题/综述版：强调研究脉络、相关工作、启发',
      crossfield: '跨方向交流版：降低术语密度，更适合非本领域听众',
    };

    const densityDescriptions: Record<string, string> = {
      concise: '简洁：每页仅保留2-3个核心结论，语言极度精炼',
      standard: '标准：每页3-5个要点，附简要说明',
      detailed: '详细：每页5-8个要点，包含完整论证与细节',
    };

    const systemPrompt = `你是一个学术论文导读工作台生成助手。根据论文大纲和元数据，生成完整的导读工作台内容。

模板风格：${templateDescriptions[template] || '组会汇报版'}
内容密度：${densityDescriptions[density] || '标准'}

你需要生成：
1. slides: PPT 页面数组（6-10页），每页包含：
   - title: 页面标题
   - contentBlocks: 内容块数组，每个有 type (point/subpoint/finding/summary/text/heading) 和 content
   - layout: 布局类型 (cover/title-points/title-subpoints/title-two-column/title-findings/title-summary)
   - notes: 演讲注释 (mainTalk, extraExplanation, transitionSentence)

2. article: 导读文章，按章节组织：
   - sections 数组，每个有 title 和 paragraphs（段落数组）
   - 每个段落有 content（详细的导读文本，不是摘抄原文，而是用通俗的语言讲解）
   - 导读文章应该完整、连贯，适合作为汇报的讲稿参考
   - 每个段落的 linkedSlideId 对应关联的幻灯片 ID

第一页应该是封面页（cover 布局），包含论文标题、作者和导读人信息。
最后一页应该是总结/展望页。
slides 的 id 格式为 s-1, s-2, ... 
contentBlocks 的 id 格式为 b-X-Y（X是slide序号，Y是block序号）
article sections 的 id 格式为 sec-1, sec-2, ...
paragraphs 的 id 格式为 p-X-Y

请用中文回复，保持学术严谨性。`;

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
          { role: "user", content: `论文信息：${JSON.stringify(paper)}\n\n大纲结构：${JSON.stringify(outline)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_workspace",
              description: "Generate complete workspace with slides and article",
              parameters: {
                type: "object",
                properties: {
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        layout: { type: "string", enum: ["cover", "title-points", "title-subpoints", "title-two-column", "title-findings", "title-summary"] },
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
                          required: ["mainTalk", "extraExplanation", "transitionSentence"],
                        },
                      },
                      required: ["id", "title", "layout", "contentBlocks", "notes"],
                    },
                  },
                  article: {
                    type: "object",
                    properties: {
                      sections: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            title: { type: "string" },
                            paragraphs: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  content: { type: "string" },
                                  linkedSlideId: { type: "string" },
                                },
                                required: ["id", "content"],
                              },
                            },
                          },
                          required: ["id", "title", "paragraphs"],
                        },
                      },
                    },
                    required: ["sections"],
                  },
                },
                required: ["slides", "article"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_workspace" } },
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
    console.error("workspace-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
