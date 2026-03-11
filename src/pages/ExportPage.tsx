import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileDown, MessageSquare, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/data/mockData';

const ExportPage = () => {
  const navigate = useNavigate();
  const [paperTitle, setPaperTitle] = useState('未命名项目');
  const [slideCount, setSlideCount] = useState(0);
  const [templateName, setTemplateName] = useState('未知');
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('current_project');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.paper?.title) setPaperTitle(data.paper.title);
      if (data.slides?.length) setSlideCount(data.slides.length);
      if (data.template) {
        const tpl = TEMPLATES.find(t => t.id === data.template);
        if (tpl) setTemplateName(tpl.name);
      }
      if (data.updatedAt) setUpdatedAt(data.updatedAt);
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workspace')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">导出与保存</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">项目标题</p>
              <p className="font-display font-semibold text-foreground">{paperTitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">页数</p>
                <p className="text-sm font-medium text-foreground">{slideCount} 页</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">模板</p>
                <p className="text-sm font-medium text-foreground">{templateName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">最后编辑</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(updatedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full justify-start" size="lg">
              <Save className="w-5 h-5 mr-3" />
              保存项目
            </Button>
            <Button variant="outline" className="w-full justify-start" size="lg">
              <FileDown className="w-5 h-5 mr-3" />
              导出导读内容
            </Button>
            <Button variant="outline" className="w-full justify-start" size="lg">
              <MessageSquare className="w-5 h-5 mr-3" />
              导出演讲注释
            </Button>
            <Button variant="ghost" className="w-full justify-start" size="lg" onClick={() => navigate('/workspace')}>
              <Edit3 className="w-5 h-5 mr-3" />
              返回继续编辑
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExportPage;
