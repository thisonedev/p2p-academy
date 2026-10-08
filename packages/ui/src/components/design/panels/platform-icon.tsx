import { Instagram, Linkedin } from 'lucide-react';

/** The app a size is for. Story is a ring, not one app's logo, since Instagram and TikTok share it. */
export function PlatformIcon({
  app,
  className = 'size-4',
}: {
  /** `x`, `linkedin`, `instagram` or `story`. Anything else draws nothing. */
  app: string;
  className?: string;
}) {
  if (app === 'linkedin') return <Linkedin className={className} />;
  if (app === 'instagram') return <Instagram className={className} />;
  if (app === 'x') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
      </svg>
    );
  }
  if (app === 'story') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" strokeDasharray="4.2 2.4" strokeLinecap="round" />
        <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return null;
}
