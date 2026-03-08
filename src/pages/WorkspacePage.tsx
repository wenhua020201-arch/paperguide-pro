import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronUp, ChevronDown, Plus, MoreHorizontal, Copy, RefreshCw,
  PanelLeftClose, PanelLeftOpen, GripVertical, Send, Sparkles, Loader2,
  FileText as FileTextIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MOCK_PROJECT } from '@/data/mockData';
import type { Slide, SlideNotes, GuideArticle } from '@/types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCurrentPdfUrl } from '@/lib/pdfStorage';

const TONE_OPTIONS: { value: SlideNotes['tone']; label: string }[] = [
  { value: 'concise', label: '简洁' },
  { value: 'natural', label: '自然' },
  { value: 'formal', label: '正式' },
  { value: 'classroom', label: '课堂汇报风' },
];

const STORAGE_KEY = 'paper-guide-projects';

const WorkspacePage = () => {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>(MOCK_PROJECT.slides);
  const [article, setArticle] = useState<GuideArticle>(MOCK_PROJECT.article);
  const [paperTitle, setPaperTitle] = useState(MOCK_PROJECT.paper.title);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [articleOpen, setArticleOpen] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(true);
  const [promptText, setPromptText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const hasGenerated = useRef(false);
  const currentSlide = slides[currentSlideIndex];

  // Load PDF
  useEffect(() => {
    getCurrentPdfUrl().then(url => {
      if (url) setPdfUrl(url);
    }).catch(() => {});
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  // On mount, check if we need to generate workspace from AI
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;

    const saved = localStorage.getItem('current_project');
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (data.slides && data.article) {
        loadWorkspaceData(data);
        return;
      }
      if (data.outline && data.paper) {
        generateWorkspace(data);
      }
    } catch {}
  }, []);

  const loadWorkspaceData = (data: any) => {
    setPaperTitle(data.paper?.title || MOCK_PROJECT.paper.title);
    const normalizedSlides: Slide[] = (data.slides || []).map((s: any, i: number) => ({
      id: s.id || `s-${i}`,
      order: i,
      title: s.title || '未命名',
      contentBlocks: (s.contentBlocks || []).map((b: any, j: number) => ({
        id: b.id || `b-${i}-${j}`,
        type: b.type || 'point',
        content: b.content || '',
      })),
      layout: s.layout || 'title-points',
      linkedArticleSection: s.linkedArticleSection,
      notes: {
        mainTalk: s.notes?.mainTalk || '',
        extraExplanation: s.notes?.extraExplanation || '',
        transitionSentence: s.notes?.transitionSentence || '',
        tone: s.notes?.tone || 'natural',
      },
    }));
    if (normalizedSlides.length > 0) setSlides(normalizedSlides);
    if (data.article?.sections) setArticle(data.article);
  };

  const generateWorkspace = async (data: any) => {
    setGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('workspace-generate', {
        body: {
          outline: data.outline,
          paper: data.paper,
          template: data.template || 'seminar',
          density: data.density || 'standard',
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const updated = { ...data, slides: result.slides, article: result.article, step: 'done' };
      localStorage.setItem('current_project', JSON.stringify(updated));

      // Update project history
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const projects = JSON.parse(raw);
          const idx = projects.findIndex((p: any) => p.id === data.id);
          if (idx >= 0) {
            projects[idx].slideCount = result.slides?.length || 0;
            projects[idx].step = 'done';
            projects[idx].updatedAt = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
          }
        }
      } catch {}

      loadWorkspaceData(updated);
      toast.success('导读工作台已生成');
    } catch (e: any) {
      console.error('Generate workspace error:', e);
      toast.error('生成工作台失败: ' + (e.message || '请重试'));
    } finally {
      setGenerating(false);
    }
  };

  const callSlideAI = async (instruction: string) => {
    if (!currentSlide || aiLoading) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('slide-ai', {
        body: {
          messages: [{ role: 'user', content: instruction }],
          slideContext: {
            title: currentSlide.title,
            contentBlocks: currentSlide.contentBlocks,
            notes: currentSlide.notes,
            layout: currentSlide.layout,
          },
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const updated = slides.map((s, i) => {
        if (i !== currentSlideIndex) return s;
        return {
          ...s,
          title: data.title || s.title,
          contentBlocks: data.contentBlocks || s.contentBlocks,
          notes: data.notes ? { ...s.notes, ...data.notes } : s.notes,
        };
      });
      setSlides(updated);
      try {
        const saved = localStorage.getItem('current_project');
        if (saved) {
          const proj = JSON.parse(saved);
          proj.slides = updated;
          localStorage.setItem('current_project', JSON.stringify(proj));
        }
      } catch {}
      toast.success('AI 已更新页面内容');
    } catch (e: any) {
      console.error('AI error:', e);
      toast.error('AI 请求失败，请稍后再试');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePromptSubmit = () => {
    if (!promptText.trim()) return;
    const text = promptText;
    setPromptText('');
    callSlideAI(text);
  };

  if (generating) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="text-center">
          <p className="text-lg font-display font-semibold text-foreground mb-1">正在生成导读工作台…</p>
          <p className="text-sm text-muted-foreground">AI 正在根据大纲生成 PPT、导读文章和演讲注释</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-display font-semibold text-foreground">{paperTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPdfOpen(!pdfOpen)}>
            <FileTextIcon className="w-4 h-4" />
            <span className="ml-1 text-xs">原文</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setArticleOpen(!articleOpen)}>
            {articleOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            <span className="ml-1 text-xs">导读</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/export')}>导出</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Far left - PDF viewer */}
        <AnimatePresence initial={false}>
          {pdfOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border overflow-hidden flex-shrink-0"
            >
              <div className="w-[360px] h-full flex flex-col">
                <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                  <FileTextIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">论文原文</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  {pdfUrl ? (
                    <object data={pdfUrl} type="application/pdf" className="w-full h-full">
                      <iframe src={pdfUrl} className="w-full h-full border-0" title="论文 PDF" />
                    </object>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      <p>未找到 PDF 文件</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Left - Article */}
        <AnimatePresence initial={false}>
          {articleOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border overflow-hidden flex-shrink-0"
            >
              <div className="w-[300px] h-full overflow-y-auto p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">导读文章</p>
                {article.sections.map((section) => {
                  const isLinked = currentSlide?.linkedArticleSection === section.id;
                  return (
                    <div key={section.id} className="mb-6">
                      <h3
                        className={`text-sm font-display font-semibold mb-2 cursor-pointer transition-colors ${
                          isLinked ? 'text-primary' : 'text-foreground'
                        }`}
                        onClick={() => {
                          const slideIdx = slides.findIndex(s => s.linkedArticleSection === section.id);
                          if (slideIdx >= 0) setCurrentSlideIndex(slideIdx);
                        }}
                      >
                        {section.title}
                      </h3>
                      {section.paragraphs.map((p) => {
                        const pLinked = p.linkedSlideId === currentSlide?.id;
                        return (
                          <p
                            key={p.id}
                            className={`text-xs leading-relaxed mb-3 cursor-pointer rounded px-2 py-1.5 transition-colors ${
                              pLinked ? 'bg-primary/8 text-foreground border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => {
                              if (p.linkedSlideId) {
                                const idx = slides.findIndex(s => s.id === p.linkedSlideId);
                                if (idx >= 0) setCurrentSlideIndex(idx);
                              }
                            }}
                          >
                            {p.content}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center - Slide editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden">
            {currentSlide && (
              <motion.div key={currentSlide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-3xl">
                <SlideEditor slide={currentSlide} onAiAction={callSlideAI} aiLoading={aiLoading} />
              </motion.div>
            )}

            <div className="w-full max-w-3xl mt-4">
              <div className="flex items-start gap-2 bg-card border border-border rounded-lg p-2">
                <Sparkles className="w-4 h-4 text-primary mt-2 ml-1 flex-shrink-0" />
                <Textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={`对第 ${currentSlideIndex + 1} 页提出修改意见…`}
                  className="min-h-[36px] max-h-[80px] text-sm border-0 shadow-none resize-none focus-visible:ring-0 p-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit(); }
                  }}
                />
                <Button size="icon" variant="ghost" className="flex-shrink-0 mt-0.5" onClick={handlePromptSubmit} disabled={!promptText.trim() || aiLoading}>
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom - Notes drawer */}
          <div className="border-t border-border flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-2">
              <button onClick={() => setNotesOpen(!notesOpen)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <span>演讲注释</span>
                {notesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              {notesOpen && currentSlide && (
                <div className="flex items-center gap-1">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        currentSlide.notes.tone === t.value ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => {
                        const updated = slides.map((s, i) =>
                          i === currentSlideIndex ? { ...s, notes: { ...s.notes, tone: t.value } } : s
                        );
                        setSlides(updated);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  <span className="w-px h-4 bg-border mx-1" />
                  <button className="p-1 rounded hover:bg-secondary transition-colors" title="刷新注释"
                    onClick={() => callSlideAI('请为这一页重新生成演讲注释')}>
                    <RefreshCw className="w-3 h-3 text-muted-foreground" />
                  </button>
                  <button className="p-1 rounded hover:bg-secondary transition-colors" title="复制注释"
                    onClick={() => {
                      if (currentSlide) {
                        const text = `这页讲什么：${currentSlide.notes.mainTalk}\n补充说明：${currentSlide.notes.extraExplanation}\n过渡句：${currentSlide.notes.transitionSentence}`;
                        navigator.clipboard.writeText(text);
                        toast.success('注释已复制');
                      }
                    }}>
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
            <AnimatePresence initial={false}>
              {notesOpen && currentSlide && (
                <motion.div initial={{ height: 0 }} animate={{ height: 100 }} exit={{ height: 0 }} className="overflow-hidden">
                  <NotesPanel notes={currentSlide.notes} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Right - Thumbnails */}
        <aside className="w-52 border-l border-border overflow-y-auto flex-shrink-0 p-3 space-y-2">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              onClick={() => setCurrentSlideIndex(i)}
              className={`group rounded-lg border-2 p-2.5 cursor-pointer transition-all ${
                i === currentSlideIndex ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{i + 1}</span>
                <GripVertical className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
              </div>
              <p className="text-xs font-medium text-foreground truncate">{slide.title}</p>
            </div>
          ))}
          <button
            onClick={() => {
              const newSlide: Slide = {
                id: `s-${Date.now()}`,
                order: slides.length,
                title: '新页面',
                contentBlocks: [{ id: `b-${Date.now()}`, type: 'point', content: '点击编辑内容' }],
                layout: 'title-points',
                notes: { mainTalk: '', extraExplanation: '', transitionSentence: '', tone: 'natural' },
              };
              setSlides([...slides, newSlide]);
            }}
            className="w-full border-2 border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            新增页面
          </button>
        </aside>
      </div>
    </div>
  );
};

function SlideEditor({ slide, onAiAction, aiLoading }: { slide: Slide; onAiAction: (instruction: string) => void; aiLoading: boolean }) {
  const isCover = slide.layout === 'cover';

  return (
    <div className="relative group">
      {aiLoading && (
        <div className="absolute inset-0 bg-card/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            AI 正在处理…
          </div>
        </div>
      )}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-card/80 border border-border shadow-sm transition-opacity">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onAiAction('请精简这一页的内容，只保留最核心的要点')}>精简内容</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请让这一页的内容更适合口头讲解，语言更自然')}>更适合讲解</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请换一种排版方式，比如改用分栏布局或关键发现块')}>换排版</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请为这一页生成演讲注释')}>生成注释</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden ${
        isCover ? 'aspect-[16/9] flex flex-col items-center justify-center text-center p-12' : 'p-8'
      }`}>
        {isCover ? (
          <>
            <h2 className="text-2xl font-display font-bold text-foreground mb-3">{slide.title}</h2>
            {slide.contentBlocks.map(b => (
              <p key={b.id} className="text-sm text-muted-foreground">{b.content}</p>
            ))}
          </>
        ) : (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">{slide.title}</h2>
            <div className={`space-y-2.5 ${slide.layout === 'title-two-column' ? 'grid grid-cols-2 gap-4 space-y-0' : ''} ${slide.layout === 'title-quad' ? 'grid grid-cols-2 gap-3 space-y-0' : ''}`}>
              {slide.contentBlocks.map(b => (
                <div key={b.id} className={`${
                  b.type === 'subpoint' ? 'ml-5' : ''
                } ${b.type === 'finding' ? 'bg-primary/5 border border-primary/15 rounded-lg p-3' : ''}
                ${b.type === 'summary' ? 'border-t border-border pt-3 mt-4' : ''}
                ${b.type === 'quad-item' ? 'bg-secondary/50 rounded-lg p-3' : ''}
                ${b.type === 'timeline-item' ? 'border-l-2 border-primary/30 pl-3 py-1' : ''}`}>
                  <p className={`text-sm ${
                    b.type === 'point' ? 'text-foreground flex items-start gap-2 before:content-["•"] before:text-primary before:font-bold' :
                    b.type === 'subpoint' ? 'text-muted-foreground flex items-start gap-2 before:content-["–"] before:text-muted-foreground' :
                    b.type === 'finding' ? 'text-primary font-medium' :
                    b.type === 'summary' ? 'text-muted-foreground italic' :
                    b.type === 'quad-item' ? 'text-foreground font-medium' :
                    b.type === 'timeline-item' ? 'text-foreground' :
                    'text-foreground'
                  }`}>
                    {b.content}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ notes }: { notes: SlideNotes }) {
  return (
    <div className="px-4 pb-3 flex gap-6 text-xs overflow-x-auto">
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground mb-1 font-medium">这页讲什么</p>
        <p className="text-foreground leading-relaxed">{notes.mainTalk || '—'}</p>
      </div>
      <div className="w-px bg-border flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground mb-1 font-medium">补充说明</p>
        <p className="text-foreground leading-relaxed">{notes.extraExplanation || '—'}</p>
      </div>
      <div className="w-px bg-border flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground mb-1 font-medium">过渡句</p>
        <p className="text-foreground leading-relaxed">{notes.transitionSentence || '—'}</p>
      </div>
    </div>
  );
}

export default WorkspacePage;
