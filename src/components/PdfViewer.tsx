import { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPdfBlob } from '@/lib/pdfStorage';

interface PdfViewerProps {
  storageKey?: string;
  className?: string;
}

const PdfViewer = ({ storageKey = 'current_pdf', className = '' }: PdfViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasks = useRef<Map<number, any>>(new Map());
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const blob = await getPdfBlob(storageKey);
        if (!blob || cancelled) {
          if (!blob) setError('未找到 PDF 文件');
          setLoading(false);
          return;
        }
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const arrayBuffer = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载 PDF 失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Auto-fit scale to container width
  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    (async () => {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || 400;
      setScale((containerWidth - 32) / viewport.width);
    })();
  }, [pdf]);

  // Render a single page onto its canvas
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf) return;
    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return;

    // Cancel existing render
    const existing = renderTasks.current.get(pageNum);
    if (existing) {
      try { existing.cancel(); } catch {}
    }

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTasks.current.set(pageNum, task);
      await task.promise;
      setRenderedPages(prev => new Set(prev).add(pageNum));
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelled' && e?.name !== 'RenderingCancelledException') {
        console.error('PDF render error:', e);
      }
    }
  }, [pdf, scale]);

  // Render all pages when pdf or scale changes
  useEffect(() => {
    if (!pdf) return;
    setRenderedPages(new Set());
    for (let i = 1; i <= numPages; i++) {
      renderPage(i);
    }
  }, [pdf, scale, numPages, renderPage]);

  const setCanvasRef = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (el) {
      canvasRefs.current.set(pageNum, el);
    }
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full text-sm text-muted-foreground ${className}`}>
        加载 PDF 中…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full text-sm text-muted-foreground ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{numPages} 页</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[36px] text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {/* Scrollable pages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-2 bg-muted/10 space-y-2">
        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
          <div key={pageNum} className="flex justify-center">
            <canvas
              ref={(el) => setCanvasRef(pageNum, el)}
              className="shadow-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfViewer;
