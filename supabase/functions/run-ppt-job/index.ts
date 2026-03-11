import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGES = [
  "section_summarized",
  "presentation_units_extracted",
  "slide_planned",
  "slides_generated",
] as const;
type Stage = (typeof STAGES)[number];

// After slide_planned, PAUSE and wait for user confirmation before generating slides
const PAUSE_AFTER = new Set<string>(["slide_planned"]);

const STAGE_PROGRESS: Record<Stage, number> = {
  section_summarized: 15,
  presentation_units_extracted: 25,
  slide_planned: 35,
  slides_generated: 100,
};

// ─── Template style descriptions (Chinese) ───
const TEMPLATE_DESC: Record<string, string> = {
  seminar: `组会汇报版。
目标听众：导师、组会成员、同领域研究者，默认具备一定研究基础。
核心目标：突出研究问题、研究贡献、方法设计、关键发现、局限性及批判性评价。
结构重点：压缩基础背景，优先为"研究问题与贡献""方法与实验设计""核心结果""讨论、局限与启示"分配页数。
表达风格：分析性强，强调判断与讨论，信息密度较高。`,

  course: `课程演示版。
目标听众：课程同学或初学者，可能对该研究主题和术语不熟悉。
核心目标：帮助听众快速理解研究背景、核心概念、研究问题、基本方法和主要发现。
结构重点：优先安排背景、核心概念解释、方法通俗化、主要结果、总结。
表达风格：清晰友好，循序渐进，控制单页信息负担。`,

  proposal: `开题综述版。
目标听众：导师、答辩老师或研究评审。
核心目标：将论文放回研究脉络中，说明其回应了什么问题、与既有研究关系、留下哪些空白。
结构重点：研究背景与脉络、研究定位、与已有研究联系差异、关键发现、局限与延展方向。
表达风格：脉络化、综述化、研究定位导向。`,

  crossfield: `跨方向交流版。
目标听众：非本领域研究者、跨学科合作者。
核心目标：让非专业听众理解研究什么、为什么重要、基本怎么做、关键结论。
结构重点：问题背景意义、核心概念通俗解释、高层概述、关键结果、广泛启示。
表达风格：解释性强、术语负担低、强调意义。`,
};

// ─── Helper: call DashScope with tool_choice ───
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  toolDef: any,
  toolName: string
) {
  const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
  if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY not configured");

  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
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
        tools: [{ type: "function", function: toolDef }],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments)
    throw new Error("AI returned no tool call");

  return typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;
}

// ─── Outline serializer ───
function serializeOutline(node: any, depth = 0): string {
  const indent = "  ".repeat(depth);
  let result = `${indent}${depth > 0 ? "- " : ""}${node.title}`;
  if (node.description) result += `：${node.description}`;
  result += "\n";
  if (node.children) {
    for (const child of node.children) {
      result += serializeOutline(child, depth + 1);
    }
  }
  return result;
}

// Flatten outline to terminal nodes with IDs
function flattenOutline(
  node: any,
  path: string = "",
  depth = 0
): Array<{ id: string; title: string; description: string; level: number }> {
  const currentId = path || node.id || "root";
  if (!node.children || node.children.length === 0) {
    return [
      {
        id: currentId,
        title: node.title,
        description: node.description || "",
        level: depth,
      },
    ];
  }
  let results: any[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    results = results.concat(
      flattenOutline(child, child.id || `${currentId}-${i}`, depth + 1)
    );
  }
  return results;
}

