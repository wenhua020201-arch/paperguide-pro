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

// Each template: ONE slide about "What is Transformer", different style
const TEMPLATE_SINGLE_SLIDE: Record<TemplateName, { slideTitle: string; points: string[]; style: string; accent: string }> = {
  seminar: {
    slideTitle: '方法分析：Transformer 核心架构',
    points: [
      '核心假设：纯注意力机制是否足以替代循环结构？→ 实验验证支持',
      'Scaled Dot-Product Attention 中 √d_k 的缩放因子：防止 softmax 梯度消失',
      '多头注意力 vs 单头：消融实验显示 h=8 时 BLEU 最优，h=1 降 0.9',
      '位置编码选择：固定正弦 vs 可学习，实验表明差异不显著（Table 3）',
      '关键质疑：O(n²) 复杂度在长序列上是否可接受？',
    ],
    style: '批判性分析，关注实验证据和方法合理性',
    accent: 'hsl(215, 65%, 42%)',
  },
  course: {
    slideTitle: '什么是 Transformer？',
    points: [
      '想象你在翻译一句话：RNN 像"逐字朗读"，每次只看一个字',
      'Transformer 的做法不同：它一次看完整句话，然后找出哪些词跟哪些词相关',
      '这种"找关系"的能力叫做"注意力机制"——就像你读文章时，眼睛会自动聚焦到关键词上',
      '多头注意力 = 从多个角度同时关注（比如语法关系、语义关系、位置关系）',
      '为什么需要位置编码？因为 Transformer 同时看所有词，需要额外告诉它词的顺序',
    ],
    style: '从直觉出发，类比解释，适合初学者',
    accent: 'hsl(260, 55%, 50%)',
  },
  proposal: {
    slideTitle: '研究演进：从注意力到 Transformer',
    points: [
      '2014 Bahdanau: Seq2Seq + Attention，首次引入对齐机制',
      '2015 Luong: 简化注意力计算，提出 Global vs Local Attention',
      '2016 ByteNet/ConvS2S: 尝试用 CNN 替代 RNN，提升并行度',
      '2017 Vaswani: 完全移除循环 → Transformer，并行度 O(1)，性能 SOTA',
      '开放问题：O(n²) 复杂度 → 后续 Linear Attention、Sparse Attention 方向',
    ],
    style: '时间线脉络，对比方法演进，指出研究方向',
    accent: 'hsl(340, 60%, 50%)',
  },
  crossfield: {
    slideTitle: '一句话理解 Transformer',
    points: [
      '核心思想：不用排队，让所有人同时工作——这就是 Transformer 最大的创新',
      '类比：传统方法像流水线（一个一个处理），Transformer 像圆桌会议（所有人同时讨论）',
      '为什么重要：ChatGPT、图像生成、蛋白质预测都基于这个架构',
      '关键突破：翻译质量首次超过所有传统方法，训练速度快 4 倍',
      '对其他领域的启示：任何需要"理解关系"的问题，都可以尝试这个思路',
    ],
    style: '零术语，生活化类比，聚焦"为什么重要"',
    accent: 'hsl(25, 70%, 50%)',
  },
};

function SingleSlidePreview({ data }: { data: typeof TEMPLATE_SINGLE_SLIDE[TemplateName] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 relative overflow-hidden">
      <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full" style={{ background: data.accent, opacity: 0.1 }} />
      <div className="w-8 h-0.5 rounded-full mb-2" style={{ background: data.accent }} />
      <p className="text-xs font-display font-semibold text-foreground mb-3 leading-tight">{data.slideTitle}</p>
      <div className="space-y-1.5">
        {data.points.map((p, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: data.accent }} />
            <span className="text-[10px] text-muted-foreground leading-relaxed">{p}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-border">
        <p className="text-[9px] text-muted-foreground/60 italic">风格：{data.style}</p>
      </div>
    </div>
  );
}

const DENSITY_PREVIEW: Record<ContentDensity, { title: string; points: string[] }> = {
  concise: { title: '核心架构', points: ['多头自注意力', '残差 + LayerNorm'] },
  standard: { title: '核心架构', points: ['编码器-解码器各 6 层', '多头自注意力（Multi-Head）', '残差连接 + 层归一化', '前馈网络（FFN）'] },
  detailed: { title: '核心架构', points: ['编码器-解码器各 6 层，每层两个子层', '多头自注意力：Q/K/V 投影到 h 个子空间并行计算', 'Attention(Q,K,V) = softmax(QK^T/√d_k)V', '残差连接 + 层归一化保证梯度流通', '位置编码：正弦/余弦函数注入位置信息', 'FFN：两层线性变换 + ReLU 激活'] },
};

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {TEMPLATES.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id];
              const isSelected = selected === tpl.id;
              const preview = TEMPLATE_SINGLE_SLIDE[tpl.id];
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
                  <SingleSlidePreview data={preview} />
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
              data.step = 'workspace';
              delete data.slides;
              delete data.article;
              localStorage.setItem('current_project', JSON.stringify(data));

              // Update project history
              const STORAGE_KEY = 'paper-guide-projects';
              const raw = localStorage.getItem(STORAGE_KEY);
              if (raw) {
                const projects = JSON.parse(raw);
                const TEMPLATE_LABELS: Record<string, string> = {
                  seminar: '组会汇报版', course: '课程 Presentation',
                  proposal: '开题/综述版', crossfield: '跨方向交流版',
                };
                const idx = projects.findIndex((p: any) => p.id === data.id);
                if (idx >= 0) {
                  projects[idx].template = TEMPLATE_LABELS[selected] || selected;
                  projects[idx].step = 'workspace';
                  projects[idx].updatedAt = new Date().toISOString();
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
                }
              }
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
