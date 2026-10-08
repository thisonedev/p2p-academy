import { useCallback, useEffect, useState } from 'react';
import type { LessonData } from './lesson-types.js';
import { capturedKey, overrideKey, sourceFromArgvFrom } from './run-helpers.js';
import '../../lib/academy.js';

/** The arguments a lesson's code runs with: what the person typed over a default, and values an
 *  earlier lesson's run printed and this one picks up. */
export function useArgvSlots(data: Pick<LessonData, 'argv'>, isDesktop: boolean) {
  const [argvOverrides, setArgvOverrides] = useState<Record<string, string>>({});
  const [argvCaptured, setArgvCaptured] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isDesktop || !data.argv || data.argv.length === 0) return;
    let cancelled = false;
    (async () => {
      const nextOverrides: Record<string, string> = {};
      const nextCaptured: Record<string, string> = {};
      for (const slot of data.argv ?? []) {
        const overrideValue = await window.academy?.state?.get(overrideKey(slot.name));
        if (cancelled) return;
        if (typeof overrideValue === 'string' && overrideValue.length > 0) {
          nextOverrides[slot.name] = overrideValue;
        }
        const source = sourceFromArgvFrom(slot.from);
        if (source) {
          const capturedValue = await window.academy?.state?.get(capturedKey(source));
          if (cancelled) return;
          if (typeof capturedValue === 'string' && capturedValue.length > 0) {
            nextCaptured[source] = capturedValue;
          }
        }
      }
      if (!cancelled) {
        setArgvOverrides(nextOverrides);
        setArgvCaptured(nextCaptured);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, data.argv]);

  // An empty value keeps the override session active. Only non-empty values persist.
  const setArgvOverrideValue = useCallback(
    (name: string, value: string) => {
      setArgvOverrides((prev) => {
        if (!(name in prev) && value.length === 0) return prev;
        return { ...prev, [name]: value };
      });
      if (isDesktop && value.length > 0) {
        void window.academy?.state?.set(overrideKey(name), value);
      }
    },
    [isDesktop],
  );

  const startArgvOverride = useCallback((name: string) => {
    setArgvOverrides((prev) => {
      if (name in prev) return prev;
      return { ...prev, [name]: '' };
    });
  }, []);

  const clearArgvOverride = useCallback(
    (name: string) => {
      setArgvOverrides((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (isDesktop) {
        void window.academy?.state?.remove(overrideKey(name));
      }
    },
    [isDesktop],
  );

  const resolveArgv = useCallback(async (): Promise<string[]> => {
    if (!data.argv || data.argv.length === 0) return [];
    const out: string[] = [];
    for (const slot of data.argv) {
      const override = argvOverrides[slot.name];
      if (override && override.length > 0) {
        out.push(override);
        continue;
      }
      const source = sourceFromArgvFrom(slot.from);
      if (source && isDesktop) {
        const captured = await window.academy?.state?.get(capturedKey(source));
        if (typeof captured === 'string' && captured.length > 0) {
          out.push(captured);
          continue;
        }
      }
      out.push(slot.default ?? '');
    }
    return out;
  }, [data.argv, argvOverrides, isDesktop]);

  return {
    argvOverrides,
    argvCaptured,
    setArgvCaptured,
    setArgvOverrideValue,
    startArgvOverride,
    clearArgvOverride,
    resolveArgv,
  };
}
