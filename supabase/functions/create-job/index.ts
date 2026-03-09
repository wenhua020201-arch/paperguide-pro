import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { outline, paper, template, density, language, targetSlideCount } = await req.json();

    if (!outline || !paper) {
      return new Response(JSON.stringify({ error: "Missing outline or paper" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Create job record
    const { data: job, error: jobError } = await sb
      .from("ppt_jobs")
      .insert({
        status: "pending",
        input_payload: { outline, paper },
        selected_template: template || "seminar",
        presentation_style: density || "standard",
        language: language || "zh",
        target_slide_count: targetSlideCount || 20,
        progress: 0,
      })
      .select("id")
      .single();

    if (jobError) throw jobError;

    // Pre-create all step records
    const steps = [
      "section_summarized",
      "slide_planned",
      "slide_written",
      "design_decided",
      "rendered",
    ];
    const stepInserts = steps.map((name) => ({
      job_id: job.id,
      step_name: name,
      step_status: "pending",
    }));

    const { error: stepsError } = await sb.from("ppt_job_steps").insert(stepInserts);
    if (stepsError) throw stepsError;

    // Fire-and-forget: trigger the first stage
    const fnUrl = `${supabaseUrl}/functions/v1/run-ppt-job`;
    fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ jobId: job.id, stage: "section_summarized" }),
    }).catch((e) => console.error("Failed to trigger run-ppt-job:", e));

    return new Response(JSON.stringify({ jobId: job.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-job error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
