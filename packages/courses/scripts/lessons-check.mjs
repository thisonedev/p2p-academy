#!/usr/bin/env node
// lessons-check.mjs: generic upstream-vs-our-code change auditor.
//
// Repo-agnostic: to point it at a different upstream, add an entry to
// PROJECTS below via defineProject(). Everything past PROJECTS is generic.
//
// For the selected project (--project <key>, default 'qvac'): clones/fetches
// the upstream repo(s), resolves a baseline (latest version tag satisfying
// a package.json dep constraint, or --since <tag|sha|date>), extracts the
// SDK surface at baseline and HEAD via the TS compiler API, diffs it into
// EXPORT_*/PARAM_*/TYPE_*/SCHEMA_FIELD_*/FILE_* changes, filters down to
// what's RELEVANT to existing lessons plus NEW OPPORTUNITIES, and writes a
// markdown report plus machine-readable JSON.
//
// Usage:
//   pnpm <name>:check                     # full run, default project+baseline
//   pnpm <name>:check -- --project <key>  # pick a project (see PROJECTS)
//   pnpm <name>:check -- --since <ref>    # override baseline
//   pnpm <name>:check -- --quick          # skip docs site fetch
//   pnpm <name>:check -- --json           # JSON only, no markdown
//   pnpm <name>:check -- --head           # diff against upstream HEAD, not
//                                         # the latest release tag (default)
//
// Output is namespaced per project under temp/scripts/lessons-check/<key>/.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');
// Folder (relative to the monorepo root) where generated output is written:
// per project, the report, its JSON twin, run state, and the cached docs
// dump. Gitignored; safe to wipe between runs.
const OUTPUT_DIR_NAME = path.join('temp', 'scripts', 'lessons-check');

// ─── PROJECTS ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────
// Add a project via defineProject(key, overrides). `key` doubles as the
// lesson/example directory name and the output namespace.
//
// qvac is a monorepo, but not every project is: `repos` is a map of every
// named git repo the project pulls from, and `examplesRepo`/`docsRepo`
// (default 'main') say which one examples/docs live in when they differ.
// Each repo is cloned and baselined independently: a tag in one repo means
// nothing in another.
// ────────────────────────────────────────────────────────────────────

function defineProject(key, cfg) {
  const outDir = path.join(MONOREPO_ROOT, OUTPUT_DIR_NAME, key);
  return {
    key,
    reportMd: path.join(outDir, 'report', 'report.md'),
    reportJson: path.join(outDir, 'report', 'report.json'),
    stateFile: path.join(outDir, 'check-state.json'),
    docsFileCache: path.join(outDir, 'docs', 'full.txt'),
    lessonsRoot: path.join(MONOREPO_ROOT, 'packages', 'courses', 'courses', key, 'en'),
    vendoredRoot: path.join(MONOREPO_ROOT, 'packages', 'courses', 'examples', key),
    // Named git repos: see comment above. Every project needs at least a
    // 'main' entry: { url, baselinePackage, baselineDepName, baselineTagGlob }.
    // baselinePackage/baselineDepName pick the default baseline from a
    // package.json dep constraint (null to require --since every run).
    repos: {},
    examplesRepo: 'main',
    docsRepo: 'main',
    // Optional: docs pages (relative to the docs repo root) that map
    // example files/subdirectories to capability names for chapter
    // attribution. See buildChapterMapFromDocs(). Empty if unset.
    docsCapabilityDirs: [],
    // Optional: release-notes directory (relative to the docs repo root)
    // with a per-version api.md carrying human-written usage snippets. See
    // loadReleaseNoteSnippets(). Null to skip.
    changelogDir: null,
    // Optional: files (relative to the main repo root) backing the "does a
    // lesson already pass this required field" schema-to-loadModel-family
    // linkage. See buildModelConfigSchemaIndex(). Null to skip
    // (qvac-specific pattern; unlikely to transfer to a different upstream
    // as-is).
    modelTypesFile: null,
    loadModelSchemaFile: null,
    ...cfg,
  };
}

const PROJECTS = {
  qvac: defineProject('qvac', {
    project: 'QVAC SDK',
    projectUrl: 'https://docs.qvac.tether.io',
    // Monorepo: SDK source, examples, and docs all live in one repo, so
    // examplesRepo/docsRepo stay at their 'main' default (no override needed).
    repos: {
      main: {
        url: 'https://github.com/tetherto/qvac.git',
        // Null requires --since on every run.
        baselinePackage: path.join(MONOREPO_ROOT, 'apps', 'desktop', 'package.json'),
        baselineDepName: '@qvac/sdk',
        baselineTagGlob: 'sdk-v*',
      },
    },
    // Directory inside the upstream whose files we want to diff and
    // consider for NEW OPPORTUNITIES.
    examplesPathPrefix: 'packages/sdk/examples/',
    // Directory inside the upstream whose files we want to extract as the
    // "SDK surface" (function signatures, types, Zod schemas).
    surfacePathPrefix: 'packages/sdk/',
    // Optional: a single file in the upstream that exports a flat list of
    // uppercase constants (the "model registry"). Set to null to skip.
    modelRegistryFile: 'packages/inference/src/models/registry/models.ts',
    // The package's public entry point. Only symbols reachable from here via
    // its re-export chain are actually importable as `@qvac/sdk`'s public API.
    // Used to gate ADD_NEW_API so it doesn't suggest showcasing symbols that
    // are `export`ed from some internal file (making them technically
    // importable via a deep path) but never re-exported to the package root.
    publicEntryFile: 'packages/sdk/index.ts',
    // Optional: where to fetch the docs dump for divergence checking.
    docsLlmsUrl: 'https://docs.qvac.tether.io/llms-full.txt',
    // {current} is the current docs version, the one folder named in parentheses, like "(v0.22)".
    docsCapabilityDirs: ['docs/website/content/docs/sdk/{current}/ai-capabilities', 'docs/website/content/docs/sdk/{current}/p2p-capabilities'],
    changelogDir: 'packages/sdk/changelog',
    modelTypesFile: 'packages/sdk/schemas/model-types.ts',
    loadModelSchemaFile: 'packages/sdk/schemas/load-model.ts',
  }),
};
// ─── END PROJECTS ──────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// CLI args and project resolution.
// ────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const RAW_SINCE = (() => {
  const i = process.argv.indexOf('--since');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const RAW_PROJECT = (() => {
  const i = process.argv.indexOf('--project');
  return i >= 0 ? process.argv[i + 1] : null;
})() ?? 'qvac';
const QUICK = args.has('--quick');
const JSON_ONLY = args.has('--json');
// Default `to` is the latest tagged release, not upstream HEAD, so a run
// a few days after a release doesn't pull in unshipped commits.
const INCLUDE_UNRELEASED = args.has('--head');

if (!PROJECTS[RAW_PROJECT]) {
  console.error(`[check] unknown project "${RAW_PROJECT}". Known: ${Object.keys(PROJECTS).join(', ')}`);
  process.exit(1);
}
const CONFIG = PROJECTS[RAW_PROJECT];

const STATE_FILE = CONFIG.stateFile;
const REPORT_MD = CONFIG.reportMd;
const REPORT_JSON = CONFIG.reportJson;

// ────────────────────────────────────────────────────────────────────
// report.md is regenerated from scratch every run, which would reset every
// `[x]` back to `[ ]`. Each checkbox row carries a hidden `<!-- id:... -->`
// marker (see box() below); loadCheckedKeys() unions those still checked in
// the previous report.md with check-state.json, so a checked row survives
// the next regen. Unchecking one back off means editing check-state.json.
// ────────────────────────────────────────────────────────────────────

function extractCheckedKeys(text) {
  const keys = new Set();
  const re = /\[x\][^\n]*<!--\s*id:(.+?)\s*-->/gi;
  let m;
  while ((m = re.exec(text))) keys.add(m[1]);
  return keys;
}

function loadCheckedKeys() {
  const keys = new Set();
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    for (const k of state.checkedKeys ?? []) keys.add(k);
  } catch { /* no prior state */ }
  try {
    for (const k of extractCheckedKeys(readFileSync(REPORT_MD, 'utf8'))) keys.add(k);
  } catch { /* no prior report */ }
  return keys;
}

let CHECKED_KEYS = new Set();
const box = (key) => (CHECKED_KEYS.has(key) ? 'x' : ' ');

// ────────────────────────────────────────────────────────────────────
// Repo handles — each bundles a `git` function bound to its clone dir, so
// the rest of the file passes `repo.git` around instead of a module-global.
// ────────────────────────────────────────────────────────────────────

function makeGit(repoDir) {
  return function git(argv) {
    return new Promise((resolve, reject) => {
      const c = spawn('git', ['-C', repoDir, ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      c.stdout.on('data', (d) => (out += d.toString()));
      c.stderr.on('data', (d) => (err += d.toString()));
      c.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(`git ${argv.join(' ')} -> ${code}: ${err}`)));
    });
  };
}

const repoHandleCache = new Map();

// ────────────────────────────────────────────────────────────────────
// Returns the cached repo handle for `key`, building it from CONFIG.repos on first use.
// ────────────────────────────────────────────────────────────────────

function getRepo(key) {
  if (repoHandleCache.has(key)) return repoHandleCache.get(key);
  const repoCfg = CONFIG.repos[key];
  if (!repoCfg) throw new Error(`[check] project "${CONFIG.key}" has no repos.${key} configured`);
  const dir = path.join(MONOREPO_ROOT, OUTPUT_DIR_NAME, CONFIG.key, 'repos', key);
  const handle = { key, dir, url: repoCfg.url, config: repoCfg, git: makeGit(dir) };
  repoHandleCache.set(key, handle);
  return handle;
}

// ────────────────────────────────────────────────────────────────────
// Clones a repo on first run, fetches on every run after.
// ────────────────────────────────────────────────────────────────────

async function ensureRepo(repo) {
  if (existsSync(path.join(repo.dir, '.git'))) {
    console.error(`[check] ${repo.key} repo exists, fetching...`);
    await repo.git(['fetch', '--tags', '--force', 'origin']);
    // `fetch` alone never moves the local checkout forward, so HEAD stays
    // pinned to whatever commit was checked out on the first clone.
    await repo.git(['remote', 'set-head', 'origin', '-a']);
    await repo.git(['reset', '--hard', 'origin/HEAD']);
    return;
  }
  mkdirSync(path.dirname(repo.dir), { recursive: true });
  console.error(`[check] cloning ${repo.key} (${repo.url})...`);
  await new Promise((res, rej) => {
    const c = spawn('git', ['clone', repo.url, repo.dir], { stdio: 'inherit' });
    c.on('close', (code) => code === 0 ? res() : rej(new Error(`clone -> ${code}`)));
  });
  await repo.git(['fetch', '--tags', '--force', 'origin']);
}

// ────────────────────────────────────────────────────────────────────
// Resolves a tag/sha/ISO-date/null ref to a concrete {ref, sha, date}.
// ────────────────────────────────────────────────────────────────────

