# @styloviz/image-compare

> A before/after wipe that admits when it is not one: it measures both images' intrinsic sizes and says so when their aspect ratios disagree, because then part of what the reader sees as "the change" is the crop. Operated as a real ARIA slider — arrows, page keys, Home and End — which almost no implementation of this control is.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/image-compare
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
import { SvImageCompareComponent } from '@styloviz/image-compare';

@Component({
  standalone: true,
  imports: [SvImageCompareComponent],
  template: `
    <sv-image-compare
      [beforeSrc]="original"
      [afterSrc]="retouched"
      beforeAlt="the original"
      afterAlt="the retouch" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `ImageCompareVariant` | `'slider'` | Presentation: `'slider'` (draggable handle), `'bare'` (no handle; keyboard and drag still work) or `'inspect'` (adds the measured ratios). |
| `beforeSrc` | `string` | `''` | The image revealed on the left of the wipe. |
| `afterSrc` | `string` | `''` | The image revealed on the right of the wipe. |
| `beforeAlt` | `string` | `'the before image'` | Alt text, used in the slider's spoken value as well as on the images. "Before" and "after" are what the CONTROL does, not what the images are. A screen reader user hearing "50% after" learns nothing; "50% retouched" is the sentence a sighted reader gets from looking. |
| `afterAlt` | `string` | `'the after image'` | Alt text for the after image, also used as its name in the slider's spoken value. |
| `beforeLabel` | `string` | `''` | Corner captions. Empty hides them. |
| `afterLabel` | `string` | `''` | Corner caption on the after image; empty hides it. |
| `ariaLabel` | `string` | `'Comparison position'` | Accessible name for the slider itself. |
| `allowMismatch` | `boolean` | `false` | Suppress the aspect-ratio warning. Provided because a caller who has deliberately letterboxed both images to a common frame is telling the truth and the warning would be noise. It is NOT a way to silence a real mismatch, and the docs say so. |
| `landmarks` | `ImageCompareLandmarks` | `'none'` | Draw a fixed alignment reference over both images. |
| `position` | `number (two-way)` | `0.5` | Wipe position, 0–1. Two-way. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `mismatch` | `number` | Emitted once when the two images turn out not to be comparable. |
| `positionChange` | `number` | Emits the new `position` whenever it changes — the output half of `[(position)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/image-compare

## License

MIT
