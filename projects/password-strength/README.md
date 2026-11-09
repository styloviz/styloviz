# @styloviz/password-strength

> A dependency-free password guidance meter that pairs alongside any text input — a segmented bar, a strength band, and up to three suggestions. Length carries three of the four points and character variety adds the fourth, so a passphrase outranks a short password stuffed with symbols. It advises and never blocks: a heuristic run in the browser cannot measure how guessable a password is, so the only real evidence — a breach lookup — comes in as an input the host owns.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/password-strength
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
import { SvPasswordStrengthComponent } from '@styloviz/password-strength';

@Component({
  standalone: true,
  imports: [SvPasswordStrengthComponent],
  template: `
    <sv-input-field label="Password" type="password" [(value)]="password" />
    <sv-password-strength [value]="password()" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `''` | The password to advise on — bind it to the same signal driving your text input. |
| `minLength` | `number` | `12` | Your own minimum length, which the advice is measured against. Defaults to 12 rather than 8: length is the lever that actually matters, and a component that calls eight characters "enough" is teaching the wrong thing. |
| `breach` | `PasswordBreachStatus` | `'unknown'` | What your breach check knows. An input, never a network call from here — the component has no business choosing your provider, sending a hash of a password to a third party, or firing a request per keystroke. `unavailable` exists so an outage can be reported as an outage. Whatever the status, nothing here blocks anything. |
| `showSuggestions` | `boolean` | `true` | Show the improvement-suggestion list below the meter. |
| `size` | `PasswordStrengthSize` | `'md'` | Density preset. |
| `label` | `string` | `'Password strength'` | Accessible group label; it also opens the announcement. |
| `announceDelay` | `number` | `700` | Quiet period before an announcement, in milliseconds. Announcements wait for typing to stop and fire only when the band changed, so a screen-reader user is not interrupted mid-word. Set 0 in tests. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `guidanceChange` | `PasswordGuidance` | The guidance changed. It emits advice, not a score to threshold on. |

## Forms integration

A **ControlValueAccessor** works with `[formControl]`, `formControlName`, `[(ngModel)]` and Signal Forms `[formField]`. An **output-driven** component is bound through its own inputs and outputs instead — the reason is given for each.

| Component | Forms integration |
| --- | --- |
| `sv-password-strength` | Output-driven — A meter for the password you pass to `[value]` — it reports `(guidanceChange)`. Your own password input is the form field. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/password-strength

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