async function resolveRef(git, ref) {
  // ref can be: a tag, a sha, an ISO date, or null (= HEAD).
  if (!ref) return { ref: 'HEAD', sha: (await git(['rev-parse', 'HEAD'])).trim(), date: (await git(['log', '-1', '--format=%aI', 'HEAD'])).trim() };
  if (/^\d{4}-\d{2}-\d{2}/.test(ref)) {
    const sha = (await git(['log', '-1', '--format=%H', `--since=${ref}`, `--until=${ref}T23:59:59`])).trim();
    if (!sha) throw new Error(`no commit on ${ref}`);
    const date = (await git(['log', '-1', '--format=%aI', sha])).trim();
    return { ref, sha, date };
  }
  try {
    const sha = (await git(['rev-parse', '--verify', `${ref}^{commit}`])).trim();
    const date = (await git(['log', '-1', '--format=%aI', sha])).trim();
    return { ref, sha, date };
  } catch (e) {
    throw new Error(`could not resolve ${ref}: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// Resolves the baseline ref from a package.json dep constraint and the highest satisfying tag.
// ────────────────────────────────────────────────────────────────────

async function baselineFromDep(git, repoCfg) {
  if (!repoCfg.baselinePackage) throw new Error('baselinePackage is null — pass --since=<ref> explicitly');
  const pkg = JSON.parse(readFileSync(repoCfg.baselinePackage, 'utf8'));
  const constraint = (pkg.dependencies ?? pkg.devDependencies ?? {})[repoCfg.baselineDepName];
  if (!constraint) throw new Error(`${repoCfg.baselineDepName} not in ${repoCfg.baselinePackage}`);
  // ^0.15.0 -> [0.15.0, 0.16.0); pick the highest matching tag satisfying it.
  const m = constraint.match(/^[\^~]?\s*(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`unparseable constraint: ${constraint}`);
  const [, MAJ, MIN, PAT] = m.map(Number);
  const tags = (await git(['tag', '--list', repoCfg.baselineTagGlob, '--sort=-version:refname'])).trim().split('\n').filter(Boolean);
  // Find the latest tag whose semver matches the constraint floor. Tags can
  // carry any non-digit prefix (sdk-v1.2.3, v1.2.3, release-1.2.3, ...):
  // parseSemver() just finds the first X.Y.Z run, no fixed prefix assumed.
  for (const t of tags) {
    const tm = parseSemver(t);
    if (!tm) continue;
    const [maj, min, pat] = tm;
    if (maj !== MAJ || min !== MIN) continue;
    // ^0.15.0 means >=0.15.0 <0.16.0 in npm semver for 0.x packages; ~0.15.0
    // means the same range. min===MIN is already pinned above, so every
    // patch on that minor satisfies both operators, only the floor matters.
    if (pat < PAT) continue;
    return await resolveRef(git, t);
  }
  throw new Error(`no tag matching ${repoCfg.baselineTagGlob} satisfies ${constraint}`);
}

// ────────────────────────────────────────────────────────────────────
// AST extraction: functions, params, type fields, Zod schemas.
// ────────────────────────────────────────────────────────────────────

function fingerprint(node) {
  // Normalized AST hash, sensitive to any structural statement change,
  // stable across whitespace/comment reformatting.
  const seen = new WeakSet();
  function visit(n) {
    if (!n || typeof n !== 'object') return '';
    if (seen.has(n)) return '';
    seen.add(n);
    if (n.flags & ts.NodeFlags.Synthesized) return '';
    if (n.kind === ts.SyntaxKind.JSDocComment || n.kind === ts.SyntaxKind.JSDoc) return '';
    const kids = n.getChildren ? n.getChildren() : [];
    const out = [ts.SyntaxKind[n.kind]];
    for (const k of kids) {
      if (k.kind === ts.SyntaxKind.SingleLineCommentTrivia ||
          k.kind === ts.SyntaxKind.MultiLineCommentTrivia ||
          k.kind === ts.SyntaxKind.NewLineTrivia ||
          k.kind === ts.SyntaxKind.WhitespaceTrivia ||
          k.kind === ts.SyntaxKind.ShebangTrivia) continue;
      out.push(visit(k));
    }
    return out.join('|');
  }
  return createHash('sha256').update(visit(node)).digest('hex').slice(0, 16);
}

// ────────────────────────────────────────────────────────────────────
// Extracts a function parameter's name/type/optional/default as plain data.
// ────────────────────────────────────────────────────────────────────

function paramShape(p) {
  return {
    name: ts.isIdentifier(p.name) ? p.name.text : p.name.getText(),
    type: p.type ? p.type.getText() : '',
    optional: !!p.questionToken,
    default: p.initializer ? p.initializer.getText() : null,
  };
}

// ────────────────────────────────────────────────────────────────────
// Extracts field/method members from a type literal or interface.
// ────────────────────────────────────────────────────────────────────

function extractTypeMembers(node) {
  if (!node) return [];
  if (ts.isTypeLiteralNode(node)) return extractFromMembers(node.members);
  if (ts.isInterfaceDeclaration(node)) return extractFromMembers(node.members ?? []);
  if (ts.isTypeReferenceNode(node)) {
    // Unwrap `z.infer<typeof fooSchema>`-style references by following the
    // symbol. We don't have cross-file symbol resolution here, so we record
    // the reference name and the extractor also walks Zod schemas
    // independently in extractZodSchemas().
    return [{ kind: 'type-ref', name: node.typeName.getText() }];
  }
  return [];
}

// ────────────────────────────────────────────────────────────────────
// Converts property/method/index signature nodes to plain field data.
// ────────────────────────────────────────────────────────────────────

function extractFromMembers(members) {
  const out = [];
  for (const m of members) {
    if (ts.isPropertySignature(m) && m.name) {
      out.push({ name: m.name.getText(), type: m.type ? m.type.getText() : '', optional: !!m.questionToken, kind: 'field' });
    } else if (ts.isMethodSignature(m) && m.name) {
      out.push({ name: m.name.getText(), params: m.parameters.map(paramShape), returnType: m.type ? m.type.getText() : '', kind: 'method' });
    } else if (ts.isIndexSignature(m)) {
      out.push({ name: '[index]', type: m.type ? m.type.getText() : '', kind: 'index' });
    }
  }
  return out;
}

// Zod methods that wrap validation/docs without changing the object shape.
// Unwrapping them lets the walker find `z.object({...})` buried under
// chains like `.strict().refine(fn).describe('...')`.
const ZOD_TRANSPARENT_WRAPPERS = new Set([
  'strict', 'passthrough', 'partial', 'deepPartial', 'required',
  'refine', 'superRefine', 'transform', 'describe', 'readonly',
  'brand', 'catch', 'default', 'optional', 'nullable', 'nullish', 'meta',
]);

// ────────────────────────────────────────────────────────────────────
// Finds Zod schemas declared as `export const fooSchema = z.object({...})`,
// including ones composed via `.extend()`/`.merge()` on a local base const.
// AST inspection only, no schema instantiation.
//
// Known gap: a function's parameter type isn't generally linked back to the
// schema that validates it (`z.input<typeof fooSchema>`), so a schema-field
// change only attributes to lessons that import the schema by name.
// buildModelConfigSchemaIndex() closes this for one common pattern
// (`loadModel({ modelConfig })` family schemas); nothing else.
// ────────────────────────────────────────────────────────────────────

function extractZodSchemas(filePath, sourceText) {
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const localSchemas = new Map(); // name -> fields result, in source order
  const schemas = {};
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || !ts.isIdentifier(decl.name)) continue;
      if (!decl.initializer) continue;
      const fields = walkZodExpr(decl.initializer, localSchemas);
      if (fields) {
        localSchemas.set(decl.name.text, fields);
        if (isExport) schemas[decl.name.text] = { fields, fingerprint: fingerprint(decl.initializer) };
      }
    }
  }
  return schemas;
}

// ────────────────────────────────────────────────────────────────────
// Merges the fields of every schema in a `z.union`/`discriminatedUnion`
// options array. Discriminated-union fields get tagged with the branch's
// discriminant literal (`branch: 'parler'`) so diffSchemaFields() diffs
// same-branch fields instead of merging unrelated branches by field name.
// ────────────────────────────────────────────────────────────────────

function unionFields(arrNode, localSchemas, discriminantKey = null) {
  const out = [];
  for (const el of arrNode.elements) {
    const sub = walkZodExpr(el, localSchemas);
    if (!sub || sub.kind !== 'fields') continue;
    let branch = null;
    if (discriminantKey) {
      const discField = sub.fields.find((f) => f.name === discriminantKey);
      const m = discField?.type.match(/z\.literal\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (m) branch = m[1];
    }
    for (const f of sub.fields) out.push(branch ? { ...f, branch } : f);
  }
  return { kind: 'fields', fields: out, discriminantKey };
}

// ────────────────────────────────────────────────────────────────────
// Walks a Zod expression down to its field shape, resolving `.extend()`/`.merge()`/wrapper chains.
// ────────────────────────────────────────────────────────────────────

function walkZodExpr(node, localSchemas) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return localSchemas?.get(node.text) ?? null;
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'shape') {
    return walkZodExpr(node.expression, localSchemas);
  }
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    const arg = node.arguments[0];
    if (ts.isPropertyAccessExpression(expr)) {
      const method = expr.name.text;
      const receiver = expr.expression;
      if (method === 'extend' || method === 'merge') {
        const base = walkZodExpr(receiver, localSchemas);
        const baseFields = base && base.kind === 'fields' ? base.fields : [];
        // `.extend({...})` takes an object literal; `.merge(otherSchema)`
        // takes a schema reference, resolve either the same way.
        const added = arg && ts.isObjectLiteralExpression(arg)
          ? objectLiteralToFields(arg)
          : walkZodExpr(arg, localSchemas);
        const addedFields = added && added.kind === 'fields' ? added.fields : [];
        const merged = new Map(baseFields.map((f) => [f.name, f]));
        for (const f of addedFields) merged.set(f.name, f);
        return { kind: 'fields', fields: [...merged.values()] };
      }
      if (ZOD_TRANSPARENT_WRAPPERS.has(method)) return walkZodExpr(receiver, localSchemas);
      if (method === 'discriminatedUnion') {
        // `z.discriminatedUnion('key', [...])`: the options array is the
        // *second* argument, not the first (that's the discriminator key).
        const keyArg = node.arguments[0];
        const discriminantKey = keyArg && ts.isStringLiteralLike(keyArg) ? keyArg.text : null;
        const options = node.arguments[1];
        if (options && ts.isArrayLiteralExpression(options)) return unionFields(options, localSchemas, discriminantKey);
      }
      if (method === 'union') {
        if (arg && ts.isArrayLiteralExpression(arg)) return unionFields(arg, localSchemas);
      }
      if (method === 'intersection') {
        // `z.intersection(left, right)` takes two positional schema args,
        // not an array. A value satisfying the intersection has both shapes,
        // so merge them the same way `.extend()`/`.merge()` do.
        const left = walkZodExpr(node.arguments[0], localSchemas);
        const right = walkZodExpr(node.arguments[1], localSchemas);
        const leftFields = left && left.kind === 'fields' ? left.fields : [];
        const rightFields = right && right.kind === 'fields' ? right.fields : [];
        const merged = new Map(leftFields.map((f) => [f.name, f]));
        for (const f of rightFields) merged.set(f.name, f);
        return { kind: 'fields', fields: [...merged.values()] };
      }
    }
    if (arg && ts.isObjectLiteralExpression(arg)) return objectLiteralToFields(arg);
  }
  return null;
}

const ZOD_FIELD_MODIFIERS = new Set(['optional', 'nullable', 'nullish', 'describe', 'default', 'catch', 'readonly', 'brand']);

// ────────────────────────────────────────────────────────────────────
// Walks the full method chain, not just the outermost call. Fields are
// routinely `z.number().optional().describe('...')`, and checking only the
// outermost link misses the `.optional()` in the middle.
// ────────────────────────────────────────────────────────────────────

function fieldFromValueExpr(name, valueExpr) {
  let node = valueExpr;
  let optional = false;
  let nullable = false;
  while (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ZOD_FIELD_MODIFIERS.has(node.expression.name.text)) {
    const method = node.expression.name.text;
    if (method === 'optional' || method === 'nullish') optional = true;
    if (method === 'nullable' || method === 'nullish') nullable = true;
    node = node.expression.expression;
  }
  const type = node.getText();
  return { name, type: nullable ? `${type} | null` : type, optional };
}

// ────────────────────────────────────────────────────────────────────
// Converts an object literal's properties to field records.
// ────────────────────────────────────────────────────────────────────

function objectLiteralToFields(obj) {
  const out = [];
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name) {
      const name = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText();
      out.push(fieldFromValueExpr(name, prop.initializer));
    }
    // Spread properties (`...baseSchema.shape`) aren't resolved here: this
    // function only sees the object literal, not the enclosing file's local
    // schema map. Not observed in this codebase at time of writing.
  }
  return { kind: 'fields', fields: out };
}

export function extractFile(filePath, sourceText) {
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result = {
    file: filePath,
    exports: [],
    functions: {},
    consts: {},
    types: {},
    zodSchemas: extractZodSchemas(filePath, sourceText),
  };
  for (const stmt of sf.statements) {
    const isExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (isExport) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        result.exports.push({ kind: 'function', name });
        result.functions[name] = {
          params: stmt.parameters.map(paramShape),
          fingerprint: fingerprint(stmt.body ?? stmt),
        };
        continue;
      }
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            const name = decl.name.text;
            const fp = decl.initializer ? fingerprint(decl.initializer) : fingerprint(decl);
            result.exports.push({ kind: 'const', name });
            result.consts[name] = { fingerprint: fp };
          }
        }
        continue;
      }
      if (ts.isTypeAliasDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        result.exports.push({ kind: 'type', name });
        result.types[name] = {
          kind: 'type',
          fingerprint: fingerprint(stmt.type),
          fields: extractTypeMembers(stmt.type),
        };
        continue;
      }
      if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        result.exports.push({ kind: 'interface', name });
        result.types[name] = {
          kind: 'interface',
          fingerprint: fingerprint(stmt),
          fields: stmt.members ? extractFromMembers(stmt.members) : [],
        };
        continue;
      }
      if (ts.isClassDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        result.exports.push({ kind: 'class', name });
        result.types[name] = { kind: 'class', fingerprint: fingerprint(stmt) };
        continue;
      }
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause) {
      if (stmt.exportClause.kind === ts.SyntaxKind.NamedExports) {
        for (const spec of stmt.exportClause.elements) {
          result.exports.push({ kind: 'reexport', name: spec.name.text, from: stmt.moduleSpecifier?.getText() ?? '' });
        }
      } else if (stmt.exportClause.kind === ts.SyntaxKind.NamespaceExport) {
        result.exports.push({ kind: 'namespace-reexport', name: stmt.exportClause.name.text });
      }
    } else if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier) {
      // Bare `export * from './foo'` has no exportClause at all (that's only
      // set for `export { ... } from` or `export * as ns from`). Needed by
      // computePublicSurface() to follow chains like the SDK root's
      // `export * from './models/registry'`.
      result.exports.push({ kind: 'star-reexport', from: stmt.moduleSpecifier.getText() });
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────
// Extracts the SDK surface (exports, functions, types, schemas) for every file at a ref.
// ────────────────────────────────────────────────────────────────────

async function extractRef(git, ref) {
  const files = (await git(['ls-tree', '-r', '--name-only', ref, '--', CONFIG.surfacePathPrefix]))
    .split('\n').filter((f) => f && f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('/test/') && !f.includes('/tests/'));
  const out = {};
  for (const rel of files) {
    try {
      out[rel] = extractFile(rel, (await git(['show', `${ref}:${rel}`])));
    } catch (e) {
      // skip unreadable
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Diff: per-file exports, per-function params, per-type fields,
// per-Zod-schema fields, plus model registry.
// ────────────────────────────────────────────────────────────────────

function diffParams(before, after) {
  const changes = [];
  const bByName = new Map(before.map((p) => [p.name, p]));
  const aByName = new Map(after.map((p) => [p.name, p]));
  for (const [n, b] of bByName) {
    const a = aByName.get(n);
    if (!a) { changes.push({ category: 'PARAM_REMOVED', param: n }); continue; }
    if (b.type !== a.type) changes.push({ category: 'PARAM_RETYPE', param: n, before: b.type, after: a.type });
    if (b.optional !== a.optional) changes.push({ category: 'PARAM_OPTIONAL_TOGGLED', param: n, before: b.optional, after: a.optional });
    if ((b.default ?? null) !== (a.default ?? null)) changes.push({ category: 'PARAM_DEFAULT_CHANGED', param: n, before: b.default, after: a.default });
  }
  for (const [n, a] of aByName) if (!bByName.has(n)) changes.push({ category: 'PARAM_ADDED', param: n, optional: a.optional });
  const bOrder = before.map((p) => p.name);
  const aOrder = after.map((p) => p.name);
  if (bOrder.length === aOrder.length && bOrder.slice().sort().join(',') === aOrder.slice().sort().join(',') && bOrder.join(',') !== aOrder.join(',')) {
    changes.push({ category: 'PARAMS_REORDERED', order: { before: bOrder, after: aOrder } });
  }
  return changes;
}

// ────────────────────────────────────────────────────────────────────
// Diffs two type field lists into TYPE_FIELD_* changes.
// ────────────────────────────────────────────────────────────────────

function diffTypeFields(before, after) {
  const out = [];
  const bByName = new Map(before.filter((f) => f.kind === 'field').map((f) => [f.name, f]));
  const aByName = new Map(after.filter((f) => f.kind === 'field').map((f) => [f.name, f]));
  for (const [n, b] of bByName) if (!aByName.has(n)) out.push({ category: 'TYPE_FIELD_REMOVED', field: n, type: b.type });
  for (const [n, a] of aByName) if (!bByName.has(n)) out.push({ category: 'TYPE_FIELD_ADDED', field: n, type: a.type, optional: a.optional });
  for (const [n, b] of bByName) {
    const a = aByName.get(n);
    if (!a) continue;
    if (b.type !== a.type) out.push({ category: 'TYPE_FIELD_RETYPED', field: n, before: b.type, after: a.type });
    if (b.optional !== a.optional) out.push({ category: 'TYPE_FIELD_OPTIONAL_TOGGLED', field: n, before: b.optional, after: a.optional });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Diffs two Zod schema field lists into SCHEMA_FIELD_* changes, grouped by
// unionFields()'s `branch` tag first: without that, a brand-new branch's
// field would diff against an unrelated branch's same-named field and read
// as a false retype instead of an addition. Non-union schemas have no
// `branch` tag, so they all fall into one group, same as a flat diff.
// ────────────────────────────────────────────────────────────────────

function groupFieldsByBranch(fields) {
  const map = new Map();
  for (const f of fields) {
    const key = f.branch ?? '';
    if (!map.has(key)) map.set(key, new Map());
    map.get(key).set(f.name, f);
  }
  return map;
}

function diffSchemaFields(before, after) {
  const out = [];
  const bFields = (before?.fields?.kind === 'fields' ? before.fields.fields : []) || [];
  const aFields = (after?.fields?.kind === 'fields' ? after.fields.fields : []) || [];
  const discriminantKey = after?.fields?.discriminantKey ?? before?.fields?.discriminantKey ?? null;
  const bByBranch = groupFieldsByBranch(bFields);
  const aByBranch = groupFieldsByBranch(aFields);
  const branchKeys = new Set([...bByBranch.keys(), ...aByBranch.keys()]);
  for (const branchKey of branchKeys) {
    const bByName = bByBranch.get(branchKey) ?? new Map();
    const aByName = aByBranch.get(branchKey) ?? new Map();
    const branch = branchKey || null;
    for (const [n, b] of bByName) if (!aByName.has(n)) out.push({ category: 'SCHEMA_FIELD_REMOVED', field: n, type: b.type, branch, discriminantKey });
    for (const [n, a] of aByName) if (!bByName.has(n)) out.push({ category: 'SCHEMA_FIELD_ADDED', field: n, type: a.type, optional: a.optional, branch, discriminantKey });
    for (const [n, b] of bByName) {
      const a = aByName.get(n);
      if (!a) continue;
      if (b.type !== a.type) out.push({ category: 'SCHEMA_FIELD_RETYPED', field: n, before: b.type, after: a.type, branch, discriminantKey });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Diffs two extracted snapshots into the full list of raw changes.
// ────────────────────────────────────────────────────────────────────

function diffSnapshots(before, after) {
  const changes = [];
  const beforeFiles = new Set(Object.keys(before));
  const afterFiles = new Set(Object.keys(after));
  for (const f of beforeFiles) {
    if (!afterFiles.has(f)) { changes.push({ category: 'FILE_REMOVED', file: f }); continue; }
    const b = before[f], a = after[f];
    const bExports = new Map();
    for (const e of b.exports ?? []) if (e?.name) bExports.set(e.name + '|' + e.kind, e);
    const aExports = new Map();
    for (const e of a.exports ?? []) if (e?.name) aExports.set(e.name + '|' + e.kind, e);
    for (const [k, ex] of bExports) if (!aExports.has(k)) changes.push({ category: 'EXPORT_REMOVED', file: f, name: ex.name, kind: ex.kind });
    for (const [k, ex] of aExports) if (!bExports.has(k)) changes.push({ category: 'EXPORT_ADDED', file: f, name: ex.name, kind: ex.kind });
    for (const [name, fn] of Object.entries(b.functions ?? {})) {
      const af = (a.functions ?? {})[name];
      if (!af || af.fingerprint === fn.fingerprint) continue;
      const pc = diffParams(fn.params, af.params);
      if (pc.length > 0) for (const p of pc) changes.push({ category: p.category, file: f, name, ...p });
      else changes.push({ category: 'BODY_CHANGED', file: f, name, before: fn.fingerprint, after: af.fingerprint });
    }
    for (const [name, c] of Object.entries(b.consts ?? {})) {
      const ac = (a.consts ?? {})[name];
      if (!ac || ac.fingerprint === c.fingerprint) continue;
      changes.push({ category: 'CONST_CHANGED', file: f, name, before: c.fingerprint, after: ac.fingerprint });
    }
    for (const [name, t] of Object.entries(b.types ?? {})) {
      const at = (a.types ?? {})[name];
      if (!at) continue;
      if (t.fingerprint !== at.fingerprint) changes.push({ category: 'TYPE_CHANGED', file: f, name, kind: t.kind });
      for (const c of diffTypeFields(t.fields ?? [], at.fields ?? [])) changes.push({ category: c.category, file: f, name, ...c });
    }
    for (const [name, bSch] of Object.entries(b.zodSchemas ?? {})) {
      const aSch = (a.zodSchemas ?? {})[name];
      if (!aSch) continue;
      for (const c of diffSchemaFields(bSch, aSch)) changes.push({ category: c.category, file: f, schema: name, ...c });
    }
  }
  for (const f of afterFiles) if (!beforeFiles.has(f)) changes.push({ category: 'FILE_ADDED', file: f });
  return changes;
}

// ────────────────────────────────────────────────────────────────────
// Diffs the model registry's constant names between two refs.
// ────────────────────────────────────────────────────────────────────

async function diffModelRegistry(git, fromRef, toRef) {
  if (!CONFIG.modelRegistryFile) return { added: [], removed: [] };
  try {
    const before = await git(['show', `${fromRef}:${CONFIG.modelRegistryFile}`]);
    const after = await git(['show', `${toRef}:${CONFIG.modelRegistryFile}`]);
    const extract = (text) => {
      const names = new Set();
      for (const m of text.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]+)\s*[:=]/g)) names.add(m[1]);
      return names;
    };
    const b = extract(before), a = extract(after);
    return { added: [...a].filter((n) => !b.has(n)), removed: [...b].filter((n) => !a.has(n)) };
  } catch (e) {
    return { added: [], removed: [], error: e.message };
  }
}

// ────────────────────────────────────────────────────────────────────
// extractRef() only walks the main repo, so when examples live elsewhere
// this is the only source of their FILE_ADDED/FILE_REMOVED events.
// ────────────────────────────────────────────────────────────────────

async function diffExampleFilesAcrossRepo(git, fromSha, toSha, pathPrefix) {
  const before = new Set((await git(['ls-tree', '-r', '--name-only', fromSha, '--', pathPrefix])).trim().split('\n').filter(Boolean));
  const after = new Set((await git(['ls-tree', '-r', '--name-only', toSha, '--', pathPrefix])).trim().split('\n').filter(Boolean));
  const changes = [];
  for (const f of before) if (!after.has(f)) changes.push({ category: 'FILE_REMOVED', file: f });
  for (const f of after) if (!before.has(f)) changes.push({ category: 'FILE_ADDED', file: f });
  return changes;
}

// ────────────────────────────────────────────────────────────────────
// Lists commits (first-parent) touching CONFIG.examplesPathPrefix between two refs.
// ────────────────────────────────────────────────────────────────────

async function listCommitsTouchingExamples(git, sinceRef, toRef) {
  const log = await git(['log', '--first-parent', '--format=%H|%aI|%s', `${sinceRef}..${toRef}`, '--', CONFIG.examplesPathPrefix]);
  if (!log.trim()) return [];
  return log.trim().split('\n').map((line) => {
    const [sha, date, ...rest] = line.split('|');
    return { sha, date, subject: rest.join('|') };
  });
}

// ────────────────────────────────────────────────────────────────────
// Lists the files a commit touched, plus which of those it deleted (so
// callers can tell a real addition from a file that's already gone again).
// ────────────────────────────────────────────────────────────────────

async function filesChangedInCommit(git, sha) {
  try {
    const out = await git(['show', '--name-status', '--format=', sha]);
    const files = [];
    const deleted = new Set();
    for (const line of out.split('\n').filter(Boolean)) {
      const parts = line.split('\t');
      const status = parts[0];
      const file = parts[parts.length - 1];
      files.push(file);
      if (status.startsWith('D')) deleted.add(file);
    }
    return { files, deleted };
  } catch { return { files: [], deleted: new Set() }; }
}

// ────────────────────────────────────────────────────────────────────
// Relevance: which upstream changes matter to the academy. Builds
// relevantPaths (files a lesson references) and coveredExampleFiles
// (example paths already vendored); everything else drops before the report.
// ────────────────────────────────────────────────────────────────────

function walkSync(dir, ext, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSync(p, ext, out);
    else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Maps each symbol imported from the package to the vendored files that import it.
// ────────────────────────────────────────────────────────────────────

function harvestImportedSymbols(examplesDir) {
  const imports = new Map();
  const importPattern = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escapeRegExp(CONFIG.repos.main.baselineDepName)}['"]`, 'g');
  for (const f of walkSync(examplesDir, '.answer.ts')) {
    let code;
    try { code = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of code.matchAll(importPattern)) {
      for (const sym of m[1].split(',')) {
        const name = sym.trim().split(/\s+as\s+/).pop().trim();
        if (!name) continue;
        if (!imports.has(name)) imports.set(name, new Set());
        imports.get(name).add(f);
      }
    }
  }
  return imports;
}

// ────────────────────────────────────────────────────────────────────
// Maps each lesson's `sourceExample` frontmatter value to the lesson file(s) that declare it.
// ────────────────────────────────────────────────────────────────────

function buildLessonIndex(lessonsDir) {
  const upstreamToLessons = new Map();
  for (const f of walkSync(lessonsDir, '.mdx')) {
    if (f.endsWith('index.mdx')) continue;
    let raw;
    try { raw = readFileSync(f, 'utf8'); } catch { continue; }
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const srcEx = m[1].match(/^sourceExample\s*:\s*(.*)$/m);
    if (!srcEx) continue;
    let v = srcEx[1].trim().replace(/^['"]|['"]$/g, '');
    if (!v) continue;
    if (!upstreamToLessons.has(v)) upstreamToLessons.set(v, new Set());
    upstreamToLessons.get(v).add(f);
  }
  return { upstreamToLessons };
}

// ────────────────────────────────────────────────────────────────────
// Resolves a relative import specifier (e.g. `'./client/api'`) against the
// importing file's path to whichever snapshot key it points at
// (`<dir>/api.ts` or `<dir>/api/index.ts`). Returns null for non-relative
// specifiers (external packages) or paths not present in the snapshot.
// ────────────────────────────────────────────────────────────────────

function resolveModuleFile(snapshot, fromFile, rawSpec) {
  const spec = rawSpec.replace(/^['"]|['"]$/g, '');
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  if (snapshot[`${base}.ts`]) return `${base}.ts`;
  const indexFile = path.posix.join(base, 'index.ts');
  if (snapshot[indexFile]) return indexFile;
  if (snapshot[base]) return base;
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Symbol names actually importable from the package: reachable from
// CONFIG.publicEntryFile via its re-export chain, transitively. A file
// under CONFIG.surfacePathPrefix using `export` isn't enough on its own:
// plenty of surface files have module-internal exports the package never
// re-exports from its entry point. Without this gate, ADD_NEW_API produced
// lesson content importing symbols the package doesn't actually expose.
// ────────────────────────────────────────────────────────────────────

function computePublicSurface(snapshot, entryFile) {
  const names = new Set();
  const visited = new Set();
  function visitExports(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const data = snapshot[file];
    if (!data) return;
    for (const ex of data.exports ?? []) {
      if (ex.kind === 'reexport') {
        names.add(ex.name);
      } else if (ex.kind === 'star-reexport') {
        const target = resolveModuleFile(snapshot, file, ex.from);
        if (target) visitExports(target);
      } else if (ex.name) {
        names.add(ex.name);
      }
    }
  }
  visitExports(entryFile);
  return names;
}

// ────────────────────────────────────────────────────────────────────
// Maps each exported symbol name to the upstream file(s) that export it.
// ────────────────────────────────────────────────────────────────────

function indexExportsBySnapshot(snapshot) {
  const symbolToFiles = new Map();
  for (const [rel, file] of Object.entries(snapshot)) {
    for (const ex of file.exports ?? []) {
      if (!ex?.name) continue;
      if (!symbolToFiles.has(ex.name)) symbolToFiles.set(ex.name, new Set());
      symbolToFiles.get(ex.name).add(rel);
    }
  }
  return symbolToFiles;
}

// ────────────────────────────────────────────────────────────────────
// Builds the maps that decide which upstream changes are relevant to our lessons.
// ────────────────────────────────────────────────────────────────────

function buildRelevanceIndex(snapshot, opts = {}) {
  const examplesDir = CONFIG.vendoredRoot;
  const lessonsDir = CONFIG.lessonsRoot;
  const { upstreamToLessons } = buildLessonIndex(lessonsDir);

  // For each symbol imported by a vendored .answer.ts, record:
  //   - the set of upstream files that export it (in the current snapshot)
  //   - the set of vendored files that import it, so a change to that
  //     symbol can be attributed to the lesson that actually uses it.
  const importedSymbols = harvestImportedSymbols(examplesDir);
  const symbolToFiles = indexExportsBySnapshot(snapshot);
  const symbolToVendored = importedSymbols; // symbol -> Set<vendored .answer.ts path>

  const symbolToRelevantUpstreamFiles = new Map();
  for (const [sym] of importedSymbols) {
    const files = symbolToFiles.get(sym);
    if (files && files.size > 0) symbolToRelevantUpstreamFiles.set(sym, files);
  }

  const relevantPaths = new Set();
  for (const p of upstreamToLessons.keys()) relevantPaths.add(p);
  for (const files of symbolToRelevantUpstreamFiles.values()) {
    for (const f of files) relevantPaths.add(f);
  }

  // Also add any upstream file whose basename matches a vendored file:
  // catches a moved upstream source before the lesson's frontmatter catches up.
  const vendoredBasenames = new Set();
  for (const f of walkSync(examplesDir, '.answer.ts')) {
    vendoredBasenames.add(path.basename(f, '.answer.ts'));
  }
  if (snapshot) {
    for (const file of Object.keys(snapshot)) {
      if (!file.startsWith(CONFIG.examplesPathPrefix)) continue;
      const base = path.basename(file, '.ts');
      if (vendoredBasenames.has(base)) relevantPaths.add(file);
    }
  }

  const coveredExampleFiles = new Set();
  for (const p of upstreamToLessons.keys()) {
    if (p.startsWith(CONFIG.examplesPathPrefix)) coveredExampleFiles.add(p);
  }

  const publicSurface = computePublicSurface(snapshot, CONFIG.publicEntryFile);

  return {
    relevantPaths,
    coveredExampleFiles,
    symbolToRelevantUpstreamFiles,
    symbolToVendored,
    upstreamToLessons,
    examplesDir,
    publicSurface,
  };
}

// ────────────────────────────────────────────────────────────────────
// Model-config schema linkage: links a `loadModel({ modelConfig })` family
// schema (ttsConfigSchema, ...) to the lessons that pass it, via the shared
// modelType literal — see the comment above buildModelConfigSchemaIndex().
// ────────────────────────────────────────────────────────────────────

function unwrapMethodChain(node) {
  const calls = [];
  let cur = node;
  while (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
    calls.unshift({ method: cur.expression.name.text, args: cur.arguments });
    cur = cur.expression.expression;
  }
  return calls;
}

// ────────────────────────────────────────────────────────────────────
// Strips `as const`/`satisfies X`/parens wrappers, which can stack (`[...] as const satisfies T[]`).
// ────────────────────────────────────────────────────────────────────

function unwrapExpr(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) {
    node = node.expression;
  }
  return node;
}

// ────────────────────────────────────────────────────────────────────
// Escapes regex special characters in a string.
// ────────────────────────────────────────────────────────────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ────────────────────────────────────────────────────────────────────
// Extracts the `ModelType` object's camelCase-key to kebab-case-literal mapping.
// ────────────────────────────────────────────────────────────────────

async function extractModelTypeLiterals(git, toSha) {
  const map = new Map(); // camelCase key -> kebab-case literal, e.g. ttsGgml -> 'tts-ggml'
  let text;
  if (!CONFIG.modelTypesFile) return map;
  try { text = await git(['show', `${toSha}:${CONFIG.modelTypesFile}`]); } catch { return map; }
  const sf = ts.createSourceFile('model-types.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || decl.name.getText() !== 'ModelType' || !decl.initializer) continue;
      let obj = decl.initializer;
      obj = unwrapExpr(obj);
      if (!ts.isObjectLiteralExpression(obj)) continue;
      for (const p of obj.properties) {
        if (ts.isPropertyAssignment(p) && p.name && ts.isStringLiteralLike(p.initializer)) {
          map.set(p.name.getText(), p.initializer.text);
        }
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────
// Extracts which modelType key each modelConfig schema loads under, from `loadBuiltinToRequestSchema`.
// ────────────────────────────────────────────────────────────────────

async function extractSchemaToModelTypeKey(git, toSha) {
  const map = new Map(); // configSchemaName -> ModelType key, e.g. ttsConfigSchema -> ttsGgml
  let text;
  if (!CONFIG.loadModelSchemaFile) return map;
  try { text = await git(['show', `${toSha}:${CONFIG.loadModelSchemaFile}`]); } catch { return map; }
  const sf = ts.createSourceFile('load-model.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || decl.name.getText() !== 'loadBuiltinToRequestSchema' || !decl.initializer) continue;
      const calls = unwrapMethodChain(decl.initializer);
      const unionCall = calls.find((c) => c.method === 'discriminatedUnion');
      const branches = unionCall?.args[1];
      if (!branches || !ts.isArrayLiteralExpression(branches)) continue;
      for (const branch of branches.elements) {
        const branchCalls = unwrapMethodChain(branch);
        const objCall = branchCalls.find((c) => c.method === 'object');
        const transformCall = branchCalls.find((c) => c.method === 'transform');
        const objLit = objCall?.args[0];
        if (!objLit || !ts.isObjectLiteralExpression(objLit)) continue;
        const modelConfigProp = objLit.properties.find((p) => ts.isPropertyAssignment(p) && p.name?.getText() === 'modelConfig');
        if (!modelConfigProp) continue;
        let schemaExpr = modelConfigProp.initializer;
        while (ts.isCallExpression(schemaExpr) && ts.isPropertyAccessExpression(schemaExpr.expression)) {
          schemaExpr = schemaExpr.expression.expression;
        }
        if (!ts.isIdentifier(schemaExpr)) continue;
        const fn = transformCall?.args[0];
        if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) continue;
        let body = fn.body;
        if (ts.isParenthesizedExpression(body)) body = body.expression;
        let returnObj = ts.isObjectLiteralExpression(body) ? body : null;
        if (!returnObj && ts.isBlock(body)) {
          for (const s of body.statements) {
            if (ts.isReturnStatement(s) && s.expression) {
              let e = s.expression;
              if (ts.isParenthesizedExpression(e)) e = e.expression;
              if (ts.isObjectLiteralExpression(e)) { returnObj = e; break; }
            }
          }
        }
        const modelTypeProp = returnObj?.properties.find((p) => ts.isPropertyAssignment(p) && p.name?.getText() === 'modelType');
        const mtInit = modelTypeProp?.initializer;
        if (mtInit && ts.isPropertyAccessExpression(mtInit)) {
          map.set(schemaExpr.text, mtInit.name.getText());
        }
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────
// Maps each explicit `modelType` literal to the vendored files that pass it to `loadModel`.
// ────────────────────────────────────────────────────────────────────

function harvestModelTypeUsage(examplesDir) {
  const usage = new Map(); // modelType literal -> Set<vendored file>
  for (const f of walkSync(examplesDir, '.answer.ts')) {
    let code;
    try { code = readFileSync(f, 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(f, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'loadModel') {
        for (const arg of node.arguments) {
          if (!ts.isObjectLiteralExpression(arg)) continue;
          const mt = arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name?.getText() === 'modelType');
          if (mt && ts.isStringLiteralLike(mt.initializer)) {
            const lit = mt.initializer.text;
            if (!usage.has(lit)) usage.set(lit, new Set());
            usage.get(lit).add(f);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return usage;
}

// ────────────────────────────────────────────────────────────────────
// Maps a model constant to its modelType key via the registry's `addon`
// field: covers lessons that pass `modelSrc` without an explicit `modelType`.
// ────────────────────────────────────────────────────────────────────

async function extractModelConstantAddons(git, toSha) {
  const constantToAddon = new Map();
  let text;
  if (!CONFIG.modelRegistryFile) return constantToAddon;
  try { text = await git(['show', `${toSha}:${CONFIG.modelRegistryFile}`]); } catch { return constantToAddon; }
  const sf = ts.createSourceFile('models.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const modelsArrayAddon = new Map(); // raw array index -> addon literal
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || decl.name.getText() !== 'models' || !decl.initializer) continue;
      let arr = decl.initializer;
      arr = unwrapExpr(arr);
      if (!ts.isArrayLiteralExpression(arr)) continue;
      arr.elements.forEach((el, i) => {
        if (!ts.isObjectLiteralExpression(el)) return;
        const p = el.properties.find((pr) => ts.isPropertyAssignment(pr) && pr.name?.getText() === 'addon');
        if (p && ts.isStringLiteralLike(p.initializer)) modelsArrayAddon.set(i, p.initializer.text);
      });
    }
  }
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExport) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || !ts.isIdentifier(decl.name) || decl.name.text === 'models' || !decl.initializer) continue;
      let obj = decl.initializer;
      obj = unwrapExpr(obj);
      if (!ts.isObjectLiteralExpression(obj)) continue;
      const p = obj.properties.find((pr) => ts.isPropertyAssignment(pr) && pr.name?.getText() === 'addon');
      if (!p) continue;
      let addon = null;
      if (ts.isStringLiteralLike(p.initializer)) {
        addon = p.initializer.text;
      } else if (
        ts.isPropertyAccessExpression(p.initializer) && p.initializer.name.text === 'addon' &&
        ts.isElementAccessExpression(p.initializer.expression) &&
        p.initializer.expression.argumentExpression && ts.isNumericLiteral(p.initializer.expression.argumentExpression)
      ) {
        addon = modelsArrayAddon.get(Number(p.initializer.expression.argumentExpression.text)) ?? null;
      }
      if (addon) constantToAddon.set(decl.name.text, addon);
    }
  }
  return constantToAddon;
}

// ────────────────────────────────────────────────────────────────────
// Extracts the registry `addon` family to `ModelType` key mapping from `ModelTypeAliases`.
// ────────────────────────────────────────────────────────────────────

async function extractAddonToModelTypeKey(git, toSha) {
  // addon family (matches registry `addon:` values, e.g. 'tts') -> ModelType camelCase key ('ttsGgml')
  const map = new Map();
  let text;
  if (!CONFIG.modelTypesFile) return map;
  try { text = await git(['show', `${toSha}:${CONFIG.modelTypesFile}`]); } catch { return map; }
  const sf = ts.createSourceFile('model-types.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.name || decl.name.getText() !== 'ModelTypeAliases' || !decl.initializer) continue;
      let obj = decl.initializer;
      obj = unwrapExpr(obj);
      if (!ts.isObjectLiteralExpression(obj)) continue;
      for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || !p.name) continue;
        const aliasKey = ts.isComputedPropertyName(p.name) && ts.isPropertyAccessExpression(p.name.expression)
          ? p.name.expression.name.text
          : p.name.getText().replace(/^['"]|['"]$/g, '');
        if (aliasKey && ts.isPropertyAccessExpression(p.initializer)) map.set(aliasKey, p.initializer.name.getText());
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────
// symbolToVendored can't do this on its own: lessons never import the config schema by name.
// ────────────────────────────────────────────────────────────────────

async function buildModelConfigSchemaIndex(git, toSha, examplesDir, symbolToVendored) {
  if (!CONFIG.modelTypesFile || !CONFIG.loadModelSchemaFile || !CONFIG.modelRegistryFile) return new Map();
  const modelTypeLiterals = await extractModelTypeLiterals(git, toSha);
  const schemaToModelTypeKey = await extractSchemaToModelTypeKey(git, toSha);
  const modelTypeUsage = harvestModelTypeUsage(examplesDir);
  const constantToAddon = await extractModelConstantAddons(git, toSha);
  const addonToModelTypeKey = await extractAddonToModelTypeKey(git, toSha);

  const modelTypeKeyToConstants = new Map();
  for (const [constant, addon] of constantToAddon) {
    const key = addonToModelTypeKey.get(addon);
    if (!key) continue;
    if (!modelTypeKeyToConstants.has(key)) modelTypeKeyToConstants.set(key, new Set());
    modelTypeKeyToConstants.get(key).add(constant);
  }

  const map = new Map(); // configSchemaName -> Set<vendored file>
  for (const [schemaName, key] of schemaToModelTypeKey) {
    const files = new Set();
    const literal = modelTypeLiterals.get(key);
    for (const f of modelTypeUsage.get(literal) ?? []) files.add(f);
    for (const constant of modelTypeKeyToConstants.get(key) ?? []) {
      for (const f of symbolToVendored.get(constant) ?? []) files.add(f);
    }
    if (files.size) map.set(schemaName, files);
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────
// Classification and partitioning: apply the relevance index to the raw
// diff, split renames from genuine new files, and attribute each change to a lesson.
// ────────────────────────────────────────────────────────────────────

function classifyChange(change, index) {
  if (change.category === 'FILE_ADDED') {
    if (change.file?.startsWith(CONFIG.examplesPathPrefix)) {
      return index.coveredExampleFiles.has(change.file) ? 'relevant' : 'new-example-file';
    }
    return 'drop'; // non-example file additions never matter to lessons
  }
  if (change.category === 'FILE_REMOVED') {
    return (change.file && index.relevantPaths.has(change.file)) ? 'relevant' : 'drop';
  }
  if (change.category === 'EXPORT_ADDED') {
    // A new symbol can't already be imported, so relevance has to come from
    // public-surface membership rather than a lesson-import signal (see
    // computePublicSurface()).
    return index.publicSurface.has(change.name) ? 'relevant' : 'drop';
  }
  // Everything else modifies/removes something that must already exist:
  // if a lesson cares, it's already importing it by name. symbolToVendored
  // is keyed by vendored imports, so unlike a snapshot map it still has
  // symbols upstream just deleted.
  const symbol = change.name ?? change.schema ?? null;
  if (symbol) {
    if (index.symbolToVendored.has(symbol)) return 'relevant';
    if (change.schema && index.modelConfigSchemaToVendored?.has(change.schema)) return 'relevant';
    return 'drop';
  }
  if (change.file && index.relevantPaths.has(change.file)) return 'relevant';
  return 'drop';
}

// ────────────────────────────────────────────────────────────────────
// Splits a change into the report's 'sdk' or 'examples' section by path;
// examples wins if a file is under both prefixes (e.g. re-exports an SDK symbol).
// ────────────────────────────────────────────────────────────────────

function categorizeChange(change) {
  const f = change.file ?? '';
  if (f.startsWith(CONFIG.examplesPathPrefix)) return 'examples';
  return 'sdk';
}

// ────────────────────────────────────────────────────────────────────
// Pairs a FILE_REMOVED with a same-basename FILE_ADDED under a different
// directory and treats it as one rename rather than two unrelated events:
// the lesson's `sourceExample` just needs to point at the new path.
// ────────────────────────────────────────────────────────────────────

function detectRenames(examplesRepoDir, changes, fromSha, toSha) {
  const removed = new Map(); // basename -> [{ file }]
  const added = new Map();
  for (const c of changes) {
    if (c.category !== 'FILE_REMOVED' && c.category !== 'FILE_ADDED') continue;
    if (!c.file?.startsWith(CONFIG.examplesPathPrefix)) continue;
    const base = path.basename(c.file);
    const m = c.category === 'FILE_REMOVED' ? removed : added;
    if (!m.has(base)) m.set(base, []);
    m.get(base).push({ file: c.file });
  }

  // For each basename in both maps, fetch the file content at both refs
  // and decide whether it's a true rename (content near-identical,
  // probably just usage-string updates) or a replacement (content
  // diverges significantly, often the old file was empty/stub and the
  // new file is genuinely new content).
  const renames = [];
  const falseRenames = []; // pairs that look like renames but aren't, surfaced in the report
  for (const [base, removedList] of removed) {
    const addedList = added.get(base);
    if (!addedList) continue;
    for (const r of removedList) {
      for (const a of addedList) {
        if (path.dirname(r.file) === path.dirname(a.file)) continue;
        // Fetch both contents via git show. Failures (file not in
        // tree at this ref) leave content empty.
        const oldContent = fromSha ? safeReadGitFile(examplesRepoDir, fromSha, r.file) : '';
        const newContent = toSha ? safeReadGitFile(examplesRepoDir, toSha, a.file) : '';
        const oldSize = oldContent.length;
        const newSize = newContent.length;
        // Empty old file → this is genuinely a new file, not a rename.
        if (oldSize === 0 && newSize > 0) {
          falseRenames.push({ from: r.file, to: a.file, basename: base, reason: 'old file was empty', oldSize, newSize });
          continue;
        }
        // Compute a quick similarity: fraction of lines that appear in
        // both. Cheap O(n) heuristic; accurate enough for our use.
        const sim = lineSimilarity(oldContent, newContent);
        // High similarity (≥80%) → genuine rename. Lower → replacement.
        if (sim >= 0.8) {
          renames.push({ from: r.file, to: a.file, basename: base, similarity: sim, oldSize, newSize });
        } else {
          falseRenames.push({ from: r.file, to: a.file, basename: base, reason: 'content diverges', similarity: sim, oldSize, newSize });
        }
      }
    }
  }
  return { renames, falseRenames };
}

// ────────────────────────────────────────────────────────────────────
// Reads a file at a git ref, returning '' if it doesn't exist at that ref.
// ────────────────────────────────────────────────────────────────────

function safeReadGitFile(repoDir, sha, filePath) {
  try {
    const r = spawnSync('git', ['-C', repoDir, 'show', `${sha}:${filePath}`], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout : '';
  } catch {
    return '';
  }
}

// ────────────────────────────────────────────────────────────────────
// Cheap line-level Jaccard similarity. Strips blank lines and comments
// before comparing so that whitespace-only diffs don't tank the score.
// ────────────────────────────────────────────────────────────────────

function lineSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const norm = function norm(s) {
    return s.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !l.startsWith('//') && !l.startsWith('*'); }).join('\n');
  };
  var aN = norm(a), bN = norm(b);
  if (!aN && !bN) return 1;
  var setA = new Set(aN.split('\n'));
  var setB = new Set(bN.split('\n'));
  var inter = 0;
  for (const l of setA) if (setB.has(l)) inter++;
  var union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ────────────────────────────────────────────────────────────────────
// Splits the raw diff into relevant/informational changes, renames, and
// new-lesson opportunities.
// ────────────────────────────────────────────────────────────────────

function partitionChanges(changes, commits, index, examplesRepoDir, examplesFromSha, examplesToSha) {
  const relevant = [];
  const newExampleFiles = new Set();
  const informational = [];
  for (const c of changes) {
    const cls = classifyChange(c, index);
    if (cls === 'relevant') {
      // Demote BODY_*/CONST_*/TYPE_CHANGED unless there's a sibling
      // signature change in the same file+symbol.
      const category = c.category;
      if (category === 'BODY_CHANGED' || category === 'CONST_CHANGED' || category === 'TYPE_CHANGED') {
        const sibling = relevant.some((r) =>
          r.file === c.file && r.name === c.name &&
          (r.category.startsWith('PARAM_') || r.category.startsWith('TYPE_FIELD') || r.category.startsWith('SCHEMA_FIELD'))
        );
        if (!sibling) informational.push(c);
        else relevant.push(c);
      } else {
        relevant.push(c);
      }
    } else if (cls === 'new-example-file') newExampleFiles.add(c.file);
  }

  const { renames: allRenames, falseRenames } = detectRenames(examplesRepoDir, changes, examplesFromSha, examplesToSha);
  // Drop already-synced renames (some lesson's sourceExample already points at `to`).
  const syncedRenames = allRenames.filter((r) => !index.upstreamToLessons.has(r.to));
  const resolvedRenameCount = allRenames.length - syncedRenames.length;
  // Only a real rename if a lesson exists at either path; otherwise it's just a new lesson to build, not a sync.
  const renames = syncedRenames.filter((r) => lessonHintForPath(r.from, index) || lessonHintForPath(r.to, index));

  const relevantCommits = [];
  for (const commit of commits) {
    const files = (commit._files ?? []).filter((f) => f.startsWith(CONFIG.examplesPathPrefix));
    const coveredFiles = files.filter((f) => index.coveredExampleFiles.has(f));
    // Files that aren't covered, aren't the `to` half of a known rename, and
    // weren't deleted by this same commit become new-opportunity files. A
    // deleted file has nothing to build a lesson from.
    const deletedFiles = commit._deletedFiles ?? new Set();
    const newOpportunityFiles = files.filter((f) =>
      !index.coveredExampleFiles.has(f) && !renames.some((r) => r.to === f) && !deletedFiles.has(f)
    );
    relevantCommits.push({ ...commit, _files: coveredFiles, _newOpportunityFiles: newOpportunityFiles });
  }

  // A false rename is a new file whose basename matches a removed one, so
  // it is a new example like any other.
  for (const fr of falseRenames) newExampleFiles.add(fr.to);

  // Build the list of files that are truly "new lessons" (not renames).
  // Only code samples qualify: a README or AGENTS.md next to them isn't one.
  const allNew = [...new Set([...newExampleFiles, ...relevantCommits.flatMap((c) => c._newOpportunityFiles)])]
    .filter((f) => f.startsWith(CONFIG.examplesPathPrefix) && f.endsWith('.ts') && !f.endsWith('.d.ts'));

  // A rename where the new path is the only entry per basename gets
  // dropped from newOpportunities: it's already represented as a
  // REPLACE_SOURCE_EXAMPLE action for any lesson that was pointing at
  // the old path.
  const newOpportunities = [];
  // A folder with an index.html is a demo app, so its code is app code, not
  // a lesson sample. Those files are listed for reference only.
  const demoAppDirs = new Set(
    spawnSync('git', ['-C', examplesRepoDir, 'ls-tree', '-r', '--name-only', examplesToSha, '--', CONFIG.examplesPathPrefix], { encoding: 'utf8' })
      .stdout.split('\n').filter((f) => path.basename(f) === 'index.html').map((f) => path.dirname(f)),
  );
  const demoAppFiles = [];
  const seen = new Set();
  for (const f of allNew.sort()) {
    if ([...demoAppDirs].some((d) => f.startsWith(`${d}/`))) { demoAppFiles.push(f); continue; }
    const base = path.basename(f);
    if (seen.has(base)) continue;
    const altPath = f.includes('/transcription/') ? f.replace('/transcription/', '/asr/') : null;
    if (altPath && allNew.includes(altPath)) continue;
    if (renames.some((r) => r.to === f)) continue;
    seen.add(base);
    newOpportunities.push(f);
  }

  // Strip example FILE_ADDED entries that are a rename's `to` half, so they
  // don't double up as a separate action item. Checked against allRenames,
  // not the narrowed `renames`: a resolved/orphan rename still needs
  // suppressing here even once it's dropped from the report.
  const filteredRelevant = relevant.filter((c) => {
    if (c.category !== 'FILE_ADDED') return true;
    if (!c.file?.startsWith(CONFIG.examplesPathPrefix)) return true;
    if (allRenames.some((r) => r.to === c.file)) return false;
    return true;
  });

  return {
    relevant: filteredRelevant,
    informational,
    renames,
    falseRenames,
    relevantCommits,
    newOpportunities,
    demoAppFiles,
    resolvedRenameCount,
  };
}

// ────────────────────────────────────────────────────────────────────
// Maps an upstream path to the lessons it affects, in priority order:
// 1. exact `sourceExample:` match in a lesson's frontmatter
// 2. a vendored file imports a symbol the path exports (`changeHint`
//    narrows this to the specific symbol that changed, if given)
// 3. basename match against vendored filenames
// ────────────────────────────────────────────────────────────────────

function lessonHintForPath(upstreamPath, index, changeHint = null) {
  // 1. Direct match via sourceExample.
  const exact = index.upstreamToLessons.get(upstreamPath);
  if (exact && exact.size > 0) {
    const lessonsRoot = CONFIG.lessonsRoot;
    return [...exact].map((p) => path.relative(lessonsRoot, p)).join(', ');
  }
  // 2. Symbol-level attribution: which symbol did the change touch, and
  //    which vendored file imports it?
  const examplesDir = index.examplesDir;
  const lessonsRoot = CONFIG.lessonsRoot;
  const lessonHits = new Set();
  function vendoredPathToLesson(vendoredAbs) {
    // Vendored layout: examples/qvac/<chapter>/<basename>.answer.ts
    // Lesson layout:  courses/qvac/en/<chapter>/<basename>.mdx
    const rel = path.relative(examplesDir, vendoredAbs);
    const parts = rel.split(path.sep); // [chapter, basename]
    if (parts.length !== 2) return null;
    const base = parts[1].replace(/\.answer\.ts$/, '');
    return path.join(lessonsRoot, parts[0], `${base}.mdx`);
  }
  if (changeHint?.name) {
    const importers = index.symbolToVendored.get(changeHint.name);
    if (importers) {
      for (const v of importers) {
        const lessonAbs = vendoredPathToLesson(v);
        if (lessonAbs && existsSync(lessonAbs)) lessonHits.add(path.relative(lessonsRoot, lessonAbs));
      }
    }
  } else if (changeHint?.schema) {
    const importers = index.symbolToVendored.get(changeHint.schema) ?? index.modelConfigSchemaToVendored?.get(changeHint.schema);
    if (importers) {
      for (const v of importers) {
        const lessonAbs = vendoredPathToLesson(v);
        if (lessonAbs && existsSync(lessonAbs)) lessonHits.add(path.relative(lessonsRoot, lessonAbs));
      }
    }
  } else {
    // No specific symbol: any vendored file importing anything from this
    // upstream path is potentially affected.
    for (const [sym, files] of index.symbolToRelevantUpstreamFiles) {
      if (!files.has(upstreamPath)) continue;
      const importers = index.symbolToVendored.get(sym);
      if (!importers) continue;
      for (const v of importers) {
        const lessonAbs = vendoredPathToLesson(v);
        if (lessonAbs && existsSync(lessonAbs)) lessonHits.add(path.relative(lessonsRoot, lessonAbs));
      }
    }
  }
  if (lessonHits.size > 0) return [...lessonHits].join(', ');
  // 3. Basename fallback.
  const base = path.basename(upstreamPath, '.ts');
  const hits = [];
  for (const f of walkSync(examplesDir, '.answer.ts')) {
    if (f.endsWith(`${base}.answer.ts`)) hits.push(path.relative(examplesDir, f));
  }
  return hits.length ? hits.join(', ') : null;
}

// ────────────────────────────────────────────────────────────────────
// Docs site divergence (optional, --quick skips this).
// ────────────────────────────────────────────────────────────────────

async function checkDocs(snapshot) {
  const url = CONFIG.docsLlmsUrl;
  let text;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
    mkdirSync(path.dirname(CONFIG.docsFileCache), { recursive: true });
    writeFileSync(CONFIG.docsFileCache, text);
  } catch (e) {
    return { error: e.message, results: [] };
  }
  // Extract fenced blocks
  const blocks = [];
  const lines = text.split('\n');
  let inFence = false, lang = '', buf = [], context = '', start = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inFence) {
      const m = l.match(/^```(\w*)/);
      if (m) {
        inFence = true; lang = m[1]; buf = []; start = i + 1;
        for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
          const p = lines[j].trim();
          if (p && (p.startsWith('#') || p.length > 0)) { context = p.slice(0, 120); break; }
        }
      }
    } else if (l.trim().startsWith('```')) {
      blocks.push({ lang, context, code: buf.join('\n'), startLine: start });
      inFence = false; lang = ''; buf = [];
    } else {
      buf.push(l);
    }
  }
  // Group by upstream ref
  const grouped = new Map();
  for (const b of blocks) {
    if (!b.code.includes(CONFIG.repos.main.baselineDepName)) continue;
    const m = b.code.match(new RegExp(`${escapeRegExp(CONFIG.examplesPathPrefix)}[\\w./-]+\\.ts`)) || b.code.match(/examples\/[\w./-]+\.ts/);
    const key = m ? m[0] : '__inline__';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(b);
  }
  const sig = (code) => {
    const imports = new Set();
    for (const m of code.matchAll(/\b(?:import|export)\s+(?:type\s+)?\{([^}]+)\}/g))
      for (const n of m[1].split(',')) { const c = n.trim().split(/\s+as\s+/).pop(); if (c) imports.add(c); }
    return imports;
  };
  const results = [];
  for (const [ref, grp] of grouped) {
    if (ref === '__inline__') {
      results.push({ kind: 'inline-block', context: grp[0].context, blockCount: grp.length, imports: [...sig(grp[0].code)] });
      continue;
    }
    const fileSnap = snapshot[ref];
    if (!fileSnap) {
      results.push({ kind: 'upstream-ref', upstreamFile: ref, context: grp[0].context, status: 'upstream-missing' });
      continue;
    }
    const upstreamSig = sig(fileSnap.exports.map((e) => e.name).join(' '));
    for (const b of grp) {
      const docSig = sig(b.code);
      const missing = [...docSig].filter((i) => !upstreamSig.has(i));
      results.push({
        kind: 'upstream-ref', upstreamFile: ref, context: b.context,
        imports: [...docSig], missing, status: missing.length === 0 ? 'ok' : 'diverged',
      });
    }
  }
  return { error: null, results };
}

// ────────────────────────────────────────────────────────────────────
// Report rendering.
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// Derives a plain-English action for a change, tiered 'required'/'verify'/
// 'optional' (tier meanings are spelled out in the report text below).
// `verb` is grep-friendly for the JSON output; `desc` renders in the markdown.
// ────────────────────────────────────────────────────────────────────

function actionForChange(c) {
  switch (c.category) {
    case 'FILE_REMOVED': {
      return { verb: 'REPLACE_SOURCE_EXAMPLE', tier: 'required', desc: `\`${c.file}\` was removed upstream. Find its replacement and point \`sourceExample\` at it.` };
    }
    case 'EXPORT_REMOVED': {
      if (c.kind === 'reexport' || c.kind === 'namespace-reexport') return null;
      // Model registry changes get their own section in Part 5; skip here.
      if (c.file === CONFIG.modelRegistryFile) return { verb: '__SKIP__', desc: '' };
      return { verb: 'UPDATE_FUNCTION_NAME', tier: 'required', desc: `\`${c.name}\` (${c.kind}) was removed from \`${c.file}\`. Update the code sample to stop using it.` };
    }
    case 'EXPORT_ADDED': {
      if (c.kind === 'reexport' || c.kind === 'namespace-reexport') return null;
      if (c.file === CONFIG.modelRegistryFile) return { verb: '__SKIP__', desc: '' };
      if (c.kind === 'function' || c.kind === 'const') {
        return { verb: 'ADD_NEW_API', tier: 'optional', desc: `\`${c.name}\` (${c.kind}) is new in \`${c.file}\`. You could add an example that calls it.` };
      }
      return { verb: 'ADD_NEW_API', tier: 'optional', desc: `\`${c.name}\` (${c.kind}) is new in \`${c.file}\`. It's a supporting type, not something to showcase on its own; it'll show up naturally in an example for whatever function uses it.` };
    }
    case 'PARAM_ADDED': {
      if (c.optional === false) return { verb: 'ADD_PARAM', tier: 'required', desc: `\`${c.name}\` gained a new required parameter \`${c.param}\`. The code sample must now pass it or it will fail.` };
      return { verb: 'ADD_PARAM', tier: 'optional', desc: `\`${c.name}\` gained a new optional parameter \`${c.param}\`. Existing calls that omit it keep working.` };
    }
    case 'PARAM_REMOVED': return { verb: 'REMOVE_PARAM', tier: 'required', desc: `\`${c.name}\` no longer accepts \`${c.param}\`. Remove it from the code sample.` };
    case 'PARAM_RETYPE': return { verb: 'CHANGE_PARAM_TYPE', tier: 'required', desc: `\`${c.name}\`'s \`${c.param}\` parameter changed type: \`${c.before}\` → \`${c.after}\`. Check the code sample still passes a valid value.` };
    case 'PARAM_OPTIONAL_TOGGLED': {
      if (c.before === true && c.after === false) return { verb: 'OPTIONALITY_CHANGED', tier: 'required', desc: `\`${c.name}\`'s \`${c.param}\` parameter is now required (used to be optional). If the code sample omits it, this will now fail.` };
      return { verb: 'OPTIONALITY_CHANGED', tier: 'optional', desc: `\`${c.name}\`'s \`${c.param}\` parameter is now optional (used to be required). You could simplify the example by dropping it.` };
    }
    case 'PARAM_DEFAULT_CHANGED': return { verb: 'CHANGE_PARAM_DEFAULT', tier: 'verify', desc: `\`${c.name}\`'s \`${c.param}\` parameter's default value changed. The code sample's behavior may differ if it relies on the old default.` };
    case 'SCHEMA_FIELD_ADDED': {
      if (c.optional === false) return { verb: 'ADD_SCHEMA_FIELD', tier: 'required', desc: `\`${c.schema}\` gained a new required field \`${c.field}\` (\`${c.type}\`). The code sample must now set it.` };
      return { verb: 'ADD_SCHEMA_FIELD', tier: 'optional', desc: `\`${c.schema}\` gained a new optional field \`${c.field}\` (\`${c.type}\`). Existing code that doesn't set it keeps working.` };
    }
    case 'SCHEMA_FIELD_REMOVED': return { verb: 'REMOVE_SCHEMA_FIELD', tier: 'required', desc: `\`${c.schema}\` lost the field \`${c.field}\`. If the code sample sets it, remove that.` };
    case 'SCHEMA_FIELD_RETYPED': return { verb: 'CHANGE_SCHEMA_FIELD_TYPE', tier: 'required', desc: `\`${c.schema}\`'s \`${c.field}\` field changed type: \`${c.before}\` → \`${c.after}\`. Check the code sample still passes a valid value.` };
    case 'TYPE_FIELD_ADDED': {
      if (c.optional === false) return { verb: 'ADD_TYPE_FIELD', tier: 'required', desc: `\`${c.name}\` gained a new required field \`${c.field}\`. Anywhere the code sample builds this object, it must now include it.` };
      return { verb: 'ADD_TYPE_FIELD', tier: 'optional', desc: `\`${c.name}\` gained a new optional field \`${c.field}\`. Existing code that doesn't set it keeps working.` };
    }
    case 'TYPE_FIELD_REMOVED': return { verb: 'REMOVE_TYPE_FIELD', tier: 'required', desc: `\`${c.name}\` lost the field \`${c.field}\`. If the code sample reads or sets it, remove that.` };
    case 'TYPE_FIELD_RETYPED': return { verb: 'CHANGE_TYPE_FIELD_TYPE', tier: 'required', desc: `\`${c.name}\`'s \`${c.field}\` field changed type: \`${c.before}\` → \`${c.after}\`. Check the code sample still passes a valid value.` };
    case 'BODY_CHANGED': return { verb: 'BODY_CHANGED_INFO', tier: 'verify', desc: `\`${c.name}\` in \`${c.file}\` changed internally; its signature is identical.` };
    case 'CONST_CHANGED': return { verb: 'CONST_CHANGED_INFO', tier: 'verify', desc: `\`${c.name}\` in \`${c.file}\` changed value. Check the code sample still gets the result it expects.` };
    case 'TYPE_CHANGED': return { verb: 'TYPE_CHANGED_INFO', tier: 'verify', desc: `\`${c.name}\` (${c.kind}) in \`${c.file}\` changed.` };
  }
  return null;
}

const TIER_LABEL = { required: '[required]', verify: '[verify]', optional: '[optional]' };
const TIER_ORDER = { required: 0, verify: 1, optional: 2 };

// ────────────────────────────────────────────────────────────────────
// True if a vendored lesson already passes `paramName` at a call site of
// `symbolName`. Only returns true on a positive AST match (object-literal
// arg with the property); positional/spread calls leave the item flagged.
// ────────────────────────────────────────────────────────────────────

function paramAlreadyPassed(symbolName, paramName, index) {
  const importers = index.symbolToVendored.get(symbolName);
  if (!importers) return false;
  for (const vendoredFile of importers) {
    let code;
    try { code = readFileSync(vendoredFile, 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(vendoredFile, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let found = false;
    const visit = (node) => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const calleeName = ts.isIdentifier(callee) ? callee.text
          : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);
        if (calleeName === symbolName) {
          for (const arg of node.arguments) {
            if (ts.isObjectLiteralExpression(arg) && objectLiteralHasProperty(arg, paramName)) {
              found = true;
              break;
            }
          }
        }
      }
      if (!found) ts.forEachChild(node, visit);
    };
    visit(sf);
    if (found) return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// True if an object literal has a property (or shorthand) with the given name.
// ────────────────────────────────────────────────────────────────────

function objectLiteralHasProperty(obj, name) {
  return obj.properties.some((p) => {
    if (ts.isPropertyAssignment(p) && p.name) return p.name.getText().replace(/^['"]|['"]$/g, '') === name;
    if (ts.isShorthandPropertyAssignment(p) && p.name) return p.name.text === name;
    return false;
  });
}

// ────────────────────────────────────────────────────────────────────
// Finds the string literal a vendored lesson passes for `key` (e.g.
// `ttsEngine: 'parler'`). Positive AST match only, same as
// paramAlreadyPassed() above. A variable or computed value leaves it null.
// ────────────────────────────────────────────────────────────────────

function findDiscriminantLiteralInFile(vendoredFile, key) {
  let code;
  try { code = readFileSync(vendoredFile, 'utf8'); } catch { return null; }
  const sf = ts.createSourceFile(vendoredFile, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isPropertyAssignment(node) && node.name && node.name.getText().replace(/^['"]|['"]$/g, '') === key && ts.isStringLiteralLike(node.initializer)) {
      found = node.initializer.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

// ────────────────────────────────────────────────────────────────────
// How the lessons importing `schemaName` use this branch: 'match' if any
// sets `discriminantKey` to `literal`, 'all-differ' if every one positively
// sets it to something else (safe to downgrade), else 'unknown' (stay
// conservative).
// ────────────────────────────────────────────────────────────────────

function classifyDiscriminantUsage(schemaName, discriminantKey, literal, index) {
  const importers = index.symbolToVendored.get(schemaName) ?? index.modelConfigSchemaToVendored?.get(schemaName);
  if (!importers || importers.size === 0) return 'unknown';
  let sawMatch = false, sawUnknown = false;
  for (const vendoredFile of importers) {
    const found = findDiscriminantLiteralInFile(vendoredFile, discriminantKey);
    if (found === literal) sawMatch = true;
    else if (found === null) sawUnknown = true;
  }
  if (sawMatch) return 'match';
  if (sawUnknown) return 'unknown';
  return 'all-differ';
}

// ────────────────────────────────────────────────────────────────────
// Sorts new upstream examples into three groups, so the same dead ends
// don't come back as "new lesson" on every run:
//   - update: an existing lesson already teaches the same model family and
//     SDK functions under a similar name (e.g. a variant of one model).
//   - blocked: the example loads a model that isn't in the QVAC registry.
//     This check wins over a lesson match.
//   - new: everything else.
// ────────────────────────────────────────────────────────────────────

// Name parts that say little about what an example teaches.
const GENERIC_NAME_TOKENS = new Set(['llamacpp', 'diffusion', 'filesystem', 'tts', 'asr', 'example', 'sdk', 'completion', 'run', 'generate', 'model', 'multi']);
// Keys every example passes, so they never count as a new option.
const BOILERPLATE_KEYS = new Set(['modelSrc', 'modelType', 'modelId', 'onProgress', 'role', 'content', 'type', 'name', 'stream']);
const FUNCTIONS_IGNORED_FOR_MATCH = new Set(['loadModel', 'unloadModel', 'close', 'getModelInfo']);

function nameTokens(p) {
  return path.basename(p).replace(/\.(answer\.)?ts$|\.mdx$/, '').toLowerCase().split(/[-_.]+/)
    .filter((t) => t.length > 1 && !GENERIC_NAME_TOKENS.has(t));
}

function sdkImports(source) {
  const names = new Set();
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@qvac\/sdk['"]/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (n) names.add(n);
    }
  }
  return names;
}

// Q8_0, Q4_K_M, F16 and similar suffixes mark one file of a model family.
function modelFamily(constant) {
  return constant.replace(/_(?:Q\d(?:_[0-9A-Z]+)*|IQ\d\w*|F16|F32|BF16)$/, '');
}

function objectKeys(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  const keys = new Set();
  for (const m of code.matchAll(/[{,]\s*([A-Za-z_]\w*)\s*:/g)) keys.add(m[1]);
  return keys;
}

// Command-line arguments the example reads with no fallback value. An
// argument that feeds the model source means the model has to come from the
// user; any other one is an input file a lesson can supply itself.
function requiredArgs(source) {
  const out = [];
  for (const m of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:process\.argv|args)\[(\d+)\]\s*(?:;|\n)/g)) out.push(m[1]);
  for (const m of source.matchAll(/(?:const|let)\s*\[([^\]]+)\]\s*=\s*process\.argv\.slice\(2\)/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (p && !p.includes('=')) out.push(p);
    }
  }
  const isModel = (name) => /gguf|model/i.test(name) || new RegExp(`[Ss]rc\\s*:\\s*${name}\\b`).test(source);
  return { models: out.filter(isModel), files: out.filter((n) => !isModel(n)) };
}

function readRegistryNames(repoDir, sha) {
  const r = spawnSync('git', ['-C', repoDir, 'show', `${sha}:${CONFIG.modelRegistryFile}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const names = new Set();
  if (r.status !== 0) return names;
  for (const m of r.stdout.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]+)\s*[:=]/g)) names.add(m[1]);
  return names;
}

function loadLessonProfiles(repoDir, sha, registryNames) {
  const profiles = [];
  for (const f of walkSync(CONFIG.lessonsRoot, '.mdx')) {
    if (f.endsWith('index.mdx')) continue;
    const rel = path.relative(CONFIG.lessonsRoot, f);
    const answer = path.join(CONFIG.vendoredRoot, rel.replace(/\.mdx$/, '.answer.ts'));
    let source = '';
    try { source = readFileSync(answer, 'utf8'); } catch { continue; }
    const raw = readFileSync(f, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const srcEx = fm?.[1].match(/^sourceExample\s*:\s*(.*)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '') ?? '';
    if (srcEx) {
      const r = spawnSync('git', ['-C', repoDir, 'show', `${sha}:${srcEx}`], { encoding: 'utf8' });
      if (r.status === 0) source += `\n${r.stdout}`;
    }
    const imports = sdkImports(source);
    profiles.push({
      lesson: rel,
      dir: srcEx ? path.posix.dirname(srcEx) : null,
      prose: raw.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      tokens: new Set([...nameTokens(rel), ...(srcEx ? nameTokens(srcEx) : [])]),
      functions: new Set([...imports].filter((n) => /^[a-z]/.test(n))),
      constants: new Set([...imports].filter((n) => registryNames.has(n))),
      keys: objectKeys(source),
    });
  }
  return profiles;
}

function classifyOpportunities(newOpportunities, repoDir, sha) {
  const registryNames = readRegistryNames(repoDir, sha);
  const profiles = loadLessonProfiles(repoDir, sha, registryNames);
  const result = new Map();
  for (const f of newOpportunities) {
    const r = spawnSync('git', ['-C', repoDir, 'show', `${sha}:${f}`], { encoding: 'utf8' });
    const source = r.status === 0 ? r.stdout : '';
    const imports = sdkImports(source);
    const functions = [...imports].filter((n) => /^[a-z]/.test(n) && !FUNCTIONS_IGNORED_FOR_MATCH.has(n));
    const constants = [...imports].filter((n) => registryNames.has(n));
    const families = new Set(constants.map(modelFamily));
    const tokens = nameTokens(f);
    const dir = path.posix.dirname(f);
    const inSubfolder = `${dir}/` !== CONFIG.examplesPathPrefix;

    let best = null;
    for (const p of profiles) {
      const sharedFunctions = functions.filter((n) => p.functions.has(n));
      if (sharedFunctions.length === 0) continue;
      const sharedTokens = tokens.filter((t) => p.tokens.has(t));
      const sharedFamilies = [...families].filter((fam) => [...p.constants].some((c) => modelFamily(c) === fam));
      const sameFolder = inSubfolder && p.dir === dir;
      // A lesson whose text names the example's model (e.g. "Gemma4") likely covers it.
      const mentioned = tokens.filter((t) => t.length >= 4 && !sharedTokens.includes(t) && p.prose.includes(t));
      const strong = sharedTokens.length >= 2 || (sharedTokens.length >= 1 && (sharedFamilies.length > 0 || sameFolder || mentioned.length > 0));
      if (!strong) continue;
      const score = sharedTokens.length * 2 + sharedFamilies.length * 2 + mentioned.length * 2 + (sameFolder ? 1 : 0) + sharedFunctions.length;
      if (!best || score > best.score) best = { profile: p, score, sharedTokens, sharedFamilies, sharedFunctions, mentioned };
    }

    const inputs = requiredArgs(source);
    const reasons = [];
    if (inputs.models.length > 0) {
      reasons.push(`needs a model path on the command line with no default: ${inputs.models.map((i) => `\`${i}\``).join(', ')}`);
    }
    if (constants.length === 0) {
      const hints = [...registryNames].filter((n) => tokens.some((t) => t.length >= 3 && n.includes(t.toUpperCase()))).sort().slice(0, 4);
      reasons.push(`no QVAC registry model${hints.length ? `. Registry constants with a matching name: ${hints.map((h) => `\`${h}\``).join(', ')}` : ''}`);
    }
    // A missing model blocks the example even when a lesson looks similar.
    if (reasons.length) {
      result.set(f, { kind: 'blocked', reasons, inputs });
      continue;
    }
    if (best) {
      const p = best.profile;
      result.set(f, {
        kind: 'update',
        lesson: p.lesson,
        sharedFamilies: best.sharedFamilies,
        sharedFunctions: best.sharedFunctions,
        sharedTokens: best.sharedTokens,
        mentioned: best.mentioned,
        newConstants: constants.filter((c) => !p.constants.has(c)),
        newKeys: [...objectKeys(source)].filter((k) => !p.keys.has(k) && !BOILERPLATE_KEYS.has(k)),
        inputs,
      });
      continue;
    }

    result.set(f, { kind: 'new', inputs });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────
// Renders the full markdown report from every computed section.
// ────────────────────────────────────────────────────────────────────

function renderReport({ from, to, modelChanges, allChanges, relevant, informational, renames, falseRenames, relevantCommits, newOpportunities, opportunityClasses, demoAppFiles, docs, index, docChapterMap, releaseNoteSnippets, unreleasedAhead, uncoveredSnippets }) {
  const out = [];
  out.push(`# ${CONFIG.project} change report`);
  out.push('');
  out.push(`_Generated: ${new Date().toISOString()}_`);
  const toLabel = to.ref === 'HEAD' ? `\`HEAD\` (\`${to.sha.slice(0, 8)}\`, ${to.date.slice(0, 10)}, unreleased)` : `\`${to.ref}\` (\`${to.sha.slice(0, 8)}\`, ${to.date.slice(0, 10)}, released)`;
  out.push(`_Baseline: \`${from.ref}\` (\`${from.sha.slice(0, 8)}\`, ${from.date.slice(0, 10)})_  ·  _Current: ${toLabel}_`);
  out.push(`_Upstream: ${CONFIG.projectUrl}_`);
  if (unreleasedAhead) {
    out.push('');
    out.push(`> **${unreleasedAhead.count} commit(s) merged upstream since \`${to.ref}\` are not yet released and excluded from this report.** Rerun with \`--head\` to include them (they aren't part of any published version yet).`);
  }
  out.push('');
  out.push(`> ${allChanges.length} raw changes in upstream since baseline. ${relevant.length} affect existing lessons. ${newOpportunities.length} new example files could become lessons. ${renames.length} detected renames. ${informational.length} body-only changes flagged as informational.${uncoveredSnippets?.length ? ` ${uncoveredSnippets.length} academy-content candidate(s) from the changelog below.` : ''}`);
  out.push('');

  // ─── PART 1: New capabilities to consider for the academy ──────────────
  // Sourced from CONFIG.changelogDir, not the SDK-surface/example diff, so
  // it catches a capability shipped through a sibling package (see
  // findUncoveredReleaseSnippets below). No "Touches:" file list here on
  // purpose: those are SDK-source paths, not something a lesson author
  // needs, only the usage snippet is.
  out.push(`## 1. New capabilities to consider for the academy (${uncoveredSnippets?.length ?? 0})`);
  out.push('');
  out.push(`Already shipped upstream, nothing to build. Not reflected in any section below, so decide for each: an existing lesson, a new one, somewhere else in the academy, or skip it.`);
  out.push('');
  if (!uncoveredSnippets?.length) {
    out.push('_Nothing in the changelog is unaccounted for elsewhere in this report._');
  } else {
    for (const s of uncoveredSnippets) {
      const key = `chg:${s.version}:${s.prNumber ?? s.title}`;
      const prList = [s.prNumber, ...s.extraPrNumbers].filter(Boolean).map((n) => `#${n}`).join(', ');
      out.push(`- [${box(key)}] **${s.title}** (v${s.version}${prList ? `, PR ${prList}` : ''}) <!-- id:${key} -->`);
      if (s.coveredBy?.lesson) out.push(`    - Lesson \`${s.coveredBy.lesson}\` covers \`${s.coveredBy.fn}()\`. No lesson uses: ${s.coveredBy.missing.map((n) => `\`${n}\``).join(', ')}.`);
      out.push('    ```typescript');
      for (const line of s.code.split('\n')) out.push(`    ${line}`);
      out.push('    ```');
    }
  }
  out.push('');

  // ─── PART 2: SDK changes ────────────────────────────────────────────────
// Two views: (2a) what needs to change in existing lessons, as a
// per-lesson table; (2b) new SDK symbols added but no lesson touches
// them yet, as a plain list (no need for checkboxes).
  const sdkChanges = relevant.filter((c) => categorizeChange(c) === 'sdk');
  // A rename's old path also shows up as removed; it is reported as the rename.
  const removedExampleFiles = [...new Set(relevant
    .filter((c) => c.category === 'FILE_REMOVED' && c.file?.startsWith(CONFIG.examplesPathPrefix) && !renames.some((r) => r.from === c.file))
    .map((c) => c.file))];
  out.push(`## 2. SDK and example changes (${sdkChanges.length + renames.length + removedExampleFiles.length})`);
  out.push('');
  out.push('Functions, types, Zod schemas, and model constants in the upstream SDK, and renamed or removed example files that a lesson mirrors.');
  out.push('');

  // 2a. Per-lesson view: only changes that have a known affected lesson.
  const sdkChangesByLesson = new Map();
  const orphanedSdkChanges = [];
  for (const c of sdkChanges) {
    let action = actionForChange(c);
    if (!action || action.verb === '__SKIP__') continue;
    if (action.verb === 'ADD_PARAM' && action.tier === 'required' && paramAlreadyPassed(c.name, c.param, index)) continue;
    if (c.branch && c.discriminantKey) {
      const usage = classifyDiscriminantUsage(c.schema, c.discriminantKey, c.branch, index);
      const note = ` _(only applies when \`${c.discriminantKey}\` is \`'${c.branch}'\`${usage === 'all-differ' ? " — none of these lessons use that value" : ''})_`;
      action = usage === 'all-differ' && action.tier === 'required'
        ? { ...action, tier: 'optional', desc: action.desc + note }
        : { ...action, desc: action.desc + note };
    }
    const lesson = lessonHintForPath(c.file ?? '', index, c);
    if (lesson) {
      if (!sdkChangesByLesson.has(lesson)) sdkChangesByLesson.set(lesson, []);
      sdkChangesByLesson.get(lesson).push({ change: c, action });
    } else {
      orphanedSdkChanges.push({ change: c, action });
    }
  }
  // A lesson whose upstream example was renamed or removed needs its
  // sourceExample and vendored copy updated, so it is listed here with the
  // SDK changes. New example files are in section 4.
  const addLessonItem = (lesson, desc) => {
    if (!sdkChangesByLesson.has(lesson)) sdkChangesByLesson.set(lesson, []);
    sdkChangesByLesson.get(lesson).push({ change: {}, action: { tier: 'required', desc } });
  };
  const short = (f) => (f.startsWith(CONFIG.examplesPathPrefix) ? f.slice(CONFIG.examplesPathPrefix.length) : f);
  for (const r of renames) {
    const lesson = lessonHintForPath(r.from, index) ?? lessonHintForPath(r.to, index);
    if (!lesson) continue;
    const sim = r.similarity != null ? `${Math.round(r.similarity * 100)}%` : 'unknown';
    addLessonItem(lesson, `Upstream example moved from \`${short(r.from)}\` to \`${short(r.to)}\` (content similarity ${sim}). Point \`sourceExample\` at the new path and refresh the vendored copy.`);
  }
  for (const f of removedExampleFiles) {
    const lesson = lessonHintForPath(f, index);
    if (!lesson) continue;
    const docsPage = docChapterMap?.exactFileToSlug.get(f);
    addLessonItem(lesson, docsPage
      ? `Upstream example \`${short(f)}\` was removed, but the docs page \`${docsPage}\` still shows it. Find its replacement, or remove the lesson once the docs drop it.`
      : `**Remove lesson.** Upstream example \`${short(f)}\` was removed, and no docs page shows it anymore.`);
  }

  out.push('Each item below is tagged `[required]`, `[verify]`, or `[optional]`:');
  out.push('- `[required]`: the code sample uses this and the change will break it. Must be fixed.');
  out.push('- `[verify]`: nothing necessarily breaks, but behavior may differ. Worth a quick look or smoke test.');
  out.push('- `[optional]`: purely additive (new function, new optional field). Nothing to fix; only useful if you want to teach it.');
  out.push('');

  out.push(`### 2a. Changes to existing lessons (${sdkChangesByLesson.size} lesson${sdkChangesByLesson.size === 1 ? '' : 's'})`);
  out.push('');
  if (sdkChangesByLesson.size === 0) {
    out.push('_No SDK or example changes have a known affected lesson._');
  } else {
    // The map key is whatever `lessonHintForPath` returned for the symbol-
    // aware attribution: usually a vendored `.answer.ts` path. Convert to
    // the lesson MDX path before rendering.
    const toMdxPath = (k) => {
      // If the key is already an MDX path, use it as-is.
      if (k.endsWith('.mdx')) return k;
      // If the key is a vendored `.answer.ts` path, derive the MDX.
      if (k.endsWith('.answer.ts')) {
        const rel = path.relative(CONFIG.vendoredRoot, path.join(CONFIG.vendoredRoot, k));
        const parts = rel.split(path.sep);
        if (parts.length === 2) return `${parts[0]}/${parts[1].replace(/\.answer\.ts$/, '.mdx')}`;
      }
      return k;
    };
    for (const [rawKey, items] of [...sdkChangesByLesson.entries()].sort()) {
      const lessonMdx = toMdxPath(rawKey);
      const lessonParts = lessonMdx.split('/');
      const vendoredPath = `examples/${CONFIG.key}/${lessonParts[0]}/${lessonParts[1].replace(/\.mdx$/, '.answer.ts')}`;
      const sorted = [...items].sort((x, y) => TIER_ORDER[x.action.tier] - TIER_ORDER[y.action.tier]);
      const counts = { required: 0, verify: 0, optional: 0 };
      for (const { action } of sorted) counts[action.tier]++;
      const summary = [
        counts.required && `${counts.required} required`,
        counts.verify && `${counts.verify} to verify`,
        counts.optional && `${counts.optional} optional`,
      ].filter(Boolean).join(', ');
      const key = `1a:${rawKey}`;
      out.push(`- [${box(key)}] **${lessonMdx}** _(${summary})_ <!-- id:${key} -->`);
      out.push(`    - Code sample: \`${vendoredPath}\``);
      for (const { change, action } of sorted) {
        out.push(`    - \`${TIER_LABEL[action.tier]}\` ${action.desc}`);
        appendReleaseNoteSnippet(out, '      ', change, releaseNoteSnippets);
      }
    }
    out.push('');
  }

  // 2b. Orphaned SDK changes: new symbols added that no lesson uses.
  out.push(`### 2b. New SDK capabilities no lesson uses yet (${orphanedSdkChanges.length})`);
  out.push('');
  out.push('No existing lesson touches these. Nothing broke, they\'re just new; only relevant if you want a new lesson or example to showcase one.');
  out.push('');
  if (orphanedSdkChanges.length === 0) {
    out.push('_None._');
  } else {
    const sorted = [...orphanedSdkChanges].sort((x, y) => TIER_ORDER[x.action.tier] - TIER_ORDER[y.action.tier]);
    for (const { change, action } of sorted) {
      out.push(`- \`${TIER_LABEL[action.tier]}\` ${action.desc}`);
      appendReleaseNoteSnippet(out, '  ', change, releaseNoteSnippets);
    }
  }
  out.push('');

  // ─── PART 3: Docs changes ─────────────────────────────────────────────
  const docsDiverged = docs?.results.filter((r) => r.status === 'diverged') ?? [];
  const docsMissing = docs?.results.filter((r) => r.status === 'upstream-missing') ?? [];
  out.push(`## 3. Docs changes (${docsDiverged.length + docsMissing.length})`);
  out.push('');
  if (!docs) {
    out.push('_Docs check skipped (--quick). Re-run without --quick to check._');
  } else if (docs.error) {
    out.push(`_Docs check failed: ${docs.error}_`);
  } else if (docsDiverged.length === 0 && docsMissing.length === 0) {
    out.push('_No docs-site code blocks diverge from upstream examples._');
  } else {
    if (docsDiverged.length > 0) {
      out.push('### 3a. Diverged (docs code block references symbols no longer in the upstream example)');
      out.push('');
      out.push('| [ ] | Doc block context | Upstream example | Missing symbols |');
      out.push('| --- | ----------------- | ---------------- | --------------- |');
      for (const d of docsDiverged.slice(0, 30)) {
        const key = `3a:${d.upstreamFile}::${d.context}`;
        out.push(`| [${box(key)}] | ${d.context} | \`${d.upstreamFile}\` | ${(d.missing ?? []).map((m) => '`' + m + '`').join(', ') || '—'} <!-- id:${key} --> |`);
      }
      out.push('');
    }
    if (docsMissing.length > 0) {
      out.push('### 3b. Upstream-missing (docs reference an example that no longer exists)');
      out.push('');
      out.push('| [ ] | Doc block context | Missing upstream file |');
      out.push('| --- | ----------------- | --------------------- |');
      for (const d of docsMissing.slice(0, 30)) {
        const key = `3b:${d.upstreamFile}::${d.context}`;
        out.push(`| [${box(key)}] | ${d.context} | \`${d.upstreamFile}\` <!-- id:${key} --> |`);
      }
      out.push('');
    }
  }

  // ─── PART 4: New chapters (optional) ──────────────────────────────────
  const kindOf = (f) => opportunityClasses?.get(f)?.kind ?? 'new';
  const freshLessons = newOpportunities.filter((f) => kindOf(f) === 'new');
  // New examples a lesson already mirrors. They stay in 4a, checked, so 4a
  // lists every new SDK example in one place.
  const writtenLessons = [...new Set(relevant
    .filter((c) => c.category === 'FILE_ADDED' && c.file?.startsWith(CONFIG.examplesPathPrefix))
    .map((c) => c.file))]
    .map((f) => ({ file: f, lesson: lessonHintForPath(f, index) }))
    .filter((x) => x.lesson);
  const newExampleCount = newOpportunities.length + writtenLessons.length;
  const lessonUpdates = newOpportunities.filter((f) => kindOf(f) === 'update');
  const blockedExamples = newOpportunities.filter((f) => kindOf(f) === 'blocked');
  out.push(`## 4. New chapters / optional additions (${newExampleCount})`);
  out.push('');
  out.push('Upstream example files that have no matching vendored copy, in three groups: new lessons, examples an existing lesson may already cover, and examples that need a model QVAC does not provide.');
  out.push('');
  if (newExampleCount === 0) {
    out.push('_No new example files since the baseline. Nothing to add._');
    out.push('');
  } else {
    out.push(`### 4a. New lessons (${freshLessons.length + writtenLessons.length}, ${writtenLessons.length} written)`);
    out.push('');
    if (freshLessons.length + writtenLessons.length === 0) out.push('_None._');
    for (const { file, lesson } of writtenLessons) {
      out.push(`- [x] **LESSON WRITTEN** \`${lesson}\` from \`${file}\``);
    }
    for (const f of freshLessons) {
      const chapter = chapterGuess(f, docChapterMap);
      const base = path.basename(f, '.ts');
      const key = `4:${f}`;
      out.push(`- [${box(key)}] **NEW LESSON** \`${chapter}/${base}.mdx\` <!-- id:${key} -->`);
      out.push(`    - Lesson: \`${chapter}/${base}.mdx\` (chapter: \`${chapter}\`)`);
      out.push(`    - Code sample: \`examples/${CONFIG.key}/${chapter}/${base}.answer.ts\``);
      out.push(`    - Changes needed: create the lesson MDX and the vendored \`.answer.ts\`; mirror \`${f}\``);
      out.push(`    - Reason: new upstream example with no vendored counterpart yet, and no existing lesson teaches the same model and functions`);
      const files = opportunityClasses?.get(f)?.inputs?.files ?? [];
      if (files.length) out.push(`    - Needs an input file on the command line: ${files.map((x) => `\`${x}\``).join(', ')}`);
    }
    out.push('');

    out.push(`### 4b. Possible updates to an existing lesson (${lessonUpdates.length})`);
    out.push('');
    out.push('Each example below shares SDK functions, a model family or name words with a lesson we already have. Check whether a new option or a sentence in that lesson covers it before writing a new one.');
    out.push('');
    if (lessonUpdates.length === 0) out.push('_None._');
    const code = (xs) => xs.map((x) => `\`${x}\``).join(', ');
    for (const f of lessonUpdates) {
      const c = opportunityClasses.get(f);
      const key = `4:${f}`;
      out.push(`- [${box(key)}] **UPDATE LESSON?** \`${c.lesson}\` from \`${f}\` <!-- id:${key} -->`);
      const shared = [];
      if (c.sharedFamilies.length) shared.push(`model family ${code(c.sharedFamilies)}`);
      shared.push(`functions ${code(c.sharedFunctions)}`);
      if (c.sharedTokens.length) shared.push(`name words ${code(c.sharedTokens)}`);
      if (c.mentioned.length) shared.push(`the lesson text mentions ${code(c.mentioned)}`);
      out.push(`    - Shared with the lesson: ${shared.join('; ')}`);
      out.push(`    - Model constants the lesson does not use: ${c.newConstants.length ? code(c.newConstants) : 'none'}`);
      out.push(`    - Option keys the lesson does not use: ${c.newKeys.length ? code(c.newKeys) : 'none'}`);
      if (c.inputs.files.length) out.push(`    - Needs an input file on the command line: ${code(c.inputs.files)}`);
    }
    out.push('');

    out.push(`### 4c. Needs a model QVAC does not provide (${blockedExamples.length}) (reference only)`);
    out.push('');
    out.push('These examples load their model from a local path, an environment variable or a URL instead of the QVAC model registry. A lesson would need that model from QVAC first.');
    out.push('');
    if (blockedExamples.length === 0) out.push('_None._');
    for (const f of blockedExamples) {
      const c = opportunityClasses.get(f);
      out.push(`- \`${f}\``);
      for (const reason of c.reasons) out.push(`    - ${reason[0].toUpperCase()}${reason.slice(1)}`);
    }
    out.push('');
  }
  if (demoAppFiles.length) {
    out.push(`### Demo apps (${demoAppFiles.length}) (reference only, no action needed)`);
    out.push('');
    out.push('New upstream code that belongs to a demo app (a folder with an `index.html`). These files are not lesson material. They are listed in case we want to build something similar.');
    out.push('');
    for (const f of demoAppFiles) out.push(`- \`${f}\``);
    out.push('');
  }

  // ─── PART 5: Model registry ───────────────────────────────────────────
  // One sentence per direction: comma-separated constant lists. Saves
  // ~150 lines vs. one-line-per-constant in the 48/109 case.
  if (modelChanges.added.length || modelChanges.removed.length) {
    out.push(`## 5. Model registry (${CONFIG.modelRegistryFile}) (reference only, no action needed)`);
    out.push('');
    if (modelChanges.added.length) {
      out.push(`**Added models (${modelChanges.added.length}):** ${modelChanges.added.map((m) => '`' + m + '`').join(', ')}.`);
      out.push('');
    }
    if (modelChanges.removed.length) {
      out.push(`**Removed models (${modelChanges.removed.length}):** ${modelChanges.removed.map((m) => '`' + m + '`').join(', ')}.`);
      out.push('');
    }
  }

  // ─── PART 6: Informational (body-only, no signature drift) ────────────
  // Group by upstream file. One row per file, listing the symbols whose
  // body changed but signature didn't. These are *not* action items.
  if (informational.length > 0) {
    out.push(`## 6. Informational (${informational.length}) (reference only, no action needed)`);
    out.push('');
    out.push('Body fingerprint changed but the function/type signature is identical. Lessons probably still work, but a smoke run is cheap insurance. Not action items.');
    out.push('');
    // Group by file, keep insertion order of first occurrence.
    const byFile = new Map();
    for (const c of informational) {
      const f = c.file ?? '(unknown)';
      if (!byFile.has(f)) byFile.set(f, []);
      byFile.get(f).push(c);
    }
    out.push('| Upstream | Symbols whose body changed (signature identical) |');
    out.push('|----------|---------------------------------------------------|');
    for (const [f, items] of byFile) {
      const shortPath = f.startsWith(CONFIG.surfacePathPrefix) ? f.slice(CONFIG.surfacePathPrefix.length) : f;
      const symbols = items.map((c) => '`' + (c.name ?? c.schema ?? '?') + '`').join(', ');
      out.push(`| \`${shortPath}\` | ${symbols} |`);
    }
    out.push('');
  }

  // ─── PART 7: Per-commit trail (covered) ───────────────────────────────
  const coveredTouchedCommits = relevantCommits.filter((c) => c._files.length > 0);
  if (coveredTouchedCommits.length > 0) {
    out.push(`## 7. Per-commit trail (${coveredTouchedCommits.length}) (reference only, no action needed)`);
    out.push('');
    out.push('For traceability: every commit since baseline that touched a covered example file.');
    out.push('');
    out.push('| Commit | Date | Subject | Files changed |');
    out.push('| ------ | ---- | ------- | ------------- |');
    for (const c of coveredTouchedCommits) {
      const files = c._files.map((f) => '\`' + path.basename(f) + '\`').slice(0, 6).join(', ');
      const more = c._files.length > 6 ? `, +${c._files.length - 6} more` : '';
      out.push(`| \`${c.sha.slice(0, 8)}\` | ${c.date.slice(0, 10)} | ${c.subject} | ${files}${more} |`);
    }
    out.push('');
  }


  out.push('---');
  out.push('');
  out.push(`Re-run: \`node scripts/lessons-check.mjs --project ${CONFIG.key}\`. Override baseline: \`--since <ref>\`. Skip docs: \`--quick\`. Include unreleased upstream commits: \`--head\`.`);
  out.push('');
  return out.join('\n');
}

// ────────────────────────────────────────────────────────────────────
// Chapter map derived from upstream's own docs rather than hand-maintained
// prefix rules: each CONFIG.docsCapabilityDirs page references the example
// files/subdirs for its capability, and our chapter names mirror those
// slugs 1:1. A subdir claimed by more than one doc page is left unmapped;
// chapterGuess() falls back to basename prefixes for anything undocumented.
// ────────────────────────────────────────────────────────────────────

async function buildChapterMapFromDocs(git, toSha) {
  const exactFileToSlug = new Map();
  const subdirCounts = new Map(); // subdir -> Map<slug, count>
  const refPattern = new RegExp(`${escapeRegExp(CONFIG.examplesPathPrefix)}([A-Za-z0-9_./-]+)\\.ts`, 'g');
  for (const pattern of CONFIG.docsCapabilityDirs) {
    let dir = pattern;
    if (pattern.includes('{current}')) {
      const parent = pattern.slice(0, pattern.indexOf('{current}'));
      let current;
      try {
        current = (await git(['ls-tree', '-d', '--name-only', toSha, '--', parent])).trim().split('\n')
          .map((d) => path.basename(d)).find((d) => /^\(v[\d.]+\)$/.test(d));
      } catch { /* parent missing at this ref */ }
      if (!current) continue;
      dir = pattern.replace('{current}', current);
    }
    let files;
    try {
      files = (await git(['ls-tree', '-r', '--name-only', toSha, '--', dir])).trim().split('\n').filter((f) => f.endsWith('.mdx'));
    } catch { continue; }
    for (const f of files) {
      const slug = path.basename(f, '.mdx');
      let text;
      try { text = await git(['show', `${toSha}:${f}`]); } catch { continue; }
      const refs = new Set([...text.matchAll(refPattern)].map((m) => `${CONFIG.examplesPathPrefix}${m[1]}.ts`));
      for (const ref of refs) {
        exactFileToSlug.set(ref, slug);
        const rel = ref.slice(CONFIG.examplesPathPrefix.length);
        const parts = rel.split('/');
        if (parts.length > 1) {
          const subdir = parts[0];
          if (!subdirCounts.has(subdir)) subdirCounts.set(subdir, new Map());
          const counts = subdirCounts.get(subdir);
          counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
      }
    }
  }
  const subdirToSlug = new Map();
  for (const [subdir, slugCounts] of subdirCounts) {
    if (slugCounts.size === 1) subdirToSlug.set(subdir, [...slugCounts.keys()][0]);
  }
  return { exactFileToSlug, subdirToSlug };
}

// ────────────────────────────────────────────────────────────────────
// Extracts the first X.Y.Z run from a string as [major, minor, patch].
// ────────────────────────────────────────────────────────────────────

function parseSemver(s) {
  const m = String(s).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// ────────────────────────────────────────────────────────────────────
// True if semver tuple `a` is greater than `b`.
// ────────────────────────────────────────────────────────────────────

function semverGt(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// CONFIG.changelogDir/<version>/api.md carries a human-written usage
// snippet per API-affecting PR, a supplement since coverage isn't
// guaranteed (fixes/chores rarely get one). Skips if the baseline isn't a
// parseable version ref (e.g. a raw --since sha), with no range to scan.
// ────────────────────────────────────────────────────────────────────

async function loadReleaseNoteSnippets(git, fromRef, toSha) {
  if (!CONFIG.changelogDir) return [];
  const baseline = parseSemver(fromRef);
  if (!baseline) return [];
  let files;
  try {
    files = (await git(['ls-tree', '-r', '--name-only', toSha, '--', CONFIG.changelogDir]))
      .trim().split('\n').filter((f) => f.endsWith('/api.md'));
  } catch { return []; }
  const versions = [...new Set(files.map((f) => f.slice(CONFIG.changelogDir.length + 1).split('/')[0]))]
    .filter((v) => { const s = parseSemver(v); return s && semverGt(s, baseline); });

  const snippets = [];
  for (const version of versions) {
    let text;
    try { text = await git(['show', `${toSha}:${CONFIG.changelogDir}/${version}/api.md`]); } catch { continue; }
    for (const entry of text.split(/\n---\n/)) {
      const titleMatch = entry.match(/^##\s+(.+)$/m);
      const prMatch = entry.match(/PR:\s*\[#(\d+)\]\((\S+)\)/);
      const codeMatch = entry.match(/```\w*\n([\s\S]*?)```/);
      if (!titleMatch || !codeMatch) continue;
      snippets.push({
        version,
        title: titleMatch[1].trim(),
        prNumber: prMatch?.[1] ?? null,
        prUrl: prMatch?.[2] ?? null,
        code: codeMatch[1].trim(),
      });
    }
  }
  return snippets;
}

// ────────────────────────────────────────────────────────────────────
// Finds the first release-note snippet whose code references `symbol`.
// ────────────────────────────────────────────────────────────────────

function findReleaseNoteSnippet(symbol, snippets) {
  if (!symbol) return null;
  const re = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);
  return snippets.find((s) => re.test(s.code)) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// Appends a matching release-note snippet under a report line, if one exists.
// ────────────────────────────────────────────────────────────────────

function appendReleaseNoteSnippet(out, indent, change, snippets) {
  if (!snippets?.length) return;
  // Field/param name first: lesson code and these snippets reference the
  // property being set (`ttsEngine: 'parler'`), never the schema/type name
  // that owns it (`ttsConfigSchema` never appears in call-site code).
  const symbol = change.field ?? change.param ?? change.name ?? change.schema ?? null;
  const snippet = findReleaseNoteSnippet(symbol, snippets);
  if (!snippet) return;
  out.push(`${indent}Release note (v${snippet.version}${snippet.prNumber ? `, PR #${snippet.prNumber}` : ''}): ${snippet.title}`);
  out.push(`${indent}\`\`\`typescript`);
  for (const line of snippet.code.split('\n')) out.push(`${indent}${line}`);
  out.push(`${indent}\`\`\``);
}

// ────────────────────────────────────────────────────────────────────
// Resolves a changelog snippet's PR number to the files its commit(s)
// touched, straight from git rather than the (possibly out-of-scope)
// AST-based surface diff.
// ────────────────────────────────────────────────────────────────────

async function resolveSnippetTouchedFiles(git, prNumber) {
  if (!prNumber) return { files: [], commitType: null };
  try {
    const subjects = (await git(['log', '--all', '--format=%H %s', '--fixed-strings', '--grep', `(#${prNumber})`]))
      .trim().split('\n').filter(Boolean);
    if (!subjects.length) return { files: [], commitType: null };
    const shas = subjects.map((l) => l.split(' ')[0]);
    const firstSubject = subjects[0].slice(subjects[0].indexOf(' ') + 1);
    const ticket = subjects[0].split(' ')[1] ?? null;
    // Conventional-commit type, e.g. "QVAC-1234 feat[api]: ..." -> "feat".
    const commitType = firstSubject.match(/^\S+\s+(\w+)(?:\[[^\]]*\])?:/)?.[1] ?? null;
    const files = new Set();
    for (const sha of shas) {
      for (const f of (await git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])).trim().split('\n').filter(Boolean)) files.add(f);
    }
    return { files: [...files], commitType, ticket };
  } catch {
    return { files: [], commitType: null, ticket: null };
  }
}

// ────────────────────────────────────────────────────────────────────
// Finds changelog snippets whose symbol matches no detected change and
// whose PR's touched files aren't already a known example or covered file
// (e.g. a capability shipped entirely through a sibling package).
// ────────────────────────────────────────────────────────────────────

// A snippet whose code, once comments are stripped, is nothing but a
// `schema.shape.field.description` accessor only documents a Zod
// .describe() string; that's never lesson material.
function isDescribeOnlySnippet(code) {
  const lines = code.split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l && !/^import\b/.test(l));
  if (!lines.length) return false;
  const last = lines[lines.length - 1].replace(/\s+/g, '');
  return /^[$\w]+(\.[$\w]+|\[\d+\]|\['[^']*'\])*\.description$/.test(last);
}

// The SDK names a changelog snippet uses: imports from @qvac packages, client
// methods, option keys (quoted ones too), and fields it reads off a result.
// Model constants and boilerplate keys are left out, since nearly every lesson has them.
const MEMBERS_IGNORED = new Set(['length', 'prototype', 'stdout', 'stderr', 'env', 'argv']);
function snippetFeatures(code) {
  const names = new Set();
  const stripped = code.replace(/\/\/[^\n]*/g, '');
  const imported = new Set();
  for (const m of stripped.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@qvac\/[^'"]+['"]/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (n && !/^[A-Z0-9_]+$/.test(n)) imported.add(n);
    }
  }
  const functions = new Set(imported);
  for (const m of stripped.matchAll(/\bclient\.(\w+)\s*\(/g)) functions.add(m[1]);
  for (const n of functions) names.add(n);
  for (const k of objectKeys(stripped)) names.add(k);
  for (const m of stripped.matchAll(/[{,]\s*['"]([\w-]+)['"]\s*:/g)) names.add(m[1]);
  for (const m of stripped.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of m[1].split(',')) { const n = part.trim().split(/\s*:\s*/)[0]; if (/^\w+$/.test(n)) names.add(n); }
  }
  for (const m of stripped.matchAll(/[\w\])]\??\.(\w+)\b(?!\s*\()/g)) if (!MEMBERS_IGNORED.has(m[1])) names.add(m[1]);
  for (const n of [...BOILERPLATE_KEYS, ...FUNCTIONS_IGNORED_FOR_MATCH]) { names.delete(n); functions.delete(n); }
  return { names, functions };
}

// The lessons' answer files, to tell which snippet names a lesson already uses,
// and the lesson files named after an SDK function (assess-model-fit.mdx).
let lessonCode = null;
function lessonIndex() {
  if (!lessonCode) {
    const words = new Set();
    let text = '';
    for (const f of walkSync(CONFIG.vendoredRoot, '.answer.ts')) {
      const src = readFileSync(f, 'utf8');
      text += src;
      for (const m of src.matchAll(/[A-Za-z_$][\w$]*/g)) words.add(m[0]);
    }
    const byName = new Map();
    for (const f of walkSync(CONFIG.lessonsRoot, '.mdx')) byName.set(path.basename(f, '.mdx'), path.relative(CONFIG.lessonsRoot, f));
    lessonCode = { words, text, byName };
  }
  return lessonCode;
}

// Returns null when no lesson covers the snippet, { all: true } when the lessons
// use every name in it, or the lesson named after its function plus the names no lesson uses.
function lessonCoverage(code) {
  const { names, functions } = snippetFeatures(code);
  if (names.size === 0) return null;
  const { words, text, byName } = lessonIndex();
  const used = (n) => (n.includes('-') ? text.includes(`'${n}'`) || text.includes(`"${n}"`) : words.has(n));
  const missing = [...names].filter((n) => !used(n));
  if (missing.length === 0) return { all: true };
  for (const fn of functions) {
    const lesson = byName.get(fn.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
    if (lesson && used(fn)) return { all: false, lesson, fn, missing };
  }
  return null;
}

async function findUncoveredReleaseSnippets(git, snippets, allChanges, newOpportunities, coveredExampleFiles) {
  const knownSymbols = allChanges.map((c) => c.field ?? c.param ?? c.name ?? c.schema).filter(Boolean);
  const newOpportunitySet = new Set(newOpportunities);
  const uncovered = [];
  const byTicket = new Map(); // one entry per ticket: same ticket, split across PRs, is one feature.
  for (const s of snippets) {
    if (isDescribeOnlySnippet(s.code)) continue;
    const coverage = lessonCoverage(s.code);
    if (coverage?.all) continue;
    const symbolMatch = knownSymbols.some((sym) => new RegExp(`\\b${escapeRegExp(sym)}\\b`).test(s.code));
    if (symbolMatch) continue;
    const { files: touched, commitType, ticket } = await resolveSnippetTouchedFiles(git, s.prNumber);
    // test[...]/chore[...] PRs (lint guards, dependency bumps) aren't lesson material either.
    if (commitType === 'test' || commitType === 'chore') continue;
    const alreadyKnown = touched.some((f) => newOpportunitySet.has(f) || coveredExampleFiles.has(f));
    if (alreadyKnown) continue;
    // Zero touched files under packages/sdk/ at all (not even package.json,
    // a contract regen, or an e2e test) means no @qvac/sdk footprint to
    // teach, only an internal tool in a sibling package.
    if (touched.length > 0 && touched.every((f) => !f.startsWith(CONFIG.surfacePathPrefix))) continue;
    // The academy has no mobile lessons yet, so mobile-only entries are skipped.
    const sdkTouched = touched.filter((f) => f.startsWith(CONFIG.surfacePathPrefix) && !/\/(test|e2e)\//.test(f));
    if (/\bmobile\b/i.test(s.title) || (sdkTouched.length > 0 && sdkTouched.every((f) => /\/(expo|mobile|android|ios)\b/i.test(f)))) continue;
    if (ticket && byTicket.has(ticket)) {
      const existing = byTicket.get(ticket);
      existing.extraPrNumbers.push(s.prNumber);
      existing.touched = [...new Set([...existing.touched, ...touched])];
      continue;
    }
    const entry = { ...s, touched, extraPrNumbers: [], coveredBy: coverage };
    if (ticket) byTicket.set(ticket, entry);
    uncovered.push(entry);
  }
  return uncovered;
}

// ────────────────────────────────────────────────────────────────────
// Guesses which lesson chapter an upstream file belongs to.
// ────────────────────────────────────────────────────────────────────

function chapterGuess(upstreamFile, docChapterMap) {
  if (docChapterMap?.exactFileToSlug.has(upstreamFile)) return docChapterMap.exactFileToSlug.get(upstreamFile);
  if (upstreamFile.startsWith(CONFIG.examplesPathPrefix)) {
    const rel = upstreamFile.slice(CONFIG.examplesPathPrefix.length);
    const subdir = rel.split('/')[0];
    if (rel.includes('/') && docChapterMap?.subdirToSlug.has(subdir)) return docChapterMap.subdirToSlug.get(subdir);
  }
  // Legacy fallback: undocumented file, no doc page mentions it yet. Best
  // guess from the basename; still shown in the report so a human decides.
  const base = path.basename(upstreamFile, '.ts');
  if (base.startsWith('diffusion-')) return /img2vid|txt2vid|vid2vid/.test(base) ? 'video-generation' : 'image-generation';
  if (base.startsWith('vla-')) return 'vla';
  if (base.startsWith('rag-')) return 'rag';
  if (base.startsWith('completion-') || base.startsWith('multi-turn') || base.startsWith('concurrent-')) return 'text-generation';
  if (base.startsWith('transcribe') || base.startsWith('whisper') || base.startsWith('parakeet')) return 'transcription';
  if (base.startsWith('tts-') || base.startsWith('chatterbox') || base.startsWith('parler')) return 'text-to-speech';
  if (base.startsWith('logging-')) return 'profiling';
  if (base.startsWith('multi-model') || base.startsWith('llamacpp-multimodal') || base.startsWith('mcp-')) return 'multimodal';
  if (base.startsWith('registry-')) return 'p2p';
  if (base.startsWith('cancel-') || base.startsWith('parallel-') || base.startsWith('suspend-')) return 'runtime';
  if (base.startsWith('kv-cache') || base.startsWith('llamacpp-cache')) return 'text-generation';
  if (base.startsWith('config-') || base.startsWith('default-config') || base.startsWith('llamacpp-http') || base.startsWith('llamacpp-sharded')) return 'getting-started';
  if (base.startsWith('quickstart') || base.startsWith('llamacpp-filesystem') || base.startsWith('llamacpp-p2p') || base.startsWith('llamacpp-structured') || base.startsWith('llamacpp-tools-') || base.startsWith('llamacpp-dynamic') || base.startsWith('mcp-websearch') || base.startsWith('seed-')) return 'getting-started';
  if (base.startsWith('voice-')) return 'voice-assistant';
  return '(root)';
}

// ────────────────────────────────────────────────────────────────────
// Resolves a repo's baseline: --since wins outright, else the latest tag
// the app's SDK dependency allows.
// ────────────────────────────────────────────────────────────────────

async function resolveRepoBaseline(repo) {
  if (RAW_SINCE) return resolveRef(repo.git, RAW_SINCE);
  return baselineFromDep(repo.git, repo.config);
}

// ────────────────────────────────────────────────────────────────────
// Resolves the `to` ref for a repo: the latest tagged release by default
// (so the report only ever reflects code that's actually shipped), or HEAD
// when --head is passed or the repo has no tag glob to resolve against.
// ────────────────────────────────────────────────────────────────────

async function resolveToRef(repo) {
  if (INCLUDE_UNRELEASED) return resolveRef(repo.git, 'HEAD');
  const tagGlob = repo.config.baselineTagGlob;
  if (!tagGlob) return resolveRef(repo.git, 'HEAD');
  const tags = (await repo.git(['tag', '--list', tagGlob, '--sort=-version:refname'])).trim().split('\n').filter(Boolean);
  const latest = tags.find((t) => parseSemver(t));
  if (!latest) return resolveRef(repo.git, 'HEAD');
  return resolveRef(repo.git, latest);
}

// ────────────────────────────────────────────────────────────────────
// Entry point: resolves repos and baselines, diffs, classifies, and writes the report.
// ────────────────────────────────────────────────────────────────────

async function main() {
  const mainRepo = getRepo('main');
  const examplesRepoKey = CONFIG.examplesRepo ?? 'main';
  const docsRepoKey = CONFIG.docsRepo ?? 'main';
  const examplesRepo = examplesRepoKey === 'main' ? mainRepo : getRepo(examplesRepoKey);
  const docsRepo = docsRepoKey === 'main' ? mainRepo : (docsRepoKey === examplesRepoKey ? examplesRepo : getRepo(docsRepoKey));

  // Dedupe: clone/fetch each distinct repo exactly once.
  const distinctRepos = [...new Map([mainRepo, examplesRepo, docsRepo].map((r) => [r.dir, r])).values()];
  for (const repo of distinctRepos) await ensureRepo(repo);

  // Each repo baselines independently; main/examples/docs only share
  // `from`/`to` when they're literally the same repo.
  const from = await resolveRepoBaseline(mainRepo);
  const to = await resolveToRef(mainRepo);
  console.error(`[check] baseline: ${from.ref} (${from.sha.slice(0, 8)}, ${from.date.slice(0, 10)})`);
  console.error(`[check] current:  ${to.ref} (${to.sha.slice(0, 8)}, ${to.date.slice(0, 10)})${INCLUDE_UNRELEASED ? ' [includes unreleased commits]' : ''}`);

  // Commits merged since `to` that this run deliberately excludes, so the
  // report can distinguish "nothing new released" from "nothing new".
  let unreleasedAhead = null;
  if (!INCLUDE_UNRELEASED && to.ref !== 'HEAD') {
    const headRef = await resolveRef(mainRepo.git, 'HEAD');
    if (headRef.sha !== to.sha) {
      const count = parseInt((await mainRepo.git(['rev-list', '--count', `${to.sha}..${headRef.sha}`])).trim(), 10);
      unreleasedAhead = { count, headSha: headRef.sha, headDate: headRef.date };
      console.error(`[check] ${count} commit(s) merged since ${to.ref}, not yet released, excluded (rerun with --head to include)`);
    }
  }

  const examplesFrom = examplesRepo.dir === mainRepo.dir ? from : await resolveRepoBaseline(examplesRepo);
  const examplesTo = examplesRepo.dir === mainRepo.dir ? to : await resolveToRef(examplesRepo);
  const docsTo = docsRepo.dir === mainRepo.dir ? to : (docsRepo.dir === examplesRepo.dir ? examplesTo : await resolveToRef(docsRepo));
  const docsFrom = docsRepo.dir === mainRepo.dir ? from : (docsRepo.dir === examplesRepo.dir ? examplesFrom : await resolveRepoBaseline(docsRepo));

  const docChapterMap = await buildChapterMapFromDocs(docsRepo.git, docsTo.sha);
  console.error(`[check] chapter map from docs: ${docChapterMap.exactFileToSlug.size} exact files, ${docChapterMap.subdirToSlug.size} subdirs`);
  const releaseNoteSnippets = await loadReleaseNoteSnippets(docsRepo.git, docsFrom.ref, docsTo.sha);
  console.error(`[check] release note snippets: ${releaseNoteSnippets.length}`);

  // Extract both snapshots (main repo, SDK surface).
  console.error('[check] extracting baseline SDK snapshot...');
  const beforeSnap = await extractRef(mainRepo.git, from.sha);
  console.error(`[check]   ${Object.keys(beforeSnap).length} files`);
  console.error('[check] extracting HEAD SDK snapshot...');
  const afterSnap = await extractRef(mainRepo.git, to.sha);
  console.error(`[check]   ${Object.keys(afterSnap).length} files`);

  // Diff.
  let allChanges = diffSnapshots(beforeSnap, afterSnap);
  // If examples live in a separate repo, extractRef() above never walked
  // them (it's scoped to CONFIG.surfacePathPrefix in the main repo): add
  // their FILE_ADDED/FILE_REMOVED events from the examples repo directly.
  if (examplesRepo.dir !== mainRepo.dir) {
    const exampleFileChanges = await diffExampleFilesAcrossRepo(examplesRepo.git, examplesFrom.sha, examplesTo.sha, CONFIG.examplesPathPrefix);
    allChanges = allChanges.concat(exampleFileChanges);
    console.error(`[check] examples repo (${examplesRepo.key}) file changes: ${exampleFileChanges.length}`);
  }
  console.error(`[check] raw diff: ${allChanges.length} changes`);

  // Model registry (always reported, even if no lessons touch these models).
  const modelChanges = await diffModelRegistry(mainRepo.git, from.sha, to.sha);
  console.error(`[check] models: +${modelChanges.added.length} -${modelChanges.removed.length}`);

  // Examples directory commits.
  const commits = await listCommitsTouchingExamples(examplesRepo.git, examplesFrom.sha, examplesTo.sha);
  for (const c of commits) {
    const { files, deleted } = await filesChangedInCommit(examplesRepo.git, c.sha);
    c._files = files;
    c._deletedFiles = deleted;
  }
  console.error(`[check] examples commits: ${commits.length}`);

  // Build the relevance index: which upstream paths and symbols do our
  // lessons actually depend on? Everything else is dropped before the
  // report is rendered.
  const index = buildRelevanceIndex(afterSnap, { snapshot: afterSnap });
  index.modelConfigSchemaToVendored = await buildModelConfigSchemaIndex(mainRepo.git, to.sha, index.examplesDir, index.symbolToVendored);
  console.error(`[check] modelConfig schema links: ${index.modelConfigSchemaToVendored.size}`);
  const partition = partitionChanges(allChanges, commits, index, examplesRepo.dir, examplesFrom.sha, examplesTo.sha);
  const { relevant, informational, renames, falseRenames, relevantCommits, newOpportunities, demoAppFiles, resolvedRenameCount } = partition;
  console.error(`[check] relevant: ${relevant.length}, informational: ${informational.length}, renames: ${renames.length} (${resolvedRenameCount} already synced, dropped), falseRenames: ${falseRenames.length}, new opportunities: ${newOpportunities.length}, demo app files: ${demoAppFiles.length}`);

  const opportunityClasses = classifyOpportunities(newOpportunities, examplesRepo.dir, examplesTo.sha);
  const countKind = (k) => [...opportunityClasses.values()].filter((c) => c.kind === k).length;
  console.error(`[check] new examples: ${countKind('new')} new lesson(s), ${countKind('update')} possible update(s), ${countKind('blocked')} needing a model QVAC does not provide`);

  const uncoveredSnippets = await findUncoveredReleaseSnippets(mainRepo.git, releaseNoteSnippets, allChanges, [...newOpportunities, ...demoAppFiles], index.coveredExampleFiles);
  console.error(`[check] changelog entries not reflected elsewhere in the report: ${uncoveredSnippets.length}`);

  // Docs site.
  let docs = null;
  if (!QUICK) {
    console.error('[check] checking docs site...');
    docs = await checkDocs(afterSnap);
    console.error(`[check] docs: ${docs.results.length} blocks (${docs.results.filter((r) => r.status === 'diverged').length} diverged)`);
  }

  // Render and write.
  CHECKED_KEYS = loadCheckedKeys();
  console.error(`[check] carrying forward ${CHECKED_KEYS.size} checked item(s) from prior runs`);
  const report = renderReport({ from, to, modelChanges, allChanges, relevant, informational, renames, falseRenames, relevantCommits, newOpportunities, opportunityClasses, demoAppFiles, docs, index, docChapterMap, releaseNoteSnippets, unreleasedAhead, uncoveredSnippets });
  mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  if (!JSON_ONLY) writeFileSync(REPORT_MD, report);

  // Machine-readable JSON for tooling.
  const jsonOut = {
    generated: new Date().toISOString(),
    from: { ref: from.ref, sha: from.sha, date: from.date },
    to: { ref: to.ref, sha: to.sha, date: to.date },
    unreleasedAhead,
    summary: {
      rawChanges: allChanges.length,
      relevantChanges: relevant.length,
      informational: informational.length,
      renames: renames.length,
      falseRenames: falseRenames.length,
      newOpportunities: newOpportunities.length,
      newLessons: countKind('new'),
      lessonUpdates: countKind('update'),
      blockedExamples: countKind('blocked'),
      demoAppFiles: demoAppFiles.length,
      uncoveredChangelogEntries: uncoveredSnippets.length,
      modelsAdded: modelChanges.added.length,
      modelsRemoved: modelChanges.removed.length,
      examplesCommits: commits.length,
      docsBlocks: docs?.results.length ?? 0,
      docsDiverged: docs?.results.filter((r) => r.status === 'diverged').length ?? 0,
      docsMissing: docs?.results.filter((r) => r.status === 'upstream-missing').length ?? 0,
    },
    modelChanges,
    rawChanges: allChanges,
    relevantChanges: relevant,
    informational,
    renames,
    falseRenames,
    relevantCommits,
    newOpportunities,
    opportunityClasses: Object.fromEntries(opportunityClasses),
    demoAppFiles,
    uncoveredSnippets,
    docs: docs?.results ?? null,
  };
  writeFileSync(REPORT_JSON, JSON.stringify(jsonOut, null, 2));

  // Save state.
  writeFileSync(STATE_FILE, JSON.stringify({ lastRun: new Date().toISOString(), from, to, checkedKeys: [...CHECKED_KEYS].sort() }, null, 2));

  // Stdout summary for CI.
  console.log(JSON.stringify(jsonOut.summary, null, 2));
  console.log(`Report: ${REPORT_MD}`);
}

main().catch((e) => {
  console.error('[check] failed:', e);
  process.exit(1);
});
