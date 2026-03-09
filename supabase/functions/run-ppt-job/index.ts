import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGES = ["section_summarized", "slide_planned", "slide_written", "design_decided", "rendered"] as const;
type Stage = typeof STAGES[number];

const STAGE_PROGRESS: Record<Stage, number> = {
  section_summarized: 20,
  slide_planned: 40,
  slide_written: 60,
  design_decided: 80,
  rendered: 100,
};

// ─── Helper: call DashScope with tool_choice ───
async function callAI(systemPrompt: string, userPrompt: string, toolDef: any, toolName: string) {
  const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
  if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY not configured");

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
      tools: [{ type: "function", function: toolDef }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI returned no tool call");

  return typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;
}

// ─── Stage 1: Summarize sections ───
async function summarizeSections(job: any): Promise<any> {
  const { outline, paper } = job.input_payload;
  const isEn = job.language === "en";

  const systemPrompt = isEn
    ? `You are an academic paper analysis expert. For each section in the outline, produce a concise summary, key points, and importance rating. Output via the tool call.`
    : `你是学术论文分析专家。为大纲中的每个章节生成摘要、关键要点和重要性评级。通过工具调用输出。`;

  const userPrompt = isEn
    ? `Paper: ${paper.title}\nAbstract: ${paper.abstract || "N/A"}\n\nOutline:\n${serializeOutline(outline)}\n\nSummarize each terminal section.`
    : `论文：${paper.title}\n摘要：${paper.abstract || "无"}\n\n大纲：\n${serializeOutline(outline)}\n\n请为每个末级章节生成摘要。`;

  const toolDef = {
    name: "output_section_summaries",
    description: "Output summaries for each outline section",
    parameters: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sectionId: { type: "string", description: "Outline node ID" },
              sectionTitle: { type: "string" },
              summary: { type: "string", description: "2-4 sentence summary" },
              keyPoints: { type: "array", items: { type: "string" }, description: "3-5 key points" },
              importance: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["sectionId", "sectionTitle", "summary", "keyPoints", "importance"],
          },
        },
      },
      required: ["sections"],
    },
  };

  return await callAI(systemPrompt, userPrompt, toolDef, "output_section_summaries");
}

// ─── Stage 2: Plan slides ───
async function planSlides(job: any, sectionSummaries: any): Promise<any> {
  const { paper } = job.input_payload;
  const isEn = job.language === "en";
  const targetCount = job.target_slide_count || 20;

  const templateDescMap: Record<string, Record<string, string>> = {
    zh: {
      seminar: "组会汇报版：批判性视角分析",
      course: "课程演示版：初学者友好",
      proposal: "开题综述版：研究脉络梳理",
      crossfield: "跨方向交流版：非专业听众",
    },
    en: {
      seminar: "Seminar: critical analysis",
      course: "Course: beginner-friendly",
      proposal: "Proposal/survey: research lineage",
      crossfield: "Cross-field: non-specialist audience",
    },
  };

  const lang = isEn ? "en" : "zh";
  const tplDesc = templateDescMap[lang]?.[job.selected_template] || templateDescMap[lang]?.seminar;

  const systemPrompt = isEn
    ? `You are a PPT structure planner. Given section summaries, plan ${targetCount} slides. Style: ${tplDesc}. Each slide maps to one or more sections. Assign layout types from: cover, agenda, title-bullets, two-column, comparison, timeline, data-card, summary. Max 30% title-bullets. Use at least 5 different layouts.`
    : `你是PPT结构规划专家。根据章节摘要规划约${targetCount}页PPT。风格：${tplDesc}。每页对应一个或多个章节。布局类型从以下选择：cover, agenda, title-bullets, two-column, comparison, timeline, data-card, summary。title-bullets最多30%，至少使用5种布局。`;

  const userPrompt = isEn
    ? `Paper: ${paper.title}\n\nSection Summaries:\n${JSON.stringify(sectionSummaries.sections, null, 2)}\n\nPlan ${targetCount} slides.`
    : `论文：${paper.title}\n\n章节摘要：\n${JSON.stringify(sectionSummaries.sections, null, 2)}\n\n请规划约${targetCount}页PPT。`;

  const toolDef = {
    name: "output_slide_plan",
    description: "Output the slide plan",
    parameters: {
      type: "object",
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideIndex: { type: "number" },
              title: { type: "string", description: "Max 20 chars" },
              objective: { type: "string", description: "What this slide communicates" },
              sourceSections: { type: "array", items: { type: "string" }, description: "Section IDs" },
              suggestedLayout: {
                type: "string",
                enum: ["cover", "agenda", "title-bullets", "two-column", "comparison", "timeline", "data-card", "summary"],
              },
              needsVisual: { type: "boolean" },
              visualType: { type: "string", enum: ["none", "chart", "diagram", "icon", "image"] },
            },
            required: ["slideIndex", "title", "objective", "sourceSections", "suggestedLayout"],
          },
        },
      },
      required: ["slides"],
    },
  };

  return await callAI(systemPrompt, userPrompt, toolDef, "output_slide_plan");
}

