'use client';

import {
  ChevronDown,
  Eye,
  EyeOff,
  Group,
  Image as ImageIcon,
  Lock,
  Minus,
  Package,
  PaintBucket,
  RectangleHorizontal,
  Shapes,
  Square,
  Type,
  Unlock,
  UserRound,
} from 'lucide-react';
import { type ComponentType, type MouseEvent as ReactMouseEvent, useState } from 'react';
import { artDef } from './image-constructor-art.js';
import type { ICElement } from './image-constructor-layout.js';
import { RenameField } from './image-constructor-my-designs.js';
import type { StudioApi } from './image-constructor-panels.js';

const ICONS: Record<ICElement['t'], ComponentType<{ className?: string }>> = {
  text: Type,
  pill: RectangleHorizontal,
  line: Minus,
  shape: Square,
  subject: Package,
  image: ImageIcon,
  art: Shapes,
  avatar: UserRound,
};

/** What a layer is called in the list: its words, its picture's name or what kind of thing it is. */
function layerName(e: ICElement): string {
  switch (e.t) {
    case 'text':
    case 'pill':
      return e.text.split('\n')[0] || (e.t === 'text' ? 'Text' : 'Badge');
    case 'image':
      return e.name || 'Image';
    case 'art':
      return artDef(e.art)?.name ?? 'Art';
    case 'shape':
      return e.kind === 'ellipse' ? 'Circle' : 'Rectangle';
    case 'subject':
      return 'Product';
    case 'line':
      return 'Line';
    case 'avatar':
      return 'Avatar';
  }
}

/** Moves one layer next to another in the stack, above it or below it. */
function reorder(els: ICElement[], from: string, to: string, above: boolean): ICElement[] {
  const moving = els.find((e) => e.id === from);
  if (!moving || from === to) return els;
  const rest = els.filter((e) => e.id !== from);
  const at = rest.findIndex((e) => e.id === to);
  if (at < 0) return els;
  // Later in the array draws on top, so "above" in the list means after it.
  rest.splice(above ? at + 1 : at, 0, moving);
  return rest;
}

/** Every layer, topmost first, with groups as named rows over their layers, as in Figma. Click to
 *  select, shift-click for more, drag to restack, double-click a group to rename it, and
 *  right-click for the same menu as on the canvas. */
