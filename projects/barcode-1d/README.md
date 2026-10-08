# @styloviz/barcode-1d

> Code 128, EAN-13 and EAN-8 rendered as SVG from a real encoder: mod-103 and mod-10 check characters computed rather than trusted, EAN-13's leading digit carried in the left-half parity, subset-C packing so a long serial fits the label, spec quiet zones, and a module width snapped to whole device pixels. Refuses to draw what cannot scan, and says why.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/barcode-1d
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
import { SvBarcode1dComponent } from '@styloviz/barcode-1d';

@Component({
  standalone: true,
  imports: [SvBarcode1dComponent],
  template: `
    <sv-barcode-1d value="5901234123457" symbology="ean13" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the value to encode is being fetched; shows a skeleton in place of the barcode. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure, shown as an error panel in place of the content. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `variant` | `BarcodeVariant` | `'labelled'` | Bars with text, bars alone, or bars with the encoder's report. |
| `value` | `string` | `''` | What to encode. For EAN, with or without the check digit. |
| `symbology` | `BarcodeSymbology` | `'code128'` | Barcode standard `value` is encoded in: `'code128'`, `'ean13'` or `'ean8'` (check digit computed). |
| `requestedModuleWidth` | `number` | `2` | Requested width of one module, in CSS px. Requested, not final — see `moduleWidth`. A module narrower than a whole device pixel antialiases, and a scanner reads the antialiasing as different run widths. |
| `devicePixelRatio` | `number` | `1` | Device pixel ratio to snap against. |
| `barHeight` | `number` | `64` | Bar height in px, excluding the human-readable text. |
| `showQuietZone` | `boolean` | `false` | Draw the quiet zones as a visible margin outline. For the `inspect` view. The quiet zone is invisible by nature, which is exactly why people lay a barcode flush against a border and cannot see what broke it. |
| `printModuleWidthMm` | `number` | `0` | Physical width of one module when printed, in millimetres. `0` leaves the printed size to the browser, which is what an untouched print job does. This is the X-dimension, the quantity ISO/IEC 15416 and GS1 actually specify — and the reason it exists as its own input is that CSS pixels do not survive a print dialog. Pin it and the symbol measures the same on paper whatever "fit to page" decides. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | Emitted when the user presses the error panel's "Try again" button (retryable errors only); the host should re-run the failed load. |
| `encodeError` | `string` | Emitted whenever the value cannot be encoded, with the reason. |
| `scanSizeWarning` | `SvBarcodeScanSize` | Emitted when the symbol's physical size falls below the floor its symbology may be printed at. Carries the measurements, so a label pipeline can refuse the job rather than print a roll of stickers that will not read. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/barcode-1d

## License

MIT