// ─── Stage 3: Write slide content ───
async function writeSlides(job: any, slidePlan: any, sectionSummaries: any): Promise<any> {
  const isEn = job.language === "en";
  const totalSlides = slidePlan.slides?.length || 0;

  // Degradation: if >25 slides, skip speaker notes
  const includeNotes = totalSlides <= 25;

  const systemPrompt = isEn
    ? `You are a PPT content writer. For each planned slide, write the actual content. Rules:
- Title: max 15 words
- Each bullet: 15-30 words, complete sentence
- Max 6 bullets per slide
- ${includeNotes ? "Include speaker notes (mainTalk, extraExplanation, transitionSentence) each max 100 words" : "Skip speaker notes to save tokens"}
- Include specific data, numbers, comparisons where available`
    : `你是PPT内容撰写专家。为每页规划好的PPT撰写实际内容。规则：
- 标题：最多15个字
- 每个要点：15-30字，完整句子
- 每页最多6个要点
- ${includeNotes ? "包含演讲注释（mainTalk, extraExplanation, transitionSentence），每项最多100字" : "跳过演讲注释以节省token"}
- 尽量包含具体数据、数值、对比`;

  const userPrompt = isEn
    ? `Slide Plan:\n${JSON.stringify(slidePlan.slides, null, 2)}\n\nSection Summaries for reference:\n${JSON.stringify(sectionSummaries.sections, null, 2)}\n\nWrite content for all ${totalSlides} slides.`
    : `幻灯片规划：\n${JSON.stringify(slidePlan.slides, null, 2)}\n\n章节摘要参考：\n${JSON.stringify(sectionSummaries.sections, null, 2)}\n\n请为全部${totalSlides}页PPT撰写内容。`;

  const noteProperties = includeNotes
    ? {
        notes: {
          type: "object",
          properties: {
            mainTalk: { type: "string" },
            extraExplanation: { type: "string" },
            transitionSentence: { type: "string" },
          },
          required: ["mainTalk", "extraExplanation", "transitionSentence"],
        },
      }
    : {};

  const noteRequired = includeNotes ? ["notes"] : [];

  const toolDef = {
    name: "output_slide_content",
    description: "Output written content for all slides",
    parameters: {
      type: "object",
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideIndex: { type: "number" },
              title: { type: "string" },
              subtitle: { type: "string" },
              bullets: {
                type: "array",
                items: { type: "string" },
                description: "Max 6 bullets, each 15-30 words",
              },
              ...noteProperties,
            },
            required: ["slideIndex", "title", "bullets", ...noteRequired],
          },
        },
      },
      required: ["slides"],
    },
  };

  return await callAI(systemPrompt, userPrompt, toolDef, "output_slide_content");
}

