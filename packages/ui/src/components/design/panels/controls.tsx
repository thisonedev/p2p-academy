'use client';

import type { ReactNode } from 'react';
import { fieldClass } from '../../ui/field.js';

// The controls the design studio's right panel is built from. Design, Motion, Video and Sound
// all use these, so a change here shows on every tab. How they sit together, such as a run of
// rows reading as one card, is set under [data-studio-inspector] in the app's global.css.

/** A text box or a textarea. Inside a `Row` it has no box of its own and sits on the row's card. */
export const FIELD = fieldClass('sm');

/** A label on the left and its control on the right. Rows that follow each other join into one
 *  card. `end` sits after the control, for a switch or an icon button. `dim` fades the control
 *  and stops clicks on it, for something that is switched off. */
export function Row({
  label,
  children,
  end,
  dim,
}: {
  label: string;
  children?: ReactNode;
  end?: ReactNode;
  dim?: boolean;
}) {
  return (
    // Not a label: a dropdown inside one takes the focus back after a click and keeps its ring.
    <div data-row className="flex items-center gap-2 text-caption">
      <span className="w-16 shrink-0 text-canvas-muted-foreground">{label}</span>
      <div
        className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 [&>*:only-child]:flex-1 ${
          dim ? 'pointer-events-none opacity-40' : ''
        }`}
      >
        {children}
      </div>
      {end}
    </div>
  );
}

export function Switch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative flex h-4 w-7 shrink-0 items-center rounded-[3px] transition-colors ${
        on ? 'bg-primary' : 'bg-canvas-field'
      }`}
    >
      <span
        className={`inline-block size-3 rounded-[2px] transition-transform ${
          on ? 'translate-x-3.5 bg-fd-primary-foreground' : 'translate-x-0.5 bg-canvas-dimmer'
        }`}
      />
    </button>
  );
}
