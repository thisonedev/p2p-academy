# P2P Academy Desktop

Electron + Pear Runtime shell that loads the P2P Academy web app.

## Getting started

### Prerequisites

- The Node.js and pnpm versions in the root [README](../../README.md#prerequisites).
- A built web export at `apps/web/out/`, or a running Next dev server on `:3000` (see Development below).

### Run the built app

```bash
pnpm start:desktop
```

or from `apps/desktop`:

```bash
pnpm start
```

The app serves `apps/web/out/` on the `academy://app/` origin, through its own protocol handler. With `--dev` (what `pnpm dev` passes), `PEAR_DEV_URL` wins if it is an `http://localhost` address; otherwise the app serves the static build. With no build it shows a page asking for `pnpm build`.

### Development

Run both commands from the repository root. `dev:desktop` is defined on the workspace `package.json` and resolves to `pnpm --filter @p2p-academy/desktop dev`; from inside `apps/desktop` the equivalent is `pnpm dev`. Running `pnpm dev:desktop` from another directory produces `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "dev:desktop" not found`.

```bash
# terminal 1
pnpm dev                          # Next dev server with HMR on :3000

# terminal 2
PEAR_DEV_URL=http://localhost:3000 pnpm dev:desktop
```

In dev mode `PEAR_DEV_URL` wins over the static build, so changes to the web app hot-reload into the desktop window. `pnpm start:desktop` ignores it.

## Layout, tests, and architecture

- File by file: [Repository layout](../../docs/repository-layout.md#desktop-app).
- Test suites and how to run them: [Testing](../../docs/testing.md).
- Processes and patterns: [Architecture](../../docs/architecture/ARCHITECTURE.md).
- Trust boundaries: [Security boundaries](../../docs/architecture/SECURITY-BOUNDARIES.md).
- Flags, environment variables, and limits: [Configuration](../../docs/configuration.md).

## macOS sandbox notes

### What macOS read confinement does not cover

Writes are allowlisted by subpath; reads can't be, because dyld and the runtime need broad filesystem visibility to start. So the profile allows `file-read*` and denies back entry by entry, generated per spawn from `$HOME`, its parent, and `/tmp`, along with a named list of credential stores elsewhere (`sandbox-mac.cjs`).

Denying back leaves gaps a rule can't close without breaking something the runtime needs:

- A path created after the profile is generated isn't in the deny set. This is bounded to one run, since the profile is rebuilt every spawn.
- A directory the walk must enter but can't list keeps its contents readable; the profile warns per directory.
- `~/Library` stays readable outside the named denies because the dyld, font, and preference caches the runtime starts from live there.
- Paths outside `$HOME`, `/Users`, and `/tmp` are covered only by the named `SYSTEM_READ_DENY` list; walking `$TMPDIR` entry by entry would push `sandbox-exec`'s per-spawn compile time past what a run can tolerate.
- Any path the walk had not reached when it hit `MAX_GENERATED_DENIES` stays readable.

Seatbelt matches rules last-first, so a later allow re-opens an earlier `subpath` deny. This lets a crowded directory be confined without a rule per entry: deny the root once, then allow back each path the run needs.

### sandbox-exec is deprecated

`sandbox-exec(1)` carries a deprecation notice in its own man page and is the entire macOS peer-exec boundary. If a future macOS drops it, peer-exec on macOS stops working by design: `buildWrap` reports `sandboxed: false` when the binary is missing, and callers refuse the spawn rather than run remote code unconfined.

Neither documented replacement fits today: App Sandbox is entitlement-based and applies to the whole app at launch, not a per-spawn profile, so it would confine the editor along with the lesson. Endpoint Security observes syscalls after the fact rather than declaring what a child may reach before it starts.

Revisit when Apple ships a supported per-process profile mechanism.

## Storage

State lives in a Corestore at `app.getPath('userData')/corestore/`, with a separate sealed identity record (`identity-v3.json`) managed by `identity/manager.cjs`.

- `kv-state` holds the app state: a log of `set` and `remove` writes, compacted with snapshots (`kv-core.cjs`). It has the `get/set/remove/list` API the renderer's storage adapter speaks.
- The saved-items catalog keeps its own cores in the same Corestore (`catalog-store.cjs`).

The renderer never touches the storage layer directly. `packages/core/src/store/academy-storage.ts` reads and writes through `window.academy.state`, exposed by `electron/preload.js` and backed by IPC handlers in `electron/main.js`.

On first launch with the corestore build, any legacy `state.json` is migrated into the `kv-state` core and deleted from disk.

## Deep links

`p2p-academy://` is registered as a protocol handler. The name is the `productName` in `package.json`, lowercased, with every character outside `a-z`, `0-9` and `-` replaced by `-`. `electron/main.js` accepts only `p2p-academy://pair` links, which carry a device pairing invite.
