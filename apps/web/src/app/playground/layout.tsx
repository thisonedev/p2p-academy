import type { ReactNode } from 'react';
import { DesktopOnly } from '@/components/desktop-only';

export default function Layout({ children }: { children: ReactNode }) {
  return <DesktopOnly>{children}</DesktopOnly>;
}
