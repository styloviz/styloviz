# @styloviz/select-dropdown

> Single, multi-select, grouped and searchable dropdown with rich option rendering.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

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

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

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
| `clearable` | `boolean` | `false` | Show a clear (×) control. |
| `disabled` | `boolean` | `false` | Disable the field. |
| `loading` | `boolean` | `false` | The host is still resolving the *selected* value — fetching the entity a saved id points at, say. The trigger shows a spinner, reports `aria-busy` and does not open, so a user cannot pick against a value that is about to change under them. The option list's own loading state comes from `source` (`svSelectSource` from `@styloviz/core`); the two are OR-ed in the panel. |
| `required` | `boolean` | `false` | Mark the field as required. |
| `optionalTag` | `boolean` | `false` | Show an "optional" tag next to the label. |
| `maxSelected` | `number` | `0` | Max selectable options in multiple mode (0 = unlimited). |
| `inputId` | `string` | `''` | Explicit id for the control (for external <label for>). |
| `ariaLabel` | `string` | `''` | Accessible name for the trigger when there is no visible `label`. Use this instead of a native `aria-label` on the host element (which is not a labelable role and would be an ARIA violation). Falls back to the `placeholder` so the combobox always has an accessible name. |
| `customClass` | `string` | `''` | Extra CSS classes for the control. |
| `selectedOption` | `SelectOption \| null` | `null` | The option matching the current `value`, for when its label lives on the server and is not in `options` yet. Without it a picker restored from a saved id shows the raw id until the user opens the panel. |
| `sheetOnNarrow` | `boolean` | `false` | Below 640px, open the panel as a bottom sheet — full width, clear of the home indicator and of the virtual keyboard the search box raises — instead of anchoring it to the trigger, where a phone has no room beside it. The kit's shared contract (`createSheetMode`, as `sv-dropdown-menu`). Off by default, so an existing app does not change on a phone. |
| `source` | `SvSelectSource<SelectOption> \| null` | `null` | Where the options come from — search, paging and async state as one object. Build it with `svSelectSource({ search, pageSize, minChars, debounceMs })` from `@styloviz/core`. With a source set the component fetches on open, searches as the user types, appends pages on "Load more" and retries a failure itself — no host handler is involved. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `selectionChange` | `string \| string[]` | Emitted with the new selection (string or string[]). |
| `dropdownOpen` | `void` | Emitted when the dropdown opens. |
| `dropdownClose` | `void` | Emitted when the dropdown closes. |
| `valueChange` | `string \| string[]` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Forms integration

A **ControlValueAccessor** works with `[formControl]`, `formControlName`, `[(ngModel)]` and Signal Forms `[formField]`. An **output-driven** component is bound through its own inputs and outputs instead — the reason is given for each.

| Component | Forms integration |
| --- | --- |
| `sv-select-dropdown` | ControlValueAccessor |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/select-dropdown

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
