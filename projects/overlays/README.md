# @styloviz/overlays

> Overlay and feedback primitives — tooltip, result page, spinner, progress bar / ring, an onboarding checklist and a mobile action sheet.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/kbd @styloviz/overlays
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons`, `@styloviz/kbd` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

## Styles (required)

Styloviz components are Tailwind CSS 4 utilities. If the project does not use
Tailwind yet, add it and its PostCSS plugin (the Angular CLI reads
`.postcssrc.json` from the project root):

```sh
npm i -D tailwindcss @tailwindcss/postcss postcss
echo '{ "plugins": { "@tailwindcss/postcss": {} } }' > .postcssrc.json
```

Then, in your global stylesheet (usually `src/styles.css`), import the kit's
tokens and let Tailwind scan the installed packages — it skips `node_modules`
otherwise:

```css
@import "tailwindcss";
@import "@styloviz/core/styles/styloviz.css";
@source "../node_modules/@styloviz";
@source "../node_modules/@styloviz-pro";   /* Pro only */
```

The stylesheet ships in `@styloviz/core` — add it to your install if it is not
there already. Dark mode is class-based (`class="dark"` on `<html>`). Rebrand by
redeclaring a token after the import: `@theme { --color-primary-600: #0f766e; }`.

## Usage

```ts
import { SvActionSheetComponent } from '@styloviz/overlays';

@Component({
  standalone: true,
  imports: [SvActionSheetComponent],
  template: `
    <sv-action-sheet [(open)]="open" title="Invoice INV-2041" [actions]="actions" (actionSelect)="run($event.action.id)" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean (two-way)` | `false` | Whether the sheet is up. Two-way: `[(open)]`. |
| `title` | `string` | `''` | The heading — usually the thing the actions apply to ("Invoice INV-2041"). |
| `description` | `string` | `''` | A line under the heading, read as the sheet's description. |
| `actions` | `readonly SvActionSheetAction[]` | `[]` | The choices, top to bottom. |
| `cancelLabel` | `string` | `''` | The dismiss button's text. |
| `showCancel` | `boolean` | `true` | Show the separate Cancel button under the menu. |
| `ariaLabel` | `string` | `''` | The sheet's accessible name when it has no `title`. |
| `closeOnBackdrop` | `boolean` | `true` | A tap on the dimmed page closes it. |
| `closeOnEscape` | `boolean` | `true` | Escape closes it. |
| `swipeToClose` | `boolean` | `true` | A swipe down on the sheet's handle or heading closes it (touch and pen). |
| `closeOnNavigation` | `boolean` | `true` | A navigation closes it, once the app provides `provideSvOverlayRouteClose()`. |
| `labels` | `Partial<SvOverlaysLabels>` | `{}` | Per-instance overrides for the package labels. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `actionSelect` | `SvActionSheetSelection` | A choice was made. The sheet closes with reason `'action'` right after. |
| `opened` | `void` | The sheet came up. |
| `closed` | `SvActionSheetCloseReason` | The sheet went away, and why. |
| `openChange` | `boolean` | Emits the new `open` whenever it changes — the output half of `[(open)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/action-sheet

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
