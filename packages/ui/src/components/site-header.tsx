'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DownloadStatusBadge } from './download-status-badge.js';
import { UserMenu } from './user-menu.js';
import { WindowControls } from './window-controls.js';
import { useUserStore } from '@academy/core';

// Labels are short verbs; the routes keep their original paths so existing links still work.
const NAV = [
  { href: '/courses', label: 'Learn' },
  { href: '/playground', label: 'Play' },
  { href: '/design', label: 'Design' },
];

export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const username = useUserStore((s) => s.username);
  const openSignInPrompt = useUserStore((s) => s.openSignInPrompt);
  const signedIn = !!username;

  return (
    <header className="site-header sticky top-0 z-10 flex h-14 w-full items-center border-b border-canvas-border bg-canvas/90 px-4 backdrop-blur sm:px-6">
      <WindowControls />
      <Link
        href="/"
        className="ml-3 flex items-center gap-2 text-base font-bold tracking-tight sm:ml-4"
      >
        <span>
          <span className="text-emerald-400">P2P</span>
          <span className="text-canvas-foreground"> Academy</span>
        </span>
      </Link>

      <nav className="ml-auto flex items-center gap-1 sm:gap-3 text-sm">
        <DownloadStatusBadge />
        {mounted ? (
          signedIn ? (
            <UserMenu />
          ) : (
            <button
              type="button"
              onClick={openSignInPrompt}
              className="desktop-only inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-3 py-1.5 text-sm font-medium text-canvas-foreground transition-colors hover:border-emerald-500/40 hover:bg-canvas"
            >
              Sign in
            </button>
          )
        ) : (
          <span className="inline-block h-9 w-20 rounded-md" aria-hidden />
        )}
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="desktop-only inline-flex rounded-md px-2 py-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground sm:px-3"
          >
            {label}
          </Link>
        ))}
        <a
          href="https://github.com/thisonedev/p2p-academy"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-canvas-border px-2.5 py-1 text-xs text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground sm:px-3 sm:text-sm"
        >
          GitHub
        </a>
      </nav>
    </header>
  );
}
