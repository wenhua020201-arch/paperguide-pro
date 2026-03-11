// ─── Pipeline intermediate types ───

export interface PaperSection {
  id: string;
  title: string;
  level: number;
  content: string;
}

export interface SectionSummary {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  nodeType:
    | 'background'
    | 'research_question'
    | 'theory'
    | 'method'
    | 'data'
    | 'experiment'
    | 'result'
    | 'discussion'
    | 'limitation'
    | 'implication'
    | 'conclusion'
    | 'other';
  slideWorthy: boolean;
  importance: 'high' | 'medium' | 'low';
}

export interface SectionSummariesResult {
  sections: SectionSummary[];
}

export interface PresentationUnit {
  unitId: string;
  title: string;
  sourceSections: string[];
  focus: string;
  importance: 'high' | 'medium' | 'low';
  recommendedDepth: 'low' | 'medium' | 'high';
  suggestedRole?: string;
}

export interface PresentationUnitsResult {
  style: 'seminar' | 'course' | 'proposal' | 'crossfield';
  units: PresentationUnit[];
}

export type PipelineLayout =
  | 'cover'
  | 'agenda'
  | 'title-bullets'
  | 'two-column'
  | 'comparison'
  | 'timeline'
  | 'data-card'
  | 'summary';

export interface SlidePlanItem {
  slideNo: number;
  title: string;
  role: 'cover' | 'agenda' | 'content' | 'summary';
  coveredUnits: string[];
  layout: PipelineLayout;
  purpose: string;
  rationale: string;
}

export interface SlidePlanResult {
  totalSlides: number;
  slides: SlidePlanItem[];
}

export interface SlideContentBlock {
  type: 'point' | 'subpoint' | 'finding' | 'summary' | 'text' | 'heading';
  text: string;
}

export interface PipelineSlideNotes {
  mainTalk: string;
  extraExplanation: string;
  transitionSentence: string;
}

export interface SlideResult {
  slideNo: number;
  title: string;
  layout: PipelineLayout;
  contentBlocks: SlideContentBlock[];
  notes: PipelineSlideNotes;
}

export interface SlidesGeneratedResult {
  slides: SlideResult[];
  generatedCount: number;
  totalCount: number;
}

// Pipeline layout → Workspace layout mapping
export const LAYOUT_MAP: Record<PipelineLayout, string> = {
  cover: 'cover',
  agenda: 'title-points',
  'title-bullets': 'title-points',
  'two-column': 'title-two-column',
  comparison: 'title-two-column',
  timeline: 'title-timeline',
  'data-card': 'title-findings',
  summary: 'title-summary',
};

// Pipeline stages in order
export const PIPELINE_STAGES = [
  'section_summarized',
  'presentation_units_extracted',
  'slide_planned',
  'slides_generated',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface GenerationState {
  paperParseResult?: { paper: any; sections: PaperSection[] };
  sectionSummaries?: SectionSummariesResult;
  presentationUnits?: PresentationUnitsResult;
  slidePlan?: SlidePlanResult;
  slides?: SlideResult[];
  currentStyle?: 'seminar' | 'course' | 'proposal' | 'crossfield';
  targetCount?: number;
  currentSlideIndex?: number;
  generatedSlideIds?: number[];
  dirtySlideIds?: number[];
  notesRefreshQueue?: number[];
}
