import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type scale and layers in tokens.css. Listed so text-label next to text-danger stays
// a size and a color, and a z-modal passed to a component replaces its own z-*.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'label', 'body', 'lead', 'title', 'display'] }],
      z: [{ z: ['sticky', 'modal', 'modal-raised', 'modal-nested', 'toast', 'popover', 'dialog', 'tooltip'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
