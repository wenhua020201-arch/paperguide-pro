import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { savePdfFile } from '@/lib/pdfStorage';

const PARSE_STEPS = [
  '正在提取论文文本…',
  '正在识别论文结构…',
  '正在提取核心贡献…',
  '正在分析方法与实验…',
  '正在生成导读大纲…',
];

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');
    pages.push(text);
  }

  return pages.join('\n\n');
}

const STORAGE_KEY = 'paper-guide-projects';

const UploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('请上传 PDF 格式的文件');
      return;
    }
    setFile(f);
    setParsing(true);
    setStepIndex(0);
    setError(null);
    abortRef.current = false;

    try {
      // Step 1: Extract text + save PDF to IndexedDB
      setStepIndex(1);
      const [paperText] = await Promise.all([
        extractPdfText(f),
        savePdfFile(f),
      ]);
      if (abortRef.current) return;

      if (paperText.trim().length < 100) {
        throw new Error('无法提取论文文本，请确认 PDF 包含可选中的文字（非扫描版）');
      }

      // Step 2-4: Call AI to parse
      setStepIndex(2);
      const stepTimer = setInterval(() => {
        setStepIndex(prev => Math.min(prev + 1, PARSE_STEPS.length - 1));
      }, 3000);

      const { data, error: fnError } = await supabase.functions.invoke('paper-parse', {
        body: { paperText, language: 'zh' },
      });

      clearInterval(stepTimer);

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (!data?.paper || !data?.outline) {
        throw new Error('AI 返回的数据不完整，请重试');
      }

      // Normalize outline
      const normalizeOutline = (node: any, parentId: string | null = null, level = 0, order = 0): any => ({
        id: `n-${level}-${order}-${Date.now()}`,
        parentId,
        level,
        title: node.title || '未命名',
        description: node.description || '',
        order,
        children: (node.children || []).map((child: any, i: number) =>
          normalizeOutline(child, `n-${level}-${order}-${Date.now()}`, level + 1, i)
        ),
      });

      const outline = normalizeOutline(data.outline);

      // Create project record
      const projectId = `proj-${Date.now()}`;
      const projectData = {
        id: projectId,
        paper: data.paper,
        outline,
        paperText: paperText.substring(0, 50000),
        fileName: f.name,
        createdAt: new Date().toISOString(),
        step: 'outline', // track progress
      };
      localStorage.setItem('current_project', JSON.stringify(projectData));

      // Save to project history
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const projects = raw ? JSON.parse(raw) : [];
        // Remove demo project if exists
        const filtered = projects.filter((p: any) => p.id !== 'demo-project');
        filtered.unshift({
          id: projectId,
          title: data.paper.title || f.name,
          template: '未选择',
          slideCount: 0,
          updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch {}

      setStepIndex(PARSE_STEPS.length);
      setTimeout(() => navigate('/outline'), 800);

    } catch (e: any) {
      console.error('Parse error:', e);
      setError(e.message || '解析失败，请重试');
      setParsing(false);
    }
  };

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
              <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {error ? (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                ) : stepIndex >= PARSE_STEPS.length ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {PARSE_STEPS.map((step, i) => (
                    i <= stepIndex && (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 text-sm">
                        {i < stepIndex ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : error ? (
                          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                        )}
                        <span className={i < stepIndex ? 'text-muted-foreground' : 'text-foreground'}>{step}</span>
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                  {error}
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => { setFile(null); setError(null); setParsing(false); }}>
                    重新上传
                  </Button>
                </div>
              )}

              {!error && (
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min((stepIndex / PARSE_STEPS.length) * 100, 100)}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
