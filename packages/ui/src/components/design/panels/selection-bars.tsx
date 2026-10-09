'use client';

import {
  Copy,
  Lock,
  Unlock,
  Trash2,
  Group,
  Ungroup,
  MoreHorizontal,
  BringToFront,
  SendToBack,
} from 'lucide-react';
import { type CSSProperties, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEscape } from '../../../hooks/use-escape.js';
import { useOutsidePress } from '../../../hooks/use-outside-press.js';
import type { StudioApi } from './studio-api.js';
import { SMALL } from './panel-shared.js';

/** What the selection is and can do, for the bar over it and the right-click menu alike. */
function selectionOf(api: StudioApi) {
  const els = api.layout.els.filter((e) => api.selIds.includes(e.id));
  const locked = els.length > 0 && els.every((e) => e.lock);
  const grouped = els.some((e) => e.groupId !== undefined);
  const oneGroup = grouped && els.every((e) => e.groupId === els[0].groupId);
  return { els, locked, grouped, canGroup: api.multiSel.length > 1 && !oneGroup };
}

/** The floating bar over a selection on the canvas, one layer or a group: Duplicate, Lock, Delete,
 *  Group or Ungroup, and z-order extremes. */
export function MiniBar({ api, style }: { api: StudioApi; style: CSSProperties }) {
  const [more, setMore] = useState(false);
  const key = api.selIds.join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes the menu when the selection changes
  useEffect(() => setMore(false), [key]);
  const sel = selectionOf(api);
  if (sel.els.length === 0) return null;
  const btn =
    'rounded p-1.5 hover:bg-canvas-muted text-canvas-muted-foreground hover:text-canvas-foreground';
  const labeled = `${btn} flex items-center gap-1 px-2 text-caption`;
  return (
    // The stage below deselects on pointerdown, so the bar must stop it from bubbling there.
    <div
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-10 flex items-center gap-0.5 rounded-lg border border-canvas-border bg-canvas-raised p-1 shadow-xl"
    >
      <button type="button" title="Duplicate (Cmd+D)" onClick={api.duplicate} className={btn}>
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        title={sel.locked ? 'Unlock' : 'Lock'}
        onClick={api.toggleLock}
        className={sel.locked ? 'rounded p-1.5 text-primary-soft hover:bg-canvas-muted' : btn}
      >
        {sel.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>
      <button type="button" title="Delete" onClick={api.remove} className={btn}>
        <Trash2 className="size-3.5" />
      </button>
      {sel.canGroup && (
        <button type="button" title="Group (Cmd+G)" onClick={api.group} className={labeled}>
          <Group className="size-3.5" /> Group
        </button>
      )}
      {sel.grouped && !sel.canGroup && (
        <button
          type="button"
          title="Ungroup (Shift+Cmd+G)"
          onClick={api.ungroup}
          className={labeled}
        >
          <Ungroup className="size-3.5" /> Ungroup
        </button>
      )}
      <div className="relative">
        <button type="button" title="More" onClick={() => setMore((v) => !v)} className={btn}>
          <MoreHorizontal className="size-3.5" />
        </button>
        {more && (
          <div className="absolute left-1/2 top-full z-10 mt-1.5 w-40 -translate-x-1/2 rounded-xl border border-canvas-border bg-canvas-raised p-1.5 shadow-xl">
            <button
              type="button"
              className={`${SMALL} flex w-full items-center gap-1.5 text-left`}
              onClick={() => {
                api.moveEnd(1);
                setMore(false);
              }}
            >
              <BringToFront className="size-3.5" /> Bring to front
            </button>
            <button
              type="button"
              className={`${SMALL} mt-1 flex w-full items-center gap-1.5 text-left`}
              onClick={() => {
                api.moveEnd(-1);
                setMore(false);
              }}
            >
              <SendToBack className="size-3.5" /> Send to back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The right-click menu over a selection: the bar's actions, as a list with their shortcuts. */
export function SelectionMenu({
  api,
  at,
  onClose,
}: {
  api: StudioApi;
  at: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsidePress(ref, onClose, { capture: true });
  useEscape(onClose);
  // Opened near the window's right or bottom edge, the menu moves back inside it.
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - box.height - 8)),
    });
  }, [at]);
  const sel = selectionOf(api);
  if (sel.els.length === 0) return null;
  const items: [label: string, hint: string, run: () => void, hidden?: boolean][] = [
    ['Duplicate', 'Cmd+D', api.duplicate],
    [sel.locked ? 'Unlock' : 'Lock', '', api.toggleLock],
    ['Group', 'Cmd+G', api.group, !sel.canGroup],
    ['Ungroup', 'Shift+Cmd+G', api.ungroup, !sel.grouped || sel.canGroup],
    ['Bring to front', '', () => api.moveEnd(1)],
    ['Send to back', '', () => api.moveEnd(-1)],
    ['Delete', 'Del', api.remove],
  ];
  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[70] min-w-48 rounded-lg border border-canvas-border bg-canvas-raised py-1 font-mono text-caption shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {items
        .filter(([, , , hidden]) => !hidden)
        .map(([label, hint, run]) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => {
              run();
              onClose();
            }}
            className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-canvas-foreground hover:bg-canvas-muted"
          >
            {label}
            <span className="text-canvas-muted-foreground/70">{hint}</span>
          </button>
        ))}
    </div>,
    document.body,
  );
}
