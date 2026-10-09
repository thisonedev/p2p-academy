'use client';

import type { ReactNode } from 'react';

// Small pieces the studio's grouped dropdowns put in their lists. The dropdown itself is
// `Dropdown` in dropdown.tsx.

/** Two or three overlapping color dots, for a brand or palette in a list. */
export function Dots({ colors }: { colors: string[] }) {
  return (
    <span className="flex shrink-0">
      {colors.map((c, i) => (
        <span
          key={i}
          className="-ml-1 size-3 rounded-full border border-canvas-raised first:ml-0"
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

/** A row in a picker's footer that runs an action instead of picking a value. */
export function PickerAction({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-label text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
