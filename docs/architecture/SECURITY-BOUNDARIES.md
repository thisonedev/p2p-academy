# Security boundaries

This page describes each trust boundary in the P2P Academy desktop app and what enforces it. [Architecture](ARCHITECTURE.md) describes the processes these boundaries sit between, and [`SECURITY.md`](../../SECURITY.md) says how to report a vulnerability.

## Overview

The desktop app has six trust boundaries. The [security model](ARCHITECTURE.md#security-model) table lists them, and each section on this page covers one. Paths in the tables are relative to `apps/desktop`.

## Renderer to main process

The page reaches the main process only through `window.academy`, where each method invokes one fixed channel name.

| Control | What it does | Code |
| :--- | :--- | :--- |
| Renderer sandbox | The window is created with `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false` | [`electron/main.js`](../../apps/desktop/electron/main.js) |
| Bridge | `contextBridge` exposes `window.academy` and nothing else | [`electron/preload.js`](../../apps/desktop/electron/preload.js) |
| Channel registry | Every channel is registered through one `handle()` wrapper. Registering a channel the registry does not list throws `Error: unregistered IPC channel: <channel>`, so the app does not start | [`shared/ipc-channels.cjs`](../../apps/desktop/shared/ipc-channels.cjs) |
| Payload schema | The payload is parsed against the Zod schema the registry names for the channel | [`packages/validation`](../../packages/validation/src/ipc.ts) |
| Sender check | An invocation is refused unless the top frame of a page on an app origin sends it. The origin list is empty until the window is opened | [`electron/window-trust.cjs`](../../apps/desktop/electron/window-trust.cjs) |
| Navigation | A navigation to any other origin is cancelled, and an `http` or `https` link opens in the OS browser. `window.open` is always denied | [`electron/main.js`](../../apps/desktop/electron/main.js) |
| Permissions | Permission requests are denied except clipboard read, clipboard write, and the file dialogs, and only for app origins | [`electron/window-trust.cjs`](../../apps/desktop/electron/window-trust.cjs) |
| Content Security Policy | One source for the policy. The `academy://` protocol handler sends it as a header | [`electron/security-headers.cjs`](../../apps/desktop/electron/security-headers.cjs) |
| Lesson file paths | `academy:reveal` and `academy:read-saved` resolve symlinks and refuse a path outside the lesson folder | [`shared/lesson-output.cjs`](../../apps/desktop/shared/lesson-output.cjs) |
| Pairing deep links | `parsePairUrl` refuses a link longer than 4096 characters, and a link with raw or percent-encoded control characters in its query | [`electron/main.js`](../../apps/desktop/electron/main.js) |

Three unit tests cover this boundary:

- [`ipc-contract.cjs`](../../apps/desktop/tests/unit/ipc-contract.cjs) fails when a handler, a `preload.js` method, and the registry disagree.
- [`csp.cjs`](../../apps/desktop/tests/unit/csp.cjs) checks the `<meta>` copy of the policy in the web layout against the source.
- [`parse-pair-url.cjs`](../../apps/desktop/tests/unit/parse-pair-url.cjs) covers the deep link checks.

## Main process to peer worker

Pairing, the mesh, and remote code execution run in a Bare worker process, apart from the main process.

| Control | What it does | Code |
| :--- | :--- | :--- |
| Separate process | The main process starts the worker through `pear-runtime` | [`electron/pear-end/worker-client.cjs`](../../apps/desktop/electron/pear-end/worker-client.cjs) |
| One command per action | The two exchange `bare-rpc` commands, one command ID per action. The worker has no generic "invoke this method" command | [`shared/rpc-commands.cjs`](../../apps/desktop/shared/rpc-commands.cjs) |
| Field checks | The worker checks the fields of every command before it runs it. Those checks are written separately from the Zod schemas the main process uses | [`workers/rpc-schema.cjs`](../../apps/desktop/workers/rpc-schema.cjs) |
| Rate limit | The worker rate-limits the commands it accepts | [`workers/peer/rate-limit.cjs`](../../apps/desktop/workers/peer/rate-limit.cjs) |
| Restart | A worker that exits without being asked to while the mesh is running is restarted with its last `INIT` arguments. The list of revoked devices in them stays current | [`electron/pear-end/worker-client.cjs`](../../apps/desktop/electron/pear-end/worker-client.cjs) |

Identity keys and the key-value store stay in the main process. The worker receives the device identity, already decrypted, in its `INIT` command.

## Local lesson runs

A lesson started with Run executes as a normal process under your user account, the same as a script you start from a terminal. [`runner.cjs`](../../apps/desktop/runner.cjs) spawns it. The app adds no sandbox around it, because the code is course content from this repository or your own edit of it.

The same care applies as with any script: run code you wrote or trust.

## Peer to peer

This boundary is between this device and a paired device. [Configuration](../configuration.md) lists the exact limits, rate limits, and timeouts this section refers to.

### Transport

Devices connect through Hyperswarm, whose connections are end-to-end encrypted with Noise. Pairing uses `blind-pairing` invites ([`workers/peer/index.cjs`](../../apps/desktop/workers/peer/index.cjs)).

### Messages

Every message on the exec channel is a binary frame encoded with `compact-encoding`: a tag for its kind, then that kind's fields in a fixed order. One function in [`peer-messages.cjs`](../../apps/desktop/workers/peer/peer-messages.cjs) reads all of them. That function drops a frame larger than the frame cap without decoding it, and it drops a frame that ends early or has bytes left over. Pairing, identity, profile, and cancel frames each have a smaller cap of their own.

A decoded frame is then checked against the fields its kind allows, with a length bound for each string and list. A frame with an unknown kind or with a field outside its bounds is dropped. The host answers a malformed run request with the `invalid-request` refusal, so the guest is not left waiting.

### Protocol version

Remote runs use one `protomux` channel per pair, named `p2p-academy/exec`. A guest sends its protocol version with its pairing request, and the host refuses a request with another version or with none, as older releases send. Each side also sends its version when it opens the channel, and a channel opened with another version is closed, which drops the pair. The audit trail records both refusals with the `protocol-version` reason.

### Pairing

Pairing a device takes three checks. The [pairing flow](ARCHITECTURE.md#pairing-flow) diagram shows them in order.

| Check | What it does | Code |
| :--- | :--- | :--- |
| Pairing code | The host compares the code in constant time. Repeated wrong codes invalidate the invite, and pairing attempts across all invites are rate-limited | [`pairing-code.cjs`](../../apps/desktop/workers/peer/pairing-code.cjs), [`pairing-attempt-gate.cjs`](../../apps/desktop/workers/peer/pairing-attempt-gate.cjs) |
| Approval | The user on the host device approves the request | [`workers/peer/index.cjs`](../../apps/desktop/workers/peer/index.cjs) |
| Identity handshake | Each side sends a `keet-identity-key` proof that binds its device key to a root identity, then signs the other side's nonce | [`identity-handshake.cjs`](../../apps/desktop/workers/peer/identity-handshake.cjs) |

The signed message includes the context string `p2p-academy/peer-identity/v1` and the pair's discovery key, so a signature cannot be replayed on another pair.

A revoked device is refused. The `lockdown` action rejects every pending request and drops every paired device.

### Remote runs

Code that a paired device sends goes through these steps in order. Any step can refuse the run, and the guest then gets a fixed error code. The [remote run flow](ARCHITECTURE.md#remote-run-flow) diagram shows the same steps.

| Step | What it does | Code |
| :--- | :--- | :--- |
| Entry checks | Requests are rate-limited per paired device, and one device can have one run in flight. A second request while a run is active gets the `run-in-progress` refusal. A revoked device is refused. Remote runs are refused when no OS keyring protects the identity keys. That is the case when the app sealed them with its local key file, and when Linux `safeStorage` runs on its `basic_text` backend | [`exec-host.cjs`](../../apps/desktop/workers/peer/exec-host.cjs) |
| Input validation | File names, arguments, and source size are validated | [`exec-validate.cjs`](../../apps/desktop/workers/peer/exec-validate.cjs) |
| Identity check | The run waits for the identity handshake to verify the sending device | [`exec-host.cjs`](../../apps/desktop/workers/peer/exec-host.cjs) |
| MCP packages | A run can name an MCP server package only from the host's allowlist. Before the run, the host installs that package at the exact version the allowlist names, with npm lifecycle scripts turned off. The host refuses the run when the integrity npm recorded for the package differs from the one in the allowlist. The child reads the installed package from a cache it cannot write to | [`mcp-warm.cjs`](../../apps/desktop/workers/sandbox/mcp-warm.cjs), [`course-allowlist.json`](../../apps/desktop/workers/sandbox/course-allowlist.json) |
| Source check | The guest sends the lesson source together with the code built from it. The host builds that source itself and refuses the run with `source-mismatch` when the result differs from the code it received | [`exec-host.cjs`](../../apps/desktop/workers/peer/exec-host.cjs), [`runner-process.cjs`](../../apps/desktop/electron/runner-process.cjs) |
| AI code review | The review refuses a run it classifies as malicious | [`exec-host.cjs`](../../apps/desktop/workers/peer/exec-host.cjs) |
| Consent | A run that needs the microphone, the camera, or the network waits for the user to approve a prompt. A run that needs none of them starts without a prompt, unless the user turned on "Always ask before running" for the paired device that sent it | [`exec-host.cjs`](../../apps/desktop/workers/peer/exec-host.cjs) |
| Sandbox | The run is refused unless the OS sandbox is active | [`workers/sandbox`](../../apps/desktop/workers/sandbox) |

The child runs on the Bare runtime when every package the code imports is a `bare-*` one. With any other import, the QVAC SDK included, the child runs on the app's own Electron binary in Node mode.

### Code review

> [!NOTE]
> The AI code review is advisory. Any verdict other than malicious lets the run continue, and the sandbox is the boundary.

- The review and the consent prompt show the lesson source only after the source check has matched it to the code that runs. When a request has no lesson source, or the host could not run the check, they show the code that runs.
- Code identical to a lesson file in the host's own copy of the courses skips the review ([`lesson-match.cjs`](../../apps/desktop/electron/lesson-match.cjs)).
- The guest device also reviews the code before it sends it, and does not send code that review classifies as malicious.

### Consent

"Always ask before running" is off when a device pairs. The switch is on that device's card in Settings > Paired devices. The setting belongs to one pairing and ends with it.

While another device's run is going, its notice on the host has a Stop button. Stop ends that one run and keeps the pairing, and the other device's output says the paired device stopped it.

A lesson can declare the devices and the network mode it needs. A declaration can only widen what the prompt asks for. The host takes the wider of the declared and the detected network mode, and the union of the device lists. An unanswered prompt times out and counts as a refusal.

### Inside the sandbox

On macOS the sandbox is a `sandbox-exec` profile. On Linux it is `bwrap` with new user, mount, and process ID (PID) namespaces plus a `seccomp` filter. On Windows remote runs are always refused. The [desktop README](../../apps/desktop/README.md) has more detail on the macOS profile.

- The network is off unless the run was granted it.
- Writes are limited to the run's temp directory, the lesson output folder, and `~/.qvac`.
- Model files already on disk are read-only.
- The child gets a filtered environment.
- The app's state directory and its key directory are always denied to the child, whatever an allowlist asks for. When the app starts with `--storage <dir>`, that is `<dir>` and `<dir>/keys`.
- The child cannot create a symlink inside its writable area, so a write goes to the path it names.
- The child can send a signal only to itself and its child processes. On Linux it has a PID namespace of its own.
- With no network grant, the child cannot resolve a host name through the Domain Name System (DNS).
- On macOS the child can use a Unix socket only inside its run directory, and the system DNS socket when it has a full network grant.
- On macOS the child can look up only the system services in `MACH_SERVICES` and `XPC_SERVICES` ([`sandbox-mac.cjs`](../../apps/desktop/workers/sandbox/sandbox-mac.cjs)), plus the ones in `DEVICE_MACH_SERVICES` for a device the run was granted, and it cannot load native code from a path it can write.

### Sandbox guarantees per platform

[`tests/helpers/conformance.cjs`](../../apps/desktop/tests/helpers/conformance.cjs) holds these claims as a table, and [`tests/integration/sandbox-conformance.cjs`](../../apps/desktop/tests/integration/sandbox-conformance.cjs) asserts each row against a real kernel.

| Claim | macOS | Linux |
| :--- | :--- | :--- |
| With no network grant, an outbound connection fails | denied | denied |
| With a loopback grant, a connection to another host fails | denied | denied |
| With a full network grant, any host is reachable | allowed | allowed |
| Writes outside the run directory fail | denied | denied |
| The run directory is writable | allowed | allowed |
| The app's own state directory is unreadable | denied | denied |
| The local encryption key is unreadable | denied | denied |
| A run cannot create a symlink inside its writable area | denied | denied |
| With no network grant, a DNS lookup fails | denied | denied |
| A run cannot signal a process outside its own tree | denied | denied |
| A Unix socket in the host's temp directory is unreachable | denied | denied |

On Linux a loopback grant gives the run a network namespace of its own with only a loopback interface. The run cannot reach services on the host's loopback, and the consent prompt says so. Neither platform filters by domain.

On Windows, remote runs are refused. `wrapSpawn` returns `sandboxed: false` when no sandbox is available, and `exec-host.cjs` refuses the spawn.

### Refusals and the audit trail

A refusal sends the paired device a fixed error code and text. Only the fields named in `WIRE_SAFE_META` leave this device, and the full reason stays in the local audit trail. The output of a run that the page collects is capped per stream ([`run-accumulator.cjs`](../../apps/desktop/electron/run-accumulator.cjs)).

The audit trail is an append-only file of one JSON object per line, with mode `0600` ([`audit-store.cjs`](../../apps/desktop/workers/peer/audit-store.cjs)). The file rotates by size, and old entries are dropped.

## Installer and updates

The CLI builds the app from source on the user's machine.

| Control | What it does | Code |
| :--- | :--- | :--- |
| Source | The install scripts clone this repository from GitHub over HTTPS and run the CLI's installer from that clone. A different repository or branch is accepted only when `P2P_ACADEMY_DEV=1` is set | [`install.sh`](../../apps/cli/install.sh), [`install.ps1`](../../apps/web/public/install.ps1) |
| Pinned pnpm | Both scripts install pnpm at a pinned version when it is missing | [`install.sh`](../../apps/cli/install.sh), [`install.ps1`](../../apps/web/public/install.ps1) |
| Windows tool downloads | The installer downloads Git, Node, and `ffmpeg` when they are missing. Each zip has to match a published SHA-256 digest before it is unpacked: the GitHub release asset digest for Git and `ffmpeg`, and `SHASUMS256.txt` for Node | [`install.ps1`](../../apps/web/public/install.ps1) |
| Frozen lockfile | `install` and `update` run `pnpm install --frozen-lockfile`, so the dependency tree is the one the lockfile records | [`apps/cli/src`](../../apps/cli/src) |
| Install scripts | Only `electron` may run an install script (`onlyBuiltDependencies`) | [`package.json`](../../package.json) |
| Release channels | The default `stable` channel builds the newest `vX.Y.Z` tag, and `latest` builds `master` | [`channel.js`](../../apps/cli/src/channel.js) |
| Signed releases | A `stable` install or update runs no code from the clone until the tag passes `git verify-tag` against the SSH keys in [`release-signers`](../../apps/cli/release-signers). The name inside the signed tag has to match the tag, the tag has to point at the checked-out commit, and its version can be no older than the installed one. The keys stay on the maintainer's hardware security keys, never in CI. `latest` and `P2P_ACADEMY_BRANCH` builds have no signature to check | [`release-verify.js`](../../apps/cli/src/release-verify.js) |
| Release workflow | CI publishes a GitHub Release only for a pushed tag that passes the same check and points at a commit on `master` | [`release-tag.yml`](../../.github/workflows/release-tag.yml) |

## Model downloads

| Control | What it does | Code |
| :--- | :--- | :--- |
| SDK downloads | The app writes a QVAC config with `requireHttpChecksum` and `requireSecureTransport` set, which covers the SDK's own HTTP downloads | [`electron/main.js`](../../apps/desktop/electron/main.js) |
| Direct fetch | The app downloads a registry model over HTTPS from the source the registry names. The file enters the model cache only after its bytes match the recorded size and checksum | [`shared/model-sideload.cjs`](../../apps/desktop/shared/model-sideload.cjs) |
| Cache record | The app keeps a record of the model cache. It checks each file's size and modification time on every run, and a SHA-256 for the models a run names | [`shared/model-integrity.cjs`](../../apps/desktop/shared/model-integrity.cjs) |
