'use client';

import { useEffect, useState } from 'react';
import { ImageConstructorStudio } from './image-constructor-studio.js';

const STORAGE_KEY = 'p2p-academy:design-studio';

function readSaved(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** The Design page: the studio on its own, no workflow needed. The open design is kept in the browser,
 *  and Save as template puts it in My templates, where a Create design node in Play can use it. */
export function DesignStudioPage() {
  const [layout, setLayout] = useState<string | undefined | null>(null);
  useEffect(() => setLayout(readSaved()), []);
  if (layout === null) return null;
  return (
    <div className="h-[calc(100vh-3.5rem)] p-3 sm:p-4">
      <ImageConstructorStudio
        standalone
        layoutRaw={layout}
        sceneCacheRaw={undefined}
        onSave={(raw) => {
          try {
            localStorage.setItem(STORAGE_KEY, raw);
          } catch {
            // Private windows can refuse storage; the design still works for this visit.
          }
        }}
      />
    </div>
  );
}
