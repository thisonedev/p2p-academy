# Configuration

This page lists the settings of the P2P Academy desktop app and CLI: command-line flags, environment variables, and the limits fixed in source. Most limits are constants on purpose, so a security control cannot change through the environment.

## Command-line flags

| Flag | Effect |
| :--- | :--- |
| `--storage <dir>` | Use `<dir>` as the app's data directory in place of the default |
| `--dev` | Development mode. `PEAR_DEV_URL`, DevTools, and Electron's security warnings depend on it |

`p2p-academy update --channel stable` and `--channel latest` choose what the CLI builds: the newest signed release tag, or `master` with no signature check. The choice is saved in `~/.p2p-academy/channel`.

## Environment variables

The desktop main process reads every variable through [`shared/env.cjs`](../apps/desktop/shared/env.cjs).

| Name | Effect |
| :--- | :--- |
| `PEAR_DEV_URL` | With `--dev` only: load the page from this server. It has to be an `http://localhost` address |
| `PEAR_DEV_SERVER_URL` or `NODE_ENV=development` | With `--dev` only: open DevTools |
| `MIC_DEVICE` | Overrides the default microphone device |
| `ACADEMY_NO_DIRECT_FETCH=1` | For tests: never download a model |
| `ACADEMY_CHAT_FETCH_DOCS=0` | Stops the AI bot from fetching the SDK docs |
| `XDG_CONFIG_HOME` | On Linux, the base of the app's state directory. The default is `~/.config` |
| `XDG_CURRENT_DESKTOP` | On Linux, when it is unset the app selects the `gnome-libsecret` keyring backend |
| `APPIMAGE` | Set by the AppImage runtime to the image's own path |

When `QVAC_CONFIG_PATH` is not set, the app points it at its own SDK config file.

The CLI reads:

| Name | Effect |
| :--- | :--- |
| `P2P_ACADEMY_HOME` | The install directory. The default is `~/.p2p-academy` |
| `P2P_ACADEMY_DEV=1` | Allows the two overrides in the next rows |
| `P2P_ACADEMY_REPO` | Clone from this repository |
| `P2P_ACADEMY_BRANCH` | Build this branch, with no release signature check |

## Limits fixed in source

| Limit | Value | Where |
| :--- | :--- | :--- |
| Remote run with no output | Cancelled after 10 minutes | `PEER_EXEC_IDLE_MS` in `electron/main.js` |
| Collected output of a remote run | 1 MiB per stream. The start and the end are kept | `electron/run-accumulator.cjs` |
| Source of one run | 1,000,000 bytes | `MAX_EXEC_SOURCE_BYTES` in `packages/validation/src/ipc.ts` |
| One frame from another device | 4 MiB. A pairing wake or cancel frame is at most 64 bytes, a pairing response 1024 bytes, a profile frame 4096 bytes, and an identity frame 8192 bytes | `MAX_FRAME_BYTES` and `MAX_FRAME_BYTES_BY_KIND` in `workers/peer/peer-messages.cjs` |
| Arguments of one run | 32 entries of at most 4096 characters | `workers/peer/exec-validate.cjs` |
| One stored state value | 1,000,000 bytes | `MAX_STATE_VALUE_BYTES` in `packages/validation/src/ipc.ts` |
| Pairing code on the clipboard | Cleared after 90 seconds | `CLIPBOARD_SCRUB_MS` in `packages/validation/src/ipc.ts` |
| Consent prompt | Refused after 2 minutes with no answer | `DEVICE_CONSENT_TIMEOUT_MS` in `workers/peer/exec-host.cjs` |
| Identity check before a remote run | 10 seconds | `IDENTITY_WAIT_MS` in `workers/peer/exec-host.cjs` |
| Pairing code | 6 characters | `workers/peer/pairing-code.cjs` |
| Invite with no paired device | Closed after 30 minutes, along with its pending request. A device joining an invite also gives up after 30 minutes | `PAIRING_TIMEOUT_MS` in `workers/peer/index.cjs` |
| Wrong pairing codes per invite | 5, then the invite is invalid. 500 ms backoff between attempts | `workers/peer/pairing-attempt-gate.cjs` |
| Audit file | 4 MiB, three generations, 30 days | `workers/peer/audit-store.cjs` |
| Peer worker restart | 1 second after a crash, doubled for each restart in the last 60 seconds. A fourth crash in 60 seconds is not restarted | `RESTART_BASE_MS`, `MAX_RESTARTS`, and `RESTART_WINDOW_MS` in `electron/pear-end/worker-client.cjs` |

Rate limits are in [`rate-limit.cjs`](../apps/desktop/workers/peer/rate-limit.cjs), each over a 60 second window:

| Operation | Limit | Scope |
| :--- | :--- | :--- |
| Remote run requests | 10 | Per paired device |
| Pairing attempts | 60 | All invites together |
| Identity frames | 60 | Per paired device |
| Profile frames | 60 | Per paired device |
| Pairing wake frames | 10 | Per invite being joined |
| Worker commands | 600 | All commands together |

## Files

| File | Purpose |
| :--- | :--- |
| `~/.qvac/models/` | The QVAC model cache: single files, `sharded/<key>/`, and `sets/<key>/` |
| `workers/sandbox/course-allowlist.json` | The sandbox allowlist included with the app |
| `policy/sandbox-allowlist.json` in the app's state directory | A user's own additions to the sandbox allowlist |
| `peer-audit.jsonl` in the app's state directory | The audit trail of pairing and remote runs |
| `~/.p2p-academy/channel` | The CLI's saved release channel |

## What is not configurable

- The IPC registry. To add a channel, add a row in `shared/ipc-channels.cjs` and a schema in `@academy/validation`.
- The rate limits.
- One run in flight per paired device.
- The sandbox for each platform. Each platform has one implementation, chosen in `workers/sandbox/index.cjs`.
