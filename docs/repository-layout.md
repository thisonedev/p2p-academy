# Repository layout

This page lists the apps and packages in this monorepo. Apps are under `apps/` and shared packages under `packages/`. None of them is published to npm.

| Path | Package | Description |
| :--- | :--- | :--- |
| `apps/web` | `@p2p-academy/web` | Next.js 15 and Fumadocs lesson site and workspace UI. Static export at `apps/web/out/` |
| `apps/desktop` | `@p2p-academy/desktop` | Electron 44 desktop shell with a Bare worker for the peer code |
| `apps/cli` | `@p2p-academy/cli` | The `p2p-academy` command: install, update, and start the desktop app |
| `packages/config` | `@academy/config` | Shared TypeScript and Biome base configs |
| `packages/constants` | `@academy/constants` | Public values more than one app needs. It is bundled into the web build, so it never holds a secret |
| `packages/core` | `@academy/core` | Zustand store and storage adapter |
| `packages/courses` | `@academy/courses` | Curriculum, lesson `.mdx` files, vendored examples, and the sync and verify scripts |
| `packages/sandbox-types` | `@academy/sandbox-types` | Shared TypeScript types for the OS sandbox |
| `packages/scorm` | `@academy/scorm` | Builds the Sharable Content Object Reference Model (SCORM) package (`pnpm generate-scorm`) |
| `packages/ui` | `@academy/ui` | React components for the web and desktop apps |
| `packages/validation` | `@academy/validation` | Zod schemas for lesson frontmatter, IPC payloads, and the `window.academy` contract |
| `packages/workflows` | `@academy/workflows` | Playground workflow presets and their sample data |

## Desktop app

Paths are relative to `apps/desktop`.

| Path | Role |
| :--- | :--- |
| `electron/main.js` | `BrowserWindow`, the IPC registry and `handle()` wrapper, app lifecycle, deep links |
| `electron/preload.js` | Exposes `window.academy` through `contextBridge` |
| `electron/window-trust.cjs` | Which pages may load, invoke IPC, or hold a browser permission |
| `electron/security-headers.cjs` | The Content Security Policy and the other response headers |
| `electron/state-store.cjs` | Key-value store on a Corestore, behind the `academy:state:*` channels |
| `electron/models.cjs` | Lists, sizes, and removes downloaded QVAC models under `~/.qvac/models/` |
| `electron/identity/manager.cjs` | Root and device identity: create, recover, attest, revoke, reset. Sealed at rest |
| `electron/secret-storage.cjs` | Seals short secrets with the OS keyring, or with a local key file when there is none |
| `electron/pear-end/index.cjs` | Main-process facade over identity, storage, and the peer worker |
| `electron/pear-end/worker-client.cjs` | Starts the Bare worker, sends it `bare-rpc` commands, and restarts it after a crash |
| `shared/ipc-channels.cjs` | One row per IPC channel, mapped to its schema name or `null` |
| `shared/rpc-commands.cjs` | Numeric command IDs for `bare-rpc` |
| `shared/secret-schemes.cjs` | Names for how the identity record is sealed, and the ones under which the app refuses remote runs |
| `shared/model-integrity.cjs` | Integrity record for the model cache |
| `shared/lesson-output.cjs` | The lesson folder, the run's working directory, and the path containment check |
| `workers/entry.cjs` | Worker-side `bare-rpc` command router, with a rate limit and a check per command |
| `workers/rpc-schema.cjs` | Field checks for every command the worker accepts |
| `workers/peer/index.cjs` | Pairing, mesh, identity handshake, and the remote run channel |
| `workers/peer/exec-host.cjs` | One remote run: validate, review, consent, sandbox, spawn |
| `workers/peer/peer-messages.cjs` | Reads every frame from another device: the size caps, the allowed fields of each message kind, and the profile fields kept from a pairing request |
| `workers/peer/identity-handshake.cjs` | Device identity proof and signature exchange |
| `workers/peer/verification.cjs` | Verification state and revoked devices |
| `workers/peer/audit-store.cjs` | Append-only audit trail on disk |
| `workers/peer/rate-limit.cjs` | Sliding-window limits for the peer paths |
| `workers/sandbox/index.cjs` | `wrapSpawn`, the entry point that wraps a child in the platform sandbox |
| `workers/sandbox/capabilities.cjs` | What a run may reach, declared as data |
| `workers/sandbox/sandbox-mac.cjs` | `sandbox-exec` profile generation |
| `workers/sandbox/sandbox-linux.cjs` | `bwrap` arguments, with the filter from `seccomp-filter.cjs` |
| `workers/sandbox/sandbox-windows.cjs` | Refuses remote runs |
| `workers/sandbox/course-allowlist.json` | The allowlist included with the app, merged into the sandbox capability. It also lists each MCP package a remote run may use, with its exact version and tarball integrity |
| `runner.cjs` | Runs a lesson on this device as a normal process |
| `tests/unit/` | Fast tests with no network and no spawned processes |
| `tests/integration/` | Tests on a real `hyperdht` testnet with real spawned processes |
| `tests/helpers/` | Shared fixtures and the sandbox conformance table |
| `scripts/run-tests.mjs` | Runs each test file in its own process |
| `scripts/soak.mjs` | Holds one pairing open and runs repeated remote runs |

## Where to make common changes

| Task | Start with |
| :--- | :--- |
| Add an IPC channel | `shared/ipc-channels.cjs`, then the schema in `packages/validation/src/ipc.ts`, then `handle()` in `electron/main.js`, then `electron/preload.js` |
| Add a `bare-rpc` command | `shared/rpc-commands.cjs`, then `workers/rpc-schema.cjs`, then `workers/entry.cjs`, then the handler in `workers/peer/index.cjs` |
| Add a message between two devices | `SHAPES` in `workers/peer/peer-messages.cjs`, then the sender and the handler in `workers/peer/index.cjs` |
| Add a sandbox grant | `workers/sandbox/capabilities.cjs`, then a row in `tests/helpers/conformance.cjs` |
| Add a refusal reason for a remote run | `PEER_ERROR_TEXT` in `workers/peer/exec-host.cjs` |
| Add a lesson frontmatter field | `packages/validation/src/frontmatter.ts` |
| Change a state value's size cap | `MAX_STATE_VALUE_BYTES` and `stateSetSchema` in `packages/validation/src/ipc.ts` |
| Change the state store | `electron/state-store.cjs` and `tests/unit/state-store.cjs` |
| Change remote runs | `workers/peer/exec-host.cjs` and `tests/integration/exec-*.cjs` |
| Add or change a lesson | `packages/courses/`, with the lesson checks in the root [`README.md`](../README.md) |
| Add a shared UI component | [`packages/ui/AGENTS.md`](../packages/ui/AGENTS.md) |
