# Changelog

Each release has a section here, drafted by `pnpm release` and edited in its release PR.
Versions before 0.2.20 were not tracked in this file; see the git history.

## [0.3.0] - 2026-10-12

Compatibility with QVAC SDK 0.21.0, seven new lessons and model downloads from the lesson toolbar ([#61](https://github.com/thisonedev/p2p-academy/pull/61)).

- Compatibility with `@qvac/sdk` 0.21.0: the dependency, the fit lessons, the tool lessons, the world walk lesson and the desktop app's memory fit checks are updated for it
- Seven new lessons: deferred tool loading, Parakeet Unified with Core ML, Parakeet Indic Conformer, MOSS streaming speech, RPC server, RPC inference and world layer streaming
- A download button in the lesson toolbar fetches the lesson's models through the Settings queue, with a percent ring while it runs and a check when they are on disk
- Toolbar icons replace the "heavy run" text badge and open a panel of label and value rows. Lessons whose models total more than 5 GB have a "large download" label
- Header: Learn and Play sit beside the logo, and the download button shows a progress ring with the percentage
- Run is refused while Settings downloads a model the lesson needs, and Settings downloads are refused during a lesson run
- Console download bar fixed for models stored in set folders and for lessons that never load their model. A `prefetchModels` lesson flag skips the fetch before a run
- Correct answers in lesson questions no longer sit on a predictable position
- Lessons check takes its baseline from the SDK dependency, suggests only code files as new lessons and lists demo app code as reference only. The sync check compares against the pinned SDK release tag
- Runner no longer fetches models a lesson only assesses, and the Node-only check counts a leftover `node:` import
- Home page hero without the Learn and Play pills
- X link points to p2pacademyhq ([#60](https://github.com/thisonedev/p2p-academy/pull/60))

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
