// Checks the public API of the shared packages against packages/<name>/api-surface.json:
// every name each subpath of the package's `exports` map provides, and its kind.
// Reads the built .d.ts files, so run `pnpm build:packages` first.
//
// Usage:
//   node scripts/api-baselines.mjs            exits 1 when a name was removed, added, or changed kind
//   node scripts/api-baselines.mjs --update   writes the current API as the new baselines

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['constants', 'core', 'validation', 'ui'];
const update = process.argv.includes('--update');

// The root package has no TypeScript of its own; every listed package depends on it.
const ts = createRequire(path.join(root, 'packages/validation/package.json'))('typescript');

function kindOf(symbol, checker) {
  const s = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const f = s.flags;
  if (f & ts.SymbolFlags.Class) return 'class';
  if (f & ts.SymbolFlags.Enum) return 'enum';
  if (f & ts.SymbolFlags.Function) return 'function';
  if (f & ts.SymbolFlags.Variable) {
    const decl = s.valueDeclaration ?? s.declarations?.[0];
    const type = decl ? checker.getTypeOfSymbolAtLocation(s, decl) : null;
    return type && type.getCallSignatures().length > 0 ? 'function' : 'const';
  }
  if (f & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) return 'type';
  return 'other';
}

function readSurface(dir) {
  const pkgDir = path.join(root, 'packages', dir);
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const entries = Object.entries(pkg.exports ?? {})
    .filter(([, target]) => typeof target === 'object' && target.types)
    .map(([subpath, target]) => [subpath, path.join(pkgDir, target.types)]);
  const missing = entries.filter(([, file]) => !existsSync(file));
  if (missing.length) {
    throw new Error(`${pkg.name}: no built types at ${missing.map(([, f]) => path.relative(root, f)).join(', ')}. Run 'pnpm build:packages' first.`);
  }

  const program = ts.createProgram(
    entries.map(([, file]) => file),
    { noEmit: true, skipLibCheck: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022 },
  );
  const checker = program.getTypeChecker();
  const entrypoints = {};
  for (const [subpath, file] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file));
    const names = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : [];
    entrypoints[subpath] = Object.fromEntries(
      names
        .map((symbol) => [symbol.getName(), kindOf(symbol, checker)])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  return { package: pkg.name, entrypoints };
}

function diff(before, after) {
  const lines = [];
  const subpaths = new Set([...Object.keys(before.entrypoints), ...Object.keys(after.entrypoints)]);
  for (const subpath of [...subpaths].sort()) {
    const was = before.entrypoints[subpath] ?? {};
    const now = after.entrypoints[subpath] ?? {};
    for (const name of Object.keys(was)) {
      if (!(name in now)) lines.push(`  ${subpath}  removed  ${name} (${was[name]})`);
      else if (was[name] !== now[name]) lines.push(`  ${subpath}  changed  ${name}: ${was[name]} -> ${now[name]}`);
    }
    for (const name of Object.keys(now)) {
      if (!(name in was)) lines.push(`  ${subpath}  added    ${name} (${now[name]})`);
    }
  }
  return lines;
}

let drifted = false;
for (const dir of PACKAGES) {
  const current = readSurface(dir);
  const file = path.join(root, 'packages', dir, 'api-surface.json');
  const count = Object.values(current.entrypoints).reduce((n, names) => n + Object.keys(names).length, 0);
  if (update) {
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`${current.package}: wrote ${count} names`);
    continue;
  }
  const baseline = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { entrypoints: {} };
  const lines = diff(baseline, current);
  if (lines.length === 0) {
    console.log(`${current.package}: ${count} names, matches the baseline`);
    continue;
  }
  drifted = true;
  console.error(`${current.package}: the public API differs from ${path.relative(root, file)}`);
  for (const line of lines) console.error(line);
}

if (drifted) {
  console.error("\nIf the change is intended, run 'pnpm api:update' and commit the baseline diff.");
  process.exit(1);
}
