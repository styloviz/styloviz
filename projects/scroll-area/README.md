# @styloviz/scroll-area

> A styled scrollbar drawn over a genuinely scrolling element — never in place of one. Minimum grabbable thumb with the track arithmetic corrected for it, click-to-page on the track, and edge fades that are the only affordance a hidden scrollbar leaves.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/scroll-area
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvScrollAreaComponent } from '@styloviz/scroll-area';

@Component({
  standalone: true,
  imports: [SvScrollAreaComponent],
  template: `
    <sv-scroll-area maxHeight="16rem" ariaLabel="Activity">
      <!-- …long content… -->
    </sv-scroll-area>
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `ScrollAreaVariant` | `'auto'` | When the thumb is drawn. |
| `maxHeight` | `string` | `'16rem'` | Max height of the scrolling box, as a CSS length. Ignored with `fill`. |
| `fill` | `boolean` | `false` | Fill the height the parent gives the host — `flex-1` in a flex column, a sidebar's list under its header — instead of growing to `maxHeight`. |
| `minThumb` | `number` | `24` | Smallest grabbable thumb, in px. |
| `edgeFade` | `boolean` | `true` | Fade the edges that have content behind them. Once the native chrome is hidden, a list that scrolls looks exactly like a list that does not. This is the only affordance left. |
| `ariaLabel` | `string` | `''` | Accessible name for the scrolling region. |
| `observeContent` | `boolean` | `true` | Re-measure automatically when the viewport or the content resizes, with no scroll event needed. Turn off only to drive `measure()` yourself — e.g. a virtualised list that already knows its size. |
| `tabStop` | `ScrollAreaTabStop` | `'auto'` | Whether the region is a tab stop. `'auto'` makes it one only while it can actually scroll — short content adds no empty tab stop. |
| `orientation` | `ScrollAreaOrientation` | `'vertical'` | Which axis the drawn thumb, the edge fades and track paging follow. `'horizontal'` normalises `scrollLeft` for RTL, so the thumb and the fades start at the inline start in either direction. |
| `scrollbars` | `ScrollAreaScrollbars` | `'overlay'` | Overlay the thumb, or reserve an inset gutter for it. |
| `thumbStyle` | `ScrollAreaThumbStyle` | `'pill'` | The thumb's shape. |
| `size` | `ScrollAreaSize` | `'md'` | Thumb thickness. |
| `fadeStyle` | `ScrollAreaFadeStyle` | `'gradient'` | How hidden content is marked at the edges. `'gradient'` fades to the surface colour — set `fadeColor` (or the `--sv-sa-fade` custom property) when the area sits on anything but the default white / gray-900 card; `'shadow'` needs no colour at all. |
| `fadeColor` | `string` | `''` | The colour a `'gradient'` fade ends in — the background behind the area. Empty uses the `--sv-sa-fade` custom property, else white / gray-900. |
| `hideDelay` | `number` | `600` | With `variant="hover"`, how long the thumb stays after the pointer leaves, in ms. |
| `backToTop` | `boolean` | `false` | Show a floating "back to the start" button once the area has scrolled `showAfter` px. |
| `showAfter` | `number` | `240` | How far the area must scroll before the back-to-top button appears, in px. |
| `backToTopLabel` | `string` | `'Back to top'` | The back-to-top button's accessible name. |
| `progress` | `boolean` | `false` | A thin progress bar along the start edge, filling as the area scrolls. |
| `threshold` | `number` | `48` | How close to an end counts as reaching it, in px — `reachedEnd` fires this far before the last row, so the next page can load before the user hits the bottom. |
| `snap` | `ScrollAreaSnap` | `'none'` | Snap the scroll to the items. |
| `contentHeight` | `number \| null` | `null` | The total content height in px, for a virtual list that renders only the rows in view. The content box is given at least this height, so the element still genuinely scrolls the whole list; position the rendered window yourself from `scrolled`. Null measures the content. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `scrolled` | `number` | Emitted on every scroll, with the current position along the axis: `scrollTop` when vertical, the px from the INLINE START when horizontal (direction-normalised, so it is never negative in RTL). |
| `reachedEnd` | `void` | The area came within `threshold` px of its end — the infinite-scroll hook. Fires once per arrival: it re-arms only after the user scrolls back out of the threshold, or when the content grows (a page was appended). |
| `reachedStart` | `void` | The area came within `threshold` px of its start. Fires once per arrival. |
| `snapChange` | `number` | With `snap`, the index of the item the area settled on, once the scroll comes to rest — not on every frame of the way there. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/scroll-area

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