// ════════════════════════════════════════════════
// Stage 1: Section Summaries
// ════════════════════════════════════════════════
async function summarizeSections(job: any): Promise<any> {
  const { outline, paper } = job.input_payload;
  const terminalNodes = flattenOutline(outline);

  const systemPrompt = `你是学术论文分析专家。你的任务是为论文大纲中的每个末级章节生成结构化摘要，并提取展示结构信息。

## 你的身份
- 学术论文结构分析者
- 中立客观，不加入主观评价
- 输出是后续 PPT 生成的"事实基础层"

## 任务边界
- 只做摘要、关键点提取和结构分析
- 不要考虑汇报风格、听众偏好
- 不要生成 PPT 内容

## 输出规则
- summary：2-4句话，忠实概括该节核心内容
- keyPoints：3-5个关键要点，每个15-30字
- keyNumbers：该节中出现的关键数值/指标/统计量（如"准确率提升12%""样本量N=500""p<0.01"），无则空数组
- coreRelation：该节内容的核心逻辑关系
  - parallel：并列多个同级要素（如多个实验条件）
  - sequence：有先后顺序（如流程步骤、时间演进）
  - comparison：对比（如方法对比、结果对比）
  - part-whole：整体与局部关系
  - hierarchy：层级/分类关系
  - cause-effect：因果关系
  - none：无明显结构关系
- visualPattern：最适合展示该节内容的视觉模式
  - cards：适合并列展示的卡片
  - process：流程/步骤图
  - comparison：对比表格/双栏
  - matrix：矩阵/网格
  - timeline：时间线
  - bullets：传统要点列表
  - hierarchy：层级图
  - single-highlight：聚焦单个核心发现
- presentationHint：给后续PPT生成的建议（1句话，如"适合用对比表格展示两种方法差异"或"核心数据适合做高亮卡片"）
- suggestedSplit：建议拆成几页PPT来展示（1-3页，信息量大的章节建议拆分）
- nodeType：从枚举中选择最匹配的类型
- slideWorthy：该节是否值得在PPT中展示
- importance：对理解论文主旨的重要程度

## 质量标准
- 摘要必须忠实于原文
- keyNumbers 必须提取具体数值，不要遗漏重要量化结果
- coreRelation 和 visualPattern 要基于内容实际结构判断，不要都选 bullets
- presentationHint 要具体有用，不要泛泛而谈`;

  const userPrompt = `论文标题：${paper.title}
摘要：${paper.abstract || "无"}
关键词：${(paper.keywords || []).join("、")}

大纲结构：
${serializeOutline(outline)}

末级节点列表（共${terminalNodes.length}个）：
${terminalNodes.map((n) => `- [${n.id}] ${n.title}：${n.description}`).join("\n")}

请为每个末级节点生成结构化摘要，特别注意提取 keyNumbers、coreRelation、visualPattern 和 presentationHint。`;

  const toolDef = {
    name: "output_section_summaries",
    description: "Output structured summaries for each outline section",
    parameters: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Outline node ID" },
              title: { type: "string" },
              summary: { type: "string", description: "2-4 sentence summary" },
              keyPoints: {
                type: "array",
                items: { type: "string" },
                description: "3-5 key points, each 15-30 chars",
              },
              keyNumbers: {
                type: "array",
                items: { type: "string" },
                description: "Key numbers/metrics from this section, e.g. '准确率92.3%', 'N=500'",
              },
              coreRelation: {
                type: "string",
                enum: ["parallel", "sequence", "comparison", "part-whole", "hierarchy", "cause-effect", "none"],
                description: "Core logical relation of the content",
              },
              visualPattern: {
                type: "string",
                enum: ["cards", "process", "comparison", "matrix", "timeline", "bullets", "hierarchy", "single-highlight"],
                description: "Best visual pattern for this content",
              },
              presentationHint: {
                type: "string",
                description: "1-sentence hint for how to present this on a slide",
              },
              suggestedSplit: {
                type: "number",
                description: "Suggested number of slides (1-3)",
              },
              nodeType: {
                type: "string",
                enum: [
                  "background", "research_question", "theory", "method",
                  "data", "experiment", "result", "discussion",
                  "limitation", "implication", "conclusion", "other",
                ],
              },
              slideWorthy: { type: "boolean" },
              importance: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
            required: [
              "id", "title", "summary", "keyPoints", "keyNumbers",
              "coreRelation", "visualPattern", "presentationHint", "suggestedSplit",
              "nodeType", "slideWorthy", "importance",
            ],
          },
        },
      },
      required: ["sections"],
    },
  };

  return await callAI(
    systemPrompt,
    userPrompt,
    toolDef,
    "output_section_summaries"
  );
}

