# @styloviz/jump-menu

> Compact navigation as a single native select: grouped destinations, the current one shown, and the platform picker on touch. The small form of a tab strip or an anchor rail.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/jump-menu
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
import { SvJumpMenuComponent } from '@styloviz/jump-menu';

@Component({
  standalone: true,
  imports: [SvJumpMenuComponent],
  template: `
    <sv-jump-menu [items]="sections" [(value)]="current" (jump)="go($event.item.id)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly JumpMenuItem[]` | `[]` | Destinations, in display order. |
| `value` | `string (two-way)` | `''` | Id of the current destination. Use `[(value)]` for two-way binding. |
| `label` | `string` | `'Jump to'` | Visible label above the control. Not optional in practice: a bare `<select>` in a navigation bar reads as *"combo box, Overview"* and nothing tells a screen-reader user it moves them. |
| `labelHidden` | `boolean` | `false` | Hide the label visually, keeping it for assistive technology. |
| `size` | `JumpMenuSize` | `'md'` | Control size. |
| `disabled` | `boolean` | `false` | Prevents any destination from being chosen. |
| `placeholder` | `string` | `'Select…'` | Text for the placeholder option shown while `value` matches no destination. Empty string removes the placeholder entirely. |
| `customClass` | `string` | `''` | Additional CSS classes on the root wrapper. |
| `scrollTarget` | `JumpMenuScrollTarget` | `'none'` | Scroll to the chosen destination, by id. `'none'` leaves it to the host's `(jump)`; `'id'` scrolls the page to the element with the item's id; an element scrolls THAT container to the matching id inside it. Emits `jumped` once the scroll has started. |
| `scrollOffset` | `number` | `0` | Pixels left above the destination — a sticky header's height. |
| `activeId` | `string \| null` | `null` | The destination something else says is current — typically a scroll-spy's `activeId()`. When set, the select follows it, so scrolling the content moves the control. `null` leaves `value` alone. |
| `goButton` | `boolean` | `false` | Choosing marks a destination; nothing happens until the Go button (or Enter on the select) — WCAG 3.2.2 for menus whose destinations are new pages. |
| `goLabel` | `string` | `'Go'` | The Go button's label. |
| `surfaceId` | `string \| null` | `null` | Names this menu in the shared navigation-analytics stream when a page has more than one — a static name, never a record id. Ignored unless `provideSvNavTelemetry()` is wired up. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `jump` | `JumpMenuChangeEvent` | Emitted whenever a destination is chosen — always, because a `<select>` is not a link and the browser does not navigate from it. Fires on every `change`, which on Windows includes each arrow key pressed on the closed control (WCAG 3.2.2); set `[goButton]="true"` to emit only on Go or Enter. |
| `jumped` | `JumpMenuJumpedEvent` | Emitted after `scrollTarget` scrolled to a destination, with the element. |
| `valueChange` | `string` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/jump-menu

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
