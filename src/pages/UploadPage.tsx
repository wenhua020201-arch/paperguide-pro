import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PARSE_STEPS = [
  '正在识别论文结构…',
  '正在提取核心贡献…',
  '正在分析方法与实验…',
  '正在生成导读逻辑…',
  '正在构建大纲节点…',
];

const UploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setParsing(true);
    setStepIndex(0);
  };

  useEffect(() => {
    if (!parsing) return;
    if (stepIndex >= PARSE_STEPS.length) {
      const t = setTimeout(() => navigate('/outline'), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex(i => i + 1), 1200);
    return () => clearTimeout(t);
  }, [parsing, stepIndex, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">上传论文</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">
          {!file ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1">拖放 PDF 文件到此处</p>
              <p className="text-sm text-muted-foreground">或点击选择文件</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* File card */}
              <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {stepIndex >= PARSE_STEPS.length ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <AnimatePresence>
                  {PARSE_STEPS.map((step, i) => (
                    i <= stepIndex && (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        {i < stepIndex ? (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                        )}
                        <span className={i < stepIndex ? 'text-muted-foreground' : 'text-foreground'}>
                          {step}
                        </span>
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min((stepIndex / PARSE_STEPS.length) * 100, 100)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
