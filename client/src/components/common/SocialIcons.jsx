import { createLucideIcon } from 'lucide-react';

// Brand icons are not exported by the installed Lucide version.
export const Linkedin = createLucideIcon('Linkedin', [
  ['path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z', key: 'profile' }],
  ['rect', { x: 2, y: 9, width: 4, height: 12, key: 'stem' }],
  ['circle', { cx: 4, cy: 4, r: 2, key: 'dot' }],
]);

export const Github = createLucideIcon('Github', [
  ['path', { d: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22', key: 'mark' }],
]);
