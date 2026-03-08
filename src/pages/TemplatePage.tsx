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

// Built-in Transformer-based previews showing clear style differences
const TEMPLATE_PREVIEWS: Record<TemplateName, { title: string; points: string[]; accent: string }[]> = {
  seminar: [
    { title: '研究问题与动机', points: ['RNN 顺序计算瓶颈 → 能否完全去掉循环？', '核心假设：纯注意力足以建模序列'], accent: 'hsl(215, 65%, 42%)' },
    { title: '方法批判性分析', points: ['Scaled Dot-Product 缩放因子的必要性', '多头注意力 vs 单头：消融实验验证', '位置编码选择：固定 vs 可学习'], accent: 'hsl(195, 70%, 45%)' },
    { title: '实验评价与复现性', points: ['BLEU 28.4 是否充分说明优势？', '训练成本对比是否公平？', '消融实验的完备性讨论'], accent: 'hsl(155, 60%, 42%)' },
  ],
  course: [
    { title: '什么是序列建模？', points: ['从翻译任务说起：输入一句话→输出另一种语言', 'RNN 像"流水线"一步步处理，速度慢', '为什么需要新方法？'], accent: 'hsl(260, 55%, 50%)' },
    { title: '注意力机制直觉', points: ['类比：阅读时眼睛会"关注"重要的词', 'Query-Key-Value 三元组的含义', '多头 = 从多个角度同时关注'], accent: 'hsl(215, 65%, 42%)' },
    { title: '总结与课后思考', points: ['Transformer 的三个核心创新', '思考题：为什么需要位置编码？', '延伸阅读：BERT 和 GPT'], accent: 'hsl(45, 80%, 50%)' },
  ],
  proposal: [
    { title: '研究脉络：从 RNN 到 Transformer', points: ['2014: Seq2Seq + Attention', '2015: 注意力对齐可视化', '2017: 完全去除循环 → Transformer'], accent: 'hsl(340, 60%, 50%)' },
    { title: '相关工作对比', points: ['RNN+Attention vs CNN (ByteNet) vs Transformer', '计算复杂度 O(n²) vs O(n·k) vs O(n²)', '并行度：不可并行 vs 部分 vs 完全'], accent: 'hsl(215, 65%, 42%)' },
    { title: '研究启发与开放问题', points: ['如何降低 O(n²) → Linear Attention', '位置编码的更好方案：RoPE, ALiBi', '跨模态统一架构的可能性'], accent: 'hsl(155, 60%, 42%)' },
  ],
  crossfield: [
    { title: '一句话理解 Transformer', points: ['想象一个"全知全能"的翻译官', '不是逐字翻译，而是同时看完整句话再翻', '类比：不用排队，所有人同时工作'], accent: 'hsl(25, 70%, 50%)' },
    { title: '为什么值得关注？', points: ['不只是翻译：ChatGPT、图像生成都用它', '影响了生物(蛋白质预测)、医学、金融', '被称为"AI 的基础设施"'], accent: 'hsl(195, 70%, 45%)' },
    { title: '核心发现（无公式版）', points: ['翻译质量：超过当时所有方法', '训练速度：快了 4 倍以上', '一个架构统治所有任务'], accent: 'hsl(260, 55%, 50%)' },
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
