# @styloviz/toggle-switch

> Accessible toggle for boolean settings in multiple sizes, colors and label positions.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/toggle-switch
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
import { SvToggleSwitchComponent } from '@styloviz/toggle-switch';

@Component({
  standalone: true,
  imports: [SvToggleSwitchComponent],
  template: `
    <sv-toggle-switch
      label="Email notifications"
      description="Get notified when something needs your attention."
      [(checked)]="notifications" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean (two-way)` | `false` | Current on/off state. Use `[(checked)]` for two-way binding. |
| `label` | `string` | `''` | Visible label text. |
| `description` | `string` | `''` | Smaller descriptor line beneath the label. |
| `labelPosition` | `ToggleLabelPosition` | `'right'` | Position of the label relative to the track. |
| `onLabel` | `string` | `''` | Text shown inside the track when ON. Keep ≤ 3 characters for `md` size, fewer for smaller sizes. |
| `offLabel` | `string` | `''` | Text shown inside the track when OFF. |
| `onIcon` | `string` | `''` | Icon-library NAME rendered inside the thumb when the toggle is ON — e.g. `'check'`. Omit to show a plain thumb. BREAKING (icon sweep): was `onIconPath`, a raw SVG `d` string. |
| `offIcon` | `string` | `''` | Icon-library NAME rendered inside the thumb when the toggle is OFF — e.g. `'close'`. Was `offIconPath`. |
| `size` | `ToggleSize` | `'md'` | Size of the toggle track and thumb. |
| `variant` | `ToggleVariant` | `'primary'` | Active-state color variant. |
| `disabled` | `boolean` | `false` | Disable interaction. |
| `required` | `boolean` | `false` | Mark the control as required (sets `aria-required`). |
| `loading` | `boolean` | `false` | The switch's own value is not known yet — a settings screen that rendered before its settings arrived. Shows a spinner in the thumb and blocks interaction. |
| `pending` | `boolean` | `false` | The user's change is applied on screen and the write is in flight. Why this is not `loading`: They are opposite states wearing the same spinner. `loading` means *we do not know what this switch is* — there is nothing on screen to trust yet. `pending` means *we know exactly what the user asked for, it is already drawn, and the server has not agreed yet*. Collapsing the two costs the host the only lock that makes `rollback()` unambiguous: with two writes outstanding there is no single previous state to return to, so the older handle would silently discard the newer change. Bind it for the whole round-trip and clear it in both branches. |
| `error` | `SvDataError \| string \| null` | `null` | The write failed. Why this is not `serverError`: They are different facts about different things, and using one for the other is a real bug rather than a naming preference. `serverError` is the field-error contract: *the server rejected this VALUE*, and it self-expires on the next change because a rejection stops describing a value the moment the value moves. A failed write is *the server never recorded the change* — and reverting it **is** a change, so routing it through `serverError` would clear the message in the same tick the rollback ran. The user would see the switch move back and be told nothing, which is the precise failure this whole contract exists to prevent. Accepts an `SvDataError` or a plain string. Roll the value back as well — a message beside a switch still showing the state that failed to save is worse than either on its own. |
| `lockReason` | `string` | `''` | Why this switch cannot be changed. Non-empty locks the control and renders the reason, which `aria-describedby` also points at. Distinct from `disabled`, deliberately. A disabled switch is a dead end: it tells the user they may not, and nothing else, so they are left to guess between "not on your plan", "your admin turned this off" and "this is broken". Those need different next actions, and only the host knows which one applies. |
| `ariaLabel` | `string` | `''` | `aria-label` override — required when `labelPosition === 'hidden'` so screen readers still announce the control's purpose. |
| `inputId` | `string` | `''` | id forwarded to the hidden `<input>` for `<label for="">` use. |
| `customClass` | `string` | `''` | Additional CSS classes on the root wrapper element. |
| `errorMessage` | `string` | `''` | Client-side validation message. |
| `serverError` | `SvServerError` | `null` | A rejection reported by the server about this value. Self-expiring. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `toggled` | `boolean` | Emits the new boolean state after every toggle. |
| `toggleRequest` | `SvToggleChange` | The same toggle, carrying what a server write needs: an idempotency key and a guarded way back. Additive, not a replacement — `toggled` still fires, and a switch that only writes to local state has no use for either of these. Both are emitted for one interaction, in this order. |
| `checkedChange` | `boolean` | Emits the new `checked` whenever it changes — the output half of `[(checked)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/toggle-switch

## License

MIT
