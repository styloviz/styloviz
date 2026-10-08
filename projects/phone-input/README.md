# @styloviz/phone-input

> A phone number field with a country selector (local flag assets, no remote images) that drives @styloviz/forms' sv-input-mask phone-us/phone-intl presets. Ships alongside sv-phone-flag, the picker's standalone flag-glyph component.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

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

## Documentation

Full API reference and live demos: https://styloviz.dev/docs

## License

MIT
