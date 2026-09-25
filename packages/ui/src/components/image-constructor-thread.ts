// Threads: one design made of several cards, one per post. Each page is a whole layout, so every
// editing tool works on it as it is. The open page is the layout itself; the rest wait in
// `layout.thread.pages` and catch up with the open page's brand, colors and size when opened.

import { shrinkToFit } from './image-constructor-fit.js';
import {
  applyBrandKit,
  applyPalette,
  applyShared,
  type ICLayout,
  type ICTemplate,
  layoutFromTemplate,
  resizeLayout,
  sizeKey,
} from './image-constructor-layout.js';
import { findTemplate, siblingTemplate } from './image-constructor-templates.js';

/** Shrinks words that run past their box in this brand's fonts. Runs once the fonts have loaded. */
const fitWords = (l: ICLayout): ICLayout => ({
  ...l,
  els: l.els.map((e) => (e.t === 'text' || e.t === 'pill' ? shrinkToFit(e) : e)),
});

/** A page as stored in the thread: without the parts that belong to the whole design. */
function pageOnly(l: ICLayout): ICLayout {
  const { thread: _t, drafts: _d, shared: _s, saved: _v, exportSizes: _e, ...page } = l;
  return page;
}

/** The parts of the open page that belong to the whole design, carried onto the next open page. */
const designParts = (l: ICLayout) => ({
  drafts: l.drafts,
  shared: l.shared,
  saved: l.saved,
  exportSizes: l.exportSizes,
});

/** Brings a stored page up to the open page's kit or palette, size, background and brand details. */
export function syncPage(page: ICLayout, live: ICLayout): ICLayout {
  const t = findTemplate(page.templateId);
  let p = page;
  if (live.kit) {
    if (JSON.stringify(p.kit) !== JSON.stringify(live.kit)) p = applyBrandKit(p, live.kit);
  } else if (live.palette && live.palette !== p.palette) {
    p = applyPalette(p, live.palette);
  }
  if (sizeKey(p.ratio, p.customSize) !== sizeKey(live.ratio, live.customSize)) {
    p = resizeLayout(p, t, live.ratio ?? t.ratio, live.customSize);
  }
  return { ...applyShared(p, t, live.shared), bg: structuredClone(live.bg) };
}

/** Every page in order, each as it looks now. A design that isn't a thread is one page. */
export function allPages(live: ICLayout): ICLayout[] {
  const th = live.thread;
  if (!th) return [live];
  return th.pages.map((p, i) => (i === th.at ? live : syncPage(p, live)));
}

/** Numbers the step badges in order across the pages that have one (01, 02, and so on), sets each
 *  page's counter to its place in the thread, such as 3/7, and trims the rail at both ends. */
function numberSteps(pages: ICLayout[]): ICLayout[] {
  let n = 0;
  const hasRail = pages.map((p) => p.els.some((e) => e.rail));
  const firstRail = hasRail.indexOf(true);
  const lastRail = hasRail.lastIndexOf(true);
  return pages.map((p, i) => {
    const step = p.els.some((e) => e.slot === 'step_no');
    if (step) n += 1;
    const text = (slot: string | undefined) =>
      slot === 'step_no' && step
        ? String(n).padStart(2, '0')
        : slot === 'thread_count'
          ? `${i + 1}/${pages.length}`
          : undefined;
    // The connecting line runs into the next card and out of the one before, not past the ends.
    const railed = (side: 'top' | 'bottom') => (side === 'top' ? i > firstRail : i < lastRail);
    return {
      ...p,
      els: p.els.map((e) => {
        if (e.rail) return { ...e, vis: railed(e.rail) };
        const next = e.t === 'text' ? text(e.slot) : undefined;
        return next !== undefined && e.t === 'text' ? { ...e, text: next } : e;
      }),
    };
  });
}

/** Opens page `i` with `pages` as the thread's pages, the open one included and up to date. */
function open(live: ICLayout, root: string, pages: ICLayout[], i: number): ICLayout {
  const at = Math.max(0, Math.min(pages.length - 1, i));
  const next = syncPage(pages[at], live);
  return { ...next, ...designParts(live), thread: { root, pages, at } };
}

/** The pages with the open one written back, so it can be stored or moved. */
const current = (live: ICLayout): ICLayout[] => {
  const th = live.thread;
  if (!th) return [pageOnly(live)];
  const pages = th.pages.slice();
  pages[th.at] = pageOnly(live);
  return pages;
};

export function goToPage(live: ICLayout, i: number): ICLayout {
  const th = live.thread;
  if (!th || i === th.at) return live;
  return open(live, th.root, current(live), i);
}

/** Adds a page after the open one: a copy of it, or a fresh page of a kind the thread offers. */
export function addPage(live: ICLayout, kind?: string): ICLayout {
  const th = live.thread;
  if (!th) return live;
  const pages = current(live);
  const page = kind
    ? fitWords(pageOnly(layoutFromTemplate(findTemplate(kind), undefined, undefined, live.ratio)))
    : structuredClone(pages[th.at]);
  pages.splice(th.at + 1, 0, page);
  return open(live, th.root, numberSteps(pages), th.at + 1);
}

export function removePage(live: ICLayout): ICLayout {
  const th = live.thread;
  if (!th || th.pages.length < 2) return live;
  const pages = current(live);
  pages.splice(th.at, 1);
  return open(live, th.root, numberSteps(pages), Math.min(th.at, pages.length - 1));
}

/** Moves the open page one place earlier (-1) or later (1). */
export function movePage(live: ICLayout, by: -1 | 1): ICLayout {
  const th = live.thread;
  if (!th) return live;
  const to = th.at + by;
  if (to < 0 || to >= th.pages.length) return live;
  const pages = current(live);
  [pages[th.at], pages[to]] = [pages[to], pages[th.at]];
  return open(live, th.root, numberSteps(pages), to);
}

/** Turns a new design built from a thread template's first page into the whole thread. */
export function startThread(built: ICLayout, root: ICTemplate): ICLayout {
  if (!root.thread) return built;
  const pages = root.thread.pages.map((id, i) =>
    fitWords(
      i === 0
        ? pageOnly(built)
        : pageOnly(layoutFromTemplate(findTemplate(id), undefined, undefined, built.ratio)),
    ),
  );
  return {
    ...fitWords(built),
    thread: { root: root.id, pages: numberSteps(pages), at: 0 },
  };
}

/** The same thread in another built-in brand: each page moves to that brand's version of it. */
export function threadInBrand(live: ICLayout, brand: string): ICLayout | undefined {
  const th = live.thread;
  if (!th) return undefined;
  const root = siblingTemplate(findTemplate(th.root), brand);
  if (!root) return undefined;
  const pages = allPages(live).map((p) => {
    const t = findTemplate(p.templateId);
    const s = siblingTemplate(t, brand);
    if (!s) return pageOnly(p);
    // Passing the template's own kit marks the kit as not chosen, so the brand's kit comes with it.
    return pageOnly(
      layoutFromTemplate(s, { ...p, kit: t.kit, palette: undefined }, t, p.ratio ?? s.ratio),
    );
  });
  const { logo: _l, brandName: _b, url: _u, ...shared } = live.shared ?? {};
  return {
    ...pages[th.at],
    ...designParts(live),
    shared,
    thread: { root: root.id, pages, at: th.at },
  };
}
