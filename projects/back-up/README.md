# @styloviz/back-up

> Back and Up as two different controls, because they are two different promises: back is history and may leave the site, up is hierarchy and is always defined. A back control with nothing behind it goes up rather than dead-ending, and says which it did.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/back-up
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
import { SvBackUpComponent } from '@styloviz/back-up';

@Component({
  standalone: true,
  imports: [SvBackUpComponent],
  template: `
    <sv-back-up [up]="'/orders'" upLabel="Orders" (navigated)="log($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `BackUpMode` | `'back'` | What this control promises. `back` returns through history and falls back to up; `up` always goes to up. |
| `up` | `SvLinkTarget \| null` | `null` | The hierarchical parent — where "up" goes, and where "back" lands when there is no history. **Required in practice**: without it a `back` control has no fallback and can still dead-end, which is the defect this component exists to prevent. Warns once in dev when it is missing. |
| `upLabel` | `string` | `''` | Name of the up destination, used in the visible text and the accessible name — "Back to Orders", "Up to Orders". Without it the control reads as a bare "Back", which tells a screen-reader user nothing about where they will end up. |
| `label` | `string` | `''` | Override the whole visible text. Leave unset to compose it from mode and upLabel. |
| `stayInSite` | `boolean` | `false` | Only use history when the previous entry is provably this app's — otherwise go up. OFF BY DEFAULT, AND THAT IS THE RIGHT DEFAULT FOR A *BACK* CONTROL. Back meaning "the browser's back", including off the site, is what the word has always meant and what the hardware button does. Turn this on for a control that is really *"return to where you were in this app"* — a wizard's escape hatch, a detail page's return-to-list — where leaving the site is never the intended answer. "Provably ours" means: this control has observed at least one in-app navigation since it was created, **or** `document.referrer` is same-origin. Anything else is treated as not ours, because the failure modes are not symmetric — going up when back would have worked is a mild surprise; leaving the site when the user expected to stay is a lost session. ⚠️ In a single-page app both signals are weaker: a router's `pushState` is not observed, a control inside a routed page starts counting from zero on each route, and `document.referrer` describes how the reader entered the app, not the entry behind this one. So it errs towards going up. |
| `variant` | `BackUpVariant` | `'ghost'` | Visual treatment. |
| `size` | `BackUpSize` | `'md'` | Control size. |
| `disabled` | `boolean` | `false` | Prevents the control from being used. |
| `iconOnly` | `boolean` | `false` | Show only the arrow, keeping the text as the accessible name. Useful in a dense toolbar. |
| `surfaceId` | `string \| null` | `null` | Names this control in the shared navigation-analytics stream, when a page has more than one. Ignored unless `provideSvNavTelemetry()` is wired up. |
| `customClass` | `string` | `''` | Additional CSS classes on the control. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `navigated` | `BackUpNavigation` | What the control did. Always emitted, including when the fallback fired — see BackUpNavigation.reason. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/back-up

## License

MIT
