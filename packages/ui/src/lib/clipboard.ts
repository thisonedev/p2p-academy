/** How long a command, pairing code or invite link may sit on the clipboard. */
export const CLIPBOARD_SCRUB_MS = 90_000;

/** Copies text. Older browsers and non-secure contexts have no Clipboard API, so those go through a hidden textarea. */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/** Clears the clipboard after a delay, but only if it still holds `text`: a later copy by the user survives. */
export function scrubClipboardLater(text: string, ms = CLIPBOARD_SCRUB_MS): void {
  setTimeout(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    navigator.clipboard
      .readText()
      .then((current) => {
        if (current === text) return navigator.clipboard.writeText('');
      })
      .catch(() => {});
  }, ms);
}
