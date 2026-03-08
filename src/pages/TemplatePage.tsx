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

const DENSITIES: { value: ContentDensity; label: string }[] = [
  { value: 'concise', label: '简洁' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '详细' },
];

const TemplatePage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TemplateName>('seminar');
  const [density, setDensity] = useState<ContentDensity>('standard');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/outline')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">选择汇报模板</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Template cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id];
              const isSelected = selected === tpl.id;
              return (
                <motion.div
                  key={tpl.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
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
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground mb-1">{tpl.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{tpl.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tpl.tags.map(tag => (
                          <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Density selector */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">内容密度</p>
            <div className="flex gap-2">
              {DENSITIES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDensity(d.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    density === d.value
                      ? 'border-primary bg-primary/8 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="border-t border-border px-6 py-4 flex justify-end">
        <Button size="lg" onClick={() => navigate('/workspace')}>
          生成导读工作台
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default TemplatePage;
