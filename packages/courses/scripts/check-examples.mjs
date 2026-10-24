// Fails when a vendored example (.starting.ts or .answer.ts) does not parse.
// Syntax only: the examples import @qvac/sdk, which this package does not install.

import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const EXAMPLES_DIR = path.resolve('examples');

async function findExamples(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findExamples(full)));
    else if (e.isFile() && e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const files = (await findExamples(EXAMPLES_DIR)).sort();
let failed = 0;
for (const file of files) {
  const source = await fs.readFile(file, 'utf-8');
  const { diagnostics = [] } = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  for (const d of diagnostics) {
    failed++;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    console.error(`${path.relative(process.cwd(), file)}:${line + 1}:${character + 1} ${message}`);
  }
}

if (failed) {
  console.error(`check:examples: ${failed} syntax error(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`check:examples: ${files.length} files parse`);
