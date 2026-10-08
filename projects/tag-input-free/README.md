# @styloviz/tag-input

> 9 premium multi-select tag-input variants: default, avatar, grouped, creatable, colors, token limit, async search, inline and overflow.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/tag-input
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
import { SvTagInputComponent } from '@styloviz/tag-input';

@Component({
  standalone: true,
  imports: [SvTagInputComponent],
  template: `
    <sv-tag-input
      [options]="options"
      [(values)]="tags"
      (tagsChange)="onChange($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `values` | `string[] (two-way)` | `[]` | Current tags (two-way). |
| `options` | `TagOption[]` | `[]` | Suggestion options offered as the user types. |
| `compareWith` | `((a: string, b: string) => boolean) \| null` | `null` | What "the same tag" means. Defaults to strict equality on `value`. ⚠️ FREE, NOT PRO. `check:parity` flagged it as an undeclared Pro-only member and was right to: knowing whether two values are the same tag is correctness, not a premium feature, and a free control that silently duplicates a selection is broken rather than merely basic. |
| `size` | `TagInputSize` | `'md'` | Field size: sm, md or lg. |
| `label` | `string` | `''` | Field label. |
| `placeholder` | `string` | `'Add tags…'` | Placeholder shown in the input. |
| `hint` | `string` | `''` | Helper text shown below the field. |
| `errorMessage` | `string` | `''` | Error message; sets the field to an error state when present. |
| `serverError` | `string \| { readonly message: string } \| null` | `null` | A validation failure reported by the **server** — the 422 that comes back after submit, not something the client could have known. It is a separate input from `errorMessage` because it has a different lifetime, not because it needs a second way to show a string. A server error is a statement about *the value that was submitted*: the moment the user edits the field it stops being true, and this input expires itself rather than sitting there telling someone their new email is already taken. `errorMessage` has no such expiry — it is the host's to clear. While live it outranks `errorMessage`: it is the more specific fact, and it is the one the user has not seen yet. Typed structurally rather than as `SvDataError` so this stays dependency free — an `SvDataError` satisfies it unchanged. |
| `disabled` | `boolean` | `false` | Disable the field. |
| `required` | `boolean` | `false` | Mark the field as required. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `tagsChange` | `TagInputChangeEvent` | Emitted with the change (added/removed tag + full list). |
| `valuesChange` | `string[]` | Emits the new `values` whenever it changes — the output half of `[(values)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/tag-input

## License

MIT
