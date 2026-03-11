import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_DESC: Record<string, string> = {
  seminar: "组会汇报版：批判性视角，高信息密度，强调方法合理性和结果分析。",
  course: "课程演示版：初学者友好，循序渐进，强调概念解释。",
  proposal: "开题综述版：研究脉络导向，强调文献定位和延展价值。",
  crossfield: "跨方向交流版：低术语负担，强调意义和通俗理解。",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { jobId, slideNo, mode, slideContent } = await req.json();

    if (!jobId || !slideNo) {
      return new Response(
        JSON.stringify({ error: "Missing jobId or slideNo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job } = await sb
      .from("ppt_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (!job) throw new Error("Job not found");

    const { data: steps } = await sb
      .from("ppt_job_steps")
      .select("step_name, step_output")
      .eq("job_id", jobId)
      .eq("step_status", "completed");

    const stepOutputs: Record<string, any> = {};
    for (const s of steps || []) {
      if (s.step_output) stepOutputs[s.step_name] = s.step_output;
    }

    const slidePlan = stepOutputs.slide_planned;
    const presentationUnits = stepOutputs.presentation_units_extracted;
    const sectionSummaries = stepOutputs.section_summarized;
    const { paper } = job.input_payload as any;
    const style = job.selected_template || "seminar";
    const styleDesc = TEMPLATE_DESC[style] || TEMPLATE_DESC.seminar;

    const slideIdx = slideNo - 1;
    const plan = slidePlan?.slides?.[slideIdx];
    const prevPlan = slideIdx > 0 ? slidePlan?.slides?.[slideIdx - 1] : null;
    const nextPlan =
      slideIdx < (slidePlan?.slides?.length || 0) - 1
        ? slidePlan?.slides?.[slideIdx + 1]
        : null;

    // Find relevant context
    const relevantUnits = (presentationUnits?.units || []).filter((u: any) =>
      (plan?.coveredUnits || []).includes(u.unitId)
    );
    const relevantSectionIds = new Set<string>();
    for (const u of relevantUnits) {
      for (const sid of u.sourceSections || []) relevantSectionIds.add(sid);
    }
    const relevantSummaries = (sectionSummaries?.sections || []).filter(
      (s: any) => relevantSectionIds.has(s.id)
    );

    // Aggregate structure hints
    const aggregatedKeyNumbers = relevantSummaries.flatMap((s: any) => s.keyNumbers || []);
    const dominantRelation = relevantSummaries.length > 0 ? relevantSummaries[0].coreRelation : "none";
    const dominantPattern = relevantSummaries.length > 0 ? relevantSummaries[0].visualPattern : "bullets";
    const hints = relevantSummaries.map((s: any) => s.presentationHint).filter(Boolean);

    if (mode === "refresh-notes") {
      const systemPrompt = `你是学术导读PPT演讲注释专家。用户已经手动编辑了某一页PPT内容，你需要根据更新后的内容重新生成演讲注释。

## 规则
- mainTalk：这页该怎么讲（2-3句话，最多100字）
- extraExplanation：页面之外但讲者应知道的补充（最多100字）
- transitionSentence：过渡到下一页的衔接语（最多50字）
- notes 不是复读页面内容，要提供讲解策略和补充信息

汇报风格：${styleDesc}`;

      const userPrompt = `当前页内容：
标题：${slideContent?.title || plan?.title || ""}
布局：${slideContent?.layout || plan?.layout || ""}
内容块：${JSON.stringify(slideContent?.contentBlocks || [])}

页面结构信息：
pageGoal：${plan?.pageGoal || "无"}
primaryMessage：${plan?.primaryMessage || "无"}

下一页：${nextPlan ? nextPlan.title : "无（最后一页）"}

请根据以上内容重新生成演讲注释。`;

      const result = await callAI(
        systemPrompt,
        userPrompt,
        {
          name: "update_notes",
          description: "Generate updated speaker notes",
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
        "update_notes"
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === 'regenerate'
    const systemPrompt = `你是学术导读PPT内容撰写专家。你正在重新生成一页PPT内容。

## 汇报风格
${styleDesc}

## ❗ 核心规则：内容组织必须服从 contentStructure 和 groupingLogic

### contentStructure → 内容块组织方式
- **linear**：按逻辑顺序排列 point 块，用 subpoint 补充细节
- **grouped**：用 heading 块做分组标题，每组下 2-3 个 point/finding 块
- **contrasted**：用 heading 块标示对比维度，两侧各用 point/finding 展示
- **layered**：先用 summary/text 给总论，再用 point/finding 展开分论
- **highlighted**：1-2 个 finding 块做核心高亮，辅以 point/subpoint 做支撑说明

### visualPriority → 内容重点
- **text**：以文字描述为主
- **data**：以 finding 块突出数据和指标
- **structure**：用 heading 分区 + point/subpoint 展示层次
- **comparison**：用 heading 标示对比项，finding/point 展示差异

## 内容块类型
point, subpoint, finding, summary, text, heading

## 布局与内容块匹配规则
- cover：2-3个text块
- title-bullets：4-6个point块
- two-column：heading + point/finding 交替（至少2个heading做栏分隔）
- comparison：heading + finding 交替（至少2个heading标示对比项）
- timeline：point块按时间排列，可用heading标示阶段
- data-card：3-5个finding块为主
- summary：3-5个summary块

## 质量要求
- 标题最多15字
- 每个要点15-30字完整句子
- 每页4-8个内容块
- 如果有关键数据必须用 finding 块体现
- Notes 不是复读内容，要提供讲解策略`;

    const userPrompt = `论文标题：${paper?.title || ""}
汇报风格：${style}
重新生成第 ${slideNo} 页

═══ 当前页规划 ═══
${plan ? JSON.stringify(plan) : "无"}

═══ 页面结构指令（必须遵守）═══
pageGoal：${plan?.pageGoal || "无"}
primaryMessage：${plan?.primaryMessage || "无"}
secondaryMessage：${plan?.secondaryMessage || "无"}
visualPriority：${plan?.visualPriority || "text"}
contentStructure：${plan?.contentStructure || "linear"}
groupingLogic：${plan?.groupingLogic || "无"}

═══ 来自摘要层的结构线索 ═══
关键数据：${aggregatedKeyNumbers.length > 0 ? aggregatedKeyNumbers.join("；") : "无"}
核心关系类型：${dominantRelation}
推荐视觉模式：${dominantPattern}
展示建议：${hints.length > 0 ? hints.join("；") : "无"}

前一页：${prevPlan ? `${prevPlan.title}（${prevPlan.purpose}）` : "无"}
下一页：${nextPlan ? `${nextPlan.title}（${nextPlan.purpose}）` : "无"}

相关展示单元：${JSON.stringify(relevantUnits)}
相关章节摘要：${JSON.stringify(relevantSummaries)}

请重新生成这一页的完整内容。
重要：内容组织必须服从 contentStructure="${plan?.contentStructure || "linear"}"，不要退化成纯列表。`;

    const result = await callAI(
      systemPrompt,
      userPrompt,
      {
        name: "output_slide",
        description: "Output regenerated slide content",
        parameters: {
          type: "object",
          properties: {
            slideNo: { type: "number" },
            title: { type: "string" },
            layout: {
              type: "string",
              enum: ["cover", "agenda", "title-bullets", "two-column", "comparison", "timeline", "data-card", "summary"],
            },
            contentBlocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["point", "subpoint", "finding", "summary", "text", "heading"] },
                  text: { type: "string" },
                },
                required: ["type", "text"],
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
          required: ["slideNo", "title", "layout", "contentBlocks", "notes"],
        },
      },
      "output_slide"
    );

    result.slideNo = slideNo;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-single-slide error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
