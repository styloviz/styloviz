# @styloviz/watermark

> A repeating overlay tiled from the ROTATED bounding box, so the marks neither collide nor gap at an angle. Staggered rows, an opacity band that says which way it is wrong, and a signature a host can compare against to detect tampering.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/watermark
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
import { SvWatermarkComponent } from '@styloviz/watermark';

@Component({
  standalone: true,
  imports: [SvWatermarkComponent],
  template: `
    <sv-watermark text="Confidential" [opacity]="0.08">
      <div>…the document…</div>
    </sv-watermark>
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `WatermarkVariant` | `'tiled'` | Presentation: `'tiled'` across the whole box, one centred `'single'` mark, or `'inspect'` (tiled plus a note on what the mark is and is not). |
| `text` | `string` | `'Confidential'` | The mark. ⚠️ PRIVACY: whatever you put here is published to every screenshot, screen share and support ticket the page appears in — and to the DOM, the visually-hidden label and the `data-sv-signature` attribute. Do not put a viewer's name or email here; bind `viewerId` (or a server-minted token) instead. Dev mode warns once when the text looks like an email address. |
| `viewerId` | `string \| number \| null` | `null` | An id identifying the viewer, hashed into an opaque token by `svViewerToken(viewerId, viewerSalt)` and appended to the mark as `text · token`. The raw id never reaches the DOM. THE TOKEN IDENTIFIES THE VIEWER ONLY TO WHOEVER CAN MAP IT BACK — your server — rather than to every recipient of every screenshot. It is a hash, not a secret: see `svViewerToken` for why a guessable id space needs a salt. |
| `viewerSalt` | `string` | `''` | Salt mixed into the viewer token. Use a per-deployment value the client cannot guess. |
| `angle` | `number` | `-30` | Rotation in degrees. |
| `opacity` | `number` | `0.08` | 0–1. Outside roughly 0.04–0.25 the mark stops working — see `opacityVerdict`. |
| `fontSize` | `number` | `14` | Font size in px. |
| `gapX` | `number` | `80` | Extra space between marks, in px. |
| `gapY` | `number` | `60` | Extra vertical space between rows of marks, in px. |
| `stagger` | `boolean` | `true` | Offset every other row by half a tile. A square grid reads as columns, and columns leave clean vertical stripes a screenshot can be cropped to. |
| `observeResize` | `boolean` | `true` | Re-tile automatically when the box resizes (a `ResizeObserver` through `svElementSize`, throttled to one measurement per frame) and when web fonts finish loading. Turn it off to drive `measure()` yourself — e.g. for a box whose size you already track, or in a test. WITHOUT IT A RESIZED BOX KEEPS THE TILING IT WAS MEASURED AT — gaps down one edge when it grows, marks stacked past the clip when it shrinks. The observer measures the border box on the first render, so the first paint is already tiled; the server renders no marks (zero size) and the browser tiles on hydration. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `tampered` | `void` | Emitted by `checkIntegrity()` when the mark in the DOM no longer matches the signature the host captured. WHAT IT PROVES, PRECISELY: that at the moment of the check, in this browser, the rendered overlay was missing, hidden, or carried a different configuration (text, angle, opacity, font size) than the one expected — i.e. a client-side DOM mutation, or a configuration change, was observed. ⚠️ WHAT IT DOES NOT PROVE: that the content is protected, that nobody screenshotted it first, that a silent check means the mark was intact (the check runs in the same page an attacker controls; they can stub it, block the event, or copy the content out of the DOM without touching the overlay), or anything a compliance control needs — it is not an audit record, not tamper-evident, and not server-verified. The mark is not restored. Watermarking is deterrence, not security: treat this event as a telemetry hint, never as a control. A durable mark is burned in on the server (an exported PDF or image). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/watermark

## License

MIT
