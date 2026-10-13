import { ShieldAlert } from 'lucide-react';
import { Note } from '../ui/note.js';

/** Shown on Linux when Electron found no keyring to seal the profile keys with. */
export function UnprotectedKeysNote() {
  return (
    <Note icon={ShieldAlert}>
      No system keyring was found in this Linux session, so the keys for this profile are
      stored on this device without real protection. Anyone who can read your files can
      recover those keys.
    </Note>
  );
}
