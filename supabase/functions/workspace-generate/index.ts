import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const templateDescriptions: Record<string, Record<string, string>> = {
  zh: {
    seminar: '组会汇报版：以批判性视角分析论文。强调研究问题的动机、方法设计的合理性、实验设计的完备性、结果的可靠性。需要包含对方法的质疑和讨论。',
    course: '课程 Presentation 版：面向初学者友好。需要从基础概念讲起，用类比和直觉解释复杂概念，减少数学公式的直接展示，增加"为什么"的解释。每个概念都要有铺垫。',
    proposal: '开题/综述版：强调研究脉络和方法演进。需要梳理时间线，对比不同方法的优缺点，分析研究趋势，指出开放问题和可能的研究方向。',
    crossfield: '跨方向交流版：面向非本领域听众。完全避免专业术语或立即解释，使用生活化类比，关注"这个研究为什么重要"和"对其他领域有什么启示"。',
  },
  en: {
    seminar: 'Seminar Presentation: Critically analyze the paper. Emphasize research motivation, method design rationale, experimental completeness, and reliability of results. Include critical questions and discussion.',
    course: 'Course Presentation: Beginner-friendly. Start from basic concepts, use analogies and intuition to explain complex ideas, minimize raw formulas, add "why" explanations.',
    proposal: 'Proposal/Survey: Emphasize research lineage and method evolution. Timeline of approaches, compare pros/cons, analyze trends, identify open problems.',
    crossfield: 'Cross-field Talk: For non-specialist audience. Avoid jargon or explain immediately, use everyday analogies, focus on "why this matters" and "implications for other fields".',
  },
};

