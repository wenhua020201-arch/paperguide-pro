import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const templateDescriptions: Record<string, string> = {
  seminar: '组会汇报版：以批判性视角分析论文。强调研究问题的动机、方法设计的合理性、实验设计的完备性、结果的可靠性。需要包含对方法的质疑和讨论。',
  course: '课程 Presentation 版：面向初学者友好。需要从基础概念讲起，用类比和直觉解释复杂概念，减少数学公式的直接展示，增加"为什么"的解释。每个概念都要有铺垫。',
  proposal: '开题/综述版：强调研究脉络和方法演进。需要梳理时间线，对比不同方法的优缺点，分析研究趋势，指出开放问题和可能的研究方向。',
  crossfield: '跨方向交流版：面向非本领域听众。完全避免专业术语或立即解释，使用生活化类比，关注"这个研究为什么重要"和"对其他领域有什么启示"。',
};

const densityDescriptions: Record<string, string> = {
  concise: '简洁模式：每页3-4个核心要点，语言精炼但每个要点要有完整说明',
  standard: '标准模式：每页5-7个要点，附完整说明、数据支撑和对比分析',
  detailed: '详细模式：每页7-10个要点，包含完整论证、公式、数据对比和细节说明',
};

function serializeOutline(node: any, depth = 0): string {
  const indent = '  '.repeat(depth);
  let result = `${indent}${depth > 0 ? '- ' : ''}${node.title}`;
  if (node.description) result += `：${node.description}`;
  result += '\n';
  if (node.children) {
    for (const child of node.children) {
      result += serializeOutline(child, depth + 1);
    }
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { outline, paper, template, density } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const outlineText = serializeOutline(outline);

    const systemPrompt = `你是一个学术论文导读PPT生成专家。你需要根据用户提供的论文大纲，生成高质量的PPT内容。

## 模板风格
${templateDescriptions[template] || templateDescriptions.seminar}

## 内容密度
${densityDescriptions[density] || densityDescriptions.standard}

## 核心要求
1. **以大纲为骨架生成PPT**：大纲的每个一级节点对应PPT的一个章节，但一个章节可以有多页PPT。根据信息量决定页数，信息量大的章节可以拆成2-4页。
2. **内容必须充实详尽**：
   - 每个要点不能只写几个词，必须是完整的说明句子
   - 包含具体数据、实验结果、数值对比
   - 解释"为什么"和"怎么做"，而不只是"是什么"
   - 方法部分要包含具体步骤、参数设置、创新点解释
   - 实验部分要包含数据集说明、评估指标、具体数值结果
3. **必须多样化使用布局**：
   - cover：封面页（仅第一页）
   - title-points：标题+要点列表（不要每页都用这个！）
   - title-subpoints：标题+要点+子要点（适合有层级的内容）
   - title-two-column：双栏对比（适合优缺点对比、方法对比、before/after）
   - title-findings：核心发现（适合突出重要结论，用高亮卡片）
   - title-summary：总结页
   - title-quad：四分框布局（适合4个并列概念/组件/模块的介绍）
   - title-timeline：时间线布局（适合研究脉络、方法演进、发展历程）
   - title-method-flow：方法流程图布局（适合方法步骤、pipeline、算法流程）
   - title-results：结果展示页（适合数据对比、实验结果）

   **布局分布要求**：
   - title-points 最多占 30% 的页面
   - 至少使用 4 种不同的布局类型
   - 方法部分优先用 title-method-flow 或 title-quad
   - 实验对比优先用 title-two-column 或 title-results
   - 研究背景/相关工作优先用 title-timeline
   - 核心创新点/关键发现用 title-findings

4. **配合布局选择内容块类型**：
   - point：普通要点（带圆点标记，内容要详细）
   - subpoint：子要点（缩进显示，补充说明）
   - finding：核心发现（高亮卡片显示）
   - summary：总结性文字（斜体+分隔线）
   - text：普通文本
   - heading：小标题（粗体分隔）
   - quad-item：四分框中的一项（包含标题和说明，用于 title-quad 布局）
   - timeline-item：时间线中的一个节点（用于 title-timeline 布局）

5. **每页内容块数量要求**：
   - cover：2-3 个（标题、作者、会议/期刊）
   - title-points：5-7 个（充实的要点列表）
   - title-two-column：6-8 个（左右各3-4个对比项）
   - title-quad：4 个（每个象限一个详细说明）
   - title-timeline：4-6 个（每个时间节点有详细说明）
   - title-method-flow：4-6 个（每个步骤有详细说明）
   - title-findings：3-5 个（每个发现都要详细论证）
   - title-results：4-6 个（结合 heading + point + finding）

## 生成规则
- 第一页必须是封面页（cover），包含论文标题和作者信息
- 最后一页是总结/展望页
- 总页数建议 12-20 页，根据内容复杂度调整
- 每个大纲章节至少1页，内容多的可以2-4页
- 演讲注释要实用：mainTalk 是这页的核心讲解要点，extraExplanation 是补充的背景知识或细节，transitionSentence 是过渡到下一页的衔接语

## 同时生成导读文章
- 按章节组织，与PPT章节对应
- 每个段落要用通俗易懂的语言讲解论文内容
- 导读文章应该完整连贯，可以作为汇报讲稿的参考

## ID 格式
- slides: s-1, s-2, ...
- contentBlocks: b-X-Y（X是slide序号，Y是block序号）
- article sections: sec-1, sec-2, ...
- paragraphs: p-X-Y

请用中文回复，保持学术严谨性。`;

    const userPrompt = `论文信息：
标题：${paper.title}
作者：${paper.authors?.join(', ') || '未知'}
年份：${paper.year || '未知'}
关键词：${paper.keywords?.join(', ') || '未知'}
摘要：${paper.abstract || '无'}

用户编辑后的大纲结构：
${outlineText}

请严格按照上述大纲结构生成PPT和导读文章。大纲是用户精心编辑的，每个节点的标题和描述都要在PPT中体现。
注意：布局必须多样化，不要全部使用 title-points！每个要点内容要详尽充实！`;

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
          { role: "user", content: userPrompt },
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
                        layout: { type: "string", enum: ["cover", "title-points", "title-subpoints", "title-two-column", "title-findings", "title-summary", "title-quad", "title-timeline", "title-method-flow", "title-results"] },
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
