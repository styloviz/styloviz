# @styloviz/timeline

> 9 variations: horizontal, alternate zigzag, numbered stepper, check stepper, activity feed, status tracker, rich card, date-grouped and interactive (clickable rows).

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/timeline
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
import { SvTimelineComponent } from '@styloviz/timeline';

@Component({
  standalone: true,
  imports: [SvTimelineComponent],
  template: `
    <sv-timeline [items]="events" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly TimelineItem[]` | `[]` | Array of timeline events to render. |
| `layout` | `TimelineLayout` | `'left'` | Structural layout direction. |
| `size` | `TimelineSize` | `'md'` | Component size preset. |
| `showConnector` | `boolean` | `true` | Show connector lines between dots. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | What this timeline is, e.g. `'Deployment history'` — names the list and, in the horizontal layout, the scrollable region a keyboard user tabs into. Set it whenever a page holds more than one timeline — a deploy log beside an audit trail — so they can be told apart. Left unset, the layout's own generic name is kept. Matches `sv-timeline-pro`. |
| `dotStyle` | `TimelineDotStyle` | `'dot'` | Dot rendering style. |
| `displayMode` | `TimelineDisplayMode` | `'default'` | Content display mode. |
| `intent` | `TimelineIntent \| 'auto'` | `'auto'` | What the list means. `'auto'` infers it from `displayMode`. |
| `activeIndex` | `number` | `-1` | Zero-based index of the currently active step. Items before → `complete`; this item → `active`; after → `pending`. Defaults to `-1` (uses each item's own `itemStatus`). |
| `groupByDate` | `boolean` | `false` | Group consecutive items under the `groupDate` header they share. The component never derives a day from a timestamp, and that is the zone policy. "Tuesday" depends on who is reading — an event at 23:30 in Berlin is Wednesday in Auckland and still Tuesday in New York — so a component that grouped by parsing a timestamp would have to pick somebody's Tuesday, and any choice is wrong for the others. `groupDate` is a LABEL the host supplies, already resolved in the zone it wants displayed, and consecutive items sharing it are grouped. That makes the zone the host's decision, which is the only place it can correctly be made. Same policy as `sv-timeline-pro`. |
| `collapseAfter` | `number` | `0` | Show only this many items until the reader asks for the rest. `0` shows all. Five hundred entries push everything else off the page and cost a screen-reader user five hundred stops to get past; collapsing keeps the first entries and a control that shows the rest. |
| `expanded` | `boolean (two-way)` | `false` | Whether the collapsed remainder is currently shown (two-way). A `model` so a host can persist it: a reader who expanded a history and navigated away should not have to expand it again. |
| `horizontalAlign` | `TimelineHorizontalAlign` | `'alternate'` | Content placement for `layout='horizontal'`. |
| `showVariantIcon` | `boolean` | `false` | Draw a status glyph inside `success` / `error` / `warning` / `info` dots that have no `item.icon` of their own — a tick, a cross, a triangle, an "i". The dot's meaning is already announced (see `variantLabel`), but for a sighted reader it was still a hue alone. A shape survives colour-vision deficiency, greyscale printing and a theme that happens to put two tones close together. Opt-in so existing plain dots are unchanged. |
| `loading` | `boolean` | `false` | True while the first page of events is being fetched. Replaces the timeline with a placeholder. For an additional page use `loadingOlder` or `loadingNewer`, which keep the events already on screen. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No events to show'` | Copy for the empty state. |
| `hasOlder` | `boolean` | `false` | Older events exist further back in history. |
| `loadingOlder` | `boolean` | `false` | True while the previous page of history is being fetched. |
| `hasNewer` | `boolean` | `false` | Newer events exist — for a feed that is still being written to. |
| `loadingNewer` | `boolean` | `false` | True while newer events are being fetched. |
| `selectedId` | `string \| number \| null (two-way)` | `null` | Currently selected item id (two-way). Use `[(selectedId)]` with `displayMode="interactive"` for a selectable timeline. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `itemClick` | `TimelineItem` | Emitted when an interactive row is activated (click / Enter / Space). Only fires when `displayMode='interactive'`. |
| `actionClick` | `TimelineItem` | Emitted when a `rich`-card CTA button is activated. Fires alongside any `actionUrl` navigation so you can handle the action in code. |
| `loadMore` | `TimelineLoadMoreEvent` | The user asked for another page. `direction` says which end: `'older'` for history below, `'newer'` for a feed that has moved on above. |
| `retry` | `void` | The host should re-run the failed load. |
| `expandedChange` | `boolean` | Emits the new `expanded` whenever it changes — the output half of `[(expanded)]`. |
| `selectedIdChange` | `string \| number \| null` | Emits the new `selectedId` whenever it changes — the output half of `[(selectedId)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/timeline

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
