import { useSyncExternalStore } from 'react';

// The download scope of the lesson on screen, if any. That lesson draws its own progress ring,
// so the header leaves its ring out while the two would show the same download.
let visibleScope: string | null = null;
const listeners = new Set<() => void>();

export function setVisibleLessonDownloadScope(scope: string | null) {
  if (visibleScope === scope) return;
  visibleScope = scope;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVisibleLessonDownloadScope(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => visibleScope,
    () => null,
  );
}
