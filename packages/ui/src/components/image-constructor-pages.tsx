import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type ICLayout, ratioHeight } from './image-constructor-layout.js';
import { composeLayout } from './image-constructor-render.js';
import { findTemplate } from './image-constructor-templates.js';
import { allPages } from './image-constructor-thread.js';

export interface PageStripProps {
  layout: ICLayout;
  sceneUrl: string | null;
  onGo: (i: number) => void;
  /** A fresh page of that kind, or a copy of the open page without one. */
  onAdd: (kind?: string) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
}

/** A thread's cards in order under the canvas, with the tools to add, copy, move and delete them. */
export function PageStrip({ layout, sceneUrl, onGo, onAdd, onRemove, onMove }: PageStripProps) {
  const th = layout.thread;
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!layout.thread) return;
    let live = true;
    // Redraws once the edits settle, not on every keystroke.
    const timer = setTimeout(() => {
      void Promise.all(
        allPages(layout).map((p) =>
          composeLayout(p, sceneUrl, {
            width: 200,
            format: 'jpeg',
            quality: 0.8,
          }).catch(() => ''),
        ),
      ).then((urls) => live && setThumbs(urls));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [layout, sceneUrl]);

  if (!th) return null;
  const kinds = findTemplate(th.root).thread?.kinds ?? [];
  const thumbW = Math.round(60 / ratioHeight(layout.ratio, layout.customSize));
  const tool =
    'flex items-center gap-1 rounded-md border border-canvas-border px-2 py-1 text-[11.5px] hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex items-center gap-3 border-t border-canvas-border bg-canvas-raised px-3 py-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {th.pages.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGo(i)}
            title={findTemplate(p.templateId).title}
            className={`relative shrink-0 overflow-hidden rounded-md border bg-canvas-muted ${
              i === th.at
                ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
                : 'border-canvas-border hover:border-canvas-muted-foreground'
            }`}
            style={{ height: 60, width: thumbW }}
          >
            {thumbs[i] && <img src={thumbs[i]} alt="" className="size-full object-cover" />}
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 text-white">
              {i + 1}
            </span>
          </button>
        ))}
      </div>
      <div className="relative flex shrink-0 items-center gap-1.5">
        <button type="button" className={tool} onClick={() => setMenu(!menu)}>
          <Plus className="size-3.5" /> Page
        </button>
        {menu && (
          <div className="absolute bottom-full right-0 z-20 mb-1 w-44 rounded-lg border border-canvas-border bg-canvas p-1 shadow-xl">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-[12px] hover:bg-canvas-muted"
                onClick={() => {
                  onAdd(k);
                  setMenu(false);
                }}
              >
                {findTemplate(k).title}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={tool} onClick={() => onAdd()} title="Duplicate page">
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          className={tool}
          onClick={() => onMove(-1)}
          disabled={th.at === 0}
          title="Move earlier"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          className={tool}
          onClick={() => onMove(1)}
          disabled={th.at === th.pages.length - 1}
          title="Move later"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          className={tool}
          onClick={onRemove}
          disabled={th.pages.length < 2}
          title="Delete page"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
