# 论文导读PPT生成器 - 产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品名称
论文导读PPT生成器 (Paper Guide Generator)

### 1.2 产品定位
一款面向科研人员和学生的AI驱动工具，能够自动解析学术论文PDF，生成结构化导读大纲，并根据用户选择的汇报场景智能生成PPT内容和导读文章。

### 1.3 核心价值
- **节省时间**：将数小时的论文阅读和PPT制作压缩到分钟级别
- **结构化理解**：AI辅助提取论文核心贡献、方法、实验等关键信息
- **场景适配**：针对不同汇报场景（组会、课程、开题、跨领域）生成风格各异的内容
- **信息完整**：PPT内容详实，把事情讲清楚，把数据摆明白

---

## 2. 用户角色

| 角色 | 描述 | 核心需求 |
|------|------|----------|
| 研究生 | 需要在组会汇报论文 | 快速理解论文，制作批判性分析PPT |
| 本科生 | 课程作业需要讲解论文 | 用通俗语言解释复杂概念 |
| 博士生 | 开题/综述需要梳理文献 | 对比方法演进，分析研究趋势 |
| 跨领域研究者 | 向非专业听众介绍研究 | 避免术语，强调研究意义 |

---

## 3. 功能需求

### 3.1 首页 (Index)

#### 功能描述
- 展示历史项目列表，支持恢复进度
- 提供"新建项目"入口

#### 数据存储
- 项目列表存储在 `localStorage` (`paper-guide-projects`)
- 每个项目记录包含：`id`, `title`, `template`, `slideCount`, `updatedAt`, `step`

#### 交互
- 点击项目卡片 → 根据 `step` 字段跳转到对应页面
- 点击"新建项目" → 跳转上传页面

---

### 3.2 上传页面 (UploadPage)

#### 功能描述
1. 支持拖拽或点击上传 PDF 文件
2. 客户端提取 PDF 文本（使用 pdfjs-dist）
3. 将 PDF 原文存储到 IndexedDB（突破 localStorage 5MB 限制）
4. 调用 AI 解析论文，生成元信息和导读大纲

#### AI 解析流程
```
PDF 文件 → 文本提取 → paper-parse Edge Function → 返回 {paper, outline}
```

#### 解析步骤展示
1. 正在提取论文文本…
2. 正在识别论文结构…
3. 正在提取核心贡献…
4. 正在分析方法与实验…
5. 正在生成导读大纲…

#### 数据模型

**PaperMeta**
```typescript
interface PaperMeta {
  title: string;
  authors: string[];
  year: number;
  keywords: string[];
  topic: string;
  abstract?: string;
}
```

**OutlineNode**
```typescript
interface OutlineNode {
  id: string;
  parentId: string | null;
  level: number;
  title: string;
  description: string;
  order: number;
  children: OutlineNode[];
  collapsed?: boolean;
  isPage?: boolean;
}
```

---

### 3.3 大纲编辑页面 (OutlinePage)

#### 功能描述
1. **左侧**：PDF 原文预览（iframe），独立滚动
2. **右侧**：大纲树形编辑器

#### 大纲编辑功能
- **双击编辑**：支持双击编辑节点标题和描述
- **节点操作菜单**：
  - 添加子节点
  - 删除节点
  - **置顶** (Move to Top)
  - 上移
  - 下移
  - **置底** (Move to Bottom)
- **折叠/展开**：支持折叠子节点

#### 布局要求
- PDF 查看器与大纲编辑器独立滚动
- PDF 面板可折叠隐藏

---

### 3.4 模板选择页面 (TemplatePage)

#### 功能描述
展示4种汇报模板，每种模板用**内置的 Transformer 介绍示例**展示风格差异

#### 四种模板

| 模板 ID | 名称 | 风格特点 | 示例内容 |
|---------|------|----------|----------|
| `seminar` | 组会汇报版 | 批判性视角，强调方法设计合理性、实验完备性 | 展示注意力机制的计算复杂度分析 |
| `course` | 课程 Presentation 版 | 初学者友好，用类比解释概念 | "Self-Attention 就像一群人开会讨论" |
| `proposal` | 开题/综述版 | 梳理时间线，对比方法演进 | 展示 RNN → LSTM → Transformer 演进 |
| `crossfield` | 跨方向交流版 | 避免术语，强调研究意义 | "为什么这个架构改变了AI的发展方向" |

#### 内容密度选项
- `concise`：简洁模式，每页2-3个核心要点
- `standard`：标准模式，每页3-5个要点（默认）
- `detailed`：详细模式，每页5-8个要点

---

### 3.5 工作台页面 (WorkspacePage)

#### 功能描述
1. **左侧**：PDF 原文预览（与大纲页一致）
2. **中间**：PPT 幻灯片编辑器
3. **右侧**：导读文章 / 演讲笔记

#### AI 生成逻辑（核心！）

**输入**
- 用户编辑后的大纲（作为 prompt 骨架）
- 用户选择的模板
- 用户选择的内容密度
- 论文元信息（标题、作者、摘要等）

