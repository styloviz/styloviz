# @styloviz/affix

> Pin an element while the page scrolls, with the placeholder that stops the jump. Optional container boundary so a pinned sidebar parks at the end of its section instead of floating over the footer.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/affix
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
import { SvAffixComponent } from '@styloviz/affix';

@Component({
  standalone: true,
  imports: [SvAffixComponent],
  template: `
    <!-- The affix reads scroll from the host: forward the scroll root (here, the window). -->
    <sv-affix #affix [offsetTop]="16" (window:scroll)="affix.onWindowScroll($event)">
      <nav>…</nav>
    </sv-affix>
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `offsetTop` | `number` | `0` | Gap between the viewport top and the pinned element, in px. |
| `container` | `HTMLElement \| null` | `null` | Stop the element at the bottom of this container. WITHOUT A BOUNDARY, A PINNED SIDEBAR FLOATS OVER THE FOOTER — and, being fixed, over whatever the reader scrolled down to look at. |
| `disabled` | `boolean` | `false` | Disable pinning entirely, e.g. below a breakpoint. |
| `holdRestingHeight` | `boolean` | `false` | Keep the placeholder at the height the content had IN FLOW while it is pinned, instead of following the content's live height. FOR SHRINK-ON-SCROLL HEADERS. A header that compacts from 80px to 48px once pinned would otherwise pull everything below it up by 32px mid-scroll. With this on, the page below never moves while the header animates; the pin threshold is measured from the placeholder either way, so a changing header height never moves the threshold and cannot re-pin it. |
| `floatingAnchor` | `SvFloatingAnchor \| null` | `null` | Join the shared floating layer while PINNED, as an occupied region at this anchor — usually `'top'` for a full-width bar, or a corner for a pinned card. Floating controls at that edge then stack clear of it, and regions ranked before it (a host's top banner) push it down through `collisionOffset`, which is added to `offsetTop`. `null` registers nothing and leaves the offset at 0 — the behaviour before this input existed. |
| `floatingOrder` | `number` | `SV_FLOATING_ORDER.affix` | Rank in the floating layer; lower sits nearer the edge. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `affixChange` | `AffixMode` | Emitted whenever the mode changes. |
| `containingBlockChange` | `SvAffixContainingBlock \| null` | Emitted when an ancestor turns out to be the containing block for `position: fixed` — a `transform`, `filter`, `perspective`, `backdrop-filter`, `will-change`, `contain`, `content-visibility`, `transform-style: preserve-3d` or `container-type` on any ancestor — so the pinned element is positioned against that ancestor and scrolls away with it. Checked each time the element pins; `null` once the viewport is the containing block again. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/affix

## License

MIT
