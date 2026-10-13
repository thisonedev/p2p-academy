# Releasing P2P Academy

This document is for maintainers cutting a release. A release is a version bump that reaches `master` through a `release/vX.Y.Z` pull request. Merging that pull request tags the release.

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

### Verify

- [ ] The Release tag workflow on `master` created the `vX.Y.Z` tag and a GitHub Release whose notes are the `CHANGELOG.md` section.
- [ ] `p2p-academy update` on the default `stable` channel installs the new tag.
- [ ] Settings > About shows the new "App version".

## Notes

Only a `release/vX.Y.Z` branch may change the version. A pull request from any other branch that changes it fails the version check.

The `stable` channel builds the newest `vX.Y.Z` tag, so a release reaches users on that channel only after the tag exists. The `latest` channel builds `master`.
