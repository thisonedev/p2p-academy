import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** Called on a press that lands on the dimmed area itself, not on what it holds. */
  onClose: () => void;
  /** Dims less, for a confirm that opens over another dialog. */
  nested?: boolean;
}

/** The dimmed layer behind a dialog, with the dialog centered on it. `className` changes its
 *  stacking and padding. */
export function Overlay({ onClose, nested, className, ...rest }: OverlayProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a press on the dimmed backdrop closes what it holds
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-center justify-center p-4',
        nested ? 'bg-black/40' : 'bg-black/60',
        className,
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      {...rest}
    />
  );
}
