/** A ring that fills clockwise with a whole percent, and the number inside it. Drawn on the
 *  edge of its `relative`, round parent. */
export function ProgressRing({ percent }: { percent: number }) {
  return (
    <>
      <svg viewBox="0 0 34 34" aria-hidden="true" className="pointer-events-none absolute inset-[-1px] -rotate-90 fill-none stroke-2">
        <circle cx="17" cy="17" r="16" className="stroke-primary/30" />
        <circle
          cx="17"
          cy="17"
          r="16"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - percent}
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="text-micro font-medium tabular-nums leading-none tracking-tighter">
        {percent}
        <span className="text-[0.7em] opacity-75">%</span>
      </span>
    </>
  );
}