**输出**
- `slides[]`：PPT 幻灯片数组
- `article`：导读文章

**生成规则**
1. **以大纲为骨架**：大纲的每个一级节点对应PPT的一个章节
2. **不强制一章一页**：根据信息量决定页数，信息量大的章节可拆成2-3页
3. **内容要充实**：终极要求是把事情讲清楚，把数据摆明白
4. **善用布局格式**：根据内容类型选择合适的布局

#### PPT 布局类型

| Layout | 用途 | 适用场景 |
|--------|------|----------|
| `cover` | 封面页 | 论文标题、作者信息 |
| `title-points` | 标题+要点列表 | 最常用，一般内容 |
| `title-subpoints` | 标题+要点+子要点 | 有层级的内容 |
| `title-two-column` | 双栏对比 | 优缺点对比、方法对比 |
| `title-findings` | 核心发现 | 突出重要结论 |
| `title-summary` | 总结页 | 章节/全文总结 |
| `title-quad` | 四分框布局 | 4个并列概念/组件介绍 |
| `title-timeline` | 时间线布局 | 研究脉络、方法演进 |
| `title-method-flow` | 方法流程图 | 方法步骤说明 |
| `title-results` | 结果展示 | 数据对比、实验结果 |

#### 内容块类型

| Type | 用途 |
|------|------|
| `point` | 普通要点 |
| `subpoint` | 子要点（缩进显示） |
| `finding` | 核心发现（高亮显示） |
| `summary` | 总结性文字 |
| `text` | 普通文本 |
| `heading` | 小标题 |
| `quad-item` | 四分框中的一项 |
| `timeline-item` | 时间线中的一个节点 |

#### 演讲笔记结构
```typescript
interface SlideNotes {
  mainTalk: string;        // 这页要讲什么
  extraExplanation: string; // 补充说明
  transitionSentence: string; // 过渡到下一页的衔接语
  tone: 'concise' | 'natural' | 'formal' | 'classroom';
}
```

---

## 4. 技术架构

### 4.1 前端
- **框架**：React + TypeScript + Vite
- **UI 组件**：shadcn/ui + Tailwind CSS
- **动画**：Framer Motion
- **PDF 解析**：pdfjs-dist（客户端提取文本）

### 4.2 后端
- **平台**：Lovable Cloud (Supabase)
- **Edge Functions**：
  - `paper-parse`：解析论文，生成元信息和大纲
  - `workspace-generate`：根据大纲生成PPT和文章

### 4.3 AI 服务
- **模型**：阿里通义千问 Qwen-3-Max
- **接口**：DashScope OpenAI 兼容 API
- **调用方式**：Function Calling（结构化输出）

### 4.4 数据存储
- **localStorage**：项目列表、当前项目数据
- **IndexedDB**：PDF 文件（突破 5MB 限制）

---

## 5. 数据流

```
┌─────────────┐
│  上传 PDF   │
└──────┬──────┘
       │ 提取文本
       ▼
┌─────────────┐     ┌──────────────┐
│ paper-parse │────▶│ PaperMeta +  │
│   (AI)      │     │ OutlineNode  │
└─────────────┘     └──────┬───────┘
                           │ 用户编辑大纲
                           ▼
                    ┌──────────────┐
                    │ 选择模板/密度 │
                    └──────┬───────┘
                           │
                           ▼
┌──────────────────┐     ┌──────────────┐
│workspace-generate│────▶│ Slides[] +   │
│      (AI)        │     │ GuideArticle │
└──────────────────┘     └──────────────┘
```

---

## 6. 页面流程

```
首页 (/index)
    │
    ├── 新建项目 → 上传页面 (/upload)
    │                   │
    │                   ▼
    │              大纲编辑 (/outline)
    │                   │
    │                   ▼
    │              模板选择 (/template)
    │                   │
    │                   ▼
    │              工作台 (/workspace)
    │
    └── 恢复项目 → 根据 step 跳转对应页面
```

---

## 7. 项目进度追踪

| Step | 状态 | 页面 |
|------|------|------|
| `outline` | 大纲编辑中 | /outline |
| `template` | 模板选择中 | /template |
| `workspace` | 工作台编辑中 | /workspace |
| `done` | 已完成 | /workspace |

---

## 8. 未来迭代方向

### 8.1 导出功能
- 导出为 PPTX 文件（使用 pptxgenjs）
- 导出为 PDF 讲义
- 导出为 Markdown 文档

### 8.2 协作功能
- 用户登录
- 项目云端存储
- 多人协作编辑

### 8.3 AI 增强
- 配图生成（根据内容自动配图）
- 多语言支持
- 个性化风格学习

### 8.4 更多场景
- 会议汇报模板
- 项目答辩模板
- 技术分享模板

---

## 9. 附录

### 9.1 Edge Function 配置
```toml
[functions.paper-parse]
verify_jwt = false

[functions.workspace-generate]
verify_jwt = false
```

### 9.2 关键依赖
- pdfjs-dist: PDF 文本提取
- framer-motion: 动画效果
- sonner: Toast 通知
- lucide-react: 图标库
