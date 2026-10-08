# @styloviz/sparkline

> Micro-chart small enough to live in a table cell, list row or stat card. Four encodings — line, area, bar and win/loss — with optional smoothing, last-point and extreme markers, a dashed reference baseline and a pinnable domain. Pure SVG, zero dependencies.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/sparkline
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
import { SvSparklineComponent } from '@styloviz/sparkline';

@Component({
  standalone: true,
  imports: [SvSparklineComponent],
  template: `
    <sv-sparkline [data]="revenue" variant="area" [showLast]="true" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Rendered as a muted dash in the same box, not a card. |
| `data` | `readonly SparklineDatum[]` | `[]` | The series. Bare numbers, or objects carrying an optional label. |
| `domainMin` | `number \| null` | `null` | Pin the bottom of the value range instead of using the series minimum. |
| `domainMax` | `number \| null` | `null` | Pin the top of the value range instead of using the series maximum. |
| `domain` | `readonly [number, number] \| null` | `null` | `[min, max]` for the whole group — the shared-domain mode for a table column. A COLUMN OF SPARKLINES EACH SCALED TO ITSELF INVITES EXACTLY THE COMPARISON IT CANNOT SUPPORT. Row A rising 2% and row B rising 900% draw the identical shape, side by side, and nothing on the page says otherwise. Compute one range with `svSharedDomain()` over every row's series and hand the same tuple to all of them. Takes precedence over `domainMin` / `domainMax`, which stay for pinning one end. When none of the three is set, the scale is per-series and the accessible label says so — because a reader who cannot see that is being invited to compare heights that do not mean the same thing. |
| `missing` | `SparklineMissing` | `'gap'` | What to do with a missing sample. |
| `variant` | `SparklineVariant` | `'area'` | Drawing style. |
| `width` | `number` | `120` | Width of the drawing box in px. |
| `height` | `number` | `36` | Height of the drawing box in px. |
| `strokeWidth` | `number` | `1.5` | Line thickness in px. |
| `smooth` | `boolean` | `false` | Round the line through point midpoints. Ignored by bar variants. |
| `tone` | `SparklineTone` | `'auto'` | Colour source. |
| `barGap` | `number` | `1` | Gap between bars in px, for `bar` and `winloss`. |
| `fluid` | `boolean` | `false` | Stretch to the width of the container instead of drawing at `width`. `width` still sets the viewBox, so it stays the coordinate space the geometry is computed in — only the rendered size follows the parent. Use this for a chart that spans a fluid card; leave it off in a table cell, where a fixed width keeps columns aligned. |
| `showLast` | `boolean` | `false` | Dot on the most recent point. |
| `showExtremes` | `boolean` | `false` | Dots on the lowest and highest points. |
| `baseline` | `number \| null` | `null` | Draw a horizontal rule at this value — a target, budget or zero line. |
| `ariaLabel` | `string \| null` | `null` | Override the generated summary. |
| `ariaHidden` | `boolean` | `false` | Hide from assistive tech — use when adjacent text already conveys the data. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. Nothing here triggers it. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/sparkline

## License

MIT
