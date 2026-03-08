import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, ChevronDown, GripVertical, MoreHorizontal,
  Plus, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  FileText as FileTextIcon, Check, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MOCK_PAPER, MOCK_OUTLINE } from '@/data/mockData';
import type { OutlineNode, PaperMeta } from '@/types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const OutlinePage = () => {
  const navigate = useNavigate();
  const [outline, setOutline] = useState<OutlineNode>(MOCK_OUTLINE);
  const [paper, setPaper] = useState<PaperMeta>(MOCK_PAPER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(true);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('current_project');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.outline) setOutline(data.outline);
        if (data.paper) setPaper(data.paper);
      }
    } catch {}
    // Load PDF
    try {
      const pdf = localStorage.getItem('current_pdf_base64');
      if (pdf) setPdfDataUrl(pdf);
    } catch {}
  }, []);

  const findNode = useCallback((root: OutlineNode, id: string): OutlineNode | null => {
    if (root.id === id) return root;
    for (const c of root.children) {
      const found = findNode(c, id);
      if (found) return found;
    }
    return null;
  }, []);

  const selectedNode = selectedId ? findNode(outline, selectedId) : null;

  const updateNode = (id: string, updates: Partial<OutlineNode>) => {
    const update = (node: OutlineNode): OutlineNode => {
      if (node.id === id) return { ...node, ...updates };
      return { ...node, children: node.children.map(update) };
    };
    setOutline(update(outline));
  };

  const toggleCollapse = (id: string) => {
    updateNode(id, { collapsed: !findNode(outline, id)?.collapsed });
  };

  const deleteNode = (id: string) => {
    const remove = (node: OutlineNode): OutlineNode => ({
      ...node,
      children: node.children.filter(c => c.id !== id).map(remove),
    });
    setOutline(remove(outline));
    if (selectedId === id) setSelectedId(null);
  };

  const addChild = (parentId: string) => {
    const newNode: OutlineNode = {
      id: `n-${Date.now()}`,
      parentId,
      level: 0,
      title: '新节点',
      description: '点击编辑说明',
      order: 0,
      children: [],
    };
    const add = (node: OutlineNode): OutlineNode => {
      if (node.id === parentId) {
        const child = { ...newNode, level: node.level + 1, order: node.children.length };
        return { ...node, children: [...node.children, child], collapsed: false };
      }
      return { ...node, children: node.children.map(add) };
    };
    setOutline(add(outline));
  };

  const moveNode = (parentId: string | null, nodeId: string, direction: 'up' | 'down') => {
    const reorder = (node: OutlineNode): OutlineNode => {
      const idx = node.children.findIndex(c => c.id === nodeId);
      if (idx >= 0) {
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= node.children.length) return node;
        const newChildren = [...node.children];
        [newChildren[idx], newChildren[newIdx]] = [newChildren[newIdx], newChildren[idx]];
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children.map(reorder) };
    };
    setOutline(reorder(outline));
  };

  const moveNodeToEdge = (nodeId: string, edge: 'top' | 'bottom') => {
    const reorder = (node: OutlineNode): OutlineNode => {
      const idx = node.children.findIndex(c => c.id === nodeId);
      if (idx >= 0) {
        const newChildren = [...node.children];
        const [moved] = newChildren.splice(idx, 1);
        if (edge === 'top') newChildren.unshift(moved);
        else newChildren.push(moved);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children.map(reorder) };
    };
    setOutline(reorder(outline));
  };

  const dragNodeId = useRef<string | null>(null);
  const dragParentId = useRef<string | null>(null);

  const handleDragStart = (nodeId: string, parentId: string | null) => {
    dragNodeId.current = nodeId;
    dragParentId.current = parentId;
  };

  const handleDrop = (targetNodeId: string, targetParentId: string | null) => {
    if (!dragNodeId.current || dragNodeId.current === targetNodeId) return;
    if (dragParentId.current !== targetParentId) return;
    const reorder = (node: OutlineNode): OutlineNode => {
      const dragIdx = node.children.findIndex(c => c.id === dragNodeId.current);
      const dropIdx = node.children.findIndex(c => c.id === targetNodeId);
      if (dragIdx >= 0 && dropIdx >= 0) {
        const newChildren = [...node.children];
        const [moved] = newChildren.splice(dragIdx, 1);
        newChildren.splice(dropIdx, 0, moved);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children.map(reorder) };
    };
    setOutline(reorder(outline));
    dragNodeId.current = null;
  };

  // Persist
  useEffect(() => {
    try {
      const saved = localStorage.getItem('current_project');
      if (saved) {
        const data = JSON.parse(saved);
        data.outline = outline;
        localStorage.setItem('current_project', JSON.stringify(data));
      }
    } catch {}
  }, [outline]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/upload')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">导读大纲</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPdfOpen(!pdfOpen)}>
            {pdfOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            <span className="ml-1 text-xs">原文</span>
          </Button>
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
                  {pdfDataUrl ? (
                    <iframe
                      src={pdfDataUrl}
                      className="w-full h-full border-0"
                      title="论文 PDF"
                    />
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

        {/* Main outline editor */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <TreeNodeComponent
              node={outline}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggle={toggleCollapse}
              onDelete={deleteNode}
              onAddChild={addChild}
              onUpdate={updateNode}
              onMove={moveNode}
              onMoveToEdge={moveNodeToEdge}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              isRoot
            />
          </div>
        </main>

        {/* Right panel - node details */}
        <aside className="w-72 border-l border-border p-4 overflow-y-auto hidden xl:block">
          {selectedNode ? (
            <motion.div key={selectedNode.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">节点标题</p>
                <Input
                  value={selectedNode.title}
                  onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">说明</p>
                <Textarea
                  value={selectedNode.description}
                  onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
                  className="text-sm min-h-[60px]"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">层级</p>
                <p className="text-sm text-foreground">第 {selectedNode.level} 级</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">子节点数</p>
                <p className="text-sm text-foreground">{selectedNode.children.length}</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addChild(selectedNode.id)}>
                  <Plus className="w-3.5 h-3.5 mr-2" />新增子节点
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-destructive" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" />删除节点
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="text-sm text-muted-foreground text-center mt-12">选择一个节点查看详情</div>
          )}
        </aside>
      </div>

      <div className="border-t border-border px-6 py-4 flex justify-end">
        <Button onClick={() => navigate('/template')} size="lg">
          选择汇报模板
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

function TreeNodeComponent({
  node, selectedId, onSelect, onToggle, onDelete, onAddChild, onUpdate, onMove, onMoveToEdge, onDragStart, onDrop, isRoot, depth = 0
}: {
  node: OutlineNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onUpdate: (id: string, updates: Partial<OutlineNode>) => void;
  onMove: (parentId: string | null, nodeId: string, direction: 'up' | 'down') => void;
  onMoveToEdge: (nodeId: string, edge: 'top' | 'bottom') => void;
  onDragStart: (nodeId: string, parentId: string | null) => void;
  onDrop: (targetNodeId: string, targetParentId: string | null) => void;
  isRoot?: boolean;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(node.description);
  const [dragOver, setDragOver] = useState(false);

  const commitTitle = () => {
    if (editTitle.trim()) onUpdate(node.id, { title: editTitle.trim() });
    setEditingTitle(false);
  };

  const commitDesc = () => {
    onUpdate(node.id, { description: editDesc.trim() });
    setEditingDesc(false);
  };

  return (
    <div>
      <div
        draggable={!isRoot}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(node.id, node.parentId);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); onDrop(node.id, node.parentId); }}
        className={`group flex items-start gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/8 border border-primary/20' : 'hover:bg-secondary/50 border border-transparent'
        } ${dragOver ? 'border-primary/40 bg-primary/5' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {!isRoot && (
          <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
        )}

        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle(node.id); }} className="mt-0.5 flex-shrink-0">
            {node.collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                autoFocus
                className="h-6 text-sm px-1"
              />
              <button onClick={commitTitle} className="p-0.5"><Check className="w-3.5 h-3.5 text-primary" /></button>
              <button onClick={() => setEditingTitle(false)} className="p-0.5"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          ) : (
            <p
              className={`text-sm font-medium text-foreground ${isRoot ? 'font-display text-base' : ''}`}
              onDoubleClick={(e) => { e.stopPropagation(); setEditTitle(node.title); setEditingTitle(true); }}
            >
              {node.title}
            </p>
          )}
          {editingDesc ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitDesc(); if (e.key === 'Escape') setEditingDesc(false); }}
                autoFocus
                className="h-5 text-xs px-1"
              />
              <button onClick={commitDesc} className="p-0.5"><Check className="w-3 h-3 text-primary" /></button>
              <button onClick={() => setEditingDesc(false)} className="p-0.5"><X className="w-3 h-3 text-muted-foreground" /></button>
            </div>
          ) : (
            <p
              className="text-xs text-muted-foreground truncate cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditDesc(node.description); setEditingDesc(true); }}
            >
              {node.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary flex-shrink-0" onClick={e => e.stopPropagation()}>
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => { setEditTitle(node.title); setEditingTitle(true); }}>
              ✏️ 编辑标题
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditDesc(node.description); setEditingDesc(true); }}>
              ✏️ 编辑说明
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddChild(node.id)}>
              <Plus className="w-3.5 h-3.5 mr-2" />新增子节点
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveToEdge(node.id, 'top')}>
              <ChevronsUp className="w-3.5 h-3.5 mr-2" />置顶
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(node.parentId, node.id, 'up')}>
              <ArrowUp className="w-3.5 h-3.5 mr-2" />上移
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(node.parentId, node.id, 'down')}>
              <ArrowDown className="w-3.5 h-3.5 mr-2" />下移
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveToEdge(node.id, 'bottom')}>
              <ChevronsDown className="w-3.5 h-3.5 mr-2" />置底
            </DropdownMenuItem>
            {!isRoot && (
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-2" />删除
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && !node.collapsed && (
        <div>
          {node.children.map(child => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onMove={onMove}
              onMoveToEdge={onMoveToEdge}
              onDragStart={onDragStart}
              onDrop={onDrop}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default OutlinePage;