const densityDescriptions: Record<string, Record<string, string>> = {
  zh: {
    concise: '简洁模式：每页3-4个核心要点，语言精炼但每个要点要有完整说明',
    standard: '标准模式：每页5-7个要点，附完整说明、数据支撑和对比分析',
    detailed: '详细模式：每页7-10个要点，包含完整论证、公式、数据对比和细节说明',
  },
  en: {
    concise: 'Concise mode: 3-4 key points per slide, brief but complete explanations',
    standard: 'Standard mode: 5-7 points per slide, with full explanations, data support, and comparisons',
    detailed: 'Detailed mode: 7-10 points per slide, with full arguments, formulas, data comparisons and details',
  },
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
    const { outline, paper, template, density, language = 'zh' } = await req.json();
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is not configured");

    const outlineText = serializeOutline(outline);
    const isEn = language === 'en';
    const lang = isEn ? 'en' : 'zh';
    const tplDesc = templateDescriptions[lang]?.[template] || templateDescriptions[lang]?.seminar || templateDescriptions.zh.seminar;
    const denDesc = densityDescriptions[lang]?.[density] || densityDescriptions[lang]?.standard || densityDescriptions.zh.standard;

    const systemPrompt = isEn
      ? `You are an expert at generating academic paper reading-guide PPT content. Generate high-quality slides based on the provided outline.

## Template Style
${tplDesc}

## Content Density
${denDesc}

## Core Requirements
1. **Every terminal outline node MUST map to at least one slide**:
   - The outline has been carefully edited by the user, already split by paper subsections (e.g. 3.1.1, 3.1.2 each separate)
   - Each terminal node MUST have its own slide — NEVER merge them
   - Information-heavy nodes can be split into 2-3 slides
   - This is the most important rule!

2. **Content must be thorough and detailed**:
   - Each point must be a complete sentence (at least 15-30 words), not just a few keywords
   - Include specific data, experimental results, numerical comparisons
   - Explain "why" and "how", not just "what"
   - Methods: include specific steps, parameter settings, innovation explanations
   - Experiments: include dataset descriptions, evaluation metrics, specific numerical results
   - At least 5 content blocks per slide

3. **Must diversify layouts**:
   - cover: cover page (first slide only)
   - title-points: title + bullet list (max 30% of slides!)
   - title-subpoints: title + points + sub-points
   - title-two-column: two-column comparison
   - title-findings: key findings with highlight cards
   - title-summary: summary page
   - title-quad: four-quadrant layout
   - title-timeline: timeline layout
   - title-method-flow: method pipeline/flow layout
   - title-results: results display page

   **Layout distribution**: title-points max 30%, use at least 5 different layout types.

4. **Content block types**: point, subpoint, finding, summary, text, heading, quad-item, timeline-item

5. **Content blocks per slide**: cover: 2-3, title-points: 5-8, title-two-column: 6-10, title-quad: 4, title-timeline: 4-6, title-method-flow: 4-6, title-findings: 3-5, title-results: 4-6

## Generation Rules
- First slide must be cover with paper title and authors
- Last slide is summary/outlook
- 15-30 slides total, adjusted by outline node count
- Speaker notes: mainTalk = core talking points, extraExplanation = background/details, transitionSentence = transition to next slide

Reply in English.`
      : `你是一个学术论文导读PPT生成专家。你需要根据用户提供的论文大纲，生成高质量的PPT内容。

## 模板风格
${tplDesc}

## 内容密度
${denDesc}

## 核心要求
1. **大纲的每个最末级节点必须至少对应一页PPT**：
   - 大纲是用户精心编辑的，已经按照论文的小节结构拆分（如 3.1.1、3.1.2 各自独立）
   - 每个末级节点都必须有自己独立的 PPT 页面，**绝对不要合并**
   - 信息量大的节点可以拆成 2-3 页 PPT
   - 这是最重要的规则！

2. **内容必须充实详尽**：
   - 每个要点不能只写几个词，必须是完整的说明句子（至少15-30个字）
   - 包含具体数据、实验结果、数值对比
   - 解释"为什么"和"怎么做"，而不只是"是什么"
   - 方法部分要包含具体步骤、参数设置、创新点解释
   - 实验部分要包含数据集说明、评估指标、具体数值结果
   - 每页至少 5 个内容块

3. **必须多样化使用布局**：
   - cover：封面页（仅第一页）
   - title-points：标题+要点列表（不要每页都用这个！最多占30%）
   - title-subpoints：标题+要点+子要点
   - title-two-column：双栏对比
   - title-findings：核心发现
   - title-summary：总结页
   - title-quad：四分框布局
   - title-timeline：时间线布局
   - title-method-flow：方法流程图布局
   - title-results：结果展示页

   **布局分布要求**：title-points 最多占 30%，至少使用 5 种不同的布局类型。

4. **内容块类型**：point, subpoint, finding, summary, text, heading, quad-item, timeline-item

5. **每页内容块数量**：cover: 2-3, title-points: 5-8, title-two-column: 6-10, title-quad: 4, title-timeline: 4-6, title-method-flow: 4-6, title-findings: 3-5, title-results: 4-6

## 图表占位说明
- 涉及实验流程、模型架构时，添加类型为 "text" 的块，格式：[图表: 描述内容]

## 生成规则
- 第一页必须是封面页（cover）
- 最后一页是总结/展望页
- 总页数建议 15-30 页
- 演讲注释：mainTalk = 核心讲解要点，extraExplanation = 补充背景，transitionSentence = 过渡句

## 同时生成导读文章
- 按章节组织，与PPT章节对应
- 每个段落用通俗易懂的语言讲解

请用中文回复，保持学术严谨性。`;

    const userPrompt = isEn
      ? `Paper Info:
Title: ${paper.title}
Authors: ${paper.authors?.join(', ') || 'Unknown'}
Year: ${paper.year || 'Unknown'}
Keywords: ${paper.keywords?.join(', ') || 'Unknown'}
Abstract: ${paper.abstract || 'N/A'}

User-edited outline:
${outlineText}

Generate slides and article strictly following this outline.
**KEY**: Every terminal node (no children) MUST map to at least one independent slide — NEVER merge!
Diversify layouts! Each point must be detailed!`
      : `论文信息：
标题：${paper.title}
作者：${paper.authors?.join(', ') || '未知'}
年份：${paper.year || '未知'}
关键词：${paper.keywords?.join(', ') || '未知'}
摘要：${paper.abstract || '无'}

用户编辑后的大纲结构：
${outlineText}

请严格按照上述大纲结构生成PPT和导读文章。
**关键**：大纲的每个末级节点（没有子节点的节点）都必须至少对应一页独立的PPT，不要合并！
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