// ════════════════════════════════════════════════
// Stage 2: Presentation Units Extraction
// ════════════════════════════════════════════════
async function extractPresentationUnits(
  job: any,
  sectionSummaries: any
): Promise<any> {
  const { paper } = job.input_payload;
  const style = job.selected_template || "seminar";
  const styleDesc = TEMPLATE_DESC[style] || TEMPLATE_DESC.seminar;

  const systemPrompt = `你是学术汇报内容策略专家。你的任务是根据用户选择的汇报风格，将章节摘要转化为适合该场景的"展示单元"。

## 你的身份
- 汇报内容策略师
- 决定"这场汇报应该讲什么、强调什么、省略什么"

## 当前汇报风格
${styleDesc}

## 任务边界
- 不是复述论文内容，而是做展示重点提炼
- 不同模板要真正影响内容取舍和强调重点
- 不要生成 slide 内容，只做"讲什么"的决策

## 输出规则
- unitId：唯一标识（如 "unit-1"）
- title：该展示单元的标题
- sourceSections：来源的章节ID列表
- focus：该单元的核心关注点（1-2句话）
- importance：在当前风格下的重要程度
- recommendedDepth：建议展开深度
- suggestedRole：该单元在汇报中的角色（如"开场铺垫""核心论证""数据支撑""总结升华"）

## 质量标准
- 相关性低的章节可以合并或降级
- 高重要性的章节应拆分为多个单元
- 展示单元的数量应在 8-20 之间
- 必须体现当前汇报风格的特点`;

  const userPrompt = `论文标题：${paper.title}
汇报风格：${style}

章节摘要：
${JSON.stringify(sectionSummaries.sections, null, 2)}

请根据"${style}"风格，将这些章节摘要转化为展示单元。`;

  const toolDef = {
    name: "output_presentation_units",
    description: "Output style-specific presentation units",
    parameters: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["seminar", "course", "proposal", "crossfield"],
        },
        units: {
          type: "array",
          items: {
            type: "object",
            properties: {
              unitId: { type: "string" },
              title: { type: "string" },
              sourceSections: {
                type: "array",
                items: { type: "string" },
              },
              focus: { type: "string" },
              importance: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              recommendedDepth: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              suggestedRole: { type: "string" },
            },
            required: [
              "unitId",
              "title",
              "sourceSections",
              "focus",
              "importance",
              "recommendedDepth",
            ],
          },
        },
      },
      required: ["style", "units"],
    },
  };

  return await callAI(
    systemPrompt,
    userPrompt,
    toolDef,
    "output_presentation_units"
  );
}

// ════════════════════════════════════════════════
// Stage 3: Slide Plan
// ════════════════════════════════════════════════
async function planSlides(
  job: any,
  presentationUnits: any,
  sectionSummaries: any
): Promise<any> {
  const { paper } = job.input_payload;
  const targetCount = job.target_slide_count || 20;
  const style = job.selected_template || "seminar";
  const styleDesc = TEMPLATE_DESC[style] || TEMPLATE_DESC.seminar;

  const systemPrompt = `你是 PPT 结构规划专家。你的任务是根据展示单元，规划整套 PPT 的骨架结构。

## 你的身份
- PPT 结构架构师
- 决定"这套PPT有哪些页、每页什么作用、什么布局"

## 当前汇报风格
${styleDesc}

## 可用布局类型
- cover：封面页（仅第一页）
- agenda：目录/议程页
- title-bullets：标题+要点列表（⚠️ 最多占总页数的30%！）
- two-column：双栏对比/并列
- comparison：对比分析
- timeline：时间线/演进
- data-card：数据/发现卡片
- summary：总结/展望页（仅最后1-2页）

## 规则
1. 第一页必须是 cover
2. 最后一页必须是 summary
3. title-bullets 不能超过总页数的 30%
4. 至少使用 5 种不同布局
5. 规划应形成清晰的讲述主线，不是机械照搬论文目录
6. 每页必须有明确的 purpose（这页为什么存在）和 rationale（为什么选这个布局）
7. coveredUnits 必须引用展示单元的 unitId
8. 总页数应接近目标页数（${targetCount}页）

## 输出规则
- slideNo：从 1 开始
- title：页面标题，最多15字
- role：cover/agenda/content/summary
- coveredUnits：该页覆盖的展示单元ID列表
- layout：从上述布局中选择
- purpose：该页的讲述目标（1句话）
- rationale：为什么选择这个布局（1句话）`;

  const userPrompt = `论文标题：${paper.title}
目标页数：${targetCount}
汇报风格：${style}

展示单元：
${JSON.stringify(presentationUnits.units, null, 2)}

章节摘要（供参考）：
${JSON.stringify(sectionSummaries.sections.slice(0, 20), null, 2)}

请规划约${targetCount}页PPT的结构骨架。记住：先形成讲述主线，再分配布局。`;

  const toolDef = {
    name: "output_slide_plan",
    description: "Output the global slide plan",
    parameters: {
      type: "object",
      properties: {
        totalSlides: { type: "number" },
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideNo: { type: "number" },
              title: { type: "string", description: "Max 15 chars" },
              role: {
                type: "string",
                enum: ["cover", "agenda", "content", "summary"],
              },
              coveredUnits: {
                type: "array",
                items: { type: "string" },
              },
              layout: {
                type: "string",
                enum: [
                  "cover",
                  "agenda",
                  "title-bullets",
                  "two-column",
                  "comparison",
                  "timeline",
                  "data-card",
                  "summary",
                ],
              },
              purpose: { type: "string" },
              rationale: { type: "string" },
            },
            required: [
              "slideNo",
              "title",
              "role",
              "coveredUnits",
              "layout",
              "purpose",
              "rationale",
            ],
          },
        },
      },
      required: ["totalSlides", "slides"],
    },
  };

  return await callAI(systemPrompt, userPrompt, toolDef, "output_slide_plan");
}

