# @styloviz/ai

> Free AI chat building blocks — starter-prompt suggestions and the per-message action row (copy that confirms only when the clipboard write lands, thumbs up / down, regenerate).

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/ai
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
import { SvMessageActionsComponent } from '@styloviz/ai';

@Component({
  standalone: true,
  imports: [SvMessageActionsComponent],
  template: `
    <sv-message-actions [text]="message.content" [(feedback)]="message.feedback" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | `''` | The text the copy action writes to the clipboard. |
| `actions` | `readonly SvMessageAction[]` | `['copy', 'like', 'dislike']` | Which built-in actions to show, in this order. |
| `feedback` | `SvMessageFeedback (two-way)` | `null` | The reader's verdict. Two-way: the thumbs are mutually exclusive, and pressing the active one again clears it. |
| `copyResetMs` | `number` | `2000` | How long the "Copied" confirmation stays, in milliseconds. |
| `ariaLabel` | `string \| null` | `null` | The group's accessible name; `null` uses the `messageActions` label. |
| `labels` | `Partial<SvAiLabels>` | `{}` | Per-instance text, merged over the registry's `ai` labels. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `copied` | `string` | The text reached the clipboard. The payload is that text. |
| `copyFailed` | `void` | The clipboard refused. The button shows its failed state and the hint names the shortcut; offer the text another way if you can. |
| `regenerate` | `void` | The user asked for another answer. |
| `feedbackChange` | `SvMessageFeedback` | Emits the new `feedback` whenever it changes — the output half of `[(feedback)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/message-actions

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
