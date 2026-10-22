# Desktop app conventions

This page lists the conventions the desktop app's code follows and the patterns to avoid. Tooling enforces some of them, and the rest depend on review. [Architecture](../architecture/ARCHITECTURE.md) describes the patterns these rules protect.

## Conventions

- Every IPC channel has a schema, and every `bare-rpc` command has a field check. A `null` in the IPC registry means the channel takes no payload, and a field a command's check does not name is an error. [Repository layout](../repository-layout.md#where-to-make-common-changes) lists the files to change for each.
- `apps/desktop/contract/ipc.json` lists every IPC channel with its payload schema, every channel the main process pushes to the page, and every error code. It is generated from the registries, the schemas, and the error code map, so commit the file `pnpm ipc:contract` writes in the same change as any of them. Do not edit it by hand.
- Every message kind two devices exchange has an entry in `SHAPES` in `workers/peer/peer-messages.cjs` that names each field it allows. Add the entry in the same change that adds the sender, because the receiver drops a kind with no entry.
- An error the page can act on is raised with `codedError()` from `shared/coded-error.cjs` and a code from `ERROR_CODES` in `packages/validation/src/errors.ts`. A coded error rejects in the page as a plain object, not an `Error`, so page code shows a caught error with `errorMessage()` from `packages/ui/src/lib/error-message.ts` and reads the code with `isAcademyError()`.
- The page reaches the file system, the network, and the worker only through `window.academy`, which `electron/preload.js` exposes.
- A comment states a constraint the code cannot show. Do not write a comment that restates the line next to it.
- A change comes with the test that proves it.
- A sandbox claim has a row in `tests/helpers/conformance.cjs`, so a test asserts it.

## Patterns to avoid

- Do not add a generic `invoke(method, args)` command on the IPC channel or the `bare-rpc` channel. One command per action keeps the callable set a fixed list.
- Do not branch on the runtime to choose a module, as in `isBare ? require('bare-fs') : require('fs')`. Use the import map in `apps/desktop/package.json`, where `require('fs')` resolves to `bare-fs` under Bare and to `fs` under Node.
- Do not require `electron` from `workers/`. The worker runs under Bare. Pass what it needs through its `INIT` command.
- Do not change the rule of one run in flight per paired device without a test for the new behavior. The `run-in-progress` refusal stops consent prompts from queueing up.
- Do not add a switch that skips the integration tests. They run offline on an in-process `hyperdht` testnet, so a failing one points at a real bug.
- Do not add a dependency that needs an install script without saying so in the pull request. The desktop test workflow installs with `--ignore-scripts`, and only `electron` is allowed to run one.
- Do not add a `V2` suffix to a name. Replace the old behavior, or give the new one a name that says what it does.
