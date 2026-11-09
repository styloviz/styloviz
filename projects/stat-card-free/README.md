# @styloviz/stat-card

> KPI metric cards with sparklines, trend chips and four layout variants.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/sparkline @styloviz/stat-card
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons`, `@styloviz/sparkline` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvStatCardComponent } from '@styloviz/stat-card';

@Component({
  standalone: true,
  imports: [SvStatCardComponent],
  template: `
    <sv-stat-card title="Revenue" [value]="48200" prefix="$" [trendPercent]="12.5" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Card title / metric label. |
| `value` | `string \| number` | `''` | Primary metric value — string or number, displayed as-is or formatted. |
| `prefix` | `string` | `''` | Optional prefix rendered before the value (e.g. "$", "€"). |
| `suffix` | `string` | `''` | Optional suffix rendered after the value (e.g. "K", "%", "ms"). |
| `description` | `string` | `''` | Short helper text beneath the title (e.g. "Last 30 days"). |
| `trend` | `StatCardTrend` | `'neutral'` | Direction of change. |
| `trendValue` | `number \| null` | `null` | Absolute delta value shown alongside the trend icon. |
| `trendPercent` | `number \| null` | `null` | Percentage change shown in the trend chip. |
| `trendLabel` | `string` | `''` | Comparison context label (e.g. "vs last month"). |
| `trendPolarity` | `StatCardTrendPolarity` | `'up-is-good'` | Which direction is good news — see StatCardTrendPolarity. `'up-is-good'` paints a rise green and a fall red; `'down-is-good'` swaps them, for a churn or cost KPI; `'neutral'` paints any change grey. |
| `sparklineDomain` | `readonly [number, number] \| null` | `null` | `[min, max]` for the inline sparkline, shared across a KPI row. Unset, each card scales its line to itself, and two cards rising 2% and 900% draw the same shape side by side. Compute one range with `svSharedDomain()` from `@styloviz/sparkline` over every card's series and bind it to all of them. An sr-only note says which kind of scale the line is on. |
| `updatedAt` | `string` | `''` | When this figure was last refreshed, as `YYYY-MM-DD` or an ISO timestamp. Renders an "Updated … ago" line under the figure, marked stale past `staleAfterMinutes`, because a cached KPI looks identical to a live one. |
| `staleAfterMinutes` | `number` | `60` | How many minutes before the figure is called out as possibly stale. |
| `source` | `string` | `''` | Where the figure came from — a warehouse, a job, a service. |
| `layout` | `StatCardLayout` | `'default'` | Card layout mode. |
| `icon` | `string` | `''` | Name of an icon in `@styloviz/icons`, e.g. `'trending-up'`. A library glyph is always drawn on a 24-unit box, so there is no viewBox to pass. |
| `sparkline` | `SparkPoint[]` | `[]` | Array of data points for the inline sparkline. Values should be on a consistent numeric scale; the component normalises them internally. Empty array hides the sparkline. |
| `loading` | `boolean` | `false` | Show skeleton loading shimmer instead of content. |
| `error` | `SvDataError \| string \| null` | `null` | The figure could not be loaded. Rendered in place of the metric, because a card that keeps showing a stale number after a failed refresh is worse than one that admits it: the reader has no way to tell the two apart. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `linkLabel` | `string` | `''` | Label for the bottom "view more" link. Empty string hides the link. |
| `customClass` | `string` | `''` | Additional CSS classes merged on the root card element. |
| `locale` | `string` | `svLocale()` | BCP 47 locale for dates and numbers. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `linkClick` | `void` | Emitted when the "view more" link is clicked. |
| `retry` | `void` | The host should re-run the failed load. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/stat-card

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