// ════════════════════════════════════════════════
// Stage 4: Generate ONE slide (called per-slide)
// ════════════════════════════════════════════════
async function generateOneSlide(
  job: any,
  slidePlan: any,
  presentationUnits: any,
  sectionSummaries: any,
  slideIndex: number
): Promise<any> {
  const { paper } = job.input_payload;
  const style = job.selected_template || "seminar";
  const styleDesc = TEMPLATE_DESC[style] || TEMPLATE_DESC.seminar;
  const plan = slidePlan.slides[slideIndex];
  const prevPlan =
    slideIndex > 0 ? slidePlan.slides[slideIndex - 1] : null;
  const nextPlan =
    slideIndex < slidePlan.slides.length - 1
      ? slidePlan.slides[slideIndex + 1]
      : null;

  // Find relevant units and summaries
  const relevantUnits = (presentationUnits.units || []).filter((u: any) =>
    (plan.coveredUnits || []).includes(u.unitId)
  );
  const relevantSectionIds = new Set<string>();
  for (const u of relevantUnits) {
    for (const sid of u.sourceSections || []) relevantSectionIds.add(sid);
  }
  const relevantSummaries = (sectionSummaries.sections || []).filter(
    (s: any) => relevantSectionIds.has(s.id)
  );

  const systemPrompt = `你是学术导读PPT内容撰写专家。你的任务是根据全局规划，为当前这一页生成完整的PPT内容。

## 你的身份
- PPT 单页内容撰写者
- 基于全局 slide plan 生成该页内容

## 当前汇报风格
${styleDesc}

## 可用内容块类型
- point：普通要点（带圆点标记）
- subpoint：子要点（缩进显示）
- finding：核心发现（高亮卡片）
- summary：总结性文字
- text：普通文本
- heading：小标题

## 内容质量要求
- 标题：最多15个字
- 每个要点：15-30字完整句子，不要只写几个关键词
- 每页至少4个、最多8个内容块
- 包含具体数据、数值、对比（如有）
- 内容块类型要与该页布局匹配

## Notes 要求（非常重要）
notes 不是复读页面内容！
- mainTalk：这页该怎么讲，讲解策略和核心要点（2-3句话，最多100字）
- extraExplanation：页面之外但讲者应知道的补充理解（最多100字）
- transitionSentence：自然过渡到下一页的话（1句话，最多50字）

## 布局与内容块匹配规则
- cover：2-3个text块（论文标题、作者、日期）
- agenda：4-6个point块
- title-bullets：4-6个point块
- two-column：6-8个块（用heading分隔两栏）
- comparison：6-8个块（对比项用finding或point）
- timeline：4-6个块（按时间顺序）
- data-card：3-5个finding块
- summary：3-5个point或summary块`;

  const userPrompt = `论文标题：${paper.title}
汇报风格：${style}
当前生成第 ${slideIndex + 1}/${slidePlan.totalSlides} 页

═══ 当前页规划 ═══
标题：${plan.title}
布局：${plan.layout}
角色：${plan.role}
目的：${plan.purpose}
布局理由：${plan.rationale}
覆盖单元：${(plan.coveredUnits || []).join(", ")}

═══ 上下文 ═══
前一页：${prevPlan ? `${prevPlan.title}（${prevPlan.layout}，${prevPlan.purpose}）` : "无（这是第一页）"}
下一页：${nextPlan ? `${nextPlan.title}（${nextPlan.layout}，${nextPlan.purpose}）` : "无（这是最后一页）"}

═══ 相关展示单元 ═══
${relevantUnits.length > 0 ? JSON.stringify(relevantUnits, null, 2) : "无"}

═══ 相关章节摘要 ═══
${relevantSummaries.length > 0 ? JSON.stringify(relevantSummaries, null, 2) : "无"}

请生成这一页的完整内容，包括 title、contentBlocks 和 notes。
注意：内容块类型必须与布局"${plan.layout}"匹配。`;

  const toolDef = {
    name: "output_slide",
    description: "Output content for a single slide",
    parameters: {
      type: "object",
      properties: {
        slideNo: { type: "number" },
        title: { type: "string", description: "Max 15 chars" },
        layout: {
          type: "string",
          enum: [
            "cover",
            "agenda",
            "title-bullets",
            "two-column",
            "comparison",
            "timeline",
            "data-card",
            "summary",
          ],
        },
        contentBlocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "point",
                  "subpoint",
                  "finding",
                  "summary",
                  "text",
                  "heading",
                ],
              },
              text: {
                type: "string",
                description: "15-30 chars per block",
              },
            },
            required: ["type", "text"],
          },
        },
        notes: {
          type: "object",
          properties: {
            mainTalk: { type: "string", description: "Max 100 chars" },
            extraExplanation: {
              type: "string",
              description: "Max 100 chars",
            },
            transitionSentence: {
              type: "string",
              description: "Max 50 chars",
            },
          },
          required: ["mainTalk", "extraExplanation", "transitionSentence"],
        },
      },
      required: ["slideNo", "title", "layout", "contentBlocks", "notes"],
    },
  };

  const result = await callAI(
    systemPrompt,
    userPrompt,
    toolDef,
    "output_slide"
  );
  result.slideNo = slideIndex + 1; // Ensure correct slideNo
  return result;
}

