# @styloviz/tabs

> 6 visual styles (underline, pills, boxed, lifted, border-card, unstyled), dismissible and scrollable tabs, vertical layout, keyboard navigation and lazy panels.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/tabs
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
import { SvTabsComponent } from '@styloviz/tabs';

@Component({
  standalone: true,
  imports: [SvTabsComponent],
  template: `
    <sv-tabs [tabs]="tabs">
      <ng-template svTabPanel="overview">…</ng-template>
    </sv-tabs>
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `tabs` | `TabItem[]` | `[]` | Tab definitions in display order. |
| `activeId` | `string (two-way)` | `''` | ID of the currently active tab. Use `[(activeId)]` for two-way binding. |
| `tabsStyle` | `TabsStyle` | `'underline'` | Visual style variant. |
| `size` | `TabsSize` | `'md'` | Size of the tab text and icons. |
| `layout` | `TabsLayout` | `'horizontal'` | Layout direction. |
| `fullWidth` | `boolean` | `false` | Whether tab buttons stretch to fill all available width. Only applicable to the `'horizontal'` layout. |
| `scrollable` | `boolean` | `false` | Allows the tab list to scroll horizontally instead of wrapping/overflowing when there are more tabs than fit the available width. |
| `customClass` | `string` | `''` | Additional CSS classes on the root wrapper. |
| `activation` | `TabsActivation \| null` | `null` | Whether the arrow keys select the tab they move to (`'automatic'`) or only move focus, leaving Enter/Space to select (`'manual'`). Prefer `'manual'` when a panel costs something to show — `lazy` panels that fetch, heavy charts, anything a keyboard user should not trigger five times on the way past. Leaving it unset resolves to `'automatic'`, and logs a dev-only warning if any tab is `lazy`. |
| `lazyRetention` | `TabsLazyRetention` | `'retain'` | What happens to a `lazy` panel the user switches away from: `'retain'` keeps it mounted with its state (the long-standing behaviour), `'destroy'` unmounts it and rebuilds it on the next visit. Only `lazy` tabs are affected — a panel that was never deferred is never destroyed. Choose `'destroy'` for panels that must re-read their data on every visit, or hold enough DOM that keeping several alive is the real cost; and know that it discards whatever the user typed. |
| `urlKey` | `string \| null` | `null` | Put the active tab in the URL under this key, so a tab can be shared and survives a refresh. Needs `provideSvNavLocation()` at the app root; give a nested tab strip a different key. |
| `surfaceId` | `string \| null` | `null` | Names this tabset in the shared navigation-analytics stream, when a page has more than one. Ignored unless `provideSvNavTelemetry()` is wired up. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `tabClose` | `TabItem` | Emitted when a closable tab's × is clicked or Delete/Backspace is pressed on it. The tab is NOT removed automatically — remove it from `tabs` yourself. |
| `unresolved` | `SvUnresolvedValue<string>` | Emitted when `activeId` names a tab this component cannot show. Reports; never corrects, because there is no nearest tab to correct to. |
| `activeIdChange` | `string` | Emits the new `activeId` whenever it changes — the output half of `[(activeId)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/tabs

## License

MIT
