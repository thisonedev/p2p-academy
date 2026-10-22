import { Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

const TONES = {
  warning: { wash: 'from-warning/10', link: 'text-warning' },
  info: { wash: 'from-info/10', link: 'text-info' },
  success: { wash: 'from-primary/12', link: 'text-primary' },
  danger: { wash: 'from-danger/12', link: 'text-danger' },
};

const CHIP_TONES = {
  neutral: 'border-canvas-border text-canvas-muted-foreground',
  warning: 'border-warning/35 text-warning',
  success: 'border-primary/35 text-primary',
};

// The dashes are drawn in currentColor, so the tone's text color sets them.
const LINK_STYLES = `
  @keyframes noticeLinkFlow { to { background-position: 10px 0; } }
  .notice-link { background: repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 10px); }
  .notice-link-moving { animation: noticeLinkFlow 0.6s linear infinite; }
  .notice-link-solid { background: currentColor; }
`;

export type NoticeTone = keyof typeof TONES;
/** A device in the card's pair of tiles: a name, or `self` for this device. */
export type NoticeDevice = string | 'self';

function DeviceTile({ device }: { device: NoticeDevice }) {
  if (device === 'self') {
    return (
      <span
        title="This device"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas-muted-foreground/70 text-canvas"
      >
        <Monitor className="size-4" />
      </span>
    );
  }
  return (
    <span
      title={device}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary-soft to-primary-strong text-sm font-semibold text-canvas"
    >
      {device.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** A small bordered fact under a notice's text. */
export function NoticeChip({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof CHIP_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-caption',
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * A notice about another device: two device tiles joined by a line, a title, the text under
 * it, chips, and controls on the right. `link` is `waiting` (still dashes), `moving`, or
 * `done` (solid). `aside` sits top right, `actions` under it, and `footer` goes under the chips.
 */
export function NoticeCard({
  tone,
  devices,
  link,
  title,
  children,
  chips,
  aside,
  actions,
  footer,
}: {
  tone: NoticeTone;
  devices: [NoticeDevice, NoticeDevice];
  link: 'waiting' | 'moving' | 'done';
  title: ReactNode;
  children?: ReactNode;
  chips?: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    // The tint is its own layer: tailwind-merge drops a bg color that shares a class list with bg-linear-*.
    <div className="mx-3 mt-2 overflow-hidden rounded-2xl border border-canvas-border bg-canvas-raised text-sm shadow-lg shadow-black/40">
      <style>{LINK_STYLES}</style>
      <div className={cn('bg-linear-to-br to-transparent to-60%', t.wash)}>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5">
          <div className="flex items-center pt-0.5">
            <DeviceTile device={devices[0]} />
            <span
              aria-hidden
              className={cn(
                'mx-1 h-0.5 w-8',
                t.link,
                link === 'done' ? 'notice-link-solid' : 'notice-link',
                link === 'moving' && 'notice-link-moving',
              )}
            />
            <DeviceTile device={devices[1]} />
          </div>
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-semibold text-canvas-foreground">{title}</p>
            {children ? <div className="mt-0.5 text-canvas-muted-foreground">{children}</div> : null}
            {chips ? <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div> : null}
            {footer}
          </div>
          {aside || actions ? (
            <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
              {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
              {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
