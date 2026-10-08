import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** A short heads-up in a tinted box, with an icon before the words. */
export function Note({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-canvas-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
      {children}
    </p>
  );
}