export function LayersPanel({ api }: { api: StudioApi }) {
  const { layout, selId } = api;
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; above: boolean } | null>(null);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const rows = [...layout.els].reverse();
  // Group numbers follow the order groups first appear in the stack, bottom up.
  const groupNo = new Map<string, number>();
  for (const e of layout.els) if (e.groupId && !groupNo.has(e.groupId)) groupNo.set(e.groupId, groupNo.size + 1);
  const groupName = (id: string) => layout.groupNames?.[id] ?? `Group ${groupNo.get(id)}`;
  const setAll = (ids: string[], key: 'vis' | 'lock', value: boolean) =>
    api.update((l) => ({
      ...l,
      els: l.els.map((e) => (ids.includes(e.id) ? { ...e, [key]: value } : e)),
    }));
  const selected =
    api.multiSel.length > 0 ? api.multiSel : selId && selId !== 'bg' && selId !== 'scene' ? [selId] : [];
  // Shift, Cmd or Ctrl adds layers to the selection, or takes them back out.
  const pickAlso = (ids: string[]) => {
    const all = ids.every((id) => selected.includes(id));
    api.selectMany(all ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])]);
  };
  const pick = (ids: string[], ev: ReactMouseEvent) =>
    ev.shiftKey || ev.metaKey || ev.ctrlKey ? pickAlso(ids) : api.selectMany(ids);
  const menu = (ids: string[], ev: ReactMouseEvent) => {
    ev.preventDefault();
    if (!ids.every((id) => selected.includes(id))) api.selectMany(ids);
    api.openMenu({ x: ev.clientX, y: ev.clientY });
  };
  const icon =
    'rounded p-1 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground';
  const toggles = (ids: string[], locked: boolean, shown: boolean) => (
    <>
      <button
        type="button"
        title={locked ? 'Unlock' : 'Lock'}
        aria-label={locked ? 'Unlock' : 'Lock'}
        onClick={() => setAll(ids, 'lock', !locked)}
        className={`${icon} ${locked ? '' : 'opacity-0 group-hover:opacity-100'}`}
      >
        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>
      <button
        type="button"
        title={shown ? 'Hide' : 'Show'}
        aria-label={shown ? 'Hide' : 'Show'}
        onClick={() => setAll(ids, 'vis', !shown)}
        className={`${icon} ${shown ? 'opacity-0 group-hover:opacity-100' : ''}`}
      >
        {shown ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
    </>
  );

  const layerRow = (e: ICElement, nested: boolean) => {
    const Icon = ICONS[e.t];
    const on = selected.includes(e.id);
    const line =
      drop?.id === e.id ? (drop.above ? 'shadow-[inset_0_2px_0_#e879f9]' : 'shadow-[inset_0_-2px_0_#e879f9]') : '';
    return (
      <div
        key={e.id}
        draggable
        onDragStart={(ev) => {
          setDrag(e.id);
          ev.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(ev) => {
          if (!drag) return;
          ev.preventDefault();
          const box = ev.currentTarget.getBoundingClientRect();
          setDrop({ id: e.id, above: ev.clientY < box.top + box.height / 2 });
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(ev) => {
          ev.preventDefault();
          if (drag && drop) api.update((l) => ({ ...l, els: reorder(l.els, drag, drop.id, drop.above) }));
          setDrag(null);
          setDrop(null);
        }}
        onDragEnd={() => {
          setDrag(null);
          setDrop(null);
        }}
        className={`group flex items-center gap-2 py-1 pr-2 ${nested ? 'pl-8' : 'pl-3'} ${
          on ? 'bg-fuchsia-400/10 text-canvas-foreground' : 'hover:bg-canvas-muted'
        } ${e.vis ? '' : 'opacity-50'} ${line}`}
      >
        <button
          type="button"
          onClick={(ev) =>
            ev.shiftKey || ev.metaKey || ev.ctrlKey ? pickAlso([e.id]) : api.select(e.id)
          }
          onContextMenu={(ev) => menu([e.id], ev)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Icon className="size-3.5 shrink-0 text-canvas-muted-foreground" />
          <span className="truncate">{layerName(e)}</span>
        </button>
        {toggles([e.id], !!e.lock, e.vis)}
      </div>
    );
  };

  const shownGroups = new Set<string>();
  return (
    <div className="py-1.5 text-[12px]">
      {rows.map((e) => {
        if (!e.groupId) return layerRow(e, false);
        const gid = e.groupId;
        if (shownGroups.has(gid)) return null;
        shownGroups.add(gid);
        // The group sits where its topmost layer does, with all its layers under it.
        const members = rows.filter((m) => m.groupId === gid);
        const ids = members.map((m) => m.id);
        const on = ids.every((id) => selected.includes(id));
        const open = !folded.has(gid);
        return (
          <div key={gid}>
            <div
              className={`group flex items-center gap-1.5 py-1 pl-1.5 pr-2 ${
                on ? 'bg-fuchsia-400/10 text-canvas-foreground' : 'hover:bg-canvas-muted'
              } ${members.every((m) => !m.vis) ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                aria-label={open ? 'Fold group' : 'Unfold group'}
                onClick={() =>
                  setFolded((f) => {
                    const next = new Set(f);
                    if (open) next.add(gid);
                    else next.delete(gid);
                    return next;
                  })
                }
                className="rounded p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground"
              >
                <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>
              {renaming === gid ? (
                <RenameField
                  name={groupName(gid)}
                  onDone={(name) => {
                    setRenaming(null);
                    if (name)
                      api.update((l) => ({ ...l, groupNames: { ...l.groupNames, [gid]: name } }));
                  }}
                />
              ) : (
                <button
                  type="button"
                  title="Double-click to rename"
                  onClick={(ev) => pick(ids, ev)}
                  onDoubleClick={() => setRenaming(gid)}
                  onContextMenu={(ev) => menu(ids, ev)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium"
                >
                  <Group className="size-3.5 shrink-0 text-canvas-muted-foreground" />
                  <span className="truncate">{groupName(gid)}</span>
                </button>
              )}
              {toggles(
                ids,
                members.every((m) => m.lock),
                members.some((m) => m.vis),
              )}
            </div>
            {open && members.map((m) => layerRow(m, true))}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => api.select('bg')}
        className={`flex w-full items-center gap-2 py-1.5 pl-3 text-left ${
          selId === 'bg' ? 'bg-fuchsia-400/10 text-canvas-foreground' : 'hover:bg-canvas-muted'
        }`}
      >
        <PaintBucket className="size-3.5 text-canvas-muted-foreground" />
        Background
      </button>
    </div>
  );
}
