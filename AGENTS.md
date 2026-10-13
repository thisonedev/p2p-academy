# Repository agent guide

Keep this file short. It defines stable agent behavior and points to the repository's own sources.

## Sources of truth

- Start with [`README.md`](README.md) for the product overview, the workspace layout, and the lint, lesson, and sync commands.
- Use [`apps/desktop/README.md`](apps/desktop/README.md) for the desktop app's process layout, tests, and storage.
- Use [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) for the processes and patterns, and [`docs/architecture/SECURITY-BOUNDARIES.md`](docs/architecture/SECURITY-BOUNDARIES.md) for the trust boundaries and what enforces each one.
- Use [`docs/repository-layout.md`](docs/repository-layout.md) to find a file, [`docs/testing.md`](docs/testing.md) for the test suites, [`docs/configuration.md`](docs/configuration.md) for flags, environment variables, and limits, and [`docs/conventions/desktop-conventions.md`](docs/conventions/desktop-conventions.md) for the desktop code conventions.
- Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) for pull requests, [`RELEASING.md`](RELEASING.md) for releases, and [`SECURITY.md`](SECURITY.md) for vulnerability reports.
- Use the affected package's manifest and scripts for package commands.
- Follow the nearest scoped `AGENTS.md` when one exists, such as [`packages/ui/AGENTS.md`](packages/ui/AGENTS.md).

Do not copy commands, versions, package lists, workflow details, or other volatile facts into agent instructions. Link to the file that owns them.

## Working agreement

- User instructions take precedence, followed by the nearest scoped instructions and the current repository sources. Verify current behavior in the code instead of trusting an older note.
- Leave uncommitted changes you did not make as they are.
- Diagnose a reported failure from runtime evidence before editing. Add a test for the confirmed failure.
- Run the narrowest relevant lint, type, and unit checks before handoff. Report any check you could not run.
- Do not delete, skip, or weaken a test to make a check pass. Fix the confirmed failure or report the blocker.
- Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) for the checks to run, dependency changes, the version rule, and docs.
- Do not commit, push, open pull requests, or change remote systems unless the user asks.

## Security rules

- Register a new IPC channel through the `handle()` wrapper in `main.js`, never with `ipcMain.handle` directly. [Desktop conventions](docs/conventions/desktop-conventions.md) has the full rule.
- A change that adds a trust boundary, or changes how an existing one is enforced, updates `docs/architecture/SECURITY-BOUNDARIES.md` in the same pull request.
- Do not describe an unfixed security weakness in public docs, issues, pull requests, or commit messages. Report it privately, as [`SECURITY.md`](SECURITY.md) describes.
- Code from a paired device runs only inside the OS sandbox. Do not add a path that runs it unconfined.
- Never describe an SDK function, option, or behavior in a lesson that the `@qvac/sdk` version this repository depends on does not have.

## Maintaining the repository

- Rewrite documentation in place. Replace obsolete prose instead of appending corrections or a second version. `CHANGELOG.md` is the exception.
- Write one line per paragraph and per list item in Markdown. Do not hard-wrap prose at a fixed width.
- Prefer improving an existing document over creating another source of truth.
- Never commit secrets, private infrastructure details, or private links.
- Keep changes scoped to the task, and use each package's own dependency and test tooling.
