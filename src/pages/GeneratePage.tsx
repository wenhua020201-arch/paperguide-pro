import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronRight,
  ArrowLeft, Eye, AlertTriangle, Clock, Play, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useJobPolling, PIPELINE_STAGE_ORDER, type JobStep } from '@/hooks/useJobPolling';
import { LAYOUT_MAP } from '@/types/pipeline';
import type { Slide, ContentBlock } from '@/types';

const STAGE_INFO: Record<string, { zh: string; icon: string }> = {
  section_summarized: { zh: '章节摘要生成', icon: '📝' },
  presentation_units_extracted: { zh: '风格化内容提炼', icon: '🎯' },
  slide_planned: { zh: 'PPT 结构规划', icon: '📋' },
  slides_generated: { zh: '逐页内容生成', icon: '✍️' },
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'running': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'failed': return <XCircle className="w-5 h-5 text-destructive" />;
    default: return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const statusBadge = (status: string) => {
  const variants: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    failed: 'bg-destructive/10 text-destructive',
    pending: 'bg-muted text-muted-foreground',
  };
  return <Badge className={variants[status] || variants.pending}>{status}</Badge>;
};

export default function GeneratePage() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { job, steps, loading, error, retryStep, triggerStage } = useJobPolling(jobId);

  // Create job on mount
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
          // Save jobId for workspace context
          data.jobId = result.jobId;
          localStorage.setItem('current_project', JSON.stringify(data));
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

  // Check if pipeline is waiting for user confirmation (slide_planned done, slides_generated pending)
  const slidePlanStep = steps.find(s => s.step_name === 'slide_planned');
  const slidesGenStep = steps.find(s => s.step_name === 'slides_generated');
  const awaitingConfirmation =
    slidePlanStep?.step_status === 'completed' &&
    slidesGenStep?.step_status === 'pending';

  const handleConfirmAndGenerate = () => {
    triggerStage('slides_generated');
    toast.success('开始逐页生成 PPT 内容...');
  };

  const handleViewWorkspace = () => {
    const genStep = steps.find(
      s => s.step_name === 'slides_generated' && s.step_status === 'completed'
    );
    const slideResults = genStep?.step_output?.slides;
    if (!slideResults) return;

    // Convert pipeline SlideResult[] → workspace Slide[]
    const workspaceSlides: Slide[] = slideResults.map((sr: any, i: number) => {
      const wsLayout = LAYOUT_MAP[sr.layout as keyof typeof LAYOUT_MAP] || 'title-points';
      const contentBlocks: ContentBlock[] = (sr.contentBlocks || []).map(
        (b: any, bi: number) => ({
          id: `s${i}-b${bi}`,
          type: b.type === 'heading' ? 'heading' : b.type === 'finding' ? 'finding' : b.type === 'summary' ? 'summary' : b.type === 'subpoint' ? 'subpoint' : b.type === 'text' ? 'text' : 'point',
          content: b.text || b.content || '',
        })
      );

      return {
        id: `slide-${i}`,
        order: i,
        title: sr.title || `Slide ${i + 1}`,
        layout: wsLayout as any,
        contentBlocks,
        notes: {
          mainTalk: sr.notes?.mainTalk || '',
          extraExplanation: sr.notes?.extraExplanation || '',
          transitionSentence: sr.notes?.transitionSentence || '',
          tone: 'natural' as const,
        },
      };
    });

    const saved = localStorage.getItem('current_project');
    const data = saved ? JSON.parse(saved) : {};
    data.slides = workspaceSlides;
    data.article = { sections: [] };
    localStorage.setItem('current_project', JSON.stringify(data));
    navigate('/workspace');
  };

  const sortedSteps = PIPELINE_STAGE_ORDER.map(name =>
    steps.find(s => s.step_name === name)
  ).filter(Boolean) as JobStep[];

  // Per-slide progress
  const slidesOutput = slidesGenStep?.step_output;
  const generatedCount = slidesOutput?.generatedCount || 0;
  const totalCount = slidesOutput?.totalCount || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/template')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold text-foreground">PPT 生成流水线</h1>
        </div>
        {job?.status === 'completed' && (
          <Button onClick={handleViewWorkspace} className="gap-2">
            <Eye className="w-4 h-4" />
            进入工作台
          </Button>
        )}
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Overall Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">总体进度</CardTitle>
              {job && statusBadge(job.status)}
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={job?.progress || 0} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">
              {creating
                ? '创建任务中...'
                : awaitingConfirmation
                ? '🔔 结构规划已完成，请确认后开始逐页生成'
                : job?.status === 'completed'
                ? '✅ 所有阶段已完成！'
                : job?.status === 'failed'
                ? `❌ 失败阶段：${STAGE_INFO[job.current_stage || '']?.zh || job.current_stage}`
                : slidesGenStep?.step_status === 'running'
                ? `✍️ 正在生成第 ${generatedCount + 1}/${totalCount} 页...`
                : job?.current_stage
                ? `${STAGE_INFO[job.current_stage]?.icon || ''} ${STAGE_INFO[job.current_stage]?.zh || ''}...`
                : '初始化中...'}
            </p>
            {job?.error_message && (
              <div className="mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{job.error_message}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Banner */}
        {awaitingConfirmation && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-foreground mb-1">
                      📋 PPT 结构规划已完成
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      共规划 {slidePlanStep?.step_output?.totalSlides || '?'} 页，请查看下方规划详情后确认开始生成
                    </p>
                  </div>
                  <Button onClick={handleConfirmAndGenerate} className="gap-2">
                    <Play className="w-4 h-4" />
                    确认并开始生成
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pipeline Stages */}
        <div className="space-y-3">
          {sortedSteps.map((step) => {
            const info = STAGE_INFO[step.step_name];
            const isExpanded = expandedStep === step.step_name;
            const hasOutput = step.step_status === 'completed' || (step.step_status === 'running' && step.step_output);

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
                    <span className="font-medium flex-1">{info?.zh}</span>

                    {/* Per-slide progress */}
                    {step.step_name === 'slides_generated' && step.step_status === 'running' && totalCount > 0 && (
                      <span className="text-xs text-primary font-medium mr-2">
                        {generatedCount}/{totalCount} 页
                      </span>
                    )}

                    {step.duration_ms && (
                      <span className="text-xs text-muted-foreground mr-2">
                        {(step.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    {step.retry_count > 0 && (
                      <Badge variant="outline" className="mr-2 text-xs">
                        重试 {step.retry_count}
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
                          toast.info(`重试 ${info?.zh}...`);
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        重试
                      </Button>
                    )}
                    {hasOutput && (
                      isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  {step.error_message && (
                    <div className="px-4 pb-3">
                      <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                        {step.error_message}
                      </div>
                    </div>
                  )}

                  {isExpanded && hasOutput && step.step_output && (
                    <div className="px-4 pb-4 border-t border-border">
                      <div className="mt-3 max-h-96 overflow-y-auto">
                        <StepOutputPreview stepName={step.step_name} output={step.step_output} />
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Loading placeholder */}
        {sortedSteps.length === 0 && !creating && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>加载任务状态中...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Output Previews ───
function StepOutputPreview({ stepName, output }: { stepName: string; output: any }) {
  switch (stepName) {
    case 'section_summarized':
      return (
        <div className="space-y-3">
          {output?.sections?.map((s: any, i: number) => (
            <div key={i} className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{s.title}</span>
                <Badge variant="outline" className="text-xs">{s.importance}</Badge>
                <Badge variant="outline" className="text-xs">{s.nodeType}</Badge>
                {!s.slideWorthy && (
                  <Badge variant="secondary" className="text-xs">跳过</Badge>
                )}
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

    case 'presentation_units_extracted':
      return (
        <div className="space-y-2">
          <div className="mb-2">
            <Badge className="text-xs">{output?.style}</Badge>
          </div>
          {output?.units?.map((u: any, i: number) => (
            <div key={i} className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{u.title}</span>
                <Badge variant="outline" className="text-xs">{u.importance}</Badge>
                <Badge variant="outline" className="text-xs">深度: {u.recommendedDepth}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{u.focus}</p>
              {u.suggestedRole && (
                <p className="text-xs text-primary/80 mt-1">角色: {u.suggestedRole}</p>
              )}
            </div>
          ))}
        </div>
      );

    case 'slide_planned':
      return (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground mb-2">
            共 {output?.totalSlides} 页
          </p>
          {output?.slides?.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded text-sm">
              <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                {s.slideNo}
              </span>
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium flex-1">{s.title}</span>
              <Badge variant="outline" className="text-xs">{s.layout}</Badge>
              <Badge
                variant="secondary"
                className="text-xs"
              >
                {s.role}
              </Badge>
            </div>
          ))}
        </div>
      );

    case 'slides_generated':
      const slides = output?.slides || [];
      const generated = output?.generatedCount || slides.length;
      const total = output?.totalCount || generated;
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            已生成 {generated}/{total} 页
          </p>
          {slides.map((s: any, i: number) => (
            <div key={i} className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">{s.slideNo}</span>
                <span className="font-medium text-sm flex-1">{s.title}</span>
                <Badge variant="outline" className="text-xs">{s.layout}</Badge>
              </div>
              <ul className="text-xs space-y-0.5 mt-1">
                {s.contentBlocks?.slice(0, 3).map((b: any, bi: number) => (
                  <li key={bi} className="text-muted-foreground truncate">
                    • {b.text || b.content}
                  </li>
                ))}
                {(s.contentBlocks?.length || 0) > 3 && (
                  <li className="text-muted-foreground/60">+{s.contentBlocks.length - 3} more...</li>
                )}
              </ul>
            </div>
          ))}
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
