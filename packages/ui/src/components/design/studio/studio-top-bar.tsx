'use client';

import {
  Loader2,
  RotateCcw,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import {
  type ICLayout,
} from '../render/layout.js';
import { FormatChips } from '../panels/format-chips.js';
import { type StudioApi } from '../panels/studio-api.js';
import { IconButton } from '../../ui/icon-button.js';
import type { ICTemplate } from '../render/layout.js';

/** The studio's top bar: its name, the size picker, undo and redo, and the close button. */
export function StudioTopBar({
  view,
  previewOpen,
  api,
  layout,
  template,
  genBusy,
  stopElement,
  revertToSaved,
  resetTemplate,
  unsaved,
  undo,
  canUndo,
  redo,
  canRedo,
  standalone,
  finish,
}: {
  view: "home" | "editor";
  previewOpen: boolean;
  api: StudioApi;
  layout: ICLayout;
  template: ICTemplate;
  genBusy: string | null;
  stopElement: () => void;
  revertToSaved: () => void;
  resetTemplate: () => void;
  unsaved: boolean;
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
  standalone: boolean;
  finish: () => void;
}) {
  return (
    <div className="relative flex items-center gap-2.5 border-b border-canvas-border px-4 py-3">
      {/* The design's size, in the middle of the bar so it is at hand from every tab. */}
      {view === 'editor' && !previewOpen && (
        // Above the canvas below the bar, so the custom size box that drops from it can be used.
        <div className="absolute left-1/2 z-40 -translate-x-1/2">
          <FormatChips api={api} />
        </div>
      )}
      <div className="flex h-7 items-center text-sm font-semibold">Design Studio</div>
      <div className="text-[12px] text-canvas-muted-foreground">
        {view === 'home' ? 'Home' : layout.templateId === 'blank' ? 'Blank' : template.title}
      </div>
      {genBusy && (
        <div className="ml-2 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-[11.5px] text-primary-soft">
          <Loader2 className="size-3 animate-spin" />
          {genBusy === 'new' ? 'Generating AI element…' : 'Regenerating…'}
          <button
            type="button"
            onClick={stopElement}
            className="rounded-md px-2 py-0.5 text-canvas-foreground hover:bg-canvas-muted"
          >
            Stop
          </button>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          // A saved design goes back to its saved copy, anything else to its template.
          onClick={layout.saved ? revertToSaved : resetTemplate}
          disabled={!!layout.saved && !unsaved}
          title={layout.saved ? 'Revert to saved' : 'Reset template to its original design'}
          aria-label={layout.saved ? 'Revert to saved' : 'Reset template'}
          className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          aria-label="Undo"
          className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-30"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Shift+Cmd+Z)"
          aria-label="Redo"
          className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-30"
        >
          <Redo2 className="size-4" />
        </button>
      </div>
      {!standalone && (
        <IconButton
          onClick={finish}
          aria-label="Close"
        >
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
