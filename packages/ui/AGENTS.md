# UI conventions for @academy/ui

This package holds the React components for the web app and the desktop app. It is written in React and TypeScript and styled with Tailwind classes built from the tokens in [`src/tokens.css`](src/tokens.css).

This page is for anyone contributing UI to the repository, including AI coding assistants. It lists the shared components, the tokens, and the rules for using them.

## Golden rules

1. Check the [component catalog](#component-catalog-13-files) before creating a component. If a shared one fits, use it. Do not wrap it or build a second version.
2. Style with tokens. Use the color, text size, and layer names from `src/tokens.css`. Do not write a hex color or a raw Tailwind palette class such as `text-red-300`.
3. Use `lucide-react` for icons. Do not add SVG files for icons.
4. A value that more than one app needs goes in `@academy/constants`, not in a component. The [constants README](../constants/README.md) says what belongs there.
5. If the catalog lacks something you need, stop and ask the user. Do not add a one-off component without saying so.

## Component catalog (13 files)

The shared components are in [`src/components/ui/`](src/components/ui/). Import them by relative path with a `.js` extension, for example `import { Card } from '../ui/card.js'`.

### Actions

- `IconButton`: a button that shows an icon and no words. `look` is `plain`, `small`, or `toolbar`. Give it an `aria-label` or a `title`.
- `iconButtonClass`: the classes of an `IconButton` look, for an icon control that is not a button.
- `SegmentGroup` and `SegmentButton`: a bordered run of choices side by side. `SegmentButton` takes `on`, and `lit` as `muted` or `canvas`.

### Forms

- `fieldClass(size)`: the one look for every text box and text area. Sizes are `sm` for dense rows, `md` for panels and popups, and `lg` for account and settings forms.
- `Dropdown`: a button that opens a list of sections with items. An item can have edit and remove actions.
- `SelectTrigger`: the button a `Dropdown` opens from.
- `ThemedSelect`: the short form of `Dropdown` for a plain list of values. It takes `value`, `options`, and `onChange`, as a native `<select>` would.
- `Switch`: an on/off toggle. It takes `on` and `onChange`.
- `SwitchRow`: a bordered row with a `title`, an optional `hint`, and a `Switch` on the right.

### Layout and surfaces

- `Card`: the bordered box around settings, devices, and profile sections. `muted` puts it on the muted surface.
- `Overlay`: the dimmed layer behind a dialog, with the dialog centered on it. `onClose` runs on a press on the dimmed area. `nested` dims less, for a confirm that opens over another dialog.
- `SectionLabel`: the small uppercase line that names a card or a field.

### Feedback

- `Badge`: a small tinted tag for a state or a role. `tone` is `primary`, `info`, or `warning`.
- `Note`: a short heads-up in a tinted box, with an icon before the words.
- `ProgressBar`: a track with a filled part. `percent` is 0 to 100, or `null` when the size is not known yet. `warn` turns it amber.
- `ProgressRing`: a ring that fills clockwise with a whole percent, and the number inside it.
- `percentOf(progress)`: how far along a download is, as a whole percent.

## Tokens

All tokens are defined in `src/tokens.css`.

### Colors

Colors are named by what they mean, and Tailwind builds the classes from the names: `text-danger`, `bg-canvas-muted`, `border-canvas-border`.

- App surfaces and text: `canvas`, `canvas-foreground`, `canvas-muted`, `canvas-muted-foreground`, `canvas-dimmer`, `canvas-border`, `canvas-raised`.
- The accent: `primary`, `primary-soft`, `primary-strong`, `primary-foreground`.
- States: `danger`, `warning`, and `info`, each with a `-strong` form.
- A light page (`paper-*`) and a dark page (`page-*`) for export previews and code blocks.

The file also defines colors for one feature each, such as the playground's node kinds and ports. Read a token's own comment before reusing it somewhere else.

### Text sizes

| Class | Size |
| --- | --- |
| `text-micro` | 10px |
| `text-caption` | 11px |
| `text-label` | 12px |
| `text-body` | 13px |
| `text-lead` | 14px |
| `text-title` | 20px |
| `text-display` | 28px |

### Layers

App-wide layers, lowest first: `z-sticky`, `z-modal`, `z-modal-raised`, `z-modal-nested`, `z-toast`, `z-popover`, `z-dialog`, `z-tooltip`. A `z-10` or `z-20` that only orders elements inside one component stays a plain number.

## Checks

- `pnpm check:colors` fails when a file under `packages/ui/src` or `apps/web/src` uses a raw Tailwind palette class or a hex color. The files allowed to hold hex colors are listed in [`scripts/check-colors.mjs`](scripts/check-colors.mjs), each with its reason.
- `pnpm build` runs that check, the constants check, and the lesson checks before it builds the web app.
