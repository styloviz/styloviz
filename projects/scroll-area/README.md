# @styloviz/scroll-area

> A styled scrollbar drawn over a genuinely scrolling element — never in place of one. Minimum grabbable thumb with the track arithmetic corrected for it, click-to-page on the track, and edge fades that are the only affordance a hidden scrollbar leaves.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/scroll-area
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
| `maxHeight` | `string` | `'16rem'` | Max height of the scrolling box, as a CSS length. |
| `minThumb` | `number` | `SV_MIN_THUMB_PX` | Smallest grabbable thumb, in px. |
| `edgeFade` | `boolean` | `true` | Fade the edges that have content behind them. Once the native chrome is hidden, a list that scrolls looks exactly like a list that does not. This is the only affordance left. |
| `ariaLabel` | `string` | `''` | Accessible name for the scrolling region. |
| `observeContent` | `boolean` | `true` | Re-measure automatically when the viewport or the content resizes, with no scroll event needed. Turn off only to drive `measure()` yourself — e.g. a virtualised list that already knows its size. |
| `tabStop` | `ScrollAreaTabStop` | `'auto'` | Whether the region is a tab stop. `'auto'` makes it one only while it can actually scroll — short content adds no empty tab stop. |
| `orientation` | `ScrollAreaOrientation` | `'vertical'` | Which axis the drawn thumb, the edge fades and track paging follow. `'horizontal'` normalises `scrollLeft` for RTL, so the thumb and the fades start at the inline start in either direction. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `scrolled` | `number` | Emitted on every scroll, with the current position along the axis: `scrollTop` when vertical, the px from the INLINE START when horizontal (direction-normalised, so it is never negative in RTL). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/scroll-area

## License

MIT
