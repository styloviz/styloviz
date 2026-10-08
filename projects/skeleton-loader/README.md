# @styloviz/skeleton-loader

> Loading placeholders with wave/pulse animations and preset layouts.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/skeleton-loader
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
import { SvSkeletonLoaderComponent } from '@styloviz/skeleton-loader';

@Component({
  standalone: true,
  imports: [SvSkeletonLoaderComponent],
  template: `
    <sv-skeleton-loader preset="card" animation="wave" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `SkeletonPreset` | `'custom'` | High-level composed preset. Set to `'custom'` (or omit) to control individual bone inputs. |
| `shape` | `SkeletonShape` | `'line'` | Shape of the skeleton bone. |
| `width` | `string` | `'100%'` | CSS width applied to the bone element. Accepts any valid CSS value: `'100%'`, `'8rem'`, `'w-1/2'` (Tailwind class). |
| `height` | `string` | `'1rem'` | CSS height applied to the bone element. |
| `rounded` | `string` | `''` | Border-radius override. Accepts Tailwind rounded-* class suffix: `'none'` `'sm'` `'md'` `'lg'` `'xl'` `'full'`. Shape defaults apply when left empty. |
| `lines` | `number` | `1` | Repeat this bone N times stacked vertically. Gaps between repeated lines are automatic. |
| `shortLastLine` | `boolean` | `true` | When `lines > 1`, make the last line shorter (like a real paragraph ending). |
| `animation` | `SkeletonAnimation` | `'wave'` | Shimmer animation style. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Overall size multiplier that scales preset bone heights. |
| `customClass` | `string` | `''` | Additional CSS classes merged onto the root wrapper. |
| `ariaLabel` | `string` | `'Loading content…'` | Accessible label announced to screen readers while content loads. |
| `announce` | `boolean` | `true` | Whether this skeleton announces the wait itself. |
| `slowAfterMs` | `number` | `0` | Say "this is taking longer than usual" after this many ms. `0` = never. A STUCK SKELETON IS INDISTINGUISHABLE FROM A FAILED REQUEST, AND IT LIES IN THE EXACT PLACE THE DATA WAS GOING. It says "the shape of your content is arriving" — permanently, if the host's request failed silently. There was no timeout, no error and no retry: the placeholder simply outlived the thing it was standing in for. Off by default, because the honest threshold depends on what is loading and because turning it on adds text to every existing layout. |
| `stalledAfterMs` | `number` | `0` | Escalate to a stuck message (with a retry offer) after this many ms. Measured from the same start, not from `slowAfterMs`. `0` = never. |
| `slowMessage` | `string` | `'This is taking longer than usual…'` | Message shown at the `slow` stage. |
| `stalledMessage` | `string` | `'This content could not be loaded.'` | Message shown at the `stalled` stage. |
| `retryLabel` | `string \| null` | `null` | Label for the retry offer shown once the wait is `stalled`. `null` = none. AN OUTPUT CANNOT BE ASKED WHETHER ANYONE IS LISTENING, so the offer is an input: a placeholder that renders "Try again" and does nothing when it is pressed is worse than one that never offered. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The user pressed the retry offer on a stalled skeleton. |
| `escalated` | `SvWaitStage` | Fires on each escalation: `'slow'`, then `'stalled'`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/skeleton-loader

## License

MIT
