import type { AcademyPeerAuditEntry } from '@academy/validation';

export function shortHex(hex: string, head = 8, tail = 6): string {
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function pairUserDataLabel(info: { userData: unknown }): string {
  const data = info.userData;
  if (data && typeof data === 'object' && 'name' in data && typeof data.name === 'string') {
    return data.name;
  }
  if (data && typeof data === 'object' && 'hostname' in data && typeof data.hostname === 'string') {
    return String(data.hostname);
  }
  return 'Unknown device';
}

export function formatRelativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function formatExecSample(entry: AcademyPeerAuditEntry): string | null {
  if (entry.mode === 'inline') return 'inline snippet';
  if (entry.label) return entry.label;
  return null;
}
