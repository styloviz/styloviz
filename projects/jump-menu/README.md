# @styloviz/jump-menu

> Compact navigation as a single native select: grouped destinations, the current one shown, and the platform picker on touch. The small form of a tab strip or an anchor rail.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/jump-menu
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
import { SvJumpMenuComponent } from '@styloviz/jump-menu';

@Component({
  standalone: true,
  imports: [SvJumpMenuComponent],
  template: `
    <sv-jump-menu [items]="sections" [(value)]="current" (jump)="go($event.item.id)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly JumpMenuItem[]` | `[]` | Destinations, in display order. |
| `value` | `string (two-way)` | `''` | Id of the current destination. Use `[(value)]` for two-way binding. |
| `label` | `string` | `'Jump to'` | Visible label above the control. Not optional in practice: a bare `<select>` in a navigation bar reads as *"combo box, Overview"* and nothing tells a screen-reader user it moves them. |
| `labelHidden` | `boolean` | `false` | Hide the label visually, keeping it for assistive technology. |
| `size` | `JumpMenuSize` | `'md'` | Control size. |
| `disabled` | `boolean` | `false` | Prevents any destination from being chosen. |
| `placeholder` | `string` | `'Select…'` | Text for the placeholder option shown while `value` matches no destination. Empty string removes the placeholder entirely. |
| `customClass` | `string` | `''` | Additional CSS classes on the root wrapper. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `jump` | `JumpMenuChangeEvent` | Emitted whenever a destination is chosen — always, because a `<select>` is not a link and the browser was never going to navigate. See the class note. Fires on every `change`, which on Windows includes each arrow key pressed on the closed control (WCAG 3.2.2) — see the class note for the tradeoff. |
| `valueChange` | `string` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/jump-menu

## License

MIT
