import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronRight,
  Download, ArrowLeft, Eye, AlertTriangle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useJobPolling, type JobStep } from '@/hooks/useJobPolling';

const STAGE_INFO: Record<string, { zh: string; en: string; icon: string }> = {
  section_summarized: { zh: '章节摘要生成', en: 'Summarizing Sections', icon: '📝' },
  slide_planned: { zh: '幻灯片规划', en: 'Planning Slides', icon: '📋' },
  slide_written: { zh: '内容撰写', en: 'Writing Content', icon: '✍️' },
  design_decided: { zh: '设计决策', en: 'Deciding Design', icon: '🎨' },
  rendered: { zh: '渲染合成', en: 'Rendering', icon: '🖼️' },
};

const STAGE_ORDER = ['section_summarized', 'slide_planned', 'slide_written', 'design_decided', 'rendered'];

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'running': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
    default: return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const statusBadge = (status: string) => {
  const variants: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-muted text-muted-foreground',
  };
  return <Badge className={variants[status] || variants.pending}>{status}</Badge>;
};

export default function GeneratePage() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { job, steps, loading, error, retryStep } = useJobPolling(jobId);

  // On mount, create the job from localStorage data
  useEffect(() => {
    const createJob = async () => {
      const saved = localStorage.getItem('current_project');
      if (!saved) {
        toast.error('没有找到项目数据，请先上传论文');
        navigate('/upload');
        return;
      }

      const data = JSON.parse(saved);
      if (!data.outline || !data.paper) {
        toast.error('缺少大纲或论文数据');
        navigate('/outline');
        return;
      }

      setCreating(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('create-job', {
          body: {
            outline: data.outline,
            paper: data.paper,
            template: data.template || 'seminar',
            density: data.density || 'standard',
            language: data.language || 'zh',
            targetSlideCount: data.targetSlideCount || 20,
          },
        });

        if (error) throw error;
        if (result?.jobId) {
          setJobId(result.jobId);
          toast.success('任务已创建，开始生成...');
        } else {
          throw new Error('未返回 jobId');
        }
      } catch (e) {
        toast.error(`创建任务失败: ${e instanceof Error ? e.message : '未知错误'}`);
      } finally {
        setCreating(false);
      }
    };

    createJob();
  }, [navigate]);

  const handleViewWorkspace = () => {
    // Find rendered output and save to localStorage
    const renderedStep = steps.find(s => s.step_name === 'rendered' && s.step_status === 'completed');
    if (renderedStep?.step_output?.slides) {
      const saved = localStorage.getItem('current_project');
      const data = saved ? JSON.parse(saved) : {};
      data.slides = renderedStep.step_output.slides;
      data.article = { sections: [] }; // Placeholder
      localStorage.setItem('current_project', JSON.stringify(data));
      navigate('/workspace');
    }
  };

  const sortedSteps = STAGE_ORDER.map(name =>
    steps.find(s => s.step_name === name)
  ).filter(Boolean) as JobStep[];

  const language = (() => {
    try {
      const saved = localStorage.getItem('current_project');
      return saved ? JSON.parse(saved).language || 'zh' : 'zh';
    } catch { return 'zh'; }
  })();
  const isEn = language === 'en';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/template')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">{isEn ? 'PPT Generation' : 'PPT 生成中'}</h1>
        </div>
        {job?.status === 'completed' && (
          <Button onClick={handleViewWorkspace} className="gap-2">
            <Eye className="w-4 h-4" />
            {isEn ? 'View Workspace' : '查看工作台'}
          </Button>
        )}
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Overall Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {isEn ? 'Overall Progress' : '总体进度'}
              </CardTitle>
              {job && statusBadge(job.status)}
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={job?.progress || 0} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">
              {creating ? (isEn ? 'Creating job...' : '创建任务中...') :
               job?.status === 'completed' ? (isEn ? 'All stages completed!' : '所有阶段已完成！') :
               job?.status === 'failed' ? (isEn ? `Failed at: ${job.current_stage}` : `失败阶段：${job.current_stage}`) :
               job?.current_stage ? `${STAGE_INFO[job.current_stage]?.icon || ''} ${isEn ? STAGE_INFO[job.current_stage]?.en : STAGE_INFO[job.current_stage]?.zh}...` :
               isEn ? 'Initializing...' : '初始化中...'}
            </p>
            {job?.error_message && (
              <div className="mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{job.error_message}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stage Steps */}
        <div className="space-y-3">
          {sortedSteps.map((step) => {
            const info = STAGE_INFO[step.step_name];
            const isExpanded = expandedStep === step.step_name;
            const hasOutput = step.step_status === 'completed' && step.step_output;

            return (
              <motion.div
                key={step.step_name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={step.step_status === 'running' ? 'ring-2 ring-primary/30' : ''}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedStep(isExpanded ? null : step.step_name)}
                  >
                    {statusIcon(step.step_status)}
                    <span className="text-lg mr-1">{info?.icon}</span>
                    <span className="font-medium flex-1">
                      {isEn ? info?.en : info?.zh}
                    </span>
                    {step.duration_ms && (
                      <span className="text-xs text-muted-foreground mr-2">
                        {(step.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    {step.retry_count > 0 && (
                      <Badge variant="outline" className="mr-2 text-xs">
                        {isEn ? `Retry ${step.retry_count}` : `重试 ${step.retry_count}`}
                      </Badge>
                    )}
                    {step.step_status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          retryStep(step.step_name);
                          toast.info(isEn ? `Retrying ${info?.en}...` : `重试 ${info?.zh}...`);
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {isEn ? 'Retry' : '重试'}
                      </Button>
                    )}
                    {hasOutput
                      ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
                      : null}
                  </div>

                  {/* Error */}
                  {step.error_message && (
                    <div className="px-4 pb-3">
                      <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                        {step.error_message}
                      </div>
                    </div>
                  )}

                  {/* Expanded output preview */}
                  {isExpanded && hasOutput && (
                    <div className="px-4 pb-4 border-t">
                      <div className="mt-3 max-h-80 overflow-y-auto">
                        <StepOutputPreview stepName={step.step_name} output={step.step_output} isEn={isEn} />
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Placeholder while no steps yet */}
        {sortedSteps.length === 0 && !creating && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>{isEn ? 'Loading job status...' : '加载任务状态中...'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Output Preview Component ───
function StepOutputPreview({ stepName, output, isEn }: { stepName: string; output: any; isEn: boolean }) {
  switch (stepName) {
    case 'section_summarized':
      return (
        <div className="space-y-3">
          {output?.sections?.map((s: any, i: number) => (
            <div key={i} className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{s.sectionTitle}</span>
                <Badge variant="outline" className="text-xs">{s.importance}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{s.summary}</p>
              <ul className="text-xs space-y-1">
                {s.keyPoints?.map((kp: string, ki: number) => (
                  <li key={ki} className="flex items-start gap-1">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case 'slide_planned':
      return (
        <div className="space-y-2">
          {output?.slides?.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded text-sm">
              <span className="font-mono text-xs text-muted-foreground w-6">{s.slideIndex + 1}</span>
              <span className="font-medium flex-1">{s.title}</span>
              <Badge variant="outline" className="text-xs">{s.suggestedLayout}</Badge>
              {s.needsVisual && <span className="text-xs">🖼️</span>}
            </div>
          ))}
        </div>
      );

    case 'slide_written':
      return (
        <div className="space-y-3">
          {output?.slides?.slice(0, 5).map((s: any, i: number) => (
            <div key={i} className="p-3 bg-muted/50 rounded-md">
              <p className="font-medium text-sm mb-2">{s.title}</p>
              <ul className="text-xs space-y-1">
                {s.bullets?.slice(0, 4).map((b: string, bi: number) => (
                  <li key={bi}>• {b}</li>
                ))}
              </ul>
              {s.bullets?.length > 4 && (
                <p className="text-xs text-muted-foreground mt-1">+{s.bullets.length - 4} more...</p>
              )}
            </div>
          ))}
          {output?.slides?.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              {isEn ? `...and ${output.slides.length - 5} more slides` : `...还有 ${output.slides.length - 5} 页`}
            </p>
          )}
        </div>
      );

    case 'design_decided':
      return (
        <div className="grid grid-cols-2 gap-2">
          {output?.slides?.map((s: any, i: number) => (
            <div key={i} className="p-2 bg-muted/50 rounded text-xs flex items-center gap-2">
              <span className="font-mono text-muted-foreground">{s.slideIndex + 1}</span>
              <Badge variant="outline">{s.finalLayout}</Badge>
              <span className="text-muted-foreground">{s.density}</span>
            </div>
          ))}
        </div>
      );

    case 'rendered':
      return (
        <div className="text-center py-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-medium">
            {isEn
              ? `${output?.slides?.length || 0} slides generated successfully!`
              : `成功生成 ${output?.slides?.length || 0} 页幻灯片！`}
          </p>
        </div>
      );

    default:
      return (
        <pre className="text-xs overflow-auto p-2 bg-muted rounded">
          {JSON.stringify(output, null, 2).slice(0, 2000)}
        </pre>
      );
  }
}
