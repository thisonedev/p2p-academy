
import {
  useCallback,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { isFrameArt } from '../art/art-web3.js';
import {
  AVATAR_PFP_CROP,
  AVATAR_FULL_CROP,
  avatarCropSvg,
  avatarCropPng,
} from '../art/avatar.js';
import { canvasLines, gridSnapLines, snapBox } from '../render/grid.js';
import {
  type ICLayout,
  type ICElement,
  type ICAvatarEl,
  isCroppable,
  type ICCrop,
  FULL_CROP,
  isSlotImage,
  isTexture,
  IC_OUTPUT_SIZE,
} from '../render/layout.js';
import { type Selection, type ICPoint, IC_ADD_MIME, type ICAddItem } from '../panels/studio-api.js';
import { pngToPdf } from '../render/pdf.js';
import { type ICExportSettings } from '../panels/previews.js';
import {
  type ICBox,
  layerBox,
  slotPlacement,
  drawBackground,
} from '../render/render.js';
import {
  type ICHandle,
  resizeRect,
  handleSign,
  toLocal,
} from '../render/resize.js';
import { clamp } from '../../../lib/math.js';
import {
  DRAW,
  groupMembers,
  isLocked,
  scaleLayer,
  snapAngle,
  type DragState,
} from './studio-helpers.js';
import type { Dispatch, RefObject, SetStateAction } from 'react';

/** Mouse work on the canvas: select, drag, resize, crop, pan, marquee, and drops from the panels. */
export function useStagePointer({
  multiSel,
  selId,
  setSelId,
  setMultiSel,
  layout,
  stageRef,
  DRAWH,
  dragRef,
  patch,
  setLayout,
  setGuides,
  hasFiles,
  dropFiles,
  addArt,
  addBlock,
  addButton,
  addShape,
  addLine,
  addAvatar,
  addText,
  avatarEl,
  exportSettings,
  marqueeRef,
  setMarquee,
  marquee,
}: {
  multiSel: string[];
  selId: Selection;
  setSelId: Dispatch<SetStateAction<Selection>>;
  setMultiSel: Dispatch<SetStateAction<string[]>>;
  layout: ICLayout;
  stageRef: RefObject<HTMLDivElement | null>;
  DRAWH: number;
  dragRef: RefObject<DragState | null>;
  patch: (id: string, p: Partial<Record<string, unknown>>) => void;
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  setGuides: Dispatch<SetStateAction<{ x?: number; y?: number; }>>;
  hasFiles: (e: ReactDragEvent) => boolean;
  dropFiles: (files: FileList, at?: ICPoint) => Promise<void>;
  addArt: (id: string, at?: ICPoint) => void;
  addBlock: (id: string, at?: ICPoint) => void;
  addButton: (at?: ICPoint) => void;
  addShape: (kind?: "rect" | "ellipse", at?: ICPoint) => void;
  addLine: (at?: ICPoint) => void;
  addAvatar: (at?: ICPoint) => void;
  addText: (kind: "text" | "pill", at?: ICPoint) => void;
  avatarEl: ICAvatarEl | null;
  exportSettings: ICExportSettings;
  marqueeRef: RefObject<{ sx: number; sy: number; dragging: boolean; inside: boolean; } | null>;
  setMarquee: Dispatch<SetStateAction<ICBox | null>>;
  marquee: ICBox | null;
}) {
  const pointerDown = (
    e: ReactPointerEvent,
    el: ICElement,
    mode: DragState['mode'],
    handle?: ICHandle,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Shift+click toggles one element into or out of the ad-hoc selection, without starting a
    // drag. A prior single selection (held in selId, not multiSel) becomes the starting set.
    if (mode === 'move' && e.shiftKey) {
      const base =
        multiSel.length > 0
          ? multiSel
          : selId && selId !== 'bg' && selId !== 'scene'
            ? [selId]
            : [];
      setSelId(null);
      setMultiSel(base.includes(el.id) ? base.filter((id) => id !== el.id) : [...base, el.id]);
      return;
    }
    // Clicking a grouped element, or one already part of the current multi-selection, keeps
    // the whole set selected so a move drag moves all of them together.
    // A layer picked out of its group with a double-click stays selected on its own for editing,
    // but still moves with its group: only Ungroup lets a piece move apart.
    const members = groupMembers(layout.els, el.id);
    const together =
      mode === 'move' && multiSel.includes(el.id) && multiSel.length > 1 ? multiSel : members;
    const pickedOut = selId === el.id && members.length > 1;
    if (mode === 'move' && together.length > 1 && !pickedOut) {
      setSelId(null);
      setMultiSel(together);
    } else {
      setMultiSel([]);
      setSelId(el.id);
    }
    if (el.lock) return;
    const box = layerBox(el, layout, DRAW);
    const rect = stageRef.current?.getBoundingClientRect();
    const turn =
      mode === 'rotate' && rect
        ? (() => {
            const cx = rect.left + ((box.x + box.w / 2) / DRAW) * rect.width;
            const cy = rect.top + ((box.y + box.h / 2) / DRAWH) * rect.height;
            return { cx, cy, from: Math.atan2(e.clientY - cy, e.clientX - cx) };
          })()
        : undefined;
    dragRef.current = {
      id: el.id,
      mode,
      handle,
      box,
      turn,
      sx: e.clientX,
      sy: e.clientY,
      orig: el,
      group:
        mode === 'move' && together.length > 1
          ? together.map((id) => {
              const found = layout.els.find((e2) => e2.id === id);
              return { id, x: found?.x ?? 0, y: found?.y ?? 0 };
            })
          : undefined,
    };
  };

  // Alt+click steps to the layer under the one on top, using real hit-testing so rotation and
  // z-order both match what is on screen. Repeated alt+clicks cycle through the whole stack.
  const selectBehind = (clientX: number, clientY: number) => {
    const stack = document
      .elementsFromPoint(clientX, clientY)
      .filter((n): n is HTMLElement => n instanceof HTMLElement && n.dataset.layerId !== undefined)
      .map((n) => n.dataset.layerId as string);
    if (stack.length < 2) return;
    const at = stack.indexOf(selId ?? '');
    setSelId(stack[(at + 1) % stack.length]);
  };

  const resizeBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box, handle } = drag;
    if (!handle) return;
    const next = resizeRect(box, orig.rot ?? 0, handle, dx, dy, isLocked(orig), 8);
    const at = { x: (next.x / DRAW) * 100, y: (next.y / DRAWH) * 100, w: (next.w / DRAW) * 100 };
    if (orig.t === 'text') {
      const size = clamp(orig.size * (next.w / box.w), 1.5, 60);
      patch(drag.id, { ...at, size });
    } else if (orig.t === 'pill') {
      const k = next.w / box.w;
      patch(drag.id, { ...at, h: orig.h * k, size: orig.size * k });
    } else if (orig.t === 'shape' || (orig.t === 'image' && orig.h !== undefined)) {
      patch(drag.id, { ...at, h: (next.h / DRAWH) * 100 });
    } else if (orig.t === 'line') {
      patch(drag.id, { x: at.x, w: at.w });
    } else {
      patch(drag.id, at);
    }
  };

  // A crop handle moves one edge of the frame while the picture stays where it is on screen.
  const cropBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box, handle } = drag;
    if (!handle || !isCroppable(orig)) return;
    const c = (orig as { crop?: ICCrop }).crop ?? FULL_CROP;
    const [fullW, fullH] = [box.w / c.w, box.h / c.h];
    const [sx, sy] = handleSign(handle);
    const room = (before: number, after: number, sign: number) => (sign < 0 ? before : after);
    const max = {
      w: box.w + (sx ? room(c.x, 1 - c.x - c.w, sx) * fullW : 0),
      h: box.h + (sy ? room(c.y, 1 - c.y - c.h, sy) * fullH : 0),
    };
    const next = resizeRect(box, orig.rot ?? 0, handle, dx, dy, false, 12, max);
    const [nw, nh] = [next.w / fullW, next.h / fullH];
    patch(drag.id, {
      crop: { x: sx < 0 ? c.x + c.w - nw : c.x, y: sy < 0 ? c.y + c.h - nh : c.y, w: nw, h: nh },
      x: (next.x / DRAW) * 100,
      y: (next.y / DRAWH) * 100,
      w: (next.w / DRAW) * 100,
    });
  };

  // Dragging inside the frame slides the picture under it.
  const panBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box } = drag;
    if (!isCroppable(orig)) return;
    if (isSlotImage(orig)) {
      const [lx, ly] = toLocal(dx, dy, orig.rot ?? 0);
      const p = slotPlacement(box, orig.ratio, orig);
      const [ox, oy] = [p.w - box.w, Math.max(0, p.h - box.h)];
      const [px, py] = [ox > 0 ? (box.x - p.x) / ox : 0.5, oy > 0 ? (box.y - p.y) / oy : 0];
      patch(drag.id, {
        pos: { x: ox > 0 ? clamp(px - lx / ox, 0, 1) : px, y: oy > 0 ? clamp(py - ly / oy, 0, 1) : py },
      });
      return;
    }
    const c = (orig as { crop?: ICCrop }).crop ?? FULL_CROP;
    const [lx, ly] = toLocal(dx, dy, orig.rot ?? 0);
    patch(drag.id, {
      crop: {
        ...c,
        x: clamp(c.x - lx / (box.w / c.w), 0, 1 - c.w),
        y: clamp(c.y - ly / (box.h / c.h), 0, 1 - c.h),
      },
    });
  };

  const pointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const px = e.clientX - drag.sx;
    const py = e.clientY - drag.sy;
    if (drag.mode === 'scale' && drag.members && drag.handle) {
      const [dx, dy] = [(px * DRAW) / rect.width, (py * DRAWH) / rect.height];
      const { box } = drag;
      const next = resizeRect(box, 0, drag.handle, dx, dy, true, 12);
      const k = next.w / box.w;
      const moved = new Map(
        drag.members.map((m) => [
          m.id,
          scaleLayer(
            m,
            k,
            ((next.x + ((m.x / 100) * DRAW - box.x) * k) / DRAW) * 100,
            ((next.y + ((m.y / 100) * DRAWH - box.y) * k) / DRAWH) * 100,
          ),
        ]),
      );
      setLayout((l) => ({ ...l, els: l.els.map((e) => moved.get(e.id) ?? e) }));
      return;
    }
    if (drag.mode === 'rotate' && drag.turn) {
      const { cx, cy, from } = drag.turn;
      const by = ((Math.atan2(e.clientY - cy, e.clientX - cx) - from) * 180) / Math.PI;
      patch(drag.id, { rot: snapAngle((drag.orig.rot ?? 0) + by, e.shiftKey) });
      return;
    }
    if (drag.mode !== 'move') {
      const [dx, dy] = [(px * DRAW) / rect.width, (py * DRAWH) / rect.height];
      if (drag.mode === 'resize') resizeBy(drag, dx, dy);
      else if (drag.mode === 'crop') cropBy(drag, dx, dy);
      else panBy(drag, dx, dy);
      return;
    }
    let [dx, dy] = [(px / rect.width) * 100, (py / rect.height) * 100];
    const moving = drag.group ?? [{ id: drag.id, x: drag.orig.x, y: drag.orig.y }];
    // The moving box's edges and middle catch on the canvas middle, edges and safe
    // margin, on other layers, and on the grid when it's snapping. Cmd or Ctrl places freely.
    let caught: { x?: number; y?: number } = {};
    const boxes = moving.flatMap((m) => {
      const el = layout.els.find((x) => x.id === m.id);
      return el ? [layerBox({ ...el, x: m.x, y: m.y } as ICElement, layout, DRAW)] : [];
    });
    if (!(e.metaKey || e.ctrlKey) && boxes.length > 0) {
      // Canvas pixels to percent of the width, the unit guides are measured in.
      const u = 100 / DRAW;
      const H = (DRAWH / DRAW) * 100;
      const x0 = Math.min(...boxes.map((b) => b.x)) * u;
      const y0 = Math.min(...boxes.map((b) => b.y)) * u;
      const x1 = Math.max(...boxes.map((b) => b.x + b.w)) * u;
      const y1 = Math.max(...boxes.map((b) => b.y + b.h)) * u;
      const { xs, ys } = canvasLines(H);
      const ids = new Set(moving.map((m) => m.id));
      for (const o of layout.els) {
        if (ids.has(o.id) || !o.vis || isTexture(o)) continue;
        const b = layerBox(o, layout, DRAW);
        if (b.w * u > 90) continue;
        xs.push(b.x * u, (b.x + b.w / 2) * u, (b.x + b.w) * u);
        ys.push(b.y * u, (b.y + b.h / 2) * u, (b.y + b.h) * u);
      }
      if (layout.grid?.on && layout.grid.snap) {
        const g = gridSnapLines(layout.grid, H);
        xs.push(...g.xs);
        ys.push(...g.ys);
      }
      const nudge = snapBox({ x: x0 + dx, y: y0 + (dy * H) / 100, w: x1 - x0, h: y1 - y0 }, xs, ys);
      dx += nudge.dx;
      dy += (nudge.dy * 100) / H;
      caught = { x: nudge.x, y: nudge.y };
    }
    setGuides(caught);
    for (const t of moving) {
      patch(t.id, { x: clamp(t.x + dx, -20, 100), y: clamp(t.y + dy, -20, 100) });
    }
  };

  const dropOnStage = (e: ReactDragEvent) => {
    const raw = e.dataTransfer.getData(IC_ADD_MIME);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const at = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (!raw && hasFiles(e)) {
      e.preventDefault();
      e.stopPropagation();
      void dropFiles(e.dataTransfer.files, at);
      return;
    }
    if (!raw) return;
    e.preventDefault();
    const item = JSON.parse(raw) as ICAddItem;
    if (item.kind === 'art') addArt(item.id, at);
    else if (item.kind === 'block') addBlock(item.id, at);
    else if (item.kind === 'button') addButton(at);
    else if (item.kind === 'rect' || item.kind === 'ellipse') addShape(item.kind, at);
    else if (item.kind === 'line') addLine(at);
    else if (item.kind === 'avatar') addAvatar(at);
    else addText(item.kind, at);
  };

  // The selected avatar on its own, cropped to a profile picture or the whole figure.
  const exportAvatar = async (mode: 'avatar-pfp' | 'avatar-full') => {
    if (!avatarEl) return;
    const { format, mult, quality, transparent } = exportSettings;
    const width = Math.round(IC_OUTPUT_SIZE * mult);
    const crop = mode === 'avatar-pfp' ? AVATAR_PFP_CROP : AVATAR_FULL_CROP;
    let href: string;
    if (format === 'svg') {
      href = `data:image/svg+xml;utf8,${encodeURIComponent(await avatarCropSvg(avatarEl.config, crop))}`;
    } else if (format === 'pdf') {
      href = await pngToPdf(
        await avatarCropPng(avatarEl.config, crop, {
          width,
          transparentBg: false,
          paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
        }),
      );
    } else {
      href = await avatarCropPng(avatarEl.config, crop, {
        width,
        format: format === 'jpeg' ? 'jpeg' : 'png',
        quality: quality / 100,
        transparentBg: transparent,
        paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
      });
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = `avatar-${mode === 'avatar-pfp' ? 'pfp' : 'full-body'}.${format === 'jpeg' ? 'jpg' : format}`;
    link.click();
  };

  // Rendered without the design's own background, so the preview shows what the file holds.
  const previewAvatar = useCallback(
    (mode: 'avatar-pfp' | 'avatar-full') =>
      avatarEl
        ? avatarCropPng(
            avatarEl.config,
            mode === 'avatar-pfp' ? AVATAR_PFP_CROP : AVATAR_FULL_CROP,
            {
              width: 576,
              format: 'png',
              transparentBg: exportSettings.transparent,
              paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
            },
          )
        : Promise.reject(new Error('No avatar')),
    [avatarEl, exportSettings.transparent, layout],
  );

  const stageClick = () => {
    setMultiSel([]);
    setSelId(layout.scene.on ? 'scene' : 'bg');
  };

  const stagePointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    marqueeRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      dragging: false,
      inside: stageRef.current?.contains(e.target as Node) ?? false,
    };
  };

  const stagePointerMove = (e: ReactPointerEvent) => {
    const m = marqueeRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!m || !rect) return;
    if (!m.dragging && Math.hypot(e.clientX - m.sx, e.clientY - m.sy) < 4) return;
    m.dragging = true;
    // In percent of the canvas, running past it when the drag starts or ends outside.
    const x1 = ((Math.min(m.sx, e.clientX) - rect.left) / rect.width) * 100;
    const y1 = ((Math.min(m.sy, e.clientY) - rect.top) / rect.height) * 100;
    const x2 = ((Math.max(m.sx, e.clientX) - rect.left) / rect.width) * 100;
    const y2 = ((Math.max(m.sy, e.clientY) - rect.top) / rect.height) * 100;
    setMarquee({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  // A drag over empty canvas, or the space around it, selects every layer it touches, so Delete and
  // Backspace can remove them all at once. A plain click still just selects
  // Background or Scene, same as before.
  const stagePointerUp = () => {
    const m = marqueeRef.current;
    marqueeRef.current = null;
    // Pointer capture still bubbles pointerup here after a layer's own
    // pointerDown handled the gesture (it only stops the down event), so
    // without this check every ordinary click also re-selected Background.
    if (!m) return;
    if (m.dragging && marquee) {
      const [mx1, my1, mx2, my2] = [
        (marquee.x / 100) * DRAW,
        (marquee.y / 100) * DRAWH,
        ((marquee.x + marquee.w) / 100) * DRAW,
        ((marquee.y + marquee.h) / 100) * DRAWH,
      ];
      const ids = layout.els
        .filter((e) => e.vis && !e.lock && !(e.t === 'art' && isFrameArt(e.art)))
        .filter((e) => {
          const box = layerBox(e, layout, DRAW);
          return box.x < mx2 && box.x + box.w > mx1 && box.y < my2 && box.y + box.h > my1;
        })
        .map((e) => e.id);
      setSelId(null);
      setMultiSel(ids);
    } else if (m.inside) {
      stageClick();
    } else {
      // A click around the canvas clears the selection.
      setSelId(null);
      setMultiSel([]);
    }
    setMarquee(null);
  };

  return {
    pointerDown,
    selectBehind,
    pointerMove,
    dropOnStage,
    exportAvatar,
    previewAvatar,
    stagePointerDown,
    stagePointerMove,
    stagePointerUp,
  };
}
