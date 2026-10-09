# Changelog

Each release has a section here, written in its release PR.
Versions before 0.2.20 were not tracked in this file; see the git history.

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
