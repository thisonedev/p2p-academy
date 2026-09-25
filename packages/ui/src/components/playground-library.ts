import type { SavedWorkflow } from './playground-workflow.js';

export const PREVIEW_W = 176;
export const PREVIEW_H = 84;
const NODE_W = 30;
const NODE_H = 12;
const MAX_PREVIEW_NODES = 40;

/** Node boxes scaled into the card's thumbnail box, plus edges as index pairs. */
export interface WorkflowPreview {
  n: [number, number][];
  e: [number, number][];
}

// Stored in the catalog manifest, so the library draws every card without
// loading a single workflow payload.
export function workflowPreview(workflow: SavedWorkflow): WorkflowPreview {
  const nodes = workflow.nodes.slice(0, MAX_PREVIEW_NODES);
  if (nodes.length === 0) return { n: [], e: [] };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const pad = 8;
  const scale = Math.min((PREVIEW_W - NODE_W - pad * 2) / spanX, (PREVIEW_H - NODE_H - pad * 2) / spanY, 0.25);
  const offX = (PREVIEW_W - NODE_W - spanX * scale) / 2;
  const offY = (PREVIEW_H - NODE_H - spanY * scale) / 2;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  return {
    n: nodes.map((n) => [Math.round(offX + (n.x - minX) * scale), Math.round(offY + (n.y - minY) * scale)]),
    e: workflow.edges.flatMap((e) => {
      const a = index.get(e.source);
      const b = index.get(e.target);
      return a === undefined || b === undefined ? [] : [[a, b] as [number, number]];
    }),
  };
}

export function isWorkflowPreview(value: unknown): value is WorkflowPreview {
  const v = value as WorkflowPreview | null;
  return !!v && Array.isArray(v.n) && Array.isArray(v.e);
}

export { NODE_H as PREVIEW_NODE_H, NODE_W as PREVIEW_NODE_W };

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function formatWhen(ts: number, now = Date.now()): string {
  const mins = Math.round((now - ts) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Electron prefixes every error crossing IPC with the channel name; the user
// only needs what the main process said.
export function ipcErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}
