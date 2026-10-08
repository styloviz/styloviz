# @styloviz/streaming-markdown

> Safe Markdown renderer built for token-by-token output. Renders a parsed token model through Angular bindings — no innerHTML and no bypassSecurityTrust, so untrusted content can never become markup. Headings, lists (incl. tasks), tables with alignment, blockquotes and inline emphasis; fenced code delegates to sv-code-block.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/code-block @styloviz/streaming-markdown
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons`, `@styloviz/code-block` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvStreamingMarkdownComponent } from '@styloviz/streaming-markdown';

@Component({
  standalone: true,
  imports: [SvStreamingMarkdownComponent],
  template: `
    <sv-streaming-markdown [content]="markdown" [headingOffset]="2" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `string` | `''` | Markdown source. Safe to update on every streamed token. |
| `streaming` | `boolean` | `false` | Render a blinking caret after the last block, for in-flight responses. |
| `density` | `MarkdownDensity` | `'md'` | Text density. |
| `headingOffset` | `number` | `0` | Added to every heading level, so `#` becomes `<h3>` at an offset of 2. Use it to keep document headings from competing with the surrounding page. |
| `codeLineNumbers` | `boolean` | `false` | Show line numbers in fenced code blocks. |
| `codeMaxHeight` | `string` | `'20rem'` | Max height of a fenced code block, as a CSS length. |
| `ariaLabel` | `string` | `''` | Accessible label for the rendered region. |
| `completionMessage` | `string` | `'Response complete'` | What a screen reader is told when a streamed response finishes. A LIVE REGION UPDATED PER TOKEN IS UNUSABLE, which is why this component has never had one — but the silence had its own cost: a screen-reader user got no signal at all that generation had finished, and had to poll the region by hand to find out. The answer is not a quieter live region, it is a DIFFERENT event: `aria-busy` while the text is arriving, and one announcement at the moment it stops. Set to `''` to announce nothing at all. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `linkClick` | `MarkdownLinkClick` | Emits when a rendered link is activated. Call `preventDefault` upstream to intercept. |
| `codeCopied` | `string` | Emits the copied text when a fenced code block is copied. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/streaming-markdown

## License

MIT
