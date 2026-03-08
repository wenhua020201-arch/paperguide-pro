import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Check, Users, BookOpen, Search, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TemplateName, ContentDensity } from '@/types';

const TEMPLATE_ICONS: Record<TemplateName, typeof Users> = {
  seminar: Users,
  course: BookOpen,
  proposal: Search,
  crossfield: Globe,
};

const DENSITIES: { value: ContentDensity; label: string; desc: string }[] = [
  { value: 'concise', label: '简洁', desc: '仅保留核心结论' },
  { value: 'standard', label: '标准', desc: '要点 + 简要说明' },
  { value: 'detailed', label: '详细', desc: '完整论证与细节' },
];

// Fallback static previews
const FALLBACK_PREVIEWS: Record<TemplateName, { title: string; points: string[]; accent: string }[]> = {
  seminar: [
    { title: '研究问题与假设', points: ['核心假设与动机', '现有方法的局限'], accent: 'hsl(215, 65%, 42%)' },
    { title: '方法设计与创新', points: ['模型架构概览', '关键创新点', '与 baseline 对比'], accent: 'hsl(195, 70%, 45%)' },
    { title: '批判性讨论', points: ['实验是否充分？', '可复现性评价'], accent: 'hsl(155, 60%, 42%)' },
  ],
  course: [
    { title: '背景知识回顾', points: ['领域概述', '核心概念解释', '为什么重要？'], accent: 'hsl(260, 55%, 50%)' },
    { title: '论文主要贡献', points: ['主要创新', '解决了什么问题'], accent: 'hsl(215, 65%, 42%)' },
    { title: '总结与延伸', points: ['关键 takeaway', '延伸阅读建议'], accent: 'hsl(45, 80%, 50%)' },
  ],
  proposal: [
    { title: '研究脉络梳理', points: ['相关工作梳理', '研究演进时间线'], accent: 'hsl(340, 60%, 50%)' },
    { title: '方法对比分析', points: ['方法 A vs B vs C', '优缺点分析'], accent: 'hsl(215, 65%, 42%)' },
    { title: '研究启发', points: ['开放问题', '可能的研究方向'], accent: 'hsl(155, 60%, 42%)' },
  ],
  crossfield: [
    { title: '一句话解释', points: ['直觉类比', '无术语版本'], accent: 'hsl(25, 70%, 50%)' },
    { title: '为什么值得关注', points: ['跨领域影响', '实际应用场景'], accent: 'hsl(195, 70%, 45%)' },
    { title: '核心发现', points: ['简化版结果', '一张图看懂'], accent: 'hsl(260, 55%, 50%)' },
  ],
};

const DENSITY_PREVIEW: Record<ContentDensity, { title: string; points: string[] }> = {
  concise: { title: '核心架构', points: ['多头自注意力', '残差 + LayerNorm'] },
  standard: { title: '核心架构', points: ['编码器-解码器各 6 层', '多头自注意力（Multi-Head）', '残差连接 + 层归一化', '前馈网络（FFN）'] },
  detailed: { title: '核心架构', points: ['编码器-解码器各 6 层，每层两个子层', '多头自注意力：Q/K/V 投影到 h 个子空间并行计算', 'Attention(Q,K,V) = softmax(QK^T/√d_k)V', '残差连接 + 层归一化保证梯度流通', '位置编码：正弦/余弦函数注入位置信息', 'FFN：两层线性变换 + ReLU 激活'] },
};

function MiniSlide({ title, points, accent }: { title: string; points: string[]; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 relative overflow-hidden aspect-[16/10]">
      <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full" style={{ background: accent, opacity: 0.12 }} />
      <div className="w-6 h-0.5 rounded-full mb-1.5" style={{ background: accent }} />
      <p className="text-[10px] font-display font-semibold text-foreground mb-1.5 leading-tight">{title}</p>
      <div className="space-y-0.5">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="w-1 h-1 rounded-full mt-1 flex-shrink-0" style={{ background: accent }} />
            <span className="text-[8px] text-muted-foreground leading-tight">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DensitySlide({ title, points, active }: { title: string; points: string[]; active: boolean }) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 relative overflow-hidden aspect-[16/10] transition-colors ${active ? 'border-primary' : 'border-border'}`}>
      <div className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-primary/10" />
      <div className="w-6 h-0.5 rounded-full bg-primary/60 mb-1.5" />
      <p className="text-[10px] font-display font-semibold text-foreground mb-1.5 leading-tight">{title}</p>
      <div className="space-y-0.5">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <span className="text-[8px] text-muted-foreground leading-tight">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TemplatePage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TemplateName>('seminar');
  const [density, setDensity] = useState<ContentDensity>('standard');
  const [aiPreviews, setAiPreviews] = useState<Record<TemplateName, { title: string; points: string[]; accent: string }[]> | null>(null);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  // Load AI-generated previews on mount
  useEffect(() => {
    const generatePreviews = async () => {
      try {
        const saved = localStorage.getItem('current_project');
        if (!saved) return;
        const data = JSON.parse(saved);
        if (!data.paper || !data.outline) return;

        setLoadingPreviews(true);
        const { data: result, error } = await supabase.functions.invoke('template-preview', {
          body: { paper: data.paper, outline: data.outline },
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        // Validate we got all 4 templates
        if (result.seminar && result.course && result.proposal && result.crossfield) {
          setAiPreviews(result);
        }
      } catch (e: any) {
        console.error('Template preview error:', e);
        // Silently fall back to static previews
      } finally {
        setLoadingPreviews(false);
      }
    };
    generatePreviews();
  }, []);

  const getPreviews = (templateId: TemplateName) => {
    return aiPreviews?.[templateId] || FALLBACK_PREVIEWS[templateId];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/outline')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">选择汇报模板</h1>
          {loadingPreviews && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI 生成预览中…
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-6">
            {TEMPLATES.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id];
              const isSelected = selected === tpl.id;
              const previews = getPreviews(tpl.id);
              return (
                <motion.div
                  key={tpl.id}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => setSelected(tpl.id)}
                  className={`relative bg-card border-2 rounded-xl p-5 cursor-pointer transition-colors ${
                    isSelected ? 'border-primary' : 'border-border hover:border-primary/30'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground mb-1">{tpl.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{tpl.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tpl.tags.map(tag => (
                          <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pl-12">
                    {previews.map((s, i) => (
                      <MiniSlide key={i} {...s} />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Density selector */}
          <div>
            <p className="text-sm font-medium text-foreground mb-4">内容密度</p>
            <div className="grid grid-cols-3 gap-4">
              {DENSITIES.map(d => {
                const preview = DENSITY_PREVIEW[d.value];
                const isActive = density === d.value;
                return (
                  <div key={d.value} onClick={() => setDensity(d.value)} className="cursor-pointer">
                    <DensitySlide title={preview.title} points={preview.points} active={isActive} />
                    <div className="mt-2 text-center">
                      <p className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <div className="border-t border-border px-6 py-4 flex justify-end">
        <Button size="lg" onClick={() => {
          try {
            const saved = localStorage.getItem('current_project');
            if (saved) {
              const data = JSON.parse(saved);
              data.template = selected;
              data.density = density;
              // Clear previous slides/article so workspace regenerates
              delete data.slides;
              delete data.article;
              localStorage.setItem('current_project', JSON.stringify(data));
            }
          } catch {}
          navigate('/workspace');
        }}>
          生成导读工作台
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default TemplatePage;
