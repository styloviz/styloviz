# @styloviz/alert-banner

> Dismissible alert banners in 5 semantic variants and multiple display styles.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/alert-banner
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
import { SvAlertBannerComponent } from '@styloviz/alert-banner';

@Component({
  standalone: true,
  imports: [SvAlertBannerComponent],
  template: `
    <sv-alert-banner variant="warning" title="Heads up" message="Your trial ends in 3 days." [dismissible]="true" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Bold heading line. Leave empty to render body-only. |
| `message` | `string` | `''` | Main alert message text. |
| `variant` | `AlertVariant` | `'info'` | Semantic color. |
| `alertStyle` | `AlertStyle` | `'soft'` | Visual treatment. |
| `size` | `AlertSize` | `'md'` | Size controls padding and text scale. |
| `position` | `AlertPosition` | `'inline'` | Positioning mode. - `inline` — block element in document flow (default) - `top-fixed` — fixed to viewport top, full width - `bottom-fixed` — fixed to viewport bottom, full width - `top-sticky` — sticky inside its scroll container |
| `showIcon` | `boolean` | `true` | Show the leading icon. |
| `icon` | `string` | `''` | Icon-library NAME overriding the default variant icon — e.g. `'bell'`. Leave empty to use the built-in icon for the current variant. BREAKING (icon sweep): was `iconPath`, a raw `<path d="…">`. `iconViewBox` is GONE — it only existed because a raw path might not be 24-box. |
| `actions` | `AlertAction[]` | `[]` | Up to 2 action buttons rendered inline. Each button emits its `id` via `actionClick`. |
| `dismissible` | `boolean` | `true` | Show the × close button. |
| `autoDismissMs` | `number` | `0` | Auto-dismiss after N milliseconds. Set to 0 to disable auto-dismiss. |
| `priority` | `number` | `0` | Stack weight for a pinned banner: higher sits against the edge. |
| `dedupeKey` | `string \| null \| undefined` | `undefined` | Identity for suppressing a duplicate pinned banner. \| Value \| Meaning \| \|-----------\|------------------------------------------------------------\| \| omitted \| derive from variant + style + title + message \| \| a string \| suppress on that, whatever the text \| \| `null` \| never suppress \| A SUPPRESSED BANNER RENDERS NOTHING — no count, unlike a deduplicated toast. A toast reports an EVENT, so "it happened eleven times" is information; a banner reports a STATE, and "your trial expires ×2" is not a thing that can be true. |
| `customClass` | `string` | `''` | Additional CSS classes merged on the root element. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `dismissed` | `void` | Emitted after the alert finishes its close animation. |
| `actionClick` | `string` | Emitted when an action button is clicked, carrying the action `id`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/alert-banner

## License

MIT
