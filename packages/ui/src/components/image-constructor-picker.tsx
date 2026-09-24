'use client';

import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PickerItem {
  id: string;
  label: string;
  lead?: ReactNode;
  right?: ReactNode;
  on?: boolean;
  disabled?: boolean;
  title?: string;
  onPick: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export interface PickerSection {
  title?: string;
  note?: string;
  items: PickerItem[];
}

/** Brand, Size and Type in the studio all use this one dropdown: a label, the current choice,
 *  and a list grouped under small headings, with any actions at the bottom. */
export function StudioPicker({
  label,
  value,
  lead,
  sections,
  footer,
  block,
}: {
  label: string;
  value: string;
  lead?: ReactNode;
  sections: PickerSection[];
  footer?: (close: () => void) => ReactNode;
  /** Fills its row, as in the side panel. */
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setConfirming(null);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const icon =
    'flex items-center justify-center rounded p-1 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground';
  return (
    <div className={block ? 'w-full' : 'shrink-0'}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex h-8 items-center gap-2 rounded-lg border bg-canvas px-2.5 text-[12px] text-canvas-foreground ${
          open
            ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/20'
            : 'border-canvas-border hover:border-canvas-muted-foreground'
        } ${block ? 'w-full' : ''}`}
      >
        <span className="text-canvas-muted-foreground/70">{label}</span>
        {lead}
        <span className="truncate">{value}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-canvas-muted-foreground ${block ? 'ml-auto' : ''}`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            className="fixed z-[60] max-h-[70vh] overflow-y-auto rounded-lg border border-canvas-border bg-canvas-raised py-1 font-mono shadow-2xl"
            style={{ left: pos.left, top: pos.top, minWidth: Math.max(pos.width, 260) }}
          >
            {sections.map((section, si) => (
              <div key={section.title ?? si}>
                {section.title && (
                  <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
                    {section.title}
                    {section.note && (
                      <span className="font-normal normal-case tracking-normal">
                        {' '}
                        · {section.note}
                      </span>
                    )}
                  </div>
                )}
                {section.items.map((item) =>
                  confirming === item.id ? (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]"
                    >
                      <span className="flex-1 text-canvas-muted-foreground">
                        Delete {item.label}?
                      </span>
                      <button
                        type="button"
                        className="rounded border border-canvas-border px-2 py-0.5 hover:bg-canvas"
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded bg-red-500/90 px-2 py-0.5 font-semibold text-white hover:bg-red-500"
                        onClick={() => {
                          setConfirming(null);
                          item.onRemove?.();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className={`group flex items-center pr-2 ${item.on ? 'bg-fuchsia-400/10' : 'hover:bg-canvas-muted'}`}
                    >
                      <button
                        type="button"
                        disabled={item.disabled}
                        title={item.title}
                        onClick={() => {
                          item.onPick();
                          close();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-3 text-left text-[12px] text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {item.lead}
                        <span className="truncate">{item.label}</span>
                        {item.right && (
                          <span className="ml-auto pl-3 text-[10.5px] text-canvas-muted-foreground">
                            {item.right}
                          </span>
                        )}
                        {item.on && (
                          <Check
                            className={`size-3.5 shrink-0 text-fuchsia-400 ${item.right ? '' : 'ml-auto'}`}
                          />
                        )}
                      </button>
                      {item.onEdit && (
                        <button
                          type="button"
                          title={`Edit ${item.label}`}
                          className={`${icon} ml-1 opacity-0 group-hover:opacity-100`}
                          onClick={() => {
                            close();
                            item.onEdit?.();
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {item.onRemove && (
                        <button
                          type="button"
                          title={`Delete ${item.label}`}
                          className={`${icon} opacity-0 group-hover:opacity-100`}
                          onClick={() => setConfirming(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            ))}
            {footer && (
              <div className="mt-1 border-t border-canvas-border pt-1">{footer(close)}</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Two or three overlapping color dots, for a brand or palette in a list. */
export function Dots({ colors }: { colors: string[] }) {
  return (
    <span className="flex shrink-0">
      {colors.map((c, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a brand may repeat a color
          key={i}
          className="-ml-1 size-3 rounded-full border border-canvas-raised first:ml-0"
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

/** A row in a picker's footer that runs an action instead of picking a value. */
export function PickerAction({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
