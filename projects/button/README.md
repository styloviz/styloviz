# @styloviz/button

> 10 variants × 6 styles × 5 sizes × 3 shapes — solid, outline, soft, ghost, link and gradient with loading states and icon support.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/button
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
import { SvButtonComponent } from '@styloviz/button';

@Component({
  standalone: true,
  imports: [SvButtonComponent],
  template: `
    <sv-button label="Primary" />
    <sv-button label="Soft" btnStyle="soft" variant="secondary" />
    <sv-button label="Loading" [loading]="true" (clicked)="save()" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | `'primary'` | Semantic color/intent: primary, secondary, success, danger, etc. |
| `btnStyle` | `ButtonStyle` | `'solid'` | Visual treatment: solid, soft, outline, ghost, link or gradient. |
| `size` | `ButtonSize` | `'md'` | Button size from xs to xl. |
| `shape` | `ButtonShape` | `'rounded'` | Corner style: rounded, pill or square. |
| `block` | `boolean` | `false` | Stretch to 100% width. |
| `elevated` | `boolean` | `false` | Add drop shadow. |
| `label` | `string` | `''` | Button text. Omit when projecting custom content. |
| `icon` | `string` | `''` | Icon-library NAME for the built-in leading/trailing icon — e.g. `'plus'`. Ignored when `iconTemplate` is set. A raw SVG `d` string is not a name and renders no icon. |
| `trailingIcon` | `string` | `''` | Icon-library NAME for the secondary/dual trailing icon. Ignored when `trailingIconTemplate` is set. Was `trailingIconPath`. |
| `iconTemplate` | `ButtonIconTemplate` | `null` | Custom template for the primary icon — use this to render a third-party icon component (e.g. lucide-angular, ngx-heroicons), an `<img>`, an icon font `<i>`, or arbitrary custom SVG instead of the built-in `icon`. Positioned per `iconPosition()`. Takes precedence over `icon` when set. |
| `trailingIconTemplate` | `ButtonIconTemplate` | `null` | Custom template for the secondary/dual trailing icon. Takes precedence over `trailingIcon` when set. See `iconTemplate` for usage. |
| `iconPosition` | `ButtonIconPos` | `'leading'` | Where the main icon sits relative to the label. |
| `counter` | `number \| null` | `null` | Numeric counter badge. null = hidden. |
| `counterMax` | `number` | `99` | Value above which the counter shows "{max}+". |
| `counterLabel` | `string` | `''` | Noun describing the counter for screen readers, e.g. "unread". |
| `type` | `ButtonType` | `'button'` | Native button type when not in link mode. |
| `disabled` | `boolean` | `false` | Disable interaction and dim the button. |
| `loading` | `boolean` | `false` | Show a loading indicator and block activation. |
| `loadingStyle` | `ButtonLoader` | `'spinner'` | Loading indicator style: spinner, dots or pulse. |
| `loadingLabel` | `string` | `''` | Optional text shown beside the loading indicator. |
| `preventDoubleSubmit` | `boolean` | `false` | Ignore a second activation that lands within `doubleSubmitWindowMs` of the one before it. |
| `doubleSubmitWindowMs` | `number` | `400` | How long a repeat activation is ignored for, in milliseconds. |
| `announceLoading` | `boolean` | `true` | Announce the loading state in a live region. |
| `href` | `string` | `''` | When set, renders an <a> anchor instead of a <button>. |
| `target` | `string` | `'_self'` | Anchor target (e.g. _blank) when href is set. |
| `rel` | `string` | `''` | Anchor rel. `noopener noreferrer` is auto-added for target="_blank". |
| `download` | `string \| null` | `null` | Anchor download attribute (filename or empty string to use the URL). |
| `name` | `string` | `''` | Native `name` for the button when submitted as part of a form. |
| `value` | `string` | `''` | Native `value` submitted with `name` for multi-button forms. |
| `ariaLabel` | `string` | `''` | Explicit accessible name. Required for icon-only buttons; overrides label. |
| `pressed` | `boolean \| null` | `null` | Toggle state, published as `aria-pressed`. A button that stays on is a toggle, and a toggle has to say so. Filter chips, "pin", "mute", "bold" — every one of them is a button whose variant changes to show it is active, and to a screen reader that change is invisible: the name is identical in both states, so the control reads as an ordinary button that does nothing. `aria-pressed` is the whole difference between "Filter" and "Filter, pressed". `null` — the default — omits the attribute entirely, because a button that is not a toggle must NOT claim to be one. `aria-pressed="false"` on an ordinary button tells the reader there is a state to toggle. |
| `title` | `string` | `''` | Native tooltip / title attribute. |
| `autofocus` | `boolean` | `false` | Autofocus the control on render. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `clicked` | `MouseEvent` | Emitted on click (suppressed while disabled or loading). |
| `focused` | `FocusEvent` | Emitted when the control receives focus. |
| `blurred` | `FocusEvent` | Emitted when the control loses focus. |

## Forms integration

A **ControlValueAccessor** works with `[formControl]`, `formControlName`, `[(ngModel)]` and Signal Forms `[formField]`. An **output-driven** component is bound through its own inputs and outputs instead — the reason is given for each.

| Component | Forms integration |
| --- | --- |
| `sv-button` | Output-driven — An action, not a value: listen to `(clicked)`. Inside a `<form>` it is a native `type="submit"` or `type="button"` and submits the form you own. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/button

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
