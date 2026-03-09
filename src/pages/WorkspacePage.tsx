import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronUp, ChevronDown, Plus, MoreHorizontal, Copy, RefreshCw,
  PanelLeftClose, PanelLeftOpen, GripVertical, Send, Sparkles, Loader2,
  FileText as FileTextIcon, LayoutGrid, Check, X, Pencil, Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MOCK_PROJECT } from '@/data/mockData';
import type { Slide, SlideNotes, ContentBlock } from '@/types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PdfViewer from '@/components/PdfViewer';

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
  const [paperTitle, setPaperTitle] = useState(MOCK_PROJECT.paper.title);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [pdfOpen, setPdfOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [promptText, setPromptText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notesRefreshing, setNotesRefreshing] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const hasGenerated = useRef(false);
  const currentSlide = slides[currentSlideIndex];
  const isEn = language === 'en';

  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;

    const saved = localStorage.getItem('current_project');
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (data.slides) {
        if (data.language) setLanguage(data.language);
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
          language: data.language || 'zh',
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const updated = { ...data, slides: result.slides, article: result.article, step: 'done' };
      localStorage.setItem('current_project', JSON.stringify(updated));

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

  // Save slides to localStorage
  const persistSlides = useCallback((updatedSlides: Slide[]) => {
    try {
      const saved = localStorage.getItem('current_project');
      if (saved) {
        const proj = JSON.parse(saved);
        proj.slides = updatedSlides;
        localStorage.setItem('current_project', JSON.stringify(proj));
      }
    } catch {}
  }, []);

  // Update a single slide and persist
  const updateSlide = useCallback((index: number, updater: (s: Slide) => Slide) => {
    setSlides(prev => {
      const updated = prev.map((s, i) => i === index ? updater(s) : s);
      persistSlides(updated);
      return updated;
    });
  }, [persistSlides]);

  // Refresh notes after content edit
  const refreshNotesForSlide = useCallback(async (slide: Slide) => {
    setNotesRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('slide-ai', {
        body: {
          mode: 'refresh-notes',
          messages: [],
          slideContext: {
            title: slide.title,
            contentBlocks: slide.contentBlocks,
            layout: slide.layout,
          },
        },
      });
      if (error) throw error;
      if (data?.notes) {
        updateSlide(currentSlideIndex, s => ({
          ...s,
          notes: { ...s.notes, ...data.notes },
        }));
        toast.success('演讲注释已自动更新');
      }
    } catch (e: any) {
      console.error('Notes refresh error:', e);
    } finally {
      setNotesRefreshing(false);
    }
  }, [currentSlideIndex, updateSlide]);

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
          layout: data.layout || s.layout,
          contentBlocks: data.contentBlocks || s.contentBlocks,
          notes: data.notes ? { ...s.notes, ...data.notes } : s.notes,
        };
      });
      setSlides(updated);
      persistSlides(updated);
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

  // Handle inline edit of slide content
  const handleContentEdit = useCallback((blockId: string, newContent: string) => {
    updateSlide(currentSlideIndex, s => ({
      ...s,
      contentBlocks: s.contentBlocks.map(b =>
        b.id === blockId ? { ...b, content: newContent } : b
      ),
    }));
  }, [currentSlideIndex, updateSlide]);

  const handleTitleEdit = useCallback((newTitle: string) => {
    updateSlide(currentSlideIndex, s => ({ ...s, title: newTitle }));
  }, [currentSlideIndex, updateSlide]);

  // Trigger notes refresh after editing
  const handleEditComplete = useCallback(() => {
    if (currentSlide) {
      // Get latest slide state
      const latestSlide = slides[currentSlideIndex];
      if (latestSlide) refreshNotesForSlide(latestSlide);
    }
  }, [currentSlide, slides, currentSlideIndex, refreshNotesForSlide]);

  if (generating) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="text-center">
          <p className="text-lg font-display font-semibold text-foreground mb-1">正在生成导读工作台…</p>
          <p className="text-sm text-muted-foreground">AI 正在根据大纲生成 PPT 和演讲注释</p>
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
          <Button variant="outline" size="sm" onClick={() => {
            const newLang = language === 'zh' ? 'en' : 'zh';
            setLanguage(newLang);
            try {
              const saved = localStorage.getItem('current_project');
              if (saved) {
                const data = JSON.parse(saved);
                data.language = newLang;
                localStorage.setItem('current_project', JSON.stringify(data));
              }
            } catch {}
          }} className="gap-1.5">
            <Languages className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{isEn ? 'EN' : '中文'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPdfOpen(!pdfOpen)}>
            <FileTextIcon className="w-4 h-4" />
            <span className="ml-1 text-xs">{isEn ? 'Paper' : '原文'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/export')}>{isEn ? 'Export' : '导出'}</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left - PDF viewer */}
        <AnimatePresence initial={false}>
          {pdfOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border overflow-hidden flex-shrink-0"
            >
              <div className="w-[420px] h-full flex flex-col">
                <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                  <FileTextIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">论文原文</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PdfViewer />
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center - Slide editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
            {currentSlide && (
              <motion.div key={currentSlide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl">
                <SlideEditor
                  slide={currentSlide}
                  onAiAction={callSlideAI}
                  aiLoading={aiLoading}
                  onContentEdit={handleContentEdit}
                  onTitleEdit={handleTitleEdit}
                  onEditComplete={handleEditComplete}
                />
              </motion.div>
            )}

            {/* AI Prompt input */}
            <div className="w-full max-w-4xl mt-4">
              <div className="flex items-start gap-2 bg-card border border-border rounded-lg p-2">
                <Sparkles className="w-4 h-4 text-primary mt-2 ml-1 flex-shrink-0" />
                <Textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={`对第 ${currentSlideIndex + 1} 页提出修改意见，如"增加更多实验数据对比"、"改成四分框布局"、"生成实验流程图"…`}
                  className="min-h-[36px] max-h-[80px] text-sm border-0 shadow-none resize-none focus-visible:ring-0 p-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit(); }
                  }}
                />
                <Button size="icon" variant="ghost" className="flex-shrink-0 mt-0.5" onClick={handlePromptSubmit} disabled={!promptText.trim() || aiLoading}>
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              {/* Quick action chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  '补充更多数据和实验细节',
                  '改成双栏对比布局',
                  '改成四分框布局',
                  '增加方法流程步骤',
                  '精简内容只保留核心',
                  '更适合口头讲解',
                  '生成实验流程图',
                ].map(chip => (
                  <button
                    key={chip}
                    onClick={() => callSlideAI(chip)}
                    disabled={aiLoading}
                    className="px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom - Notes drawer */}
          <div className="border-t border-border flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-2">
              <button onClick={() => setNotesOpen(!notesOpen)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <span>演讲注释</span>
                {notesRefreshing && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
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
                        updateSlide(currentSlideIndex, s => ({
                          ...s,
                          notes: { ...s.notes, tone: t.value },
                        }));
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  <span className="w-px h-4 bg-border mx-1" />
                  <button className="p-1 rounded hover:bg-secondary transition-colors" title="刷新注释"
                    onClick={() => currentSlide && refreshNotesForSlide(currentSlide)}>
                    <RefreshCw className={`w-3 h-3 text-muted-foreground ${notesRefreshing ? 'animate-spin' : ''}`} />
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
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100">{slide.layout.replace('title-', '')}</span>
                  <GripVertical className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
              <p className="text-xs font-medium text-foreground truncate">{slide.title}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{slide.contentBlocks.length} 个内容块</p>
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
              const updated = [...slides, newSlide];
              setSlides(updated);
              persistSlides(updated);
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

/* ============ Inline Editable Text ============ */

function EditableText({
  value,
  onSave,
  onEditComplete,
  className = '',
  as: Tag = 'p',
  editClassName = '',
}: {
  value: string;
  onSave: (v: string) => void;
  onEditComplete?: () => void;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'span';
  editClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (text.trim() !== value) {
      onSave(text.trim());
      // Trigger notes refresh after a small delay
      if (onEditComplete) setTimeout(onEditComplete, 300);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setText(value); setEditing(false); }
        }}
        className={`w-full bg-transparent border border-primary/30 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none ${editClassName || className}`}
        rows={Math.max(1, Math.ceil(text.length / 60))}
      />
    );
  }

  return (
    <Tag
      className={`${className} cursor-text hover:bg-primary/5 rounded px-0.5 transition-colors`}
      onDoubleClick={() => setEditing(true)}
      title="双击编辑"
    >
      {value}
    </Tag>
  );
}

