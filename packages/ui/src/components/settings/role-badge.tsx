import { Badge } from '../ui/badge.js';

/** Which side of a pairing a device is. `hint` adds a tooltip saying what the role means. */
export function RoleBadge({ role, hint }: { role: 'host' | 'guest'; hint?: boolean }) {
  if (role === 'host') {
    return (
      <Badge
        tone="emerald"
        className="shrink-0"
        title={hint ? 'This device runs the code; the other side is the guest.' : undefined}
      >
        host
      </Badge>
    );
  }
  return (
    <Badge
      tone="sky"
      className="shrink-0"
      title={hint ? 'This device is the guest; the other side runs the code.' : undefined}
    >
      guest
    </Badge>
  );
}
