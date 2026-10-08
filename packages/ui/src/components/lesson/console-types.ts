import type { MatchStatus } from '@academy/validation';
import type { OutputLine } from './lesson-types.js';

export interface LessonConsoleLessonContext {
  chapter: string;
  lesson: string;
  title?: string;
  reference?: string;
}

export interface ConsoleCheckResult {
  id: string;
  description: string;
  passed: boolean;
}

export type ConsoleEntry =
  | { kind: 'chat-user'; id: string; content: string }
  | { kind: 'chat-assistant'; id: string; content: string; streaming: boolean; raw?: boolean }
  | {
      kind: 'run';
      id: string;
      lines: OutputLine[];
      status: 'running' | 'ok' | 'err' | 'stopped';
      /** Paired device's display name; unset/null means this device. */
      deviceLabel?: string | null;
      /** Label of a stage opener closed by a ✓ in a later entry, which happens
       *  when output sits between the two halves of one stage. */
      settledStage?: string;
    }
  | {
      kind: 'check';
      id: string;
      structural: ConsoleCheckResult[];
      ai: 'idle' | 'loading' | 'done' | 'error' | 'unavailable';
      /** 'match' means a formatting-only comparison against the answer
       *  matched, decided client-side without calling the AI. */
      aiVerdict?: MatchStatus;
      aiReason?: string;
      aiError?: string;
    }
  | {
      kind: 'confirm';
      id: string;
      message: string;
      /** null until answered; the playground's Ask-for-confirmation node awaits it. */
      answer: 'yes' | 'no' | null;
    }
  | {
      kind: 'media';
      id: string;
      /** 'pdf' and 'zip' have nothing to play or show inline, so they render
       *  as a named row whose only affordance is the Save button. */
      mediaType: 'image' | 'audio' | 'video' | 'pdf' | 'zip';
      dataUrl: string;
      caption?: string;
    };

/** Timeline panel. Typing happens in the separate `ChatInputBar`, which
 *  appends into the same `entries`. */
export interface LessonConsoleProps {
  entries: ConsoleEntry[];
  /** Cancels an in-progress AI review for the given check entry. */
  onStopCheck: (entryId: string) => void;
  /** "Check answer" only exists in a lesson; playground has no such thing to mention. */
  emptyStateText?: string;
  /** Answers a pending 'confirm' entry. Lessons never produce one, so this is optional. */
  onConfirm?: (entryId: string, answer: 'yes' | 'no') => void;
  /** The lesson workspace stacks this below the editor and needs the seam; playground's
   *  panel has nothing above it in that column, so the line has nothing to separate. */
  topBorder?: boolean;
}

/** Chat input for the bottom nav. Owns the model/send/stop machinery;
 *  replies land in the shared `entries` array. */
export interface ChatInputBarProps {
  entries: ConsoleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ConsoleEntry[]>>;
  lessonContext: LessonConsoleLessonContext | null;
  readOnly?: boolean;
  /** When set, a Chat/Build toggle appears and a submit in Build mode calls
   *  this instead of the normal chat.send path. Playground-only; lesson pages
   *  never pass this, so their input bar is unchanged. */
  onBuildSubmit?: (prompt: string) => void;
}