/* ============ Slide Editor ============ */

function SlideEditor({
  slide,
  onAiAction,
  aiLoading,
  onContentEdit,
  onTitleEdit,
  onEditComplete,
}: {
  slide: Slide;
  onAiAction: (instruction: string) => void;
  aiLoading: boolean;
  onContentEdit: (blockId: string, content: string) => void;
  onTitleEdit: (title: string) => void;
  onEditComplete: () => void;
}) {
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
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onAiAction('请精简这一页的内容，只保留最核心的要点')}>精简内容</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请让这一页的内容更适合口头讲解，语言更自然')}>更适合讲解</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请补充更多实验数据、公式或具体数值')}>补充数据细节</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请改成双栏对比布局，左右分别展示不同方面')}>改为双栏对比</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请改成四分框布局，展示4个并列概念')}>改为四分框</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请改成时间线布局，展示方法演进')}>改为时间线</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请改成方法流程布局，展示步骤流程')}>改为方法流程</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAiAction('请为这一页生成演讲注释')}>生成注释</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Layout badge + edit hint */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
          {slide.layout}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary flex items-center gap-0.5">
          <Pencil className="w-2.5 h-2.5" />
          双击编辑
        </span>
      </div>

      <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden ${
        isCover ? 'aspect-[16/9] flex flex-col items-center justify-center text-center p-12' : 'p-8 min-h-[400px]'
      }`}>
        {isCover ? (
          <>
            <EditableText
              value={slide.title}
              onSave={onTitleEdit}
              onEditComplete={onEditComplete}
              className="text-2xl font-display font-bold text-foreground mb-3"
              as="h2"
            />
            {slide.contentBlocks.map(b => (
              <EditableText
                key={b.id}
                value={b.content}
                onSave={(v) => onContentEdit(b.id, v)}
                onEditComplete={onEditComplete}
                className="text-sm text-muted-foreground"
              />
            ))}
          </>
        ) : (
          <>
            <EditableText
              value={slide.title}
              onSave={onTitleEdit}
              onEditComplete={onEditComplete}
              className="text-xl font-display font-bold text-foreground mb-5"
              as="h2"
            />
            <SlideContentRenderer
              layout={slide.layout}
              blocks={slide.contentBlocks}
              onContentEdit={onContentEdit}
              onEditComplete={onEditComplete}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ============ Content Renderer per Layout ============ */

function SlideContentRenderer({
  layout,
  blocks,
  onContentEdit,
  onEditComplete,
}: {
  layout: string;
  blocks: ContentBlock[];
  onContentEdit: (id: string, content: string) => void;
  onEditComplete: () => void;
}) {
  if (layout === 'title-two-column') {
    const mid = Math.ceil(blocks.length / 2);
    const left = blocks.slice(0, mid);
    const right = blocks.slice(mid);
    return (
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2.5 border-r border-border pr-4">
          {left.map(b => <BlockRenderer key={b.id} block={b} onEdit={onContentEdit} onEditComplete={onEditComplete} />)}
        </div>
        <div className="space-y-2.5">
          {right.map(b => <BlockRenderer key={b.id} block={b} onEdit={onContentEdit} onEditComplete={onEditComplete} />)}
        </div>
      </div>
    );
  }

  if (layout === 'title-quad') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {blocks.map(b => (
          <div key={b.id} className="bg-secondary/40 border border-border rounded-lg p-4">
            <EditableText
              value={b.content}
              onSave={(v) => onContentEdit(b.id, v)}
              onEditComplete={onEditComplete}
              className="text-sm font-medium text-foreground leading-relaxed"
            />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'title-timeline') {
    return (
      <div className="relative pl-4">
        <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-primary/20 rounded-full" />
        <div className="space-y-4">
          {blocks.map(b => (
            <div key={b.id} className="relative flex gap-3">
              <div className="absolute -left-[10.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
              <div className="flex-1 bg-muted/40 rounded-lg p-3 border border-border">
                <EditableText
                  value={b.content}
                  onSave={(v) => onContentEdit(b.id, v)}
                  onEditComplete={onEditComplete}
                  className="text-sm text-foreground leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'title-method-flow') {
    return (
      <div className="space-y-1">
        {blocks.map((b, i) => (
          <div key={b.id}>
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-lg p-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">
                {i + 1}
              </span>
              <EditableText
                value={b.content}
                onSave={(v) => onContentEdit(b.id, v)}
                onEditComplete={onEditComplete}
                className="text-sm text-foreground leading-relaxed flex-1"
              />
            </div>
            {i < blocks.length - 1 && (
              <div className="flex justify-center py-0.5">
                <ChevronDown className="w-4 h-4 text-primary/40" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'title-findings') {
    return (
      <div className="space-y-3">
        {blocks.map(b => (
          <div key={b.id} className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-start gap-3">
            <span className="flex-shrink-0 text-lg">💡</span>
            <EditableText
              value={b.content}
              onSave={(v) => onContentEdit(b.id, v)}
              onEditComplete={onEditComplete}
              className="text-sm text-foreground leading-relaxed font-medium"
            />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'title-results') {
    return (
      <div className="space-y-3">
        {blocks.map(b => (
          <div key={b.id} className={`rounded-lg p-3 ${
            b.type === 'finding' ? 'bg-accent/10 border border-accent/20' :
            b.type === 'heading' ? '' : 'bg-muted/40 border border-border'
          }`}>
            <EditableText
              value={b.content}
              onSave={(v) => onContentEdit(b.id, v)}
              onEditComplete={onEditComplete}
              className={`text-sm leading-relaxed ${
                b.type === 'finding' ? 'text-accent-foreground font-semibold' :
                b.type === 'heading' ? 'text-foreground font-display font-bold text-base mb-1' :
                'text-foreground'
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'title-summary') {
    return (
      <div className="space-y-4">
        {blocks.map(b => (
          <div key={b.id} className={`${
            b.type === 'summary' ? 'border-l-4 border-primary pl-4 py-2' : ''
          }`}>
            <EditableText
              value={b.content}
              onSave={(v) => onContentEdit(b.id, v)}
              onEditComplete={onEditComplete}
              className={`text-sm leading-relaxed ${
                b.type === 'summary' ? 'text-foreground italic' :
                b.type === 'finding' ? 'text-primary font-semibold bg-primary/5 rounded-lg p-3' :
                'text-foreground'
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  // Default: title-points, title-subpoints
  return (
    <div className="space-y-2.5">
      {blocks.map(b => <BlockRenderer key={b.id} block={b} onEdit={onContentEdit} onEditComplete={onEditComplete} />)}
    </div>
  );
}

function BlockRenderer({
  block: b,
  onEdit,
  onEditComplete,
}: {
  block: ContentBlock;
  onEdit: (id: string, content: string) => void;
  onEditComplete: () => void;
}) {
  if (b.type === 'heading') {
    return (
      <EditableText
        value={b.content}
        onSave={(v) => onEdit(b.id, v)}
        onEditComplete={onEditComplete}
        className="text-base font-display font-bold text-foreground mt-3 mb-1"
        as="h3"
      />
    );
  }
  if (b.type === 'point') {
    return (
      <div className="flex items-start gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-foreground leading-relaxed"
        />
      </div>
    );
  }
  if (b.type === 'subpoint') {
    return (
      <div className="flex items-start gap-2 ml-5">
        <span className="text-muted-foreground text-xs mt-0.5">–</span>
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-muted-foreground leading-relaxed"
        />
      </div>
    );
  }
  if (b.type === 'finding') {
    return (
      <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-primary font-medium leading-relaxed"
        />
      </div>
    );
  }
  if (b.type === 'summary') {
    return (
      <div className="border-t border-border pt-3 mt-4">
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-muted-foreground italic leading-relaxed"
        />
      </div>
    );
  }
  if (b.type === 'quad-item') {
    return (
      <div className="bg-secondary/50 rounded-lg p-3">
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-foreground font-medium leading-relaxed"
        />
      </div>
    );
  }
  if (b.type === 'timeline-item') {
    return (
      <div className="border-l-2 border-primary/30 pl-3 py-1">
        <EditableText
          value={b.content}
          onSave={(v) => onEdit(b.id, v)}
          onEditComplete={onEditComplete}
          className="text-sm text-foreground leading-relaxed"
        />
      </div>
    );
  }
  return (
    <EditableText
      value={b.content}
      onSave={(v) => onEdit(b.id, v)}
      onEditComplete={onEditComplete}
      className="text-sm text-foreground leading-relaxed"
    />
  );
}

/* ============ Notes Panel ============ */

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
