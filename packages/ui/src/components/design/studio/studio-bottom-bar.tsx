'use client';
import {
  type ICLayout,
} from '../render/layout.js';
import { type ICExportSettings } from '../panels/previews.js';
import { SaveDesignButton } from './save-design.js';
import { findTemplate } from '../templates/templates.js';
import type { Dispatch, SetStateAction } from 'react';

/** The editor's bottom bar: save to My designs, export, and done. */
export function StudioBottomBar({
  savedTick,
  askNameTick,
  layout,
  sceneUrl,
  setLayout,
  motionOpen,
  setExportSettings,
  videoOpen,
  setPreviewOpen,
  sceneReady,
  standalone,
  finish,
}: {
  savedTick: number;
  askNameTick: number;
  layout: ICLayout;
  sceneUrl: string | null;
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  motionOpen: boolean;
  setExportSettings: Dispatch<SetStateAction<ICExportSettings>>;
  videoOpen: boolean;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  sceneReady: boolean;
  standalone: boolean;
  finish: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-canvas-border px-4 py-2.5">
      <span className="flex-1" />
      <SaveDesignButton
        savedTick={savedTick}
        askNameTick={askNameTick}
        layout={layout}
        sceneUrl={sceneUrl}
        fallbackName={
          layout.templateId === 'blank'
            ? 'Untitled design'
            : findTemplate(layout.thread?.root ?? layout.templateId).title
        }
        onSaved={(saved) => setLayout((l) => ({ ...l, saved }))}
      />
      <button
        type="button"
        onClick={() => {
          // Export starts on what the open tab plays: the design's clip or its longer video.
          if (motionOpen) setExportSettings((s) => ({ ...s, format: 'mp4' }));
          if (videoOpen) setExportSettings((s) => ({ ...s, format: 'video' }));
          setPreviewOpen(true);
        }}
        disabled={layout.scene.on && !sceneReady}
        title={
          layout.scene.on && !sceneReady
            ? 'Run the workflow once to paint the AI background'
            : 'Preview every size and download them'
        }
        className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-fd-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Export
      </button>
      {!standalone && (
        <button
          type="button"
          onClick={finish}
          className="rounded-md border border-primary/60 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Done
        </button>
      )}
    </div>
  );
}
