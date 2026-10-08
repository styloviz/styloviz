# @styloviz/input-field

> Custom calendar picker with month/year navigation, today indicator, min/max constraints and day/month/year views.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/input-field
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
import { SvDatePickerComponent } from '@styloviz/input-field';

@Component({
  standalone: true,
  imports: [SvDatePickerComponent],
  template: `
    <sv-date-picker [(value)]="date" [minDate]="minDate" [maxDate]="maxDate" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string (two-way)` | `''` | Two-way bindable `YYYY-MM-DD` date string. A CALENDAR DATE, NOT AN INSTANT: A birthday is not a moment; it is the same date everywhere on Earth. That is why this is a string and not a `Date` — a `Date` is an instant, and storing one for "15 June" means the value shifts across midnight for half the world. ⚠️ COMPOSING THIS WITH `sv-time-picker` IS NOT `new Date(d + 'T' + t)`. That composes in the browser's zone, silently, and twice a year it composes something that does not exist: London, 2026-03-29, the clocks go 01:00 → 02:00 and `new Date('2026-03-29T01:30')` returns 02:30 without a word. Use `svComposeDateTime` from `@styloviz/core`, which reports `'gap'` and `'ambiguous'` instead of guessing. |
| `label` | `string` | `''` | Label rendered above the trigger. |
| `placeholder` | `string` | `'Select date'` | Placeholder shown when no date is selected. |
| `minDate` | `string` | `''` | Minimum selectable date (YYYY-MM-DD). Cells before it are disabled. |
| `maxDate` | `string` | `''` | Maximum selectable date (YYYY-MM-DD). Cells after it are disabled. |
| `locale` | `string` | `''` | BCP-47 tag for the week's first day and the column headings. |
| `weekStart` | `number \| null` | `null` | Override the first day of the week. `0` is Sunday. |
| `timeZone` | `string` | `''` | Which zone's **today** this calendar means. THE ONE PLACE A CALENDAR DATE CANNOT AVOID A TIME ZONE. The value here is `YYYY-MM-DD` — no time, no zone, the same date everywhere. But "which date is today" has no zone-free answer: for several hours of every day, two places on Earth are on different dates. Every "today" in this component — the highlighted cell, the Today button, the month the panel opens on, the keyboard's starting point — was computed with `new Date()` in the BROWSER'S zone. That is right for a personal calendar and wrong for an app pinned to a business zone: a Sydney user booking against a New York ledger sees tomorrow highlighted as today, and the Today button writes a date the server rejects. An IANA zone (`'America/New_York'`). Empty means the browser's own, which is what this component was silently doing before the input existed — so leaving it unset changes nothing. ⚠️ It does NOT convert the value. A calendar date has no zone to convert between; use `svComposeDateTime` when you need an instant. |
| `dateDisabled` | `((date: Date) => boolean) \| null` | `null` | A rule for which dates cannot be chosen — weekends, blackout ranges, lead times. |
| `disabled` | `boolean` | `false` | Disables the trigger and prevents the popover from opening. |
| `required` | `boolean` | `false` | Shows a red asterisk in the label. |
| `ariaLabel` | `string` | `''` | Explicit accessible name for the trigger (falls back to `label`). |
| `errorMessage` | `string` | `''` | Client-side validation message. |
| `serverError` | `SvServerError` | `null` | A rejection reported by the server about this value. Self-expiring. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `opened` | `void` | Emitted when the calendar popover opens. |
| `closed` | `void` | Emitted when the calendar popover closes. |
| `valueChange` | `string` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/date-picker

## License

MIT
