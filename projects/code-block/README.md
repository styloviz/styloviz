# @styloviz/code-block

> Read-only source display with a zero-dependency highlighter for 9 languages. Four variants — block, multi-file tabs, diff (unified or split with per-hunk accept/reject) and terminal — plus streaming-safe rendering, line numbers, soft wrap, line highlighting, copy-to-clipboard, and a render cap for files too long to draw in full.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/code-block
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons`, `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvCodeBlockComponent } from '@styloviz/code-block';

@Component({
  standalone: true,
  imports: [SvCodeBlockComponent],
  template: `
    <sv-code-block [code]="source" filename="user.service.ts" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `CodeBlockVariant` | `'block'` | Layout preset. |
| `code` | `string` | `''` | Source text — the quickest way to render a single snippet. |
| `language` | `CodeLanguage \| null` | `null` | Language for `code`. Inferred from `filename` when left unset. |
| `filename` | `string` | `''` | File name shown in the header and used for language inference. |
| `files` | `readonly CodeFile[]` | `[]` | Files for the `tabs` variant. Overrides `code` / `filename` when non-empty. |
| `hunks` | `readonly DiffHunk[]` | `[]` | Hunks for the `diff` variant. |
| `terminalLines` | `readonly TerminalLine[]` | `[]` | Lines for the `terminal` variant. |
| `diffMode` | `CodeBlockDiffMode` | `'unified'` | Diff layout. Ignored unless `variant` is `'diff'`. |
| `lineNumbers` | `boolean` | `true` | Show the gutter with line numbers. |
| `wrap` | `boolean` | `false` | Soft-wrap long lines instead of scrolling horizontally. |
| `showHeader` | `boolean` | `true` | Show the header bar (file name, language badge, copy button). |
| `copyable` | `boolean` | `true` | Show the copy-to-clipboard button. |
| `highlightLines` | `readonly number[]` | `[]` | 1-based line numbers to emphasise. |
| `maxHeight` | `string` | `'24rem'` | Max height of the scroll region, as a CSS length. |
| `maxRenderedLines` | `number` | `600` | Rendering threshold, in lines. Beyond it the block truncates and offers a "show all" control. `0` renders everything, however long. Applies to `block` and `tabs`. A diff is bounded by its hunks and the terminal transcript by `terminalLines`, so neither needs a cap the caller has not already applied. "Show all" holds until the tab changes or the content is replaced; a buffer that only grows (a streamed answer) stays expanded. |
| `streaming` | `boolean` | `false` | Render a blinking caret after the last line, for in-flight responses. |
| `ariaLabel` | `string` | `''` | Accessible name for the scroll region. Falls back to the file name. |
| `reviewable` | `boolean` | `false` | Show per-hunk accept / reject buttons in diff mode. |
| `activeTab` | `number (two-way)` | `0` | Index of the visible tab in the `tabs` variant. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `copied` | `string` | Emits the copied text after a successful clipboard write. |
| `tabChange` | `CodeFile` | Emits the newly selected file when the user switches tab. |
| `hunkAction` | `DiffHunkEvent` | Emits when a diff hunk is accepted or rejected. |
| `activeTabChange` | `number` | Emits the new `activeTab` whenever it changes — the output half of `[(activeTab)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/code-block

## License

MIT
