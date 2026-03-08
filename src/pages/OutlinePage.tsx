import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, ChevronDown, GripVertical, MoreHorizontal,
  Plus, Trash2, ArrowUp, ArrowDown, Indent, Outdent, Network, List,
  FileText as FileTextIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_PAPER, MOCK_OUTLINE } from '@/data/mockData';
import type { OutlineNode } from '@/types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const OutlinePage = () => {
  const navigate = useNavigate();
  const [outline, setOutline] = useState<OutlineNode>(MOCK_OUTLINE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'outline' | 'mindmap'>('outline');

  const findNode = useCallback((root: OutlineNode, id: string): OutlineNode | null => {
    if (root.id === id) return root;
    for (const c of root.children) {
      const found = findNode(c, id);
      if (found) return found;
    }
    return null;
  }, []);

  const selectedNode = selectedId ? findNode(outline, selectedId) : null;

  const toggleCollapse = (id: string) => {
    const toggle = (node: OutlineNode): OutlineNode => {
      if (node.id === id) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children.map(toggle) };
    };
    setOutline(toggle(outline));
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

  const paper = MOCK_PAPER;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/upload')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-display font-semibold text-foreground">导读大纲</h1>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setView('outline')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'outline' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <List className="w-4 h-4 inline mr-1" />大纲
          </button>
          <button
            onClick={() => setView('mindmap')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'mindmap' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Network className="w-4 h-4 inline mr-1" />思维导图
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - paper info */}
        <aside className="w-64 border-r border-border p-4 overflow-y-auto hidden lg:block">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">论文标题</p>
              <p className="text-sm font-medium text-foreground">{paper.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">作者</p>
              <p className="text-sm text-foreground">{paper.authors.slice(0, 3).join(', ')} 等</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">年份</p>
              <p className="text-sm text-foreground">{paper.year}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">关键词</p>
              <div className="flex flex-wrap gap-1">
                {paper.keywords.map(k => (
                  <span key={k} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{k}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">研究主题</p>
              <p className="text-sm text-foreground">{paper.topic}</p>
            </div>
          </div>
        </aside>

        {/* Main - outline tree or mindmap */}
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'outline' ? (
            <div className="max-w-3xl mx-auto">
              <TreeNodeComponent
                node={outline}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={toggleCollapse}
                onDelete={deleteNode}
                onAddChild={addChild}
                isRoot
              />
            </div>
          ) : (
            <MindmapPreview outline={outline} />
          )}
        </main>

        {/* Right - detail panel */}
        <aside className="w-72 border-l border-border p-4 overflow-y-auto hidden xl:block">
          {selectedNode ? (
            <motion.div key={selectedNode.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">节点标题</p>
                <p className="text-sm font-semibold text-foreground">{selectedNode.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">说明</p>
                <p className="text-sm text-foreground">{selectedNode.description}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">层级</p>
                <p className="text-sm text-foreground">第 {selectedNode.level} 级</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">子节点数</p>
                <p className="text-sm text-foreground">{selectedNode.children.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">预计页数</p>
                <p className="text-sm text-foreground">{selectedNode.children.length > 0 ? Math.max(1, Math.ceil(selectedNode.children.length / 2)) : 1} 页</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addChild(selectedNode.id)}>
                  <Plus className="w-3.5 h-3.5 mr-2" />新增子节点
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-destructive" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" />删除节点
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <FileTextIcon className="w-3.5 h-3.5 mr-2" />标记为单独一页
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="text-sm text-muted-foreground text-center mt-12">选择一个节点查看详情</div>
          )}
        </aside>
      </div>

      {/* Bottom */}
      <div className="border-t border-border px-6 py-4 flex justify-end">
        <Button onClick={() => navigate('/template')} size="lg">
          生成导读工作台
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Tree node component
function TreeNodeComponent({
  node, selectedId, onSelect, onToggle, onDelete, onAddChild, isRoot, depth = 0
}: {
  node: OutlineNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  isRoot?: boolean;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`group flex items-start gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/8 border border-primary/20' : 'hover:bg-surface-hover border border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />

        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle(node.id); }} className="mt-0.5 flex-shrink-0">
            {node.collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-foreground ${isRoot ? 'font-display text-base' : ''}`}>
            {node.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">{node.description}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary flex-shrink-0" onClick={e => e.stopPropagation()}>
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onAddChild(node.id)}>
              <Plus className="w-3.5 h-3.5 mr-2" />新增子节点
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ArrowUp className="w-3.5 h-3.5 mr-2" />上移
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ArrowDown className="w-3.5 h-3.5 mr-2" />下移
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Indent className="w-3.5 h-3.5 mr-2" />缩进
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Outdent className="w-3.5 h-3.5 mr-2" />取消缩进
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
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Simple mindmap preview
function MindmapPreview({ outline }: { outline: OutlineNode }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex items-start gap-8">
        {/* Center node */}
        <div className="flex flex-col items-center">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm max-w-48 text-center">
            {outline.title}
          </div>
          <div className="flex mt-6 gap-4 flex-wrap justify-center max-w-4xl">
            {outline.children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <div className="bg-card border border-border px-3 py-1.5 rounded-md text-xs font-medium text-foreground shadow-sm max-w-36 text-center">
                  {child.title}
                </div>
                {child.children.length > 0 && (
                  <div className="flex mt-3 gap-2 flex-wrap justify-center">
                    {child.children.map(sub => (
                      <div key={sub.id} className="flex flex-col items-center">
                        <div className="w-px h-3 bg-border" />
                        <div className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground max-w-28 text-center truncate">
                          {sub.title}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutlinePage;
