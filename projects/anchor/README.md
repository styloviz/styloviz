# @styloviz/anchor

> An "on this page" navigation list that tracks scroll position with an IntersectionObserver and smooth-scrolls to a section on click. Vertical (side-rail) and horizontal (pill-row) layouts.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/anchor
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list it yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvAnchorComponent } from '@styloviz/anchor';

@Component({
  standalone: true,
  imports: [SvAnchorComponent],
  template: `
    <sv-anchor [items]="sections" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly AnchorItem[]` | `—` | The sections to list and track, in document order. |
| `root` | `HTMLElement \| null` | `null` | Scroll container the sections live in. `null` = the window/viewport. |
| `orientation` | `AnchorOrientation` | `'vertical'` | Layout axis. |
| `offset` | `number` | `0` | Extra pixels kept between a jumped-to section and the top of the scroll container — room for a sticky header the section would otherwise land underneath. |
| `offsetFrom` | `HTMLElement \| null` | `null` | A sticky header to measure instead of using a fixed `offset` — its current height becomes the offset, and follows it as it changes. |
| `activation` | `AnchorActivation` | `'last-passed'` | Which reading of "current" to highlight: `'last-passed'` (the last heading scrolled past), `'first-visible'`, `'most-visible'`, or `'nearest-offset'` (the heading closest to the sticky-header line). |
| `urlKey` | `string \| null` | `null` | Reflect the section being read into the URL under this key — pair it with `svHashNavLocation('section')` for `#installation`. Needs `provideSvNavLocation()` at the app root. |
| `urlWriteMode` | `SvNavWriteMode` | `'replace'` | What a CLICK on a nav link does to history — `'push'` makes back return to the section the reader came from. Scrolling always replaces, whatever this says. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `activeIdChange` | `string \| null` | Emits whenever the active section changes, including on click-to-jump. |
| `unresolved` | `SvUnresolvedValue<string>` | Emitted when an item points at a section this page does not have exactly one of. `'unknown'` for no element, `'blocked'` for several with the same id. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/anchor

## License

MIT
