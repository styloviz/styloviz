# @styloviz/kbd

> A native `<kbd>` wrapper for rendering keyboard shortcuts and hint keys, with three visual variants and two sizes so every shortcut hint in the kit shares one styled source instead of one-off utility classes.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/kbd
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list it yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvKbdComponent } from '@styloviz/kbd';

@Component({
  standalone: true,
  imports: [SvKbdComponent],
  template: `
    <sv-kbd chord="mod+K" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string` | `''` | The key, by name or by glyph — `cmd`, `shift`, `esc`, `⌘`, `K`. The point of this input is the spoken name. `⌘` is U+2318 place of interest sign and a screen reader says "place of interest sign", or nothing at all; `⇧` is upwards white arrow; `↵` is downwards arrow with corner leftwards. None of those is the name of a key, and the entire content of a shortcut hint is which keys to press — so a hint made of projected glyphs is documentation nobody can hear. Given the key, the component draws the glyph AND knows what it is called, so the symbol is hidden from assistive tech behind the word. Glyphs are accepted as well as tokens because hosts already have `⌘` hard-coded in a hundred templates, and a fix that requires rewriting all of them first is a fix that never gets adopted. |
| `chord` | `string` | `''` | A whole chord — `"cmd+shift+K"` — rendered as one unbreakable group. "Ctrl +" at the end of a line and "C" at the start of the next is not a shortcut, it is two. A literal `+` is written `++`. |
| `sequence` | `string` | `''` | A SEQUENCE — chords pressed one after another — separated by spaces: `"g i"` (Gmail's "go to inbox"), `"mod+k mod+s"`. Each step is drawn as its own unbreakable chord with "then" between them, and announced as "G then I". Takes precedence over `chord` and `key`. |
| `platform` | `'auto' \| SvKbdPlatform` | `'auto'` | Which keyboard to draw for, which is what the `mod` token resolves by — Command (⌘) on `apple`, Control on `other`. `auto` reads the platform in the browser; on the server it answers `other`, so a prerendered `mod` reads "Ctrl" until hydration (see `svKbdPlatform`). |
| `variant` | `KbdVariant` | `'solid'` | Visual weight. |
| `size` | `KbdSize` | `'sm'` | Chip size. |
| `ariaLabel` | `string` | `''` | Accessible label when the projected content is a symbol a screen reader won't say usefully on its own (e.g. `↵`, `⌘`) — announced instead of the glyph. Leave unset for plain text keys (`Esc`, `Tab`), which already read fine. |
| `customClass` | `string` | `''` | Extra classes appended after the resolved variant/size classes. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/kbd

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
