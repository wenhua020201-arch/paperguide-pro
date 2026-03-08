import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Check, Users, BookOpen, Search, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/data/mockData';
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

// Mini slide preview data per template
const TEMPLATE_PREVIEWS: Record<TemplateName, { title: string; points: string[]; accent: string; shape: 'circle' | 'rect' | 'triangle' }[]> = {
  seminar: [
    { title: '研究问题', points: ['核心假设与动机', '现有方法的局限'], accent: 'hsl(215, 65%, 42%)', shape: 'circle' },
    { title: '方法设计', points: ['模型架构概览', '关键创新点', '与 baseline 对比'], accent: 'hsl(195, 70%, 45%)', shape: 'rect' },
    { title: '批判性讨论', points: ['实验是否充分？', '可复现性评价'], accent: 'hsl(155, 60%, 42%)', shape: 'triangle' },
  ],
  course: [
    { title: '背景知识', points: ['领域概述', '核心概念回顾', '为什么重要？'], accent: 'hsl(260, 55%, 50%)', shape: 'rect' },
    { title: '论文贡献', points: ['主要创新', '解决了什么问题'], accent: 'hsl(215, 65%, 42%)', shape: 'circle' },
    { title: '总结与思考', points: ['关键 takeaway', '延伸阅读建议'], accent: 'hsl(45, 80%, 50%)', shape: 'triangle' },
  ],
  proposal: [
    { title: '研究脉络', points: ['相关工作梳理', '研究演进时间线'], accent: 'hsl(340, 60%, 50%)', shape: 'triangle' },
    { title: '核心方法对比', points: ['方法 A vs B vs C', '优缺点分析'], accent: 'hsl(215, 65%, 42%)', shape: 'rect' },
    { title: '研究启发', points: ['开放问题', '可能的研究方向'], accent: 'hsl(155, 60%, 42%)', shape: 'circle' },
  ],
  crossfield: [
    { title: '用一句话解释', points: ['直觉类比', '无术语版本'], accent: 'hsl(25, 70%, 50%)', shape: 'circle' },
    { title: '为什么值得关注', points: ['跨领域影响', '实际应用场景'], accent: 'hsl(195, 70%, 45%)', shape: 'rect' },
    { title: '核心发现', points: ['简化版结果', '一张图看懂'], accent: 'hsl(260, 55%, 50%)', shape: 'triangle' },
  ],
};

// Density preview: same slide at different densities
const DENSITY_PREVIEW: Record<ContentDensity, { title: string; points: string[] }> = {
  concise: { title: 'Transformer 核心架构', points: ['多头自注意力', '残差 + LayerNorm'] },
  standard: { title: 'Transformer 核心架构', points: ['编码器-解码器各 6 层', '多头自注意力（Multi-Head）', '残差连接 + 层归一化', '前馈网络（FFN）'] },
  detailed: { title: 'Transformer 核心架构', points: ['编码器-解码器各 6 层，每层两个子层', '多头自注意力：Q/K/V 投影到 h 个子空间并行计算', 'Attention(Q,K,V) = softmax(QK^T/√d_k)V', '残差连接 + 层归一化保证梯度流通', '位置编码：正弦/余弦函数注入位置信息', 'FFN：两层线性变换 + ReLU 激活'] },
};

function MiniShape({ shape, color, className = '' }: { shape: 'circle' | 'rect' | 'triangle'; color: string; className?: string }) {
  if (shape === 'circle') return <div className={`rounded-full ${className}`} style={{ background: color, opacity: 0.15 }} />;
  if (shape === 'rect') return <div className={`rounded ${className}`} style={{ background: color, opacity: 0.12 }} />;
  return (
    <svg className={className} viewBox="0 0 40 40" style={{ opacity: 0.15 }}>
      <polygon points="20,5 38,35 2,35" fill={color} />
    </svg>
  );
}

function MiniSlide({ title, points, accent, shape }: { title: string; points: string[]; accent: string; shape: 'circle' | 'rect' | 'triangle' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 relative overflow-hidden aspect-[16/10]">
      <MiniShape shape={shape} color={accent} className="absolute -top-2 -right-2 w-12 h-12" />
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/outline')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">选择汇报模板</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Template cards with previews */}
          <div className="space-y-6">
            {TEMPLATES.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id];
              const isSelected = selected === tpl.id;
              const previews = TEMPLATE_PREVIEWS[tpl.id];
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
                  {/* Slide previews */}
                  <div className="grid grid-cols-3 gap-3 pl-12">
                    {previews.map((s, i) => (
                      <MiniSlide key={i} {...s} />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Density selector with live preview */}
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
          // Save template & density selection to localStorage
          try {
            const saved = localStorage.getItem('current_project');
            if (saved) {
              const data = JSON.parse(saved);
              data.template = selected;
              data.density = density;
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
