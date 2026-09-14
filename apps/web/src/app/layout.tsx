import './global.css';
import { NotificationCenter, SiteHeader, UsernamePrompt } from '@academy/ui';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

// Self-hosted by Next.js at build time (no runtime fetch to Google's CDN),
// so this stays compatible with the page's font-src 'self' CSP. Variable
// names are kept as the old Geist ones so global.css needs no changes.
const sans = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'Tether Academy',
  description: "Learn to build on Tether's open source stack. Start with QVAC.",
  icons: {
    icon: [{ url: '/favicon.ico?v=2', type: 'image/x-icon', sizes: '32x32' }],
  },
  other: {
    google: 'notranslate',
  },
};

/** Tag <html data-platform="desktop"> before paint when the desktop bridge is
 *  present, so CSS can pick the right header layout (controls + logo offset). */
const tagPlatformScript = `try{if(window.academy){document.documentElement.setAttribute('data-platform','desktop')}}catch(e){}`;

const contentSecurityPolicy = [
  "default-src 'self'",
  // Monaco's AMD loader is served from /monaco/vs, copied at build time.
  // No remote origin, so a CDN compromise, a TLS intercept, or a pinned-range
  // mistake cannot run code in the same origin that holds window.academy.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // img.youtube.com and youtube-nocookie.com: the hero demo video's one
  // exception to an otherwise remote-origin-free policy (see security-headers.cjs).
  "img-src 'self' data: blob: https://img.youtube.com",
  'frame-src https://www.youtube-nocookie.com',
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Root layout: site header, page content, and the self-determining sign-in modal. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input */}
        <script dangerouslySetInnerHTML={{ __html: tagPlatformScript }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-canvas text-canvas-foreground antialiased"
        suppressHydrationWarning
      >
        <RootProvider>
          <SiteHeader />
          <NotificationCenter />
          <div className="flex w-full flex-1 flex-col">{children}</div>
          <UsernamePrompt />
        </RootProvider>
      </body>
    </html>
  );
}