// ════════════════════════════════════════════════
// Main Orchestrator
// ════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { jobId, stage, slideIndex: reqSlideIndex } = await req.json();
    if (!jobId || !stage) throw new Error("Missing jobId or stage");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Load job
    const { data: job, error: jobError } = await sb
      .from("ppt_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobError || !job) throw new Error(`Job not found: ${jobId}`);

    if (job.status === "cancelled") {
      return new Response(
        JSON.stringify({ ok: true, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job status
    await sb
      .from("ppt_jobs")
      .update({
        status: "running",
        current_stage: stage,
        progress: Math.max(
          job.progress || 0,
          (STAGE_PROGRESS[stage as Stage] || 0) - 10
        ),
      })
      .eq("id", jobId);

    // Update step to running
    await sb
      .from("ppt_job_steps")
      .update({ step_status: "running" })
      .eq("job_id", jobId)
      .eq("step_name", stage);

    const startTime = Date.now();

    try {
      // Load previous step outputs
      const { data: completedSteps } = await sb
        .from("ppt_job_steps")
        .select("step_name, step_output")
        .eq("job_id", jobId)
        .in("step_status", ["completed", "running"]);

      const stepOutputs: Record<string, any> = {};
      for (const s of completedSteps || []) {
        if (s.step_output) stepOutputs[s.step_name] = s.step_output;
      }

      // ──── Per-slide generation (special handling) ────
      if (stage === "slides_generated") {
        const slidePlan = stepOutputs.slide_planned;
        const presentationUnits = stepOutputs.presentation_units_extracted;
        const sectionSummaries = stepOutputs.section_summarized;

        if (!slidePlan?.slides)
          throw new Error("No slide plan found");

        const totalSlides = slidePlan.slides.length;

        // Determine which slide to generate
        const currentStep = (completedSteps || []).find(
          (s) => s.step_name === "slides_generated"
        );
        const existingSlides =
          (currentStep?.step_output as any)?.slides || [];
        const slideIdx =
          typeof reqSlideIndex === "number"
            ? reqSlideIndex
            : existingSlides.length;

        if (slideIdx >= totalSlides) {
          // All slides generated
          const durationMs = Date.now() - startTime;
          await sb
            .from("ppt_job_steps")
            .update({
              step_status: "completed",
              step_output: {
                slides: existingSlides,
                generatedCount: totalSlides,
                totalCount: totalSlides,
              },
              duration_ms: durationMs,
            })
            .eq("job_id", jobId)
            .eq("step_name", "slides_generated");

          await sb
            .from("ppt_jobs")
            .update({ status: "completed", progress: 100 })
            .eq("id", jobId);

          return new Response(
            JSON.stringify({ ok: true, stage, completed: true }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // Generate one slide
        const slide = await generateOneSlide(
          job,
          slidePlan,
          presentationUnits,
          sectionSummaries,
          slideIdx
        );
        const updatedSlides = [...existingSlides, slide];

        // Update step output incrementally
        await sb
          .from("ppt_job_steps")
          .update({
            step_output: {
              slides: updatedSlides,
              generatedCount: updatedSlides.length,
              totalCount: totalSlides,
            },
            step_status: "running",
          })
          .eq("job_id", jobId)
          .eq("step_name", "slides_generated");

        // Update progress: 35% base + slide progress
        const progress =
          35 + Math.round((updatedSlides.length / totalSlides) * 65);
        await sb
          .from("ppt_jobs")
          .update({ progress })
          .eq("id", jobId);

        // Chain to next slide
        if (updatedSlides.length < totalSlides) {
          const fnUrl = `${supabaseUrl}/functions/v1/run-ppt-job`;
          fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              jobId,
              stage: "slides_generated",
              slideIndex: slideIdx + 1,
            }),
          }).catch((e) =>
            console.error("Failed to chain next slide:", e)
          );
        } else {
          // All done
          await sb
            .from("ppt_job_steps")
            .update({
              step_status: "completed",
              duration_ms: Date.now() - startTime,
            })
            .eq("job_id", jobId)
            .eq("step_name", "slides_generated");

          await sb
            .from("ppt_jobs")
            .update({ status: "completed", progress: 100 })
            .eq("id", jobId);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            stage,
            slideIndex: slideIdx,
            generated: updatedSlides.length,
            total: totalSlides,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // ──── Normal stage handling ────
      let result: any;

      switch (stage) {
        case "section_summarized":
          result = await summarizeSections(job);
          break;
        case "presentation_units_extracted":
          result = await extractPresentationUnits(
            job,
            stepOutputs.section_summarized
          );
          break;
        case "slide_planned":
          result = await planSlides(
            job,
            stepOutputs.presentation_units_extracted,
            stepOutputs.section_summarized
          );
          break;
        default:
          throw new Error(`Unknown stage: ${stage}`);
      }

      const durationMs = Date.now() - startTime;

      // Save step output
      await sb
        .from("ppt_job_steps")
        .update({
          step_status: "completed",
          step_output: result,
          duration_ms: durationMs,
          error_message: null,
        })
        .eq("job_id", jobId)
        .eq("step_name", stage);

      // Update job progress
      await sb
        .from("ppt_jobs")
        .update({ progress: STAGE_PROGRESS[stage as Stage] })
        .eq("id", jobId);

      // Chain to next stage (unless we should pause)
      const currentIdx = STAGES.indexOf(stage as Stage);
      if (
        currentIdx < STAGES.length - 1 &&
        !PAUSE_AFTER.has(stage)
      ) {
        const nextStage = STAGES[currentIdx + 1];
        const fnUrl = `${supabaseUrl}/functions/v1/run-ppt-job`;
        fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ jobId, stage: nextStage }),
        }).catch((e) => console.error("Failed to chain next stage:", e));
      }
      // If PAUSE_AFTER, we stop here. Frontend will trigger next stage.

      return new Response(
        JSON.stringify({ ok: true, stage, durationMs }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (stageError) {
      const durationMs = Date.now() - startTime;
      const errMsg =
        stageError instanceof Error
          ? stageError.message
          : "Unknown stage error";

      const { data: stepData } = await sb
        .from("ppt_job_steps")
        .select("retry_count")
        .eq("job_id", jobId)
        .eq("step_name", stage)
        .single();

      const retryCount = (stepData?.retry_count || 0) + 1;

      await sb
        .from("ppt_job_steps")
        .update({
          step_status: "failed",
          error_message: errMsg,
          duration_ms: durationMs,
          retry_count: retryCount,
        })
        .eq("job_id", jobId)
        .eq("step_name", stage);

      // Auto-retry up to 2 times
      if (retryCount <= 2) {
        console.log(
          `Auto-retrying stage ${stage}, attempt ${retryCount + 1}`
        );
        await sb
          .from("ppt_job_steps")
          .update({ step_status: "pending" })
          .eq("job_id", jobId)
          .eq("step_name", stage);

        const fnUrl = `${supabaseUrl}/functions/v1/run-ppt-job`;
        fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ jobId, stage }),
        }).catch((e) => console.error("Failed to retry:", e));
      } else {
        await sb
          .from("ppt_jobs")
          .update({
            status: "failed",
            error_message: `Stage ${stage} failed after ${retryCount} attempts: ${errMsg}`,
          })
          .eq("id", jobId);
      }

      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("run-ppt-job error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
