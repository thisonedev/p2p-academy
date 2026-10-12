import type { CurriculumChapter, CurriculumLesson } from '@academy/courses';

export interface LessonTest {
  id: string;
  description: string;
  pattern?: string;
  contains?: string;
}

export interface LessonQuestionAnswer {
  text: string;
  correct: boolean;
  /** Shown when this wrong answer is picked. */
  feedback?: string;
}

export interface LessonQuestion {
  id: string;
  text: string;
  answers: LessonQuestionAnswer[];
}

export interface LessonArgvSlot {
  name: string;
  from: 'state:lastProviderPublicKey' | 'literal';
  default?: string;
  label?: string;
}

export type OutputLine = {
  stream: 'stdout' | 'stderr';
  line: string;
};

export type LessonCostKind = 'heavy-run' | 'large-download';

/** One row of a lesson's run cost, e.g. `Free disk space` and `about 19 GB`. */
export interface LessonRequirement {
  label: string;
  value: string;
}

export interface LessonData {
  title: string;
  description?: string;
  startingCode: string;
  lessonReference?: string;
  answer: string;
  tests: LessonTest[];
  hints: string[];
  expectedOutput: string[];
  questions?: LessonQuestion[];
  platforms: Array<'node' | 'web' | 'mobile' | 'desktop'>;
  sourceExample?: string;
  prevUrl?: string;
  nextUrl?: string;
  position?: { current: number; total: number };
  firstLessonHref?: string;
  currentChapter?: CurriculumChapter;
  currentLesson?: CurriculumLesson;
  readOnly?: boolean;
  argv?: LessonArgvSlot[];
  /** False for a lesson that only works on the machine running it, e.g. one
   *  that serves a port a paired device could never reach. Defaults to true. */
  pairedMode?: boolean;
  /** What this lesson costs to run, when that is more than the rest. */
  requirements?: LessonRequirement[];
  /** The lesson's cost labels, one or both. Defaults to 'heavy-run' when there are requirements. */
  requirementsKind?: LessonCostKind | LessonCostKind[];
  /** False for a lesson that names a model it may never load. Defaults to true. */
  prefetchModels?: boolean;
}
