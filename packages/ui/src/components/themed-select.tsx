'use client';

import { Dropdown } from './dropdown.js';

export interface ThemedSelectOption {
  value: string;
  label?: string;
  disabled?: boolean;
  title?: string;
}

export interface ThemedSelectProps {
  id?: string;
  value: string;
  options: (string | ThemedSelectOption)[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

function normalize(o: string | ThemedSelectOption): ThemedSelectOption {
  return typeof o === 'string' ? { value: o, label: o } : { label: o.value, ...o };
}

/** The short form of `Dropdown` for a plain list of values: it takes a value, the options and
 *  what to do with a pick, as a native `<select>` would. */
export function ThemedSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder,
  title,
  ariaLabel,
  className,
}: ThemedSelectProps) {
  const normalized = options.map(normalize);
  const current = normalized.find((o) => o.value === value);
  return (
    <Dropdown
      id={id}
      title={title}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className={className}
      value={current?.label ?? placeholder ?? value}
      sections={[
        {
          items: normalized.map((o) => ({
            id: o.value,
            label: o.label ?? o.value,
            on: o.value === value,
            disabled: o.disabled,
            title: o.title,
            onPick: () => onChange(o.value),
          })),
        },
      ]}
    />
  );
}
