# @styloviz/phone-input

> A phone number field with a country selector (local flag assets, no remote images) that drives @styloviz/forms' sv-input-mask with a per-country mask for the national number — the country code stays in the picker. Ships alongside sv-phone-flag, the picker's standalone flag-glyph component.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/icons @styloviz/forms @styloviz/core @styloviz/phone-input
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons`, `@styloviz/forms`, `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvPhoneFlagComponent } from '@styloviz/phone-input';

@Component({
  standalone: true,
  imports: [SvPhoneFlagComponent],
  template: `
    <sv-phone-flag />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `code` | `PhoneCountryCode \| string` | `'US'` | ISO 3166-1 alpha-2 country code. Unrecognized values render a neutral placeholder. |

## Forms integration

A **ControlValueAccessor** works with `[formControl]`, `formControlName`, `[(ngModel)]` and Signal Forms `[formField]`. An **output-driven** component is bound through its own inputs and outputs instead — the reason is given for each.

| Component | Forms integration |
| --- | --- |
| `sv-phone-input` | ControlValueAccessor |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