// ─── Stage 4: Decide design ───
async function decideDesign(job: any, slidePlan: any, slideContent: any): Promise<any> {
  const isEn = job.language === "en";

  const systemPrompt = isEn
    ? `You are a PPT design expert. For each slide, finalize the layout type, information density, and visual elements. Layout types: cover, agenda, title-bullets, two-column, comparison, timeline, data-card, summary. Ensure diversity: title-bullets max 30%, use at least 5 types.`
    : `你是PPT设计专家。为每页PPT确定最终布局、信息密度和视觉元素。布局类型：cover, agenda, title-bullets, two-column, comparison, timeline, data-card, summary。确保多样性：title-bullets最多30%，至少使用5种。`;

  const userPrompt = isEn
    ? `Slide Plan:\n${JSON.stringify(slidePlan.slides, null, 2)}\n\nSlide Content:\n${JSON.stringify(slideContent.slides, null, 2)}\n\nDecide final design for each slide.`
    : `幻灯片规划：\n${JSON.stringify(slidePlan.slides, null, 2)}\n\n幻灯片内容：\n${JSON.stringify(slideContent.slides, null, 2)}\n\n请为每页PPT确定最终设计。`;

  const toolDef = {
    name: "output_design_decisions",
    description: "Output design decisions for all slides",
    parameters: {
      type: "object",
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideIndex: { type: "number" },
              finalLayout: {
                type: "string",
                enum: ["cover", "agenda", "title-bullets", "two-column", "comparison", "timeline", "data-card", "summary"],
              },
              density: { type: "string", enum: ["low", "medium", "high"] },
              hasChart: { type: "boolean" },
              chartType: { type: "string", enum: ["none", "bar", "line", "pie", "flow"] },
              hasIcon: { type: "boolean" },
              emphasisStyle: { type: "string", enum: ["none", "highlight", "callout", "card"] },
            },
            required: ["slideIndex", "finalLayout", "density"],
          },
        },
      },
      required: ["slides"],
    },
  };

  return await callAI(systemPrompt, userPrompt, toolDef, "output_design_decisions");
}

