# @styloviz/commerce

> Storefront basics — price, address card, file display and QR codes.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/commerce
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
import { SvAddressCardComponent } from '@styloviz/commerce';

@Component({
  standalone: true,
  imports: [SvAddressCardComponent],
  template: `
    <sv-address-card [address]="address" (edit)="edit($event)" (remove)="remove($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `address` | `Address` | `—` | The address to display. |
| `selectable` | `boolean` | `false` | Radio-style selection mode (checkout address picker). |
| `selected` | `boolean` | `false` | Selected state (parent-controlled in a radio group). |
| `showActions` | `boolean` | `true` | Show the action row. |
| `canEdit` | `boolean` | `true` | Show the edit action. |
| `canRemove` | `boolean` | `true` | Show the remove action. |
| `canSetDefault` | `boolean` | `true` | Show the "Set as default" action (hidden when already default). |
| `maskLevel` | `AddressMaskLevel` | `'none'` | Print the address in full, or with its identifying parts masked — house and flat numbers, the inward half of the postcode and all but the last four phone digits. |
| `confirmRemove` | `boolean` | `true` | Ask before deleting. Defaults to ON, and the previous behaviour was a single click straight through to `remove`. A saved address is not something the component can put back — see AddressActionEvent — and the trash button is a 32px icon sitting next to an edit button of the same size in a grid of near-identical cards. Turn it off only where the host runs its own confirmation dialog. |
| `saving` | `boolean` | `false` | True while a write against this address is being sent. Freezes the actions, so a slow round-trip cannot be turned into two deletes. |
| `actionError` | `SvDataError \| string \| null` | `null` | The last write failed. Reported on the card, because the card is still here — the host never took it out, and the badge never moved. |
| `defaultCandidates` | `readonly Address[]` | `[]` | The other addresses that could take over as default, offered as a choice in the confirmation when THIS address is the default one being removed. Removing the default address used to have no defined transition: the card emitted `remove` and the host was left to guess whether a new default was wanted, which one, and whether the person had any say. The card cannot see the address book, so it cannot pick — but given the candidates it can ask, and the answer rides back on `nextDefaultId`. Left empty, the confirmation says plainly that there will be no default afterwards, which is the outcome the host then has to handle. Ignored entirely when this address is not the default. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `addressSelected` | `Address` | Emitted when the card is chosen in selectable mode. Named `addressSelected`, not `select`: `select` is a native DOM event name (@angular-eslint/no-output-native), so an `(select)` binding is ambiguous with the native one, and `selected` is already taken by the input above. Matches the kit's `<thing>Selected` pattern (see search-bar's `suggestionSelected`). |
| `edit` | `Address` | Emitted when the edit action is pressed. |
| `remove` | `AddressActionEvent` | The user confirmed deleting this address. Bind this or nothing happens: the component only asks, it never deletes. |
| `setDefault` | `AddressActionEvent` | "Set as default" was pressed. Persist it — the badge follows `address()`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/address-card

## License

MIT
