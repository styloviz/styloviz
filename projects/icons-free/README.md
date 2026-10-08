# @styloviz/icons

> 174 original glyphs on a 24px grid, resolved by name through one component or imported per icon for the smallest bundle. currentColor throughout, so an icon inherits its text colour in light and dark mode. Pro adds 513 more glyphs and the `sharp` and `duotone` weights.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Self-contained — no other Styloviz packages required. Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvIconComponent } from '@styloviz/icons';

@Component({
  standalone: true,
  imports: [SvIconComponent],
  template: `
    <sv-icon name="arrow-right" />
    <sv-icon name="check-circle" size="lg" cssClass="text-emerald-500" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `IconName \| (string & {})` | `—` | Icon name. Built-in names are type-checked; custom (provided) names are also accepted. |
| `size` | `IconSize` | `'md'` | Rendered size in px, or a named token (`sm`/`md`/`lg`). |
| `strokeWidth` | `number` | `1.75` | Stroke width in viewBox units (line weight only). |
| `weight` | `IconWeight` | `'line'` | Visual weight. |
| `title` | `string \| null` | `null` | Accessible label. When set the icon is exposed as `role="img"`; otherwise it is `aria-hidden`. |
| `flip` | `IconFlip` | `null` | Mirror the icon horizontally or vertically. |
| `rotate` | `number` | `0` | Rotate the icon clockwise, in degrees, around its centre. |
| `cssClass` | `string` | `''` | Extra CSS classes applied to the root `<svg>` (e.g. Tailwind `text-*`). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/icon-library

## Brand icons & trademarks

The **Brands** category contains logos and marks of third-party companies and
products (LinkedIn, YouTube, Slack, GitHub, and others), provided purely as
convenience glyphs for building interfaces that reference those services.

- **Trademarks belong to their owners.** All brand names, logos, and marks are
  the property of their respective owners. Their inclusion here does **not**
  imply any affiliation with, sponsorship by, or endorsement by those
  companies, nor any endorsement of them by Styloviz.
- **Glyph source.** Brand glyphs are derived from
  [Simple Icons](https://simpleicons.org), dedicated to the public domain under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). CC0 covers the
  copyright in the drawings only — it grants no rights in the underlying
  trademarks, which are not ours to license.
- **Your responsibility.** When you use a brand icon, you are responsible for
  complying with that brand's own trademark and brand guidelines (including any
  rules on color, spacing, or modification). Some brands prohibit recoloring
  their logo; the monochrome versions here may not satisfy every brand's
  guidelines for every use.
- **Removal requests.** If you are a rights holder and would like your mark
  removed, please open an issue or contact <YOUR-CONTACT-EMAIL> and we will
  remove it promptly.

Styloviz and its authors make no warranty that any particular use of these
brand icons is permitted, and accept no liability for how they are used.

## License

MIT
