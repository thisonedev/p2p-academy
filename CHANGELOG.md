# Changelog

Each release has a section here, drafted by `pnpm release` and edited in its release PR.
Versions before 0.2.20 were not tracked in this file; see the git history.

## [0.2.21] - 2026-10-11

Design studio removal ([#58](https://github.com/thisonedev/p2p-academy/pull/58)) and desktop hardening ([#57](https://github.com/thisonedev/p2p-academy/pull/57)).

- Design studio removed from the app, along with the playground's Create design node and "Design Studio" preset. It is now a separate app, Slaps Studio
- Saved items and the playground library list workflows only. Designs and brand kits saved earlier stay on disk but are no longer shown
- Home page shows two products, Learn and Play
- IPC handlers refuse a caller that is not the top frame of an app page, and permission handlers deny everything except clipboard and file dialogs
- With no static build, the window shows a "run pnpm build" page instead of loading `http://localhost:4712`
- Identity recovery refuses to replace a ready identity, and usernames are checked at the IPC boundary
- No EPIPE crash when `p2p-academy start` is stopped with Ctrl+C ([#56](https://github.com/thisonedev/p2p-academy/pull/56))
- License exceptions for sharp's libvips packages, `duck`, `lru-cache` and `sax` ([#55](https://github.com/thisonedev/p2p-academy/pull/55))
- `actions/setup-node`, `pnpm/action-setup` and `actions/cache` updated in the setup action ([#54](https://github.com/thisonedev/p2p-academy/pull/54))

## [0.2.20] - 2026-10-09

Supply chain and CI hardening ([#51](https://github.com/thisonedev/p2p-academy/pull/51)).

- Tether's security baseline (TruffleHog, CodeQL) and license compliance checks from tetherto/qvac-actions
- zizmor workflow-security check that fails on any finding
- Every GitHub Action pinned to a commit SHA, scoped workflow permissions, checkouts no longer keep credentials
- NOTICE files generated from pnpm-lock.yaml, with a CI check that fails when they go stale
- CLI installs use the frozen lockfile, and only electron may run install scripts
- install.ps1 checks git, Node and ffmpeg downloads against their published SHA-256
- Both installers pin pnpm to package.json packageManager, checked in CI
- Repo and branch overrides in the installers and CLI need P2P_ACADEMY_DEV=1
- Dependabot for GitHub Actions
