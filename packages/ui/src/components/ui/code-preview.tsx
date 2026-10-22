import { ChevronRight } from 'lucide-react';

/** Code folded away under "View code", opened with a chevron. */
export function CodePreview({ source }: { source: string }) {
  return (
    <details className="group mt-2 text-xs">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 font-sans text-canvas-muted-foreground transition-colors hover:text-canvas-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        View code
      </summary>
      <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-canvas-border bg-canvas p-2 font-mono text-canvas-foreground">
        {source}
      </pre>
    </details>
  );
}
