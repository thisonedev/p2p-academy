import { Shield } from 'lucide-react';
import { Note } from '../ui/note.js';

/** Shown before the P2P mesh starts, since Windows then puts up its own firewall prompt. */
export function WindowsFirewallNote() {
  return (
    <Note icon={Shield}>
      Windows may ask for firewall permission for background peer-to-peer networking used
      by model downloads and device pairing. Click Allow to continue.
    </Note>
  );
}
