# Testing

This page covers how the P2P Academy test suites are organized, how to run them, and which layer a new test belongs in. The desktop tests use [brittle](https://github.com/holepunchto/brittle), and each test file runs in its own process.

## Suite map

| Layer | Path or command | What it covers |
| :--- | :--- | :--- |
| Unit | `apps/desktop/tests/unit/` | Fast tests with no network and no spawned processes. CI runs them on every pull request |
| Desktop types | `pnpm --filter @p2p-academy/desktop typecheck` | Runs `tsc` with `checkJs` over the JavaScript in `electron/`, `shared/`, `workers/`, and `runner.cjs`, and in strict mode over `electron/preload.js`, so an argument that a shared package's types reject fails the check. `pnpm test:unit` runs it first |
| Integration | `apps/desktop/tests/integration/` | A real `hyperdht` testnet and real spawned processes. CI runs them nightly and on manual dispatch, on Linux and macOS |
| Helpers | `apps/desktop/tests/helpers/` | Fixtures with ordered teardown, and the sandbox conformance table |
| Lessons | `pnpm verify:tests` | Runs each lesson's frontmatter `tests:` against its vendored example |
| Lesson frontmatter | `pnpm check:yaml` | Checks every lesson's YAML frontmatter against the Zod schema |
| Lesson examples | `pnpm check:examples` | Fails when a `.ts` file in `packages/courses/examples/` does not parse. It checks syntax only. CI runs it on every pull request |
| Sync | `pnpm sync:examples` | Reports API differences between the vendored examples and the upstream SDK |
| CLI | `pnpm --filter @p2p-academy/cli test` | The release tag check, with throwaway keys made for each run. CI runs it on every pull request on Linux, macOS, and Windows |
| IPC contract | `pnpm ipc:contract:check` | Fails when `apps/desktop/contract/ipc.json` does not match the IPC registries, the schemas, and the error code map. The desktop unit tests run the same check |
| API baselines | `pnpm api:check` | Fails when a name in the `exports` map of `@academy/constants`, `@academy/core`, `@academy/validation`, or `@academy/ui` is removed, added, or changes kind. It reads the built types, so run `pnpm build:packages` first |
| Constants | `pnpm check:constants` | Compares the links in the CLI, the install scripts, and the root README with `@academy/constants` |
| Colors | `pnpm check:colors` | Fails on a raw color in UI code |
| Unused code | `pnpm knip` | Fails on an unused file, export, or dependency in the workspace. `knip.jsonc` lists the entry files and what it skips, with the reason for each. CI does not run it |

## Commands

```bash
cd apps/desktop
pnpm test:unit           # typecheck, then every file in tests/unit
pnpm test:integration    # every file in tests/integration
node scripts/run-tests.mjs tests/integration --filter sandbox
node scripts/soak.mjs    # one pairing held open, with repeated remote runs
```

`scripts/run-tests.mjs` prints the slowest files at the end of a run. `--filter <substring>` keeps the files whose path contains the substring.

## Why one process per file

`brittle` can take several files at once, but sharing one process across every file made results depend on file order. The integration tests start DHT testnets and Bare worker processes, and one file timed out only when many tests had run ahead of it. A process per file removes that coupling. The header of `scripts/run-tests.mjs` records the reason.

## Teardown order

Each factory in `tests/helpers/index.cjs` takes brittle's `t` and registers its own teardown, so a failing assertion cannot leave a testnet, a store, or a temp directory behind. Do not close these by hand. Teardown runs in this order:

1. Peers.
2. Stores.
3. Testnet.
4. Temp directories.

Closing a peer or a store is raced against a 2 second timeout. When the timeout wins, the helper logs a warning and the suite continues.

## Test helpers

`tests/helpers/index.cjs` exports:

| Export | Purpose |
| :--- | :--- |
| `createTestnetFor(t)` | Starts an in-process `hyperdht` testnet |
| `createStoreFor(t, label)` | Opens a Corestore in a fresh temp directory |
| `createPeers(t, n, opts)` | Creates `n` in-process peers on a shared testnet |
| `createWorkerPeers(t, n, opts)` | Creates `n` peers that each start a real Bare worker and talk over `bare-rpc` |
| `attestedIdentity()` | A device key with the `keet-identity-key` proof that binds it to a new root identity |
| `fakeDeviceIdentity()` | A minimal identity for tests that need no identity manager |
| `pairPeers(host, guest, opts)` | Pairs two peers |
| `pairForExec(t, label)` | Creates and pairs two peers, then waits for the remote run channel |
| `waitForExecChannel(peer, key)` | Waits until the remote run channel is ready |
| `runExec(peer, opts)` | Collects one remote run's output and exit status |
| `waitFor(emitter, event, pred)` | Waits for one event from the peer module |
| `freshRequire(path)` | Requires a module after clearing it from the require cache |
| `tmpDir(t, label)` | Creates a temp directory and removes it at teardown |
| `bareRequires(...)` and `bareImports(...)` | Build the `require` or `import` lines for a code snippet that runs under Bare |

## Which layer to use

| Concern | Layer | Notes |
| :--- | :--- | :--- |
| Pure logic, validation, encoding | Unit | Run the function with no I/O |
| IPC channel registration | Unit | `tests/unit/ipc-contract.cjs` reads `main.js` and `preload.js` as text and compares them with the registry, and checks `contract/ipc.json` against a freshly generated copy |
| Error codes | Unit | `tests/unit/error-codes.cjs` checks that each code raised in the desktop source is in the map, and that each mapped code is raised |
| New worker command | Unit and integration | The field check in `workers/rpc-schema.cjs` first, then a real request through the worker |
| Sandbox behavior | Integration | Add a row to `tests/helpers/conformance.cjs`. `sandbox-conformance.cjs` asserts it against a real kernel |
| Pairing state | Integration | The `tests/integration/pairing-*.cjs` files |
| Consent for a device or the network | Integration | `exec-device-consent.cjs` and `exec-network-consent.cjs` |
| Always ask before running | Integration | `exec-ask-every-run.cjs` |
| Stopping another device's run from the host | Integration | `exec-host-stop.cjs` |
| A lesson against its vendored example | Lessons | Add to the lesson's `tests:` frontmatter and run `pnpm verify:tests` |

## Manual checks

No automated test covers these.

| Check | How |
| :--- | :--- |
| Pair two devices and run a lesson | `apps/desktop/scripts/peer-test-pair.sh` starts two instances side by side |
| The page origin | In DevTools, `window.location.origin` is the `academy://app` origin |
| The lesson workspace at narrow widths | Start the app with `pnpm start:desktop` and resize the window |
