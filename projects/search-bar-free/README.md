# @styloviz/search-bar

> Command-palette style search with suggestions, filters and loading states.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/kbd @styloviz/search-bar
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
import { SvSearchBarComponent } from '@styloviz/search-bar';

@Component({
  standalone: true,
  imports: [SvSearchBarComponent],
  template: `
    <sv-search-bar
      [suggestions]="suggestions"
      (searched)="onQuery($event)"
      (suggestionSelected)="onSelect($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `value` | `string (two-way)` | `''` | Current input text. Use `[(value)]` for two-way binding. |
| `label` | `string` | `''` | Floating label text — only shown when `variant="floating"`. Acts as a Material Design-style animated label. |
| `placeholder` | `string` | `'Search…'` | Placeholder text. |
| `ariaLabel` | `string` | `''` | Explicit accessible name for the input. Falls back to `label` then `placeholder`. |
| `shortcutHint` | `string` | `''` | Keyboard shortcut hint shown on the right side of the input when empty. E.g. `'⌘K'`, `'Ctrl+K'`, `'/''`. Empty string hides the badge. |
| `suggestions` | `SearchSuggestion[]` | `[]` | Suggestion items to display in the dropdown. Pass a filtered/sliced array; the component renders all provided items. Empty array closes the dropdown. |
| `suggestionsLabel` | `string` | `''` | Label shown above the suggestions list (e.g. 'Recent searches', 'Results'). Empty string hides the header. |
| `footerLabel` | `string` | `''` | Text displayed at the bottom of the dropdown — useful for "View all results". Empty string hides the footer. |
| `filters` | `SearchFilter[]` | `[]` | Active filter chips rendered inside the input track. Each chip has an × button that emits `filterRemoved`. |
| `size` | `SearchBarSize` | `'md'` | Field size: sm, md or lg. |
| `variant` | `SearchBarVariant` | `'default'` | Visual variant: default, floating, minimal… |
| `showSearchIcon` | `boolean` | `true` | Show the magnifier icon on the left. |
| `loading` | `boolean` | `false` | Show the spinning loader inside the search icon area. |
| `stale` | `boolean` | `false` | The results on screen answer an **older** query — a newer request is still in flight. Distinct from `loading`, which cannot separate the two cases it covers: the first fetch (nothing on screen — show a skeleton) and a refinement of results already visible (keep them, and say they are provisional). Blanking the panel on the second is the most jarring thing a picker can do; showing the old list with no indication is a quiet lie. Bind `svSuggestController(...).stale` from `@styloviz/data`, or `createRequestGuard().stale` from `@styloviz/core`. The results dim and report `aria-busy` while staying fully interactive. |
| `emptyReason` | `SvEmptyReason \| null` | `null` | Why the suggestion list is empty, or `null` when it is not empty (or when nothing has been asked yet and the panel should stay shut). Bind `svSuggestController(...).emptyReason` from `@styloviz/data`, which already distinguishes these two and holds `null` while a first load is in flight — an "opening" message that flashes over a search in progress is a third wrong answer. Leaving this unbound keeps the pre-existing behaviour exactly: an empty `suggestions` array closes the panel and says nothing. |
| `noDataLabel` | `string` | `'Type to search'` | Copy for the opening state — nothing searched for yet. |
| `noResultsLabel` | `string` | `'No results found'` | Copy for a search that answered with nothing. |
| `noResultsHint` | `string` | `''` | A second line under `noResultsLabel` — "Check your spelling or try a broader term". Empty hides it. |
| `disabled` | `boolean` | `false` | Whether the input is disabled. |
| `debounceMs` | `number` | `300` | Debounce delay in milliseconds before `searched` emits. Set to 0 to emit on every keystroke. |
| `customClass` | `string` | `''` | Additional classes on the root wrapper. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed suggestion lookup. |
| `searched` | `string` | Emitted (debounced) on every value change. |
| `submitted` | `string` | Emitted when the user presses Enter or clicks a suggestion. |
| `suggestionSelected` | `SearchSuggestion` | Emitted when a suggestion row is clicked, carrying the suggestion object. |
| `filterRemoved` | `string` | Emitted when the × on a filter chip is clicked. |
| `footerClick` | `void` | Emitted when the footer link is clicked. |
| `cleared` | `void` | Emitted when the input is cleared via the × button. |
| `valueChange` | `string` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/search-bar

## License

MIT
