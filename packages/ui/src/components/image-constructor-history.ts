import { useCallback, useState } from 'react';

const LIMIT = 60;
// Changes closer together than this, like a drag or a slider, undo as one step.
const MERGE_MS = 600;

interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
  at: number;
}

/** State with undo and redo. */
export function useHistory<T>(initial: () => T) {
  const [state, setState] = useState<HistoryState<T>>(() => ({
    present: initial(),
    past: [],
    future: [],
    at: 0,
  }));

  const set = useCallback((fn: (value: T) => T) => {
    setState((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      const now = Date.now();
      const merge = s.past.length > 0 && now - s.at < MERGE_MS;
      return {
        present: next,
        past: merge ? s.past : [...s.past.slice(-(LIMIT - 1)), s.present],
        future: [],
        at: now,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length === 0
        ? s
        : {
            present: s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [s.present, ...s.future],
            at: 0,
          },
    );
  }, []);

  const redo = useCallback(() => {
    setState((s) =>
      s.future.length === 0
        ? s
        : { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1), at: 0 },
    );
  }, []);

  return {
    value: state.present,
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
