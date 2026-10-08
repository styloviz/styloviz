# @styloviz/layout

> App-shell and layout primitives — sidebar, topbar, page header, dashboard shell, footers, divider, toolbar, expand, plus copy-to-clipboard and scroll-to-top.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/toast @styloviz/layout
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons`, `@styloviz/core`, `@styloviz/toast` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvCopyToClipboardComponent } from '@styloviz/layout';

@Component({
  standalone: true,
  imports: [SvCopyToClipboardComponent],
  template: `
    <sv-copy-to-clipboard text="npm i @styloviz/core" variant="inline" (copied)="onCopied()" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | `''` | Text to copy to clipboard. |
| `successLabel` | `string` | `'Copied!'` | Label shown after successful copy. |
| `successDuration` | `number` | `2000` | Duration in ms before reverting to default state. |
| `variant` | `CopyVariant` | `'inline'` | Display variant. |
| `size` | `CopySize` | `'md'` | Component size. |
| `label` | `string` | `''` | Placeholder shown when no text content is provided via ng-content. |
| `ariaLabel` | `string` | `'Copy to clipboard'` | Accessible name of the copy button — the only name `icon-only` has. Name WHAT is copied ("Copy API key"), and localise it here. Never derived from `label`, which may be the (sensitive) value itself. |
| `sensitive` | `boolean` | `false` | Treat the value as a secret — an API key, a recovery code, a token. A COPIED SECRET LEAVES NO TRACE AND GETS NO WARNING from a generic copy button. On: the `label` is masked, the success announcement becomes `sensitiveWarning`, and every copy emits `copyAudited`. Off by default — the common use is a command or an id, and masking those would break them. |
| `sensitiveReveal` | `CopySensitiveReveal` | `'masked'` | How a `sensitive` label is shown: `masked`, `revealable` (toggle) or `visible`. |
| `sensitiveField` | `string` | `'value'` | Which field was copied, for the audit event's `field`. |
| `sensitiveWarning` | `string` | `'Copied. This value is secret — do not …` | Announced (and shown in the block variant) after a sensitive copy. |
| `requireAuthorization` | `boolean` | `true` | Whether revealing a `sensitiveReveal="revealable"` value needs the host's authorization first. While on and `revealAuthorized` is off, the toggle emits `revealRequest` instead of revealing — step up, then set `revealAuthorized`. |
| `revealAuthorized` | `boolean` | `false` | The host has re-authenticated the user; the reveal toggle may reveal. |
| `copyTimeout` | `number` | `SV_COPY_TIMEOUT_MS` | How long (ms) a clipboard write may stay pending before it is abandoned as `failed` and `busy` clears. A write that never settles — a permission prompt left open, a native bridge that never answers — would otherwise leave the button busy forever. A late answer after the timeout is ignored. An invalid value (`0`, negative, `NaN`, `Infinity`) uses the default. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `copied` | `void` | Emitted after text is successfully copied. |
| `copyError` | `unknown` | Emitted when copying fails (both the Clipboard API and the fallback), or when the write did not settle within `copyTimeout`. The payload is an `SvClipboardError`: `reason` classifies it — `denied`, `insecure-context`, `unavailable` or `failed` (also used for a timeout). When both paths ran and failed, `cause` (and so `message`) is the FALLBACK's error — the last one thrown — while `reason` is derived from the Clipboard API's rejection. Typed `unknown` for compatibility; narrow with `instanceof SvClipboardError`. |
| `copyAudited` | `SvSensitiveCopyEvent` | A `sensitive` value reached the clipboard. The event says who, which field and when — never the value itself. Log it. |
| `revealRequest` | `void` | The user asked to reveal while `requireAuthorization` was on and `revealAuthorized` off. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/copy-to-clipboard

## License

MIT
