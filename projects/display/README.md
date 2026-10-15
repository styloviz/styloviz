# @styloviz/display

> Content display components — carousel, image gallery, drag-and-drop list, description lists, a JSON tree viewer, line clamp and overflow lists.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/display
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
import { SvCarouselComponent } from '@styloviz/display';

@Component({
  standalone: true,
  imports: [SvCarouselComponent],
  template: `
    <sv-carousel [slides]="slides" [autoPlay]="true" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the slides are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No slides to show'` | Copy for the no-data state. |
| `filtered` | `boolean` | `false` | True when the emptiness is caused by a filter rather than an empty set. |
| `slides` | `readonly CarouselSlide[]` | `[]` | Slides to display (image, caption, optional link). |
| `variant` | `CarouselVariant` | `'default'` | Visual variant. `default` slides full-bleed; `fade` cross-fades in place; `card` insets each slide as a rounded, shadowed card; `coverflow` shows the neighbouring slides scaled down either side of the active one. Under `prefers-reduced-motion` every variant keeps its layout but drops the transition. |
| `indicator` | `CarouselIndicator` | `'dots'` | Indicator style: dots, lines, numbers or none. |
| `autoPlay` | `boolean` | `false` | Auto-advance slides. |
| `interval` | `number` | `4000` | Auto-advance interval in ms. |
| `loop` | `boolean` | `true` | Wrap from last slide back to first. |
| `arrows` | `boolean` | `true` | Show prev/next arrows. |
| `aspectRatio` | `string` | `'16/9'` | CSS aspect-ratio for the viewport. |
| `pauseOnHover` | `boolean` | `true` | Pause auto-advance while the carousel is hovered or focused. |
| `ariaLabel` | `string` | `'Carousel'` | Accessible name for the carousel region. |
| `priority` | `boolean` | `false` | Load the first slide's image eagerly at high fetch priority. Set it when the carousel is above the fold — a hero image is usually the page's Largest Contentful Paint, and a lazy one is fetched only after layout. Later slides stay lazy either way. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `slideChange` | `number` | Emitted with the active slide index when it changes. |
| `pausedChange` | `boolean` | Emitted when the user toggles auto-play; payload is the paused state. |
| `ctaClick` | `CarouselSlide` | Emitted with the slide whose call-to-action was activated (click, Enter or Space). A slide with `ctaLink` still navigates; this fires first, so it suits analytics. A slide without one has no other effect — handle it here. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/carousel

## License

MIT
