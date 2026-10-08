'use client';
import {
  type ICLayout,
} from '../render/layout.js';
import { Overlay } from '../../ui/overlay.js';
import type { Dispatch, SetStateAction } from 'react';

/** Asks what to do with unsaved changes before leaving a saved design. */
export function LeaveDialog({
  setLeaving,
  layout,
  leaveError,
  leaving,
  saveAndLeave,
}: {
  setLeaving: Dispatch<SetStateAction<{ go: () => void; } | null>>;
  layout: ICLayout;
  leaveError: string | null;
  leaving: { go: () => void; } | null;
  saveAndLeave: () => void;
}) {
  if (!leaving || !layout.saved) return null;
  return (
    <Overlay
      onClose={() => setLeaving(null)}
      nested
      className="z-[90] p-0"
      role="presentation"
      onKeyDown={(e) => e.key === 'Escape' && setLeaving(null)}
    >
      <div
        role="alertdialog"
        aria-labelledby="design-unsaved-title"
        className="w-[380px] rounded-xl border border-canvas-border bg-canvas p-4 shadow-2xl"
      >
        <div id="design-unsaved-title" className="text-[13px] font-semibold text-canvas-foreground">
          Save changes to “{layout.saved.name}”?
        </div>
        {leaveError && <div className="mt-1.5 text-xs text-red-300">{leaveError}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLeaving(null)}
            className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-canvas-foreground hover:bg-canvas-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setLeaving(null);
              leaving.go();
            }}
            className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-red-300 hover:bg-canvas-muted"
          >
            Discard
          </button>
          <button
            type="button"
            // biome-ignore lint/a11y/noAutofocus: the safe choice takes focus, so Enter never drops the edits
            autoFocus
            onClick={saveAndLeave}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Save
          </button>
        </div>
      </div>
    </Overlay>
  );
}
