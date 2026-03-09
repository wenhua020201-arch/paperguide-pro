
-- Job status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Step status enum  
CREATE TYPE public.step_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- Step name enum
CREATE TYPE public.step_name AS ENUM ('section_summarized', 'slide_planned', 'slide_written', 'design_decided', 'rendered');

-- Main jobs table
CREATE TABLE public.ppt_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.job_status NOT NULL DEFAULT 'pending',
  current_stage public.step_name,
  progress INTEGER NOT NULL DEFAULT 0,
  input_payload JSONB NOT NULL,
  selected_template TEXT NOT NULL DEFAULT 'seminar',
  presentation_style TEXT NOT NULL DEFAULT 'standard',
  language TEXT NOT NULL DEFAULT 'zh',
  target_slide_count INTEGER NOT NULL DEFAULT 20,
  result_file_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Steps table for intermediate results
CREATE TABLE public.ppt_job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ppt_jobs(id) ON DELETE CASCADE,
  step_name public.step_name NOT NULL,
  step_status public.step_status NOT NULL DEFAULT 'pending',
  step_input JSONB,
  step_output JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, step_name)
);

-- Index for fast job lookups
CREATE INDEX idx_ppt_jobs_status ON public.ppt_jobs(status);
CREATE INDEX idx_ppt_job_steps_job_id ON public.ppt_job_steps(job_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppt_jobs_updated_at
  BEFORE UPDATE ON public.ppt_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER ppt_job_steps_updated_at
  BEFORE UPDATE ON public.ppt_job_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Disable RLS for now (public access, no auth required)
ALTER TABLE public.ppt_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppt_job_steps ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth for MVP)
CREATE POLICY "Allow all on ppt_jobs" ON public.ppt_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ppt_job_steps" ON public.ppt_job_steps FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.ppt_jobs;
