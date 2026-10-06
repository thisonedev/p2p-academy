'use client';

import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// The app's one dropdown. A native `<select>` opens with the system's light list, which cannot
// be restyled, so this draws its own. `ThemedSelect` is the short form for a plain list of
// values. The studio's grouped pickers pass sections, with actions on an entry or under the list.

const TRIGGER =
  'flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas px-2.5 py-2 text-left text-[12.5px] text-canvas-foreground transition-colors hover:border-emerald-500/40 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40';

/** The button a dropdown opens from: an optional label and lead, the value, and an arrow. */
export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  {
    value: ReactNode;
    /** A small prefix before the value, when nothing beside the dropdown names the choice. */
    label?: string;
    lead?: ReactNode;
    open?: boolean;
    /** Only as wide as what it holds. Otherwise it fills its row. */
    inline?: boolean;
    className?: string;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'className'>
>(function SelectTrigger({ value, label, lead, open, inline, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-select
      aria-expanded={open}
      {...rest}
      className={className ?? `${TRIGGER} ${inline ? '' : 'w-full'}`}
    >
      {label && (
        <span className="w-14 shrink-0 text-left text-[11.5px] text-canvas-muted-foreground">
          {label}
        </span>
      )}
      {lead}
      <span className="truncate">{value}</span>
      <ChevronDown className="ml-auto size-3.5 shrink-0 text-canvas-muted-foreground" />
    </button>
  );
});

export interface DropdownItem {
  id: string;
  label: string;
  lead?: ReactNode;
  right?: ReactNode;
  on?: boolean;
  disabled?: boolean;
  title?: string;
  onPick: () => void;
  onEdit?: () => void;
  /** Asked to confirm in the list before it runs. */
  onRemove?: () => void;
}

export interface DropdownSection {
  title?: string;
  note?: string;
  items: DropdownItem[];
}

export interface DropdownProps {
  /** What the button shows as the current choice. */
  value: ReactNode;
  label?: string;
  lead?: ReactNode;
  sections: DropdownSection[];
  /** Actions above the list, such as creating a new entry. */
  header?: (close: () => void) => ReactNode;
  footer?: (close: () => void) => ReactNode;
  inline?: boolean;
  /** A roomy list for grouped entries: at least 260 wide, up to most of the window's height. */
  wide?: boolean;
  id?: string;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Replaces the button's whole style. */
  className?: string;
}

const ICON =
  'flex items-center justify-center rounded p-1 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground';

export function Dropdown({
  value,
  label,
  lead,
  sections,
  header,
  footer,
  inline,
  wide,
  id,
  title,
  ariaLabel,
  disabled,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    most: number;
    font: string;
  } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setConfirming(null);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const most = wide ? Math.round(window.innerHeight * 0.7) : 224;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    // It opens upward when there is no room for a short list under the button. It is then
    // anchored by its bottom, so a list shorter than the room leaves no gap over the button.
    const up = below < Math.min(most, 224) && above > below;
    const width = Math.max(rect.width, wide ? 260 : 0);
    setPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      most: Math.max(120, Math.min(most, up ? above : below)),
      // The list is drawn on the page's body, so it takes the face of the button it belongs to.
      font: getComputedStyle(button).fontFamily,
    });
    const outside = (target: EventTarget | null) =>
      !button.contains(target as Node) && !listRef.current?.contains(target as Node);
    const onDown = (e: MouseEvent) => outside(e.target) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape closes the list and goes no further, so it does not also undo something behind it.
      e.stopImmediatePropagation();
      close();
    };
    // The list is fixed to the screen, so a scroll under it would leave it behind its button.
    const onScroll = (e: Event) => !listRef.current?.contains(e.target as Node) && close();
    document.addEventListener('mousedown', onDown, true);
    // On the window in the capture phase, so it hears Escape before a page's own key handling
    // (the studio's, which uses Escape to drop the selection) can stop it.
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, wide]);

  return (
    <div className={inline ? 'shrink-0' : 'w-full min-w-0'}>
      <SelectTrigger
        ref={buttonRef}
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        open={open}
        inline={inline}
        onClick={() => (open ? close() : setOpen(true))}
        className={className}
        label={label}
        lead={lead}
        value={value}
      />
      {/* Drawn on the body and fixed in place from the button's own box: a popup that holds the
          dropdown may clip its children, which would cut a long list short. */}
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            data-themed-select-menu
            className="fixed z-[80] overflow-y-auto rounded-lg border border-canvas-border bg-canvas-raised py-1 shadow-2xl"
            style={{
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              minWidth: pos.width,
              maxHeight: pos.most,
              fontFamily: pos.font,
            }}
          >
            {header && (
              <div className="mb-1 border-b border-canvas-border pb-1">{header(close)}</div>
            )}
            {sections.map((section, si) => (
              <div key={section.title ?? si}>
                {section.title && (
                  <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground">
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
                      className={`group flex items-center pr-2 ${item.on ? 'bg-emerald-400/10' : 'hover:bg-canvas-muted'}`}
                    >
                      <button
                        type="button"
                        disabled={item.disabled}
                        title={item.title}
                        onClick={() => {
                          if (item.disabled) return;
                          item.onPick();
                          close();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-3 text-left text-[12px] text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {item.lead}
                        <span className="whitespace-nowrap">{item.label}</span>
                        {item.right && (
                          <span className="ml-auto pl-3 text-[10.5px] text-canvas-muted-foreground">
                            {item.right}
                          </span>
                        )}
                        {item.on && (
                          <Check
                            className={`size-3.5 shrink-0 text-emerald-400 ${item.right ? '' : 'ml-auto'}`}
                          />
                        )}
                      </button>
                      {item.onEdit && (
                        <button
                          type="button"
                          title={`Edit ${item.label}`}
                          className={`${ICON} ml-1 opacity-0 group-hover:opacity-100`}
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
                          className={`${ICON} opacity-0 group-hover:opacity-100`}
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
