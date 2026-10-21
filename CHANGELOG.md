# Changelog

Each release has a section here, drafted by `pnpm release` and edited in its release PR.
Versions before 0.2.20 were not tracked in this file; see the git history.

## [0.5.0] - 2026-10-21

Lessons target `@qvac/sdk` 0.22.0. Eleven new lessons ([#76](https://github.com/thisonedev/p2p-academy/pull/76)), and the CLI on Windows handles install paths with spaces ([#74](https://github.com/thisonedev/p2p-academy/pull/74)).

Update with `p2p-academy update`.

### New lessons

- Answer typed questions about a support ticket with Laya
- Run several prompts in one batch on a single model
- Split a completion model across two GPUs
- Share one model's decode loop across several completions
- Generate a sound effect with MOSS-SoundEffect
- Keep unwanted sounds out of a MOSS-SoundEffect clip
- Answer a typed question in text with MOSS-Speech
- Switch Whisper's language with a config reload
- Transcribe audio with speaker labels using MOSS
- Check MOSS transcription memory before downloading the model
- Diarize up to eight speakers with Nemotron 3

### Updated lessons

- Check whether a model fits before downloading it
- Read the SDK's own memory fit check from the log stream
- Generate image with FLUX.2-klein split layout
- Fire two completions, then await both
- Call tools with automatic dialect detection
- Run a GR00T action inference across embodiments
- Run a pi05 action inference
- Run a SmolVLA action inference

### Fixes

- On Windows, the CLI runs `git` directly instead of through `cmd.exe`, which split paths with spaces and dropped the `^` from revisions like `HEAD^{commit}`.
- Bare 1.35 drops stdout and stderr writes still pending at exit, so `process.exit()` in a Bare run now waits up to 250 ms for both streams to flush.
- Settings no longer shows installed Parakeet Core ML models as missing.

### Models

- Added: `LAYA_MULTILINGUAL_322M_Q8_0`, `MOSS_TRANSCRIBE_DIARIZE_Q8_0`, `PARAKEET_NEMOTRON_3_DIARIZATION_Q8_0`, `TTS_MOSS_SPEECH_Q8_0`, `TTS_CODEC_MOSS_SPEECH_F16`, `AUDIOGEN_MOSS_SFX_V2_Q8_0`, `QWEN3_5_0_8B_MULTIMODAL_Q8_0`

### Tooling

- The lessons-check report sorts new upstream examples into update, blocked, and new groups.
- `pnpm release` drafts release notes in the format `RELEASING.md` describes. The 0.2.20 to 0.4.0 sections of this file now use that format too.
- Pull request templates: a default one and `ci.md` for changes under `.github/`.
- `RELEASING.md` covers registering a release key on GitHub as a Signing Key and the Homebrew `ssh-keygen` setup on macOS. `CONTRIBUTING.md` lists the `cli` jobs on Linux, macOS, and Windows as required checks.
- `actions/setup-node` 7.1.0 in the setup action ([#75](https://github.com/thisonedev/p2p-academy/pull/75)).

## [0.4.0] - 2026-10-14

Lessons target `@qvac/sdk` 0.21.0. Signed releases ([#72](https://github.com/thisonedev/p2p-academy/pull/72)), QVAC SDK lessons on paired devices ([#67](https://github.com/thisonedev/p2p-academy/pull/67)), Electron 44 ([#68](https://github.com/thisonedev/p2p-academy/pull/68)) and maintainer docs ([#65](https://github.com/thisonedev/p2p-academy/pull/65)).

Update with `p2p-academy update`.

### Breaking changes

- `p2p-academy install` and `update` on the `stable` channel build only a release tag signed with the maintainer's security key, and refuse a version older than the installed one. The `latest` channel builds `master`, which has no signature to check.
- Electron 44.7.2, which drops macOS 12, 32-bit Windows and 32-bit ARM Linux. On macOS, the first start after an Electron update asks once for keychain access to "P2P Academy Safe Storage", and `p2p-academy update` prints a note when an update changes the Electron version.
- Spreadsheet import reads `.xlsx` and `.csv`, and legacy `.xls` import is dropped. PDF export uses `jspdf` 4.
- On Linux, the host refuses remote runs when the profile keys use the `basic_text` backend, and Settings > Profile shows a note about it ([#64](https://github.com/thisonedev/p2p-academy/pull/64)).

### App

- A lesson that imports `@qvac/sdk` runs on a paired device, on the Node runtime.
- For a remote run, the host builds the lesson source the paired device sent and refuses the run when the result differs from the code sent with it. The code review and the consent prompt show that source only after it matches.
- MCP server packages in the allowlist have an exact version and an integrity value, and the host installs them with lifecycle scripts off.
- Every peer message has a size cap and a fixed field list for its kind. The host caps pairing data from a guest and no longer stores or logs the pairing code.
- The AI bot's chat model loads on first use. With nothing loaded, chat, answer check, security scan and the playground preload use the model set for the AI bot instead of the largest installed one ([#63](https://github.com/thisonedev/p2p-academy/pull/63)).
- The lesson pager stays on one row and scrolls to keep the current lesson in view.

### Fixes

- Revealing and reading saved lesson files resolves symlinks before checking that a path is inside the lesson folder.
- Code scanning fixes: saved files and the docs cache are read through one file handle, the remote run log is created owner-only, the Linux seccomp filter file gets a random name, slow regexes are rewritten, and unused code is removed, including the unshipped workflow generator ([#69](https://github.com/thisonedev/p2p-academy/pull/69), [#70](https://github.com/thisonedev/p2p-academy/pull/70), [#71](https://github.com/thisonedev/p2p-academy/pull/71)).

### Tooling

- The maintainer signs each release tag. CI publishes the GitHub Release only for a pushed tag that passes the same check.
- Dependencies with open advisories are updated, and the `unit` check fails on a high or critical advisory in a production dependency.
- New `SECURITY.md`, `CONTRIBUTING.md` and `RELEASING.md`, architecture and trust boundary pages, configuration, testing and repository layout docs, and `pnpm docs:lint`.

## [0.3.0] - 2026-10-12

Lessons target `@qvac/sdk` 0.21.0. Seven new lessons, and lesson models download from the lesson toolbar ([#61](https://github.com/thisonedev/p2p-academy/pull/61)).

Update with `p2p-academy update`.

### New lessons

- Deferred tool loading
- Parakeet Unified with Core ML
- Parakeet Indic Conformer
- MOSS streaming speech
- RPC server
- RPC inference
- World layer streaming

### Updated lessons

The fit lessons, the tool lessons and the world walk lesson are updated for `@qvac/sdk` 0.21.0.

### App

- A download button in the lesson toolbar fetches the lesson's models through the Settings queue, with a percent ring while it runs and a check when they are on disk.
- Toolbar icons replace the "heavy run" text badge and open a panel of label and value rows. Lessons whose models total more than 5 GB have a "large download" label.
- Run is refused while Settings downloads a model the lesson needs, and Settings downloads are refused during a lesson run.
- The desktop app's memory fit checks are updated for `@qvac/sdk` 0.21.0.
- Header: Learn and Play sit beside the logo, and the download button shows a progress ring with the percentage.
- The home page hero drops the Learn and Play pills, and the X link points to p2pacademyhq ([#60](https://github.com/thisonedev/p2p-academy/pull/60)).

### Fixes

- The console download bar works for models stored in set folders and for lessons that never load their model. A `prefetchModels` lesson flag skips the fetch before a run.
- Correct answers in lesson questions no longer sit on a predictable position.
- The runner no longer fetches models a lesson only assesses, and the Node-only check counts a leftover `node:` import.

### Tooling

- The lessons check takes its baseline from the SDK dependency, suggests only code files as new lessons and lists demo app code as reference only. The sync check compares against the pinned SDK release tag.

## [0.2.21] - 2026-10-11

Lessons target `@qvac/sdk` 0.20.1. Design studio removal ([#58](https://github.com/thisonedev/p2p-academy/pull/58)) and desktop hardening ([#57](https://github.com/thisonedev/p2p-academy/pull/57)).

Update with `p2p-academy update`.

### Breaking changes

- Design studio removed from the app, along with the playground's Create design node and "Design Studio" preset. It is now a separate app, Slaps Studio.
- Saved items and the playground library list workflows only. Designs and brand kits saved earlier stay on disk but are no longer shown.

### App

- Home page shows two products, Learn and Play.
- IPC handlers refuse a caller that is not the top frame of an app page, and permission handlers deny everything except clipboard and file dialogs.
- With no static build, the window shows a "run pnpm build" page instead of loading `http://localhost:4712`.
- Identity recovery refuses to replace a ready identity, and usernames are checked at the IPC boundary.

### Fixes

- No EPIPE crash when `p2p-academy start` is stopped with Ctrl+C ([#56](https://github.com/thisonedev/p2p-academy/pull/56)).

### Tooling

- License exceptions for sharp's libvips packages, `duck`, `lru-cache` and `sax` ([#55](https://github.com/thisonedev/p2p-academy/pull/55)).
- `actions/setup-node`, `pnpm/action-setup` and `actions/cache` updated in the setup action ([#54](https://github.com/thisonedev/p2p-academy/pull/54)).

## [0.2.20] - 2026-10-09

Lessons target `@qvac/sdk` 0.20.1. Supply chain and CI hardening ([#51](https://github.com/thisonedev/p2p-academy/pull/51)).

Update with `p2p-academy update`.

### Breaking changes

- Repo and branch overrides in the installers and CLI need `P2P_ACADEMY_DEV=1`.

### App

- CLI installs use the frozen lockfile, and only electron may run install scripts.
- `install.ps1` checks git, Node and ffmpeg downloads against their published SHA-256.
- Both installers pin pnpm to `package.json` `packageManager`, checked in CI.

### Tooling

- Tether's security baseline (TruffleHog, CodeQL) and license compliance checks from tetherto/qvac-actions.
- zizmor workflow-security check that fails on any finding.
- Every GitHub Action pinned to a commit SHA, scoped workflow permissions, checkouts no longer keep credentials.
- NOTICE files generated from `pnpm-lock.yaml`, with a CI check that fails when they go stale.
- Dependabot for GitHub Actions.
