// Sizes use base 1024 everywhere in the app, labelled KB, MB and GB.
export const KIB = 1024;
export const MIB = 1024 ** 2;
export const GIB = 1024 ** 3;

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= KIB && unit < UNITS.length - 1) {
    value /= KIB;
    unit += 1;
  }
  const fixed = value < 10 && unit > 0 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0);
  return `${fixed} ${UNITS[unit]}`;
}

/** Always in GB, so sizes side by side (a disk and what fills it) compare at a glance. */
export function formatGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB';
  const gb = bytes / GIB;
  if (gb >= 100) return `${gb.toFixed(0)} GB`;
  if (gb >= 10) return `${gb.toFixed(1)} GB`;
  return `${gb.toFixed(2)} GB`;
}
