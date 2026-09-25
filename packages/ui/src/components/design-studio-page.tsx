'use client';

import { ImageConstructorStudio } from './image-constructor-studio.js';

/** The Design page: the studio on its own, no workflow needed. Every visit starts on a blank
 *  canvas; Save keeps a design in My designs, where it can be opened again. */
export function DesignStudioPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] p-3 sm:p-4">
      <ImageConstructorStudio
        standalone
        layoutRaw={undefined}
        sceneCacheRaw={undefined}
        onSave={() => undefined}
      />
    </div>
  );
}
