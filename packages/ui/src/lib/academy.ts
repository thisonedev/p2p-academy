import type { AcademyAPI } from '@academy/validation';

declare global {
  interface Window {
    /** The desktop app's bridge, put on the window by its preload script. Absent in a browser. */
    academy?: AcademyAPI;
  }
}

/** True in the desktop app, false in a browser and while rendering on the server. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.academy;
}
