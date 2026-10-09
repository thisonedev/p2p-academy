'use client';

import type { AcademyModelCatalogueEntry } from '@academy/validation';
import { Loader2, Download, CircleCheck, Circle, Trash2 } from 'lucide-react';
import { formatBytes } from '../../lib/format-bytes.js';
import { ProgressBar, percentOf } from '../ui/progress-bar.js';

export interface RemoveState {
  // Model id showing the inline confirm, 'all' for the remove-all button, or null when closed.
  pending: string | 'all' | null;
  // Once confirmed, the row shows a busy state until the IPC resolves.
  busy: boolean;
  // Per-row error message; cleared on next action.
  error: string | null;
}

// One row per catalogue entry, reused by Foundational models and the chapter
// detail panel so a model looks the same wherever it's listed.
export function DownloadMeter({ progress }: { progress?: { loaded: number; total: number } }) {
  const known = progress && progress.total > 0;
  return (
    <div className="mt-2">
      <ProgressBar
        percent={percentOf(progress)}
        className="w-full bg-canvas-border"
      />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
        {known ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}` : 'Preparing model…'}
      </p>
    </div>
  );
}

export function ModelListRow({
  entry,
  usedLabel,
  state,
  modelIdByName,
  modelCompleteByName,
  downloading,
  progress,
  downloadDisabled,
  onDownload,
  onRequestRemove,
  onConfirmRemove,
  onCancel,
}: {
  entry: AcademyModelCatalogueEntry;
  usedLabel: string;
  state: RemoveState;
  modelIdByName: Map<string, string>;
  modelCompleteByName: Map<string, boolean>;
  downloading?: boolean;
  progress?: { loaded: number; total: number };
  downloadDisabled?: boolean;
  onDownload?: () => void;
  onRequestRemove: (id: string) => void;
  onConfirmRemove: (id: string) => void;
  onCancel: () => void;
}) {
  const installed = modelCompleteByName.get(entry.name) === true;
  const id = modelIdByName.get(entry.name);
  return (
    <div className="border-b border-canvas-border/60 py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className={`size-2 shrink-0 rounded-full ${
            installed ? 'bg-primary' : downloading ? 'bg-primary/50' : 'border border-canvas-muted-foreground bg-transparent'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-canvas-foreground">{entry.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-canvas-muted-foreground">
            {downloading ? 'Downloading…' : usedLabel}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-canvas-muted-foreground">{formatBytes(entry.sizeBytes)}</span>
        {downloading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : installed && id ? (
          <RemoveIconButton
            id={id}
            label={entry.name}
            state={state}
            onRequestRemove={() => onRequestRemove(id)}
            onConfirmRemove={() => onConfirmRemove(id)}
            onCancel={onCancel}
          />
        ) : !installed && onDownload ? (
          <button
            type="button"
            disabled={downloadDisabled}
            onClick={onDownload}
            title={`Download ${entry.name}`}
            aria-label={`Download ${entry.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            <Download className="size-3.5" />
          </button>
        ) : null}
      </div>
      {downloading ? <DownloadMeter progress={progress} /> : null}
    </div>
  );
}

// Icon-only radio-style control for picking the active AI-bot model: an
// empty circle to select, a filled check when it's the configured one.
export function SelectModelButton({
  active,
  busy,
  disabled,
  label,
  onSelect,
}: {
  active: boolean;
  busy: boolean;
  disabled: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? `${label} is configured` : `Use ${label}`}
      title={active ? 'Configured' : 'Use this model'}
      className={`shrink-0 rounded p-1.5 transition-colors disabled:cursor-wait disabled:opacity-40 ${
        active ? 'text-primary' : 'text-canvas-muted-foreground hover:bg-canvas hover:text-primary'
      }`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : active ? (
        <CircleCheck className="size-4" />
      ) : (
        <Circle className="size-4" />
      )}
    </button>
  );
}

// Shared remove control for a model row: clicking the trash icon only arms
// the inline Cancel/Remove confirm (`onRequestRemove`); the actual delete
// fires from the "Remove" button (`onConfirmRemove`). Keyed off
// `state.pending` so only one row confirms at a time. Used by both the AI
// bot list and Downloaded models.
export function RemoveIconButton({
  id,
  label,
  state,
  onRequestRemove,
  onConfirmRemove,
  onCancel,
}: {
  id: string;
  label: string;
  state: RemoveState;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancel: () => void;
}) {
  const confirming = state.pending === id;
  const busy = confirming && state.busy;
  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded px-2 py-1 text-xs text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirmRemove}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          Remove
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onRequestRemove}
      disabled={state.busy}
      aria-label={`Remove ${label}`}
      className="shrink-0 rounded p-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas hover:text-danger disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function joinChapters(items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const CHAPTER_LABELS: Record<string, string> = {
  'getting-started': 'Getting started',
  'text-generation': 'Text generation',
  'text-embeddings': 'Text embeddings',
  rag: 'RAG',
  'fine-tuning': 'Fine-tuning',
  multimodal: 'Multimodal',
  'image-generation': 'Image generation',
  'video-generation': 'Video generation',
  transcription: 'Transcription',
  'text-to-speech': 'Text-to-speech',
  translation: 'Translation',
  'voice-assistant': 'Voice assistant',
  ocr: 'OCR',
  'image-classification': 'Image classification',
  bci: 'BCI',
  vla: 'VLA',
  p2p: 'P2P',
  'delegated-inference': 'Delegated inference',
  'music-generation': 'Music generation',
  'abot-world': 'Abot world',
};

export function chapterLabel(slug: string): string {
  if (!slug) return '';
  return CHAPTER_LABELS[slug] ?? slug;
}

export function RemoveAllButton({
  state,
  onRequestRemove,
  onConfirmRemove,
  onCancel,
}: {
  state: RemoveState;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancel: () => void;
}) {
  const confirming = state.pending === 'all';
  const busy = confirming && state.busy;
  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded px-2 py-1 text-xs text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmRemove}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            Remove all
          </button>
        </div>
        <p className="text-right text-[10px] text-canvas-muted-foreground/80">
          Frees all model files on this device except the AI bot's active model.
        </p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onRequestRemove}
      disabled={state.busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-40"
    >
      <Trash2 className="size-3.5" />
      Remove all
    </button>
  );
}
