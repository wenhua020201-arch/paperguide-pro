import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, Eye, TreePine, FileText, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: TreePine,
    title: '树状导读大纲',
    desc: '自动解析论文结构，生成可编辑的层级大纲',
  },
  {
    icon: FileText,
    title: '导读文章与演讲注释',
    desc: '为每页生成讲解稿和过渡句，助你从容汇报',
  },
  {
    icon: Presentation,
    title: '可编辑 PPT 工作台',
    desc: '直接编辑内容与排版，一站式完成汇报准备',
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-display font-semibold text-foreground">📄 论文导读助手</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/workspace')}>
            <Eye className="w-4 h-4 mr-1.5" />
            查看示例
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl text-center"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground leading-tight mb-4">
            上传论文，快速生成
            <br />
            <span className="text-primary">可讲的导读内容</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            从论文到组会汇报，只需几分钟。自动生成大纲、导读文章、PPT 页面和演讲注释。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="px-8 text-base" onClick={() => navigate('/upload')}>
              <Upload className="w-5 h-5 mr-2" />
              上传论文
            </Button>
            <Button size="lg" variant="outline" className="px-8 text-base" onClick={() => navigate('/workspace')}>
              <Eye className="w-5 h-5 mr-2" />
              查看示例
            </Button>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-20 max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        论文导读助手 — 让每一次文献汇报都从容不迫
      </footer>
    </div>
  );
};

export default Index;
