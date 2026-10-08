import { useCallback, useState } from 'react';

/** A value that shows for a moment and then clears itself, such as "Copied" on a button.
 *  Flashing a new value before the last one cleared keeps the new one for its full time. */
export function useFlash<T>(ms = 1500): [T | null, (value: T) => void] {
  const [shown, setShown] = useState<T | null>(null);
  const flash = useCallback(
    (value: T) => {
      setShown(value);
      setTimeout(() => setShown((now) => (now === value ? null : now)), ms);
    },
    [ms],
  );
  return [shown, flash];
}
