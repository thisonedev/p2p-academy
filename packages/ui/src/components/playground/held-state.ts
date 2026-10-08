import type { Edge, Node } from '@xyflow/react';
import type { ConsoleEntry } from '../lesson/console-types.js';
import type { PlaygroundNodeData } from './flow/types.js';

interface HeldState {
  nodes: Node<PlaygroundNodeData>[];
  edges: Edge[];
  entries: ConsoleEntry[];
  workflowName: string;
  fileHandle: FileSystemFileHandle | null;
  libraryId: string | null;
}

// Navigating to another route (Courses, etc.) unmounts PlaygroundCanvas entirely,
// so its own useState would reset on return. Held here instead, outside React, it
// survives that; it only clears on an actual page reload/app restart, or Reset.
export const held: { current: HeldState | null } = { current: null };
