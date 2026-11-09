# @styloviz/badge

> Compact status and category labels with 8 tone variants and 3 visual styles.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/badge
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
import { SvBadgeComponent } from '@styloviz/badge';

@Component({
  standalone: true,
  imports: [SvBadgeComponent],
  template: `
    <sv-badge label="Active" variant="success" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `BadgeVariant` | `'primary'` | Semantic color/intent (primary, success, warning, danger…). |
| `badgeStyle` | `BadgeStyle` | `'soft'` | Visual treatment: filled, soft or outline. |
| `shape` | `BadgeShape` | `'pill'` | Corner style: pill, rounded or square. |
| `size` | `BadgeSize` | `'md'` | Badge size: sm, md or lg. |
| `label` | `string` | `''` | Badge text. Omit when using count mode or projecting content. |
| `dot` | `boolean` | `false` | Show status dot. |
| `pulseDot` | `boolean` | `false` | Animate dot with ping. |
| `count` | `number` | `0` | When > 0, renders count mode (overrides label). |
| `maxCount` | `number` | `99` | Cap for count display (shows "N+"). |
| `icon` | `string` | `''` | Icon-library NAME for the leading icon — e.g. `'star'`. Was a raw `d`. |
| `dismissible` | `boolean` | `false` | Show dismiss button. |
| `customClass` | `string` | `''` | Extra CSS classes merged on root. |
| `ariaLabel` | `string` | `''` | aria-label override — replaces the visible text as the accessible name. **Required for an icon-only or dot-only badge** (no `label`, no `count`): the icon is decorative, so without this the badge says nothing at all to a screen reader. Dev mode warns when it is missing. |
| `live` | `boolean` | `false` | Announce the badge as a polite ARIA live region (`role="status"`). Enable for dynamic notification counts/statuses that update in place so assistive tech is notified of changes. Leave `false` for static labels and tags to avoid noisy announcements. |
| `announceTone` | `boolean` | `false` | Append the tone as a visually hidden word — "Paid, success", "Overdue, error" — for the `success`, `warning`, `danger` and `info` variants, so the status is not carried by colour alone (WCAG 1.4.1). Other variants have no tone and add nothing. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `dismissed` | `void` | Emitted when the dismiss button is clicked. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/badge

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
