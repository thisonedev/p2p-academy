'use client';

export interface SegmentOption {
  key: string;
  label: string;
  on: boolean;
  /** Drawn struck through, for a choice that is switched off elsewhere. */
  struck?: boolean;
  onPick: () => void;
}

/** Choices side by side with no lines between them, the ones that are on lit. With `cols`, more
 *  than that many wrap onto further rows. Used for picking one and for switching several. */
export function Segments({ options, cols }: { options: SegmentOption[]; cols?: number }) {
  const across = Math.min(cols ?? options.length, options.length) || 1;
  return (
    <div
      className="grid min-w-0 overflow-hidden rounded-md bg-canvas-field text-[11px]"
      style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.on}
          title={o.label}
          onClick={o.onPick}
          className={`truncate px-1.5 py-1.5 ${o.struck ? 'line-through' : ''} ${
            o.on
              ? 'bg-emerald-500 font-medium text-fd-primary-foreground'
              : 'text-canvas-muted-foreground hover:text-canvas-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
