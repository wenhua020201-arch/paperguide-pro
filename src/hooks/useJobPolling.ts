import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JobStep {
  id: string;
  job_id: string;
  step_name: string;
  step_status: string;
  step_input: any;
  step_output: any;
  retry_count: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  status: string;
  current_stage: string | null;
  progress: number;
  input_payload: any;
  selected_template: string;
  presentation_style: string;
  language: string;
  target_slide_count: number;
  result_file_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobState {
  job: Job | null;
  steps: JobStep[];
  loading: boolean;
  error: string | null;
}

export function useJobPolling(jobId: string | null) {
  const [state, setState] = useState<JobState>({
    job: null,
    steps: [],
    loading: false,
    error: null,
  });
  const intervalRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-job-status', {
        body: { jobId },
      });

      if (error) throw error;

      setState((prev) => ({
        ...prev,
        job: data.job,
        steps: data.steps || [],
        loading: false,
        error: null,
      }));

      // Stop polling if terminal state
      if (data.job?.status === 'completed' || data.job?.status === 'failed' || data.job?.status === 'cancelled') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch job status',
      }));
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    setState((prev) => ({ ...prev, loading: true }));
    fetchStatus();

    // Poll every 3 seconds
    intervalRef.current = window.setInterval(fetchStatus, 3000);

    // Also subscribe to realtime updates
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ppt_jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchStatus]);

  const retryStep = useCallback(async (stepName: string) => {
    if (!jobId) return;
    await supabase.functions.invoke('retry-job-step', {
      body: { jobId, stepName },
    });
    fetchStatus();
  }, [jobId, fetchStatus]);

  return { ...state, retryStep, refetch: fetchStatus };
}
