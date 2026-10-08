# @styloviz/select-dropdown

> Single, multi-select, grouped and searchable dropdown with rich option rendering.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/select-dropdown
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
import { SvSelectDropdownComponent } from '@styloviz/select-dropdown';

@Component({
  standalone: true,
  imports: [SvSelectDropdownComponent],
  template: `
    <sv-select-dropdown
      [options]="options"
      placeholder="Choose a framework"
      [(value)]="selected" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| string[] (two-way)` | `''` | Selected value(s) — string for single, string[] for multiple (two-way). |
| `options` | `readonly SelectOption[]` | `[]` | Flat list of options. Use `groups` instead for sectioned lists. |
| `groups` | `SelectGroup[]` | `[]` | Grouped options with section labels. |
| `placeholder` | `string` | `'Select an option'` | Placeholder shown when nothing is selected. |
| `label` | `string` | `''` | Field label. |
| `hint` | `string` | `''` | Helper text shown below the field. |
| `errorMessage` | `string` | `''` | Error message; puts the field in an error state when set. |
| `serverError` | `string \| { readonly message: string } \| null` | `null` | A validation failure reported by the **server** — the 422 that comes back after submit, not something the client could have known. It is a separate input from `errorMessage` because it has a different lifetime, not because it needs a second way to show a string. A server error is a statement about *the value that was submitted*: the moment the user edits the field it stops being true, and this input expires itself rather than sitting there telling someone their new email is already taken. `errorMessage` has no such expiry — it is the host's to clear. While live it outranks `errorMessage`: it is the more specific fact, and it is the one the user has not seen yet. Typed structurally rather than as `SvDataError` so this stays dependency free — an `SvDataError` satisfies it unchanged. |
| `size` | `SelectSize` | `'md'` | Field size: sm, md or lg. |
| `variant` | `SelectVariant` | `'default'` | Visual variant. |
| `multiple` | `boolean` | `false` | Allow selecting multiple options. |
| `searchable` | `boolean` | `false` | Show a search box to filter options. |
| `searchPlaceholder` | `string` | `'Search…'` | Placeholder for the search box. |
| `loadingText` | `string` | `'Loading…'` | Panel copy while the first set of options is being fetched. |
| `noResultsText` | `string` | `'No results found'` | Text shown when a search yields no matches. |
| `clearable` | `boolean` | `false` | Show a clear (×) control. |
| `disabled` | `boolean` | `false` | Disable the field. |
| `loading` | `boolean` | `false` | Show a loading state. |
| `stale` | `boolean` | `false` | The results on screen answer an **older** query — a newer request is still in flight. Distinct from `loading`, which cannot separate the two cases it covers: the first fetch (nothing on screen — show a skeleton) and a refinement of results already visible (keep them, and say they are provisional). Blanking the panel on the second is the most jarring thing a picker can do; showing the old list with no indication is a quiet lie. Bind `svSuggestController(...).stale` from `@styloviz/data`, or `createRequestGuard().stale` from `@styloviz/core`. The results dim and report `aria-busy` while staying fully interactive. |
| `required` | `boolean` | `false` | Mark the field as required. |
| `optionalTag` | `boolean` | `false` | Show an "optional" tag next to the label. |
| `maxSelected` | `number` | `0` | Max selectable options in multiple mode (0 = unlimited). |
| `inputId` | `string` | `''` | Explicit id for the control (for external <label for>). |
| `ariaLabel` | `string` | `''` | Accessible name for the trigger when there is no visible `label`. Use this instead of a native `aria-label` on the host element (which is not a labelable role and would be an ARIA violation). Falls back to the `placeholder` so the combobox always has an accessible name. |
| `customClass` | `string` | `''` | Extra CSS classes for the control. |
| `serverSide` | `boolean` | `false` | Let the server do the searching. The supplied `options` are shown exactly as given — filtering them again hides entries the server matched on fields the component cannot see, and client-side search can only ever look at the page already downloaded. |
| `debounceMs` | `number` | `300` | Delay before `searchChange` fires, in milliseconds. `0` emits immediately. |
| `minChars` | `number` | `0` | Characters required before a search is sent. Below this the panel says so rather than showing a misleading "No results found". |
| `error` | `SvDataError \| string \| null` | `null` | Failure loading the options. Rendered inside the panel, so the trigger and the current selection stay put. |
| `hasMore` | `boolean` | `false` | More options exist on the server. Renders a "Load more" row. |
| `loadingMore` | `boolean` | `false` | True while the next page is being fetched. |
| `selectedOption` | `SelectOption \| null` | `null` | The option matching the current `value`, for when its label lives on the server and is not in `options` yet. Without it a picker restored from a saved id shows the raw id until the user opens the panel. |
| `loadOptions` | `SvSelectOptionSource \| null` | `null` | Let the component fetch its own options. MEASURED — what `serverSide` actually left the host holding. The six remote inputs above describe a request; none of them *makes* one. A host wiring this picker to `/api/people` had to write, by hand, in every component that uses it: a subscription to `(searchChange)`, a request-guard so a slow answer to an abandoned term cannot overwrite a newer one, an `AbortController` so the abandoned request stops costing the server, the `loading`/`stale` split so a refinement dims the list instead of blanking it, a try/catch mapping the failure onto `error`, and a `(retry)` handler re-running the last term. Six inputs and three outputs of ceremony for one URL. The guard is the part everyone skips, and skipping it looks correct in review. Hand it a function instead: ```html <sv-select-dropdown [loadOptions]="searchPeople" [selectedOption]="current()" [searchable]="true" [minChars]="2" /> ``` ```ts searchPeople = (term: string, signal: AbortSignal) => fetch(`/api/people?q=${encodeURIComponent(term)}`, { signal }) .then((r) => r.json()); ``` With a source set, `options`, `loading`, `stale` and `error` are driven by the component and the host's own values for them are OR-ed in rather than replaced — a host may still be loading the *selected* entity while the panel is idle. `serverSide` is implied: a list this component just fetched must not then be re-filtered against the same term, which would hide the entries the server matched on fields the component cannot see. ⚠️ **Pass `selectedOption` too.** The fetched list is whatever answers the current term, so a perfectly valid selection is routinely *not in it* — and without the hydration input the trigger would call it stale and read "Unavailable". The component cannot tell "not in these results" from "deleted on the server", and guessing the friendly answer would undo Dev mode warns once when a value is held and neither the results nor `selectedOption` resolve it. ⚠️ **Not compatible with `hasMore` / `loadMore`.** A source returns the whole answer for a term; there is nowhere for the component to append a page it did not ask for. Paging stays host-driven through `options`. Dev mode warns once if both are used. |
| `source` | `SvSelectSource<SelectOption> \| null` | `null` | Where the options come from — search, paging and async state as one object. Build it with `svSelectSource({ search, pageSize, minChars, debounceMs })` from `@styloviz/core`. It replaces `loadOptions`, `serverSide`, `hasMore`, `loadingMore`, `loading`, `stale`, `error`, `(retry)` and `(loadMore)`: with a source set the component fetches on open, searches as the user types, appends pages on "Load more" and retries a failure itself. The legacy inputs are still OR-ed in, and the legacy outputs still fire. Takes precedence over `loadOptions` when both are set. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `selectionChange` | `string \| string[]` | Emitted with the new selection (string or string[]). |
| `dropdownOpen` | `void` | Emitted when the dropdown opens. |
| `dropdownClose` | `void` | Emitted when the dropdown closes. |
| `searchChange` | `string` | Emitted with the search query whenever it changes (for remote filtering). |
| `retry` | `void` | The host should re-run the failed option load. |
| `loadMore` | `void` | The user reached the end of the list and wants the next page. |
| `valueChange` | `string \| string[]` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/select-dropdown

## License

MIT
