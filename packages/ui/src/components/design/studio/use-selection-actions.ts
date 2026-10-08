
import {
  useCallback,
} from 'react';
import {
  type ICLayout,
  type ICElement,
  newElementId,
} from '../render/layout.js';
import { type Selection } from '../panels/studio-api.js';
import type { Dispatch, SetStateAction } from 'react';

/** What can be done to the selected layers: duplicate, remove, lock, group, reorder. */
export function useSelectionActions({
  multiSel,
  selected,
  insert,
  copyOf,
  layout,
  setLayout,
  setSelId,
  setMultiSel,
  selId,
}: {
  multiSel: string[];
  selected: ICElement | null;
  insert: (el: ICElement, after?: string) => void;
  copyOf: (source: ICElement) => ICElement;
  layout: ICLayout;
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  setSelId: Dispatch<SetStateAction<Selection>>;
  setMultiSel: Dispatch<SetStateAction<string[]>>;
  selId: Selection;
}) {
  const selIds = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];

  const duplicate = useCallback(() => {
    if (multiSel.length === 0) {
      if (selected) insert(copyOf(selected), selected.id);
      return;
    }
    // Copies of a group form a group of their own.
    const groups = new Map<string, string>();
    const copies = layout.els
      .filter((e) => multiSel.includes(e.id))
      .map((e) => {
        const copy = copyOf(e);
        if (!e.groupId) return copy;
        if (!groups.has(e.groupId)) groups.set(e.groupId, newElementId());
        return { ...copy, groupId: groups.get(e.groupId) };
      });
    setLayout((l) => ({ ...l, els: [...l.els, ...copies] }));
    setSelId(null);
    setMultiSel(copies.map((c) => c.id));
  }, [copyOf, insert, layout.els, multiSel, selected, setLayout]);

  const remove = useCallback(() => {
    if (multiSel.length > 0) {
      setLayout((l) => ({ ...l, els: l.els.filter((e) => !multiSel.includes(e.id)) }));
      setMultiSel([]);
      return;
    }
    if (!selected) return;
    setLayout((l) => ({ ...l, els: l.els.filter((e) => e.id !== selected.id) }));
    setSelId(null);
  }, [multiSel, selected, setLayout]);

  /** Locks the selection, or unlocks it when all of it is locked already. */
  const toggleLock = useCallback(() => {
    const ids = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];
    const lock = layout.els.some((e) => ids.includes(e.id) && !e.lock);
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (ids.includes(e.id) ? { ...e, lock } : e)),
    }));
  }, [layout.els, multiSel, selected, setLayout]);

  const group = useCallback(() => {
    if (multiSel.length < 2) return;
    const groupId = newElementId();
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (multiSel.includes(e.id) ? { ...e, groupId } : e)),
    }));
  }, [multiSel, setLayout]);

  // Ungrouping any part of a group, even the one layer picked out of it, takes the whole group apart.
  const ungroup = useCallback(() => {
    const ids = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];
    const gone = new Set(
      layout.els.flatMap((e) => (ids.includes(e.id) && e.groupId ? [e.groupId] : [])),
    );
    if (gone.size === 0) return;
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (e.groupId && gone.has(e.groupId) ? { ...e, groupId: undefined } : e)),
    }));
  }, [layout.els, multiSel, selected, setLayout]);

  const move = useCallback(
    (dir: 1 | -1) => {
      setLayout((l) => {
        const i = l.els.findIndex((e) => e.id === selId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.els.length) return l;
        const els = l.els.slice();
        [els[i], els[j]] = [els[j], els[i]];
        return { ...l, els };
      });
    },
    [selId, setLayout],
  );

  const moveEnd = useCallback(
    (dir: 1 | -1) => {
      const ids = multiSel.length > 0 ? multiSel : selId ? [selId] : [];
      setLayout((l) => {
        // Moved together, in the order they already stack.
        const picked = l.els.filter((e) => ids.includes(e.id));
        if (picked.length === 0) return l;
        const rest = l.els.filter((e) => !ids.includes(e.id));
        return { ...l, els: dir === 1 ? [...rest, ...picked] : [...picked, ...rest] };
      });
    },
    [multiSel, selId, setLayout],
  );

  return {
    selIds,
    duplicate,
    remove,
    toggleLock,
    group,
    ungroup,
    move,
    moveEnd,
  };
}
