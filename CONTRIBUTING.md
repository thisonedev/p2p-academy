# Contributing

This document covers how to contribute to P2P Academy: setting up, the checks a pull request has to pass, and the rules for dependencies, versions, lessons, and docs.

## Security

If you find a security vulnerability, do not report it in a public issue, pull request, or commit message. Follow the private reporting steps in [`SECURITY.md`](SECURITY.md).

## Getting started

The [README](README.md#getting-started) has the Node.js and pnpm versions, the install command, and how to run the web and desktop apps. [Repository layout](docs/repository-layout.md) lists the apps and packages, and [Architecture](docs/architecture/ARCHITECTURE.md) describes how the desktop app works.

## Pull requests

Open pull requests against `master`. These checks have to pass before a pull request can merge:

| Check | Workflow | Run it locally |
| :--- | :--- | :--- |
| `check` | Version check | `node scripts/version-check.mjs` |
| `unit` | Desktop tests | `pnpm --filter @p2p-academy/desktop test:unit` |
| `verify` | Verify lessons | `pnpm verify:tests:check` and `pnpm sync:examples` |
| `notice` | NOTICE drift | `pnpm notice:check` |
| `license` | License compliance | Runs in CI only |
| CodeQL and TruffleHog | Security baseline | Runs in CI only |

[Testing](docs/testing.md) describes the test suites and which layer a new test belongs in. Do not delete, skip, or weaken a test to make a check pass.

## Dependency changes

- Regenerate `pnpm-lock.yaml` in the same commit as any `package.json` dependency change. Never edit it by hand. CI installs with a frozen lockfile.
- Run `pnpm notice` after the lockfile changes, and commit the updated `NOTICE` files. The NOTICE drift check fails when they no longer match the lockfile.
- The `unit` check runs `pnpm audit --prod --audit-level=high` and fails on a high or critical advisory in a production dependency. Run it locally before you push a dependency change.
- The license check reads [`.github/license-allowlist.yml`](.github/license-allowlist.yml). A dependency under a license that is not allowed needs an entry there with a reason.
- Say so in the pull request when a new dependency needs an install script. Only `electron` is allowed to run one.

## Versions and the changelog

Only a `release/vX.Y.Z` branch may change the version, and it has to add a `CHANGELOG.md` section. [`RELEASING.md`](RELEASING.md) has the checklist. Any other pull request leaves the version and `CHANGELOG.md` alone.

## Lessons

The README covers the lesson checks: [verifying lessons](README.md#verifying-lessons), the [frontmatter check](README.md#lesson-frontmatter-check), and [keeping lessons in sync with the upstream SDK](README.md#keeping-lessons-in-sync-with-the-upstream-sdk). A lesson describes only what the `@qvac/sdk` version this repository depends on has.

## Docs

- Each topic has one owner doc. Add a fact to its owner and link to it from elsewhere.
- When a change makes a statement in a doc untrue or incomplete, update the doc in the same pull request.
- Run `pnpm docs:lint <file>` on every Markdown file you add or change outside the lessons. The [README](README.md#docs-lint) explains it.
- Write one line per paragraph and per list item. Do not hard-wrap prose at a fixed width.
- End every list item with a period.

## Code conventions

- Desktop app: [Desktop conventions](docs/conventions/desktop-conventions.md).
- UI: [`packages/ui/AGENTS.md`](packages/ui/AGENTS.md).
- AI coding assistants: [`AGENTS.md`](AGENTS.md).
