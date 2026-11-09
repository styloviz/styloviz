# @styloviz/cookie-consent

> A GDPR / ePrivacy cookie banner: a bottom banner, a corner card or a modal dialog, "Reject all" exactly as prominent as "Accept all", per-category native switches with nothing optional pre-ticked, and a consent record — the choices, an ISO timestamp and your policy version — for you to store and hand back.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/cookie-consent
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
import { SvCookieConsentComponent } from '@styloviz/cookie-consent';

@Component({
  standalone: true,
  imports: [SvCookieConsentComponent],
  template: `
    <sv-cookie-consent version="2026-10" privacyHref="/privacy" [record]="saved()" (recorded)="store($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `categories` | `readonly SvCookieCategory[]` | `[]` | The purposes the visitor chooses between. Empty uses four built-in ones — strictly necessary (required), functional, analytics and marketing — worded from the labels, so they translate with the rest. Rows with an empty or duplicate `id` are skipped. |
| `consent` | `SvCookieConsentState (two-way)` | `{}` | The visitor's choices, category id → allowed. Two-way: bind `[(consent)]` to restore and keep them. Updated only when the visitor decides — toggling a switch changes nothing until "Save choices". Unknown ids are ignored and a missing optional id counts as refused. |
| `record` | `SvCookieConsentRecord \| null` | `null` | The visitor's stored record, if any. With the current `version` the banner starts closed and `consent` is restored from it; with an older one the banner re-asks, says the policy changed and starts from the old choices. |
| `version` | `string` | `'1'` | Your cookie policy's version, stamped into every record. Change it when the policy changes and returning visitors are asked again. |
| `open` | `boolean (two-way)` | `true` | Whether the banner (or, for `layout="modal"`, the dialog) is showing. The component closes it when the visitor decides. Two-way: `[(open)]`. |
| `preferencesOpen` | `boolean (two-way)` | `false` | Whether the per-category preferences dialog is open. Set it `true` from a "Cookie settings" link so visitors can change their mind later — withdrawing consent must be as easy as giving it. Two-way: `[(preferencesOpen)]`. |
| `layout` | `SvCookieConsentLayout` | `'banner'` | `banner` (full-width bottom bar), `corner` (compact card) or `modal` (dialog up front). |
| `corner` | `SvCookieConsentCorner` | `'end'` | Which bottom corner the `corner` card sits in. |
| `inline` | `boolean` | `false` | Render the banner or card in normal flow instead of fixed to the viewport — for previews, docs and settings pages. The preferences dialog stays modal. |
| `privacyHref` | `string \| null` | `null` | Your privacy or cookie policy URL. Relative paths, `http(s):` and `mailto:` are kept; anything else (`javascript:`, `data:`) drops the link. |
| `labels` | `Partial<SvCookieConsentLabels>` | `{}` | Per-instance text, merged over the registry's `cookieConsent` labels. |
| `storageKey` | `string \| null` | `null` | Opt in to keeping the record in `localStorage` under this key, in a versioned envelope. Read once after the first render (never on the server); written on every decision. `null` keeps nothing — persistence is yours through `(recorded)` and `[record]`. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `recorded` | `SvCookieConsentRecord` | The visitor accepted, rejected or saved: their choices, an ISO timestamp and the policy version. |
| `restored` | `SvCookieConsentRecord` | A record was read back from `storageKey` — load the scripts it allows. |
| `consentChange` | `SvCookieConsentState` | Emits the new `consent` whenever it changes — the output half of `[(consent)]`. |
| `openChange` | `boolean` | Emits the new `open` whenever it changes — the output half of `[(open)]`. |
| `preferencesOpenChange` | `boolean` | Emits the new `preferencesOpen` whenever it changes — the output half of `[(preferencesOpen)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/cookie-consent

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
