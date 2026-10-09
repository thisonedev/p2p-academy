// Prints the CHANGELOG.md section for a version: node scripts/changelog-notes.mjs 1.2.3
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Text under "## [version]" up to the next "## " heading.
export function changelogNotes(version) {
  const lines = readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const notes = changelogNotes(process.argv[2] ?? '');
  if (!notes) {
    console.error(`CHANGELOG.md has no "## [${process.argv[2]}]" section`);
    process.exit(1);
  }
  console.log(notes);
}
