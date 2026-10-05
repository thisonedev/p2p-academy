'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useLayoutEffect, useState } from 'react';

/**
 * Shows a page in the desktop app only. In a browser it draws nothing and goes to the home page.
 * The site is a static export, so this keeps people out of the page, not out of its files.
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [desktop, setDesktop] = useState(false);
  // Before the first paint, so the desktop app never shows an empty page.
  useLayoutEffect(() => {
    if ((window as { academy?: unknown }).academy) setDesktop(true);
    else router.replace('/');
  }, [router]);
  return desktop ? children : null;
}
