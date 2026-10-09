# @academy/constants

This package holds public values that more than one app needs: the web app, the UI package and the desktop app. It is bundled into the web build, so it must never hold a secret.

## What goes here

- Put a value here when two or more apps use it and no package owns its topic.
- When a package owns the topic, define the value there instead: rules in `@academy/validation` (`USERNAME_RE`), storage keys in `@academy/core`, desktop-only values in `apps/desktop/shared`.
- Keep a value that one feature uses next to that feature.

## Modules

| Import | Holds |
| --- | --- |
| `@academy/constants/links` | Site, install commands, repo, X and contact links. They are for display. The installer and the updater keep their own sources. |
| `@academy/constants/product` | Product name, the three products (name, nav label, route) and `pageTitle()`. |
| `@academy/constants/units` | `KIB`, `MIB`, `GIB`, `formatBytes` and `formatGb`, all base 1024. |
| `@academy/constants/models` | The AI bot's chat models: file, SDK key, size, RAM and GPU need. |
| `@academy/constants/files` | File types the app previews inline. |

Import a subpath when you need one module. `@academy/constants` re-exports all of them.

## Checks

- `pnpm check:constants`: the CLI, the install scripts and the root README cannot import this package, so a test compares their links with `links.ts`.
- Colors, text sizes and layers are defined in `packages/ui/src/tokens.css`, and `pnpm check:colors` keeps raw colors out of UI code.

## Adding a value

1. Check whether a package already owns the value's topic. If one does, add the value there.
2. Name it by meaning, with the unit in the name (`_MS`, `_BYTES`).
3. Export it from its module and from `src/index.ts`. A new module also needs its subpath in `package.json` `exports`.
