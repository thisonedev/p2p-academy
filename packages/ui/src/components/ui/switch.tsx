import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface SwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/** An on/off toggle. */
export function Switch({ on, onChange, disabled, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'bg-primary' : 'bg-canvas-muted-foreground/40',
      )}
      {...aria}
    >
      <span
        className={cn(
          'inline-block size-4 transform rounded-[2px] bg-canvas transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/** A bordered row with a title, a hint under it, and a `Switch` on the right. */
export function SwitchRow({
  title,
  hint,
  on,
  onChange,
  disabled,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('rounded-md border border-canvas-border bg-canvas p-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={`${id}-title`} className="text-sm font-semibold text-canvas-foreground">
            {title}
          </p>
          {hint ? (
            <p id={`${id}-hint`} className="mt-0.5 text-xs text-canvas-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <Switch
          on={on}
          onChange={onChange}
          disabled={disabled}
          aria-labelledby={`${id}-title`}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      </div>
    </div>
  );
}
