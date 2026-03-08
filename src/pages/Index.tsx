import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, Eye, FileText, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectRecord {
  id: string;
  title: string;
  template: string;
  slideCount: number;
  updatedAt: string;
}

const STORAGE_KEY = 'paper-guide-projects';

const getProjects = (): ProjectRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
};

const saveProjects = (projects: ProjectRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

// Seed a demo project if none exist
const ensureDemoProject = () => {
  const projects = getProjects();
  if (projects.length === 0) {
    const demo: ProjectRecord = {
      id: 'demo-project',
      title: 'Attention Is All You Need',
      template: '组会汇报版',
      slideCount: 9,
      updatedAt: new Date().toISOString(),
    };
    saveProjects([demo]);
    return [demo];
  }
  return projects;
};

const Index = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>(ensureDemoProject);

  const deleteProject = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
    setProjects(updated);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-display font-semibold text-foreground">📄 论文导读助手</h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight mb-3">
              上传论文，快速生成
              <span className="text-primary"> 可讲的导读内容</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              从论文到组会汇报，只需几分钟。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button size="lg" className="px-8" onClick={() => navigate('/upload')}>
                <Upload className="w-5 h-5 mr-2" />
                上传论文
              </Button>
              <Button size="lg" variant="outline" className="px-8" onClick={() => {
                // Clear current_project so workspace uses mock data
                localStorage.removeItem('current_project');
                navigate('/workspace');
              }}>
                <Eye className="w-5 h-5 mr-2" />
                查看示例
              </Button>
            </div>
          </motion.div>

          {/* Project History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                历史项目
              </h3>
            </div>

            {projects.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-12 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">还没有历史项目</p>
                <p className="text-xs text-muted-foreground/60 mt-1">上传一篇论文开始使用吧</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => navigate('/workspace')}
                    className="group bg-card border border-border rounded-lg px-5 py-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.template} · {project.slideCount} 页 · {formatDate(project.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        论文导读助手 — 让每一次文献汇报都从容不迫
      </footer>
    </div>
  );
};

export default Index;
