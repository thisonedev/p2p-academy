import { type Node, type Edge } from '@xyflow/react';
import { PLAYGROUND_NODE_DEFS } from './node-defs.js';
import type { PlaygroundNodeData } from './types.js';

// Matches the `kind` tag each backend's model-status event carries, so a
// download/load line reads as "the X model" instead of a bare model name.
const MODEL_KIND_LABEL: Record<string, string> = {
  voice: 'voice model',
  ai: 'AI model',
  image: 'image model',
  video: 'video model',
  music: 'music model',
  ocr: 'text-reading model',
  translate: 'translation model',
};

// `→ label...` / `  ✓ outcome` on stderr is the exact convention
// lesson/stages.ts's splitStages() parses into the connected-dot rail
// (lesson/console.tsx's StageRow); this rides that same rail, not a lookalike.
export function formatModelStatusLine(status: {
  name: string;
  kind: string;
  phase: 'downloading' | 'loading' | 'ready';
  downloaded?: number;
  total?: number;
  cancelled?: boolean;
}): string {
  const noun = MODEL_KIND_LABEL[status.kind] ?? 'model';
  if (status.phase === 'ready') {
    return `  ✓ ${status.cancelled ? 'Stopped loading' : 'Loaded'} the ${noun} (${status.name})`;
  }
  // The percentage goes before the "...", which tells splitStages
  // (lesson/stages.ts) this line is a real phase it should later swap for
  // "Loaded". A trailing "50%" broke that and stuck the line at "Loading".
  const pct = status.total
    ? ` ${Math.min(100, Math.round(((status.downloaded ?? 0) / status.total) * 100))}%`
    : '';
  const verb = status.phase === 'downloading' ? 'Downloading' : 'Loading';
  return `→ ${verb} the ${noun} (${status.name})${pct}...`;
}

// Only a model-progress line may collapse into the one before it. Matching a
// bare "→" would let a progress tick overwrite a node's own activity line and
// leave its closing ✓ with no opener to pair with.
export const MODEL_STATUS_OPEN = /^→ (?:Downloading|Loading) the /;

let idSeq = 1;

export const nextId = () => `n${idSeq++}`;

let entrySeq = 1;

export const nextEntryId = () => `re${entrySeq++}`;

export function makeNode(kind: string, x: number, y: number): Node<PlaygroundNodeData> {
  const def = PLAYGROUND_NODE_DEFS[kind];
  return {
    id: nextId(),
    type: 'playgroundNode',
    position: { x, y },
    data: { kind, fields: def.defaultFields() },
  };
}

/** Kahn's algorithm over the current edges; both the step numbers on cards and the
 *  Run order are derived from this one list, so they can never disagree. */
export function topoOrderIds(nodes: Node<PlaygroundNodeData>[], edges: Edge[]): string[] {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const ready = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const remaining = new Map(indeg);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    order.push(id);
    for (const e of edges.filter((e2) => e2.source === id)) {
      const left = (remaining.get(e.target) ?? 1) - 1;
      remaining.set(e.target, left);
      if (left === 0) ready.push(e.target);
    }
  }
  return order;
}

/** The edge into a node's input. */
export function mainInputEdge(id: string, edges: Edge[]) {
  return edges.find((e) => e.target === id);
}

/** The output type of whatever node feeds `id`, or null if nothing does. */
export function inputKindFor(id: string, nodes: Node<PlaygroundNodeData>[], edges: Edge[]) {
  const edge = mainInputEdge(id, edges);
  const source = edge ? nodes.find((n) => n.id === edge.source) : undefined;
  return source ? (PLAYGROUND_NODE_DEFS[source.data.kind]?.output ?? null) : null;
}

export function initialGraph(): { nodes: Node<PlaygroundNodeData>[]; edges: Edge[] } {
  const start = makeNode('start', 130, 20);
  return {
    nodes: [start],
    edges: [],
  };
}

export const INITIAL_GRAPH = initialGraph();
