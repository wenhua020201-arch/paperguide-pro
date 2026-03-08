export interface PaperMeta {
  title: string;
  authors: string[];
  year: number;
  keywords: string[];
  topic: string;
  abstract?: string;
}

export interface OutlineNode {
  id: string;
  parentId: string | null;
  level: number;
  title: string;
  description: string;
  order: number;
  children: OutlineNode[];
  collapsed?: boolean;
  isPage?: boolean; // mark as separate PPT page
}

export interface ParagraphBlock {
  id: string;
  content: string;
  linkedSlideId?: string;
}

export interface ArticleSection {
  id: string;
  title: string;
  paragraphs: ParagraphBlock[];
}

export interface GuideArticle {
  sections: ArticleSection[];
}

export type SlideLayout =
  | 'title-points'
  | 'title-subpoints'
  | 'title-summary'
  | 'title-two-column'
  | 'title-findings'
  | 'title-method-flow'
  | 'title-results'
  | 'title-quad'
  | 'title-timeline'
  | 'cover';

export interface ContentBlock {
  id: string;
  type: 'heading' | 'point' | 'subpoint' | 'summary' | 'text' | 'finding' | 'quad-item' | 'timeline-item';
  content: string;
  children?: ContentBlock[];
}

export interface SlideNotes {
  mainTalk: string;
  extraExplanation: string;
  transitionSentence: string;
  tone: 'concise' | 'natural' | 'formal' | 'classroom';
}

export interface Slide {
  id: string;
  order: number;
  title: string;
  contentBlocks: ContentBlock[];
  layout: SlideLayout;
  linkedArticleSection?: string;
  notes: SlideNotes;
}

export type TemplateName = 'seminar' | 'course' | 'proposal' | 'crossfield';
export type ContentDensity = 'concise' | 'standard' | 'detailed';

export interface Template {
  id: TemplateName;
  name: string;
  description: string;
  tags: string[];
}

export interface Project {
  id: string;
  paper: PaperMeta;
  outline: OutlineNode;
  article: GuideArticle;
  slides: Slide[];
  template: TemplateName;
  density: ContentDensity;
  updatedAt: string;
}
