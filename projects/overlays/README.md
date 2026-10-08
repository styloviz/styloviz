# @styloviz/overlays

> Overlay and feedback primitives — tooltip, result page, spinner and progress bar / ring.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/overlays
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
import { SvProgressBarComponent } from '@styloviz/overlays';

@Component({
  standalone: true,
  imports: [SvProgressBarComponent],
  template: `
    <sv-progress-bar [value]="64" variant="primary" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | `0` | Progress value (0–100). Ignored when `indeterminate` is true. |
| `max` | `number` | `100` | Maximum value. |
| `variant` | `ProgressBarVariant` | `'primary'` | Color variant. |
| `size` | `ProgressBarSize` | `'md'` | Bar height. |
| `striped` | `boolean` | `false` | Apply diagonal stripe pattern. |
| `animated` | `boolean` | `false` | Animate stripes (only visible when `striped` is true). |
| `glow` | `boolean` | `false` | Show pulsing glow on the fill. |
| `labelPos` | `ProgressBarLabelPos` | `'top'` | Label position. |
| `label` | `string` | `''` | Optional label text. If empty, the percentage is shown when labelPos is top/right. |
| `announceStep` | `number` | `5` | Quantization step for the value reported to assistive technology, in percent. |
| `showPercent` | `boolean` | `true` | Show percentage text. |
| `estimated` | `boolean` | `false` | The percentage is an ESTIMATE, not a measurement. |
| `stages` | `readonly string[]` | `[]` | The named phases of the work, in order. |
| `stageIndex` | `number` | `0` | Zero-based index into stages. |
| `indeterminate` | `boolean` | `false` | Indeterminate mode — shows an animated sliding fill. |
| `ariaLabel` | `string` | `''` | Accessible name for the progress bar (recommended for standalone bars). |
| `customClass` | `string` | `''` | Extra CSS classes merged onto the root wrapper. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `completed` | `void` | Emitted once when the bar first reaches 100% (determinate mode only). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/progress-bar

## License

MIT
