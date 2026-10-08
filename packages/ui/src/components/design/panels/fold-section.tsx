import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn.js';

/** A titled block of the inspector that folds shut from its title or its arrow. The caller
 *  keeps which ones are open. With no children, only the title row is drawn. */
export function FoldSection({
  title,
  open,
  onToggle,
  action,
  id,
  quiet,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** A control in the title row, before the fold arrow. */
  action?: ReactNode;
  id?: string;
  /** Draws the body faint, for something that is switched off. */
  quiet?: boolean;
  children?: ReactNode;
}) {
  const toggle =
    'flex items-center text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70 hover:text-canvas-muted-foreground';
  return (
    <section id={id} className="border-b border-canvas-border px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onToggle} aria-expanded={open} className={`${toggle} min-w-0 flex-1`}>
          {title}
        </button>
        {action}
        <button type="button" onClick={onToggle} tabIndex={-1} aria-hidden className={`${toggle} shrink-0`}>
          <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      {open && children !== undefined && <div className={cn('mt-2.5 space-y-2.5', quiet && 'opacity-45')}>{children}</div>}
    </section>
  );
}
