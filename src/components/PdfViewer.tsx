import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPdfBlob } from '@/lib/pdfStorage';

interface PdfViewerProps {
  storageKey?: string;
  className?: string;
}

const PdfViewer = ({ storageKey = 'current_pdf', className = '' }: PdfViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

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
        setCurrentPage(1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载 PDF 失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    try {
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelled') {
        console.error('PDF render error:', e);
      }
    }
  }, [pdf, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Auto-fit scale to container width
  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    (async () => {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || 400;
      setScale((containerWidth - 16) / viewport.width);
    })();
  }, [pdf]);

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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">{currentPage} / {numPages}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
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
      {/* Canvas */}
      <div className="flex-1 overflow-auto flex justify-center p-2 bg-muted/10">
        <canvas ref={canvasRef} className="shadow-sm" />
      </div>
    </div>
  );
};

export default PdfViewer;
