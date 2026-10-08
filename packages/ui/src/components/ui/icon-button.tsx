import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

const LOOKS = {
  /** Only the icon, lit on hover. For a close button or one at the end of a title. */
  plain: 'text-canvas-muted-foreground hover:text-canvas-foreground',
  /** The same with a little padding, as at the end of a row in the design studio's panels. */
  small: 'rounded p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground',
  /** A toolbar button, with a hover surface and a faded disabled state. */
  toolbar:
    'shrink-0 rounded p-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40',
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  look?: keyof typeof LOOKS;
}

/** The classes of a look, for an icon control that is not a button, such as a file input's label. */
export function iconButtonClass(look: keyof typeof LOOKS, className?: string): string {
  return cn(LOOKS[look], className);
}

/** A button that shows an icon and no words. Give it an `aria-label` or a `title`. */
export function IconButton({ look = 'plain', className, ...rest }: IconButtonProps) {
  return <button type="button" className={cn(LOOKS[look], className)} {...rest} />;
}