// ─── Stage 5: Render (merge all data into final structure) ───
async function renderPpt(job: any, slideContent: any, designDecisions: any): Promise<any> {
  // This stage merges content + design into the final Slide[] format
  // compatible with the existing WorkspacePage component
  const slides = (slideContent.slides || []).map((sc: any, i: number) => {
    const dd = (designDecisions.slides || []).find((d: any) => d.slideIndex === sc.slideIndex) || {};

    // Map layout names to existing SlideLayout types
    const layoutMap: Record<string, string> = {
      "cover": "cover",
      "agenda": "title-points",
      "title-bullets": "title-points",
      "two-column": "title-two-column",
      "comparison": "title-two-column",
      "timeline": "title-timeline",
      "data-card": "title-findings",
      "summary": "title-summary",
    };

    const layout = layoutMap[dd.finalLayout || "title-bullets"] || "title-points";

    const contentBlocks = (sc.bullets || []).map((b: string, bi: number) => ({
      id: `s${i}-b${bi}`,
      type: layout === "title-timeline" ? "timeline-item" : layout === "title-findings" ? "finding" : "point",
      content: b,
    }));

    return {
      id: `slide-${i}`,
      order: i,
      title: sc.title || `Slide ${i + 1}`,
      layout,
      contentBlocks,
      notes: sc.notes || { mainTalk: "", extraExplanation: "", transitionSentence: "" },
      designMeta: {
        density: dd.density || "medium",
        hasChart: dd.hasChart || false,
        chartType: dd.chartType || "none",
        hasIcon: dd.hasIcon || false,
        emphasisStyle: dd.emphasisStyle || "none",
      },
    };
  });

  return { slides };
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

// ─── Main orchestrator ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobId, stage } = await req.json();
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

    // Check if job was cancelled
    if (job.status === "cancelled") {
      return new Response(JSON.stringify({ ok: true, cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update job status
    await sb.from("ppt_jobs").update({
      status: "running",
      current_stage: stage,
      progress: STAGE_PROGRESS[stage as Stage] - 10,
    }).eq("id", jobId);

    // Update step to running
    await sb.from("ppt_job_steps").update({
      step_status: "running",
    }).eq("job_id", jobId).eq("step_name", stage);

    const startTime = Date.now();

    try {
      // Load previous step outputs
      const { data: completedSteps } = await sb
        .from("ppt_job_steps")
        .select("step_name, step_output")
        .eq("job_id", jobId)
        .eq("step_status", "completed");

      const stepOutputs: Record<string, any> = {};
      for (const s of completedSteps || []) {
        stepOutputs[s.step_name] = s.step_output;
      }

      let result: any;

      switch (stage) {
        case "section_summarized":
          result = await summarizeSections(job);
          break;
        case "slide_planned":
          result = await planSlides(job, stepOutputs.section_summarized);
          break;
        case "slide_written":
          result = await writeSlides(job, stepOutputs.slide_planned, stepOutputs.section_summarized);
          break;
        case "design_decided":
          result = await decideDesign(job, stepOutputs.slide_planned, stepOutputs.slide_written);
          break;
        case "rendered":
          result = await renderPpt(job, stepOutputs.slide_written, stepOutputs.design_decided);
          break;
        default:
          throw new Error(`Unknown stage: ${stage}`);
      }

      const durationMs = Date.now() - startTime;

      // Save step output
      await sb.from("ppt_job_steps").update({
        step_status: "completed",
        step_output: result,
        duration_ms: durationMs,
        error_message: null,
      }).eq("job_id", jobId).eq("step_name", stage);

      // Update job progress
      await sb.from("ppt_jobs").update({
        progress: STAGE_PROGRESS[stage as Stage],
      }).eq("id", jobId);

      // Determine next stage
      const currentIdx = STAGES.indexOf(stage as Stage);
      if (currentIdx < STAGES.length - 1) {
        const nextStage = STAGES[currentIdx + 1];
        // Chain to next stage (fire-and-forget)
        const fnUrl = `${supabaseUrl}/functions/v1/run-ppt-job`;
        fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ jobId, stage: nextStage }),
        }).catch((e) => console.error("Failed to chain next stage:", e));
      } else {
        // All stages done
        await sb.from("ppt_jobs").update({
          status: "completed",
          progress: 100,
        }).eq("id", jobId);
      }

      return new Response(JSON.stringify({ ok: true, stage, durationMs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (stageError) {
      const durationMs = Date.now() - startTime;
      const errMsg = stageError instanceof Error ? stageError.message : "Unknown stage error";

      // Get current retry count
      const { data: stepData } = await sb
        .from("ppt_job_steps")
        .select("retry_count")
        .eq("job_id", jobId)
        .eq("step_name", stage)
        .single();

      const retryCount = (stepData?.retry_count || 0) + 1;

      // Update step as failed
      await sb.from("ppt_job_steps").update({
        step_status: "failed",
        error_message: errMsg,
        duration_ms: durationMs,
        retry_count: retryCount,
      }).eq("job_id", jobId).eq("step_name", stage);

      // Auto-retry up to 2 times
      if (retryCount <= 2) {
        console.log(`Auto-retrying stage ${stage}, attempt ${retryCount + 1}`);
        // Reset step status and retry
        await sb.from("ppt_job_steps").update({
          step_status: "pending",
        }).eq("job_id", jobId).eq("step_name", stage);

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
        // Max retries exceeded, mark job as failed
        await sb.from("ppt_jobs").update({
          status: "failed",
          error_message: `Stage ${stage} failed after ${retryCount} attempts: ${errMsg}`,
        }).eq("id", jobId);
      }

      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("run-ppt-job error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
