
import {
  useCallback,
} from 'react';
import { layerBuilder } from '../templates/announce.js';
import { artDef, artDefaults, artPalette, artFit } from '../art/art.js';
import { PHONE_SCREEN } from '../art/art-web3.js';
import {
  randomAvatarConfig,
} from '../art/avatar.js';
import { blockStyle, findBlock } from '../templates/blocks.js';
import { type ICCutout, removeBackground } from '../art/cutout.js';
import { SCREENSHOT } from '../art/device.js';
import {
  type ICLayout,
  type ICElement,
  ratioHeight,
  newElementId,
  layoutRoles,
  type ICPill,
  restyleButton,
  designRoles,
  setTexture,
  textureOf,
  figureBackdrop,
  FIGURE_MIN,
  pickPartner,
  swapSides,
  resetPartner,
} from '../render/layout.js';
import { type Selection, type ICPoint } from '../panels/studio-api.js';
import {
  layerBox,
} from '../render/render.js';
import { isScreen } from '../art/screens.js';
import { findTemplate } from '../templates/templates.js';
import { clamp } from '../../../lib/math.js';
import {
  DRAW,
} from './studio-helpers.js';
import type { Dispatch, RefObject, SetStateAction } from 'react';

/** Everything that puts a new layer on the design: text, buttons, shapes, lines, art, blocks, an avatar, a cutout. */
export function useAddLayers({
  setLayout,
  setSelId,
  layout,
  DRAWH,
  setCutBusy,
  patch,
  setMultiSel,
  creatingAvatarRef,
}: {
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  setSelId: Dispatch<SetStateAction<Selection>>;
  layout: ICLayout;
  DRAWH: number;
  setCutBusy: Dispatch<SetStateAction<string | null>>;
  patch: (id: string, p: Partial<Record<string, unknown>>) => void;
  setMultiSel: Dispatch<SetStateAction<string[]>>;
  creatingAvatarRef: RefObject<boolean>;
}) {
  const insert = useCallback(
    (el: ICElement, after?: string) => {
      setLayout((l) => {
        const at = after ? l.els.findIndex((e) => e.id === after) : -1;
        const els = l.els.slice();
        els.splice(at < 0 ? els.length : at + 1, 0, el);
        return { ...l, els };
      });
      setSelId(el.id);
    },
    [setLayout],
  );

  const copyOf = useCallback(
    (source: ICElement): ICElement => {
      const offset = {
        x: Math.min(source.x + 3, 92),
        y: Math.min(source.y + 3, 92),
        id: newElementId(),
        user: true,
      };
      if (source.t !== 'subject') return { ...structuredClone(source), ...offset };
      const { subject } = layout;
      return {
        t: 'image',
        name: subject.name,
        url: subject.url,
        ratio: subject.ratio,
        crop: source.crop,
        w: source.w,
        vis: true,
        ...offset,
      };
    },
    [layout],
  );

  // A dropped element is centered on the pointer instead of hanging from its corner.
  const centered = useCallback(
    (el: ICElement, at?: ICPoint): ICElement => {
      if (!at) return el;
      const box = layerBox(el, layout, DRAW);
      return {
        ...el,
        x: clamp(at.x - (box.w / DRAW) * 50, -10, 100),
        y: clamp(at.y - (box.h / DRAWH) * 50, -10, 100),
      };
    },
    [DRAWH, layout],
  );

  const addText = useCallback(
    (kind: 'text' | 'pill', at?: ICPoint) => {
      const base = {
        id: newElementId(),
        role: 'custom',
        x: 30,
        y: 44,
        vis: true,
        user: true,
        font: 'sans' as const,
        track: 0,
      };
      // Tagged with roles like template layers, so a palette or brand kit recolors them too.
      const roles = layoutRoles(layout);
      const ink = roles?.ink ?? layout.els.find((e) => e.t === 'text')?.color ?? '#111111';
      const el: ICElement =
        kind === 'text'
          ? {
              ...base,
              t: 'text',
              w: 40,
              text: 'New text',
              size: 6,
              weight: 700,
              color: ink,
              align: 'left',
              lh: 1.1,
              pal: { color: 'ink' },
            }
          : {
              ...base,
              t: 'pill',
              w: 28,
              h: 8,
              text: 'New badge',
              size: 3.4,
              weight: 700,
              color: roles?.onAccent ?? '#111111',
              fill: roles?.accent ?? '#34d399',
              stroke: '',
              pal: { color: 'onAccent', fill: 'accent' },
            };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const addButton = useCallback(
    (at?: ICPoint) => {
      const look = layout.kit?.elements?.buttons ?? 'solid';
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const size = 3.2;
      const base: ICPill = {
        id: newElementId(),
        t: 'pill',
        role: 'cta',
        x: 30,
        y: 44,
        w: 28,
        h: ((size * 2.6) / H) * 100,
        text: look === 'link' ? 'Read more' : 'Get started',
        size,
        weight: 600,
        font: blockStyle(layout.kit).body,
        track: 0,
        color: '',
        fill: '',
        stroke: '',
        vis: true,
        user: true,
      };
      insert(centered(restyleButton(base, look, designRoles(layout)), at));
    },
    [centered, insert, layout],
  );

  const addShape = useCallback(
    (kind: 'rect' | 'ellipse' = 'rect', at?: ICPoint) => {
      const el: ICElement = {
        id: newElementId(),
        t: 'shape',
        kind,
        x: 30,
        y: 40,
        w: 30,
        h: 18,
        fill: layoutRoles(layout)?.accent ?? '#6366f1',
        stroke: '',
        sw: 0.25,
        radius: 2,
        vis: true,
        user: true,
        pal: { fill: 'accent' },
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const addLine = useCallback(
    (at?: ICPoint) => {
      const ink = layout.els.find((e) => e.t === 'text')?.color ?? '#111111';
      const el: ICElement = {
        id: newElementId(),
        t: 'line',
        x: 25,
        y: 50,
        w: 50,
        th: 0.3,
        color: ink,
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout.els],
  );

  const cutout = useCallback(
    async (id: string, opts: ICCutout | null) => {
      const el = layout.els.find((e) => e.id === id);
      if (!el || (el.t !== 'subject' && el.t !== 'image')) return;
      const source = el.t === 'subject' ? layout.subject : el;
      const original = source.original ?? source.url;
      setCutBusy(id);
      try {
        const next = opts
          ? { url: await removeBackground(original, opts), original, cut: opts }
          : { url: original, original: undefined, cut: undefined };
        if (el.t === 'subject') setLayout((l) => ({ ...l, subject: { ...l.subject, ...next } }));
        else patch(id, next);
      } finally {
        setCutBusy(null);
      }
    },
    [layout, patch, setLayout],
  );

  const addArt = useCallback(
    (id: string, at?: ICPoint) => {
      const def = artDef(id);
      if (!def) return;
      const character = def.kind === 'character';
      const roles = designRoles(layout);
      if (def.group === 'Backgrounds') {
        // A frame, pattern or streaks becomes the design's one texture, over the whole canvas.
        setLayout((l) => setTexture(l, textureOf(id)));
        setSelId(null);
        return;
      }
      const screen = PHONE_SCREEN[id];
      if (screen) {
        // A device comes with a screenshot slot in its screen, on top so it takes clicks and drops,
        // grouped with the frame so they move together.
        const H = ratioHeight(layout.ratio, layout.customSize) * 100;
        const w = def.ratio < 0.6 ? 24 : 36;
        const k = w / screen.vw;
        const x = (at?.x ?? 50) - w / 2;
        const y = (at?.y ?? 50) - ((w / def.ratio / H) * 100) / 2;
        const groupId = newElementId();
        const shot: ICElement = {
          id: newElementId(),
          t: 'image',
          name: 'screenshot',
          slot: 'screenshot',
          url: SCREENSHOT,
          ratio: 390 / 866,
          x: x + screen.x * k,
          y: y + ((screen.y * k) / H) * 100,
          w: screen.w * k,
          h: ((screen.h * k) / H) * 100,
          radius: screen.r * k,
          fit: 'top',
          vis: true,
          user: true,
          groupId,
        };
        const frame: ICElement = {
          id: newElementId(),
          t: 'art',
          art: id,
          x,
          y,
          w,
          colors: { ...artDefaults(def), ...artPalette(def, roles) },
          vis: true,
          user: true,
          groupId,
        };
        setLayout((l) => ({
          ...l,
          els: [...l.els, frame, shot],
          groupNames: { ...l.groupNames, [groupId]: def.name },
        }));
        setSelId(null);
        setMultiSel([frame.id, shot.id]);
        return;
      }
      // Devices come in at about the height of the phone, so a laptop isn't a fraction of one. A
      // code window or chart comes in wide enough to read, and a wide drawing wider than an icon.
      const device = isScreen(id);
      const w = character
        ? 18
        : device
          ? Math.min(62, 44 * def.ratio)
          : def.group === 'Code'
            ? 60
            : def.group === 'Charts'
              ? 50
              : def.ratio >= 1.4
                ? 36
                : 24;
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const el: ICElement = {
        id: newElementId(),
        t: 'art',
        art: id,
        x: character ? 42 : (100 - w) / 2,
        y: character ? 20 : ((H - w / def.ratio) / 2 / H) * 100,
        w,
        colors: artFit(
          def,
          { ...artDefaults(def), ...artPalette(def, roles) },
          figureBackdrop(layout),
          FIGURE_MIN,
        ),
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const setPartnerColor = useCallback(
    (color: string) => setLayout((l) => pickPartner(l, color)),
    [setLayout],
  );

  const swapBrands = useCallback(() => setLayout((l) => swapSides(l)), [setLayout]);

  const clearPartner = useCallback(
    () => setLayout((l) => resetPartner(l, findTemplate(l.templateId))),
    [setLayout],
  );

  const addBlock = useCallback(
    (id: string, at?: ICPoint) => {
      const block = findBlock(id);
      if (!block) return;
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const built = block.build(layerBuilder(H, designRoles(layout)), blockStyle(layout.kit));
      // Centered where it was dropped, or on the canvas when clicked.
      const dx = (at?.x ?? 50) - built.w / 2;
      const dy = (at?.y ?? 50) - (built.h / 2 / H) * 100;
      const groupId = newElementId();
      // Slot names stay with the template, so a block's words never share a workflow value by accident.
      const els = built.els.map(
        (e): ICElement => ({
          ...e,
          id: newElementId(),
          x: e.x + dx,
          y: e.y + dy,
          slot: undefined,
          groupId,
          user: true,
        }),
      );
      setLayout((l) => ({
        ...l,
        els: [...l.els, ...els],
        groupNames: { ...l.groupNames, [groupId]: block.name },
      }));
      setSelId(null);
      setMultiSel(els.map((e) => e.id));
    },
    [layout, setLayout],
  );

  // One avatar per canvas, added only on an explicit click (the empty state's own
  // "Add avatar" button, or dropping an avatar tile): it adds into whatever template
  // is already on the canvas rather than replacing it, same as any other element
  // (user: "we have to actually click ourselves" to add one into any template).
  // `layout` here is a snapshot from the last render, not the latest queued state
  // (setLayout's updater only runs later, when React gets to it), so a second call
  // landing before that render still reads "no avatar yet" too. `creatingAvatarRef`
  // closes that window synchronously; the effect below clears it once the insert
  // this ref is guarding for has actually landed in `layout.els`.
  const addAvatar = useCallback(
    (at?: ICPoint) => {
      const existing = layout.els.find((e) => e.t === 'avatar');
      if (existing) {
        setSelId(existing.id);
        return;
      }
      if (creatingAvatarRef.current) return;
      creatingAvatarRef.current = true;
      const el: ICElement = {
        id: newElementId(),
        t: 'avatar',
        x: 37,
        y: 15,
        w: 26,
        config: randomAvatarConfig('both'),
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  return {
    insert,
    copyOf,
    addText,
    addButton,
    addShape,
    addLine,
    cutout,
    addArt,
    setPartnerColor,
    swapBrands,
    clearPartner,
    addBlock,
    addAvatar,
  };
}
