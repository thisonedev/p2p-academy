import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** Called on a press that lands on the dimmed area itself, not on what it holds. */
  onClose: () => void;
}

/** The dimmed layer behind a dialog, with the dialog centered on it. `className` changes its
 *  stacking, dimness and padding. */
export function Overlay({ onClose, className, ...rest }: OverlayProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a press on the dimmed backdrop closes what it holds
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4', className)}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      {...rest}
    />
  );
}
