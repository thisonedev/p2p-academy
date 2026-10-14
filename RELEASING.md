# Releasing P2P Academy

This document is for maintainers cutting a release. A release is a version bump that reaches `master` through a `release/vX.Y.Z` pull request. After it merges, the maintainer signs the release tag on their own machine and pushes it.

## Release checklist

Copy this into the release pull request.

### Prepare

- [ ] Check out `master`, up to date with `origin/master`, with a clean working tree.
- [ ] Run `pnpm release patch`, `pnpm release minor`, or `pnpm release major`. It creates the `release/vX.Y.Z` branch, sets the version in [`package.json`](./package.json) and [`apps/desktop/package.json`](./apps/desktop/package.json), and drafts a section in [`CHANGELOG.md`](./CHANGELOG.md) from the commits on `master` since the last tag.
- [ ] Edit the drafted `CHANGELOG.md` section.
- [ ] Run `pnpm build`: pass.
- [ ] Run `pnpm --filter @p2p-academy/desktop test:unit`: pass.
- [ ] Run `pnpm notice:check`: pass.
- [ ] Commit both `package.json` files and `CHANGELOG.md` as `update version to X.Y.Z`.
- [ ] Push the branch and open a pull request into `master`, titled `Release/vX.Y.Z`.

### Merge

- [ ] Every check on the pull request passes. The version check accepts a version change only from a `release/vX.Y.Z` branch, and requires a higher version and a `CHANGELOG.md` section for it.
- [ ] Merge the pull request.

### Sign the tag

- [ ] Run `git checkout master` and `git pull`. Check that `HEAD` is the merge commit of the release pull request.
- [ ] Read what the release contains with `git log --oneline vA.B.C..HEAD`, where `vA.B.C` is the previous release.
- [ ] Run `git tag -s vX.Y.Z -m vX.Y.Z`, then enter the security key PIN and touch the key.
- [ ] Run `git -c gpg.ssh.allowedSignersFile=apps/cli/release-signers verify-tag vX.Y.Z`: it prints `Good "git" signature`.
- [ ] Run `git push origin vX.Y.Z`.

### Verify

- [ ] The Release tag workflow passed for the tag and created a GitHub Release whose notes are the `CHANGELOG.md` section.
- [ ] `p2p-academy update` on the default `stable` channel installs the new tag.
- [ ] Settings > About shows the new "App version".

## Release keys

Release tags are signed with SSH keys that live on hardware security keys. [`apps/cli/release-signers`](./apps/cli/release-signers) lists their public keys, and the CLI installs a `stable` release only when one of them signed its tag. A signing key never goes into CI or a repository secret.

### Set up a security key

Run these in your own terminal, with the security key plugged in. On macOS, the built-in `ssh-keygen` fails with `No FIDO SecurityKeyProvider specified`, so install OpenSSH with `brew install openssh` first and check that `which ssh-keygen` prints the Homebrew path.

1. Create the key: `ssh-keygen -t ed25519-sk -O resident -O verify-required -O application=ssh:p2p-academy-release -C "p2p-academy release" -f ~/.ssh/p2p-academy-release`. The private key stays on the security key. The file it writes is a handle that is useless without the security key.
2. In your clone of this repository, run `git config gpg.format ssh` and `git config user.signingkey ~/.ssh/p2p-academy-release`. On macOS, also run `git config gpg.ssh.program "$(brew --prefix)/bin/ssh-keygen"`, so git signs with the Homebrew build. Every tag shows the `user.email` of this clone publicly. To keep a personal address out of it, use your GitHub noreply address (`git config user.email <id>+<username>@users.noreply.github.com`), which GitHub lists under Settings > Emails.
3. Add a line to `apps/cli/release-signers` through a pull request: a name, `namespaces="git"`, and the contents of `~/.ssh/p2p-academy-release.pub`.
4. After that pull request merges, sign a test tag and check it with the `verify-tag` command from the checklist. Delete the test tag locally with `git tag -d` and do not push it.

A key reaches users with the next release, since their CLI reads `release-signers` from the version they have installed.

### Remove a key

Remove its line from `release-signers` and publish a release signed with another key. Do this right away when a security key is lost or stolen. Installs that have updated to that release no longer accept the removed key.

If no listed key can sign anymore, no installed copy of the CLI can update. Add a new key to `release-signers` on `master`, sign a release with it, and ask users to run the install script again, which installs the CLI from `master` with the new key list.

## Notes

Only a `release/vX.Y.Z` branch may change the version. A pull request from any other branch that changes it fails the version check.

The `stable` channel builds the newest `vX.Y.Z` tag, so a release reaches users on that channel only after the signed tag is pushed. The `latest` channel builds `master`, which has no signature to check.
