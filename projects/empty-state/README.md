# @styloviz/empty-state

> Full-page or inline empty states with icons, titles and action buttons.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/empty-state
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
import { SvEmptyStateComponent } from '@styloviz/empty-state';

@Component({
  standalone: true,
  imports: [SvEmptyStateComponent],
  template: `
    <sv-empty-state icon="inbox" title="No messages" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Main heading text. Falls back to copy chosen from `reason`. The default is now empty rather than `'Nothing here yet'`: that string was the DEFAULT for a filtered list too, which is the whole of `resolvedTitle()` picks the sentence that is true. |
| `message` | `string` | `''` | Supporting message under the title. Falls back to copy from `reason`. |
| `reason` | `EmptyStateReason` | `'no-data'` | Why this container has nothing in it. Drive it from whether a filter or search is active — not from the row count. |
| `activeFilters` | `readonly string[]` | `[]` | The filters currently narrowing the list, in the user's words — `['Status: Overdue', 'Owner: Dana']`. ECHOING THEM TURNS A DEAD END INTO ONE CLICK. "No matching results" is unanswerable on its own: the user cannot see WHY, and the filter that is hiding everything is usually one they set three screens ago and have forgotten. Naming them, with a way to drop them, is the whole fix. Strings, not a filter model. Only the host can render a date range or a facet id as words a person recognises, and a kit that tried would print `status_id: 4`. |
| `clearFiltersLabel` | `string \| null` | `'Clear filters'` | Label for the built-in clear-filters button. `null` renders none. |
| `offline` | `boolean` | `false` | The device is offline. Takes precedence over `reason`. |
| `retryLabel` | `string \| null` | `null` | Label for the preset's retry button, offered for `reason="error"` and for `offline` — the two causes a second attempt can fix. `null` renders none. |
| `icon` | `EmptyStateIcon` | `'inbox'` | Built-in icon preset. Set to `'custom'` and provide `customIcon` to use your own SVG. |
| `customIcon` | `string` | `''` | Icon-library NAME — required when `icon === 'custom'`, ignored otherwise. BREAKING (icon sweep): was `iconPath`, a raw `<path d="…">`, alongside an `iconViewBox` that is now deleted. An unresolved name draws no `<svg>` at all, so the decorative ring keeps its shape. |
| `showRings` | `boolean` | `true` | Show the decorative concentric-ring background behind the icon. |
| `size` | `EmptyStateSize` | `'md'` | Overall size. |
| `layout` | `EmptyStateLayout` | `'vertical'` | Content stacking axis. |
| `bordered` | `boolean` | `true` | Whether to render a card surface (border + background + rounded corners) or let the component blend into its parent. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `actions` | `EmptyStateAction[]` | `[]` | CTA buttons rendered below the message. Maximum 3 — first one is typically primary, rest secondary/ghost. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `actionClick` | `string` | Emitted when any action button is clicked, carrying the action's `id`. |
| `clearFilters` | `void` | The built-in clear-filters button was pressed. |
| `retry` | `void` | The preset retry button was pressed (`retryLabel`). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/empty-state

## License

MIT
