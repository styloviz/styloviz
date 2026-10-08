# @styloviz/forms

> Form controls beyond the text field — checkbox, radio group, slider, rating, autocomplete, OTP, colour and time pickers, masked input, inplace edit, chip, like and segmented control.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/forms
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
import { SvAutocompleteComponent } from '@styloviz/forms';

@Component({
  standalone: true,
  imports: [SvAutocompleteComponent],
  template: `
    <sv-autocomplete [options]="options" [(ngModel)]="value" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `options` | `readonly AutocompleteOption[]` | `—` | Options to filter and choose from (supports groups, sublabels, icons). |
| `value` | `string (two-way)` | `''` | Selected value (two-way). |
| `placeholder` | `string` | `'Search…'` | Placeholder shown when empty. |
| `size` | `AutocompleteSize` | `'md'` | Field size: sm, md or lg. |
| `variant` | `AutocompleteVariant` | `'default'` | Visual variant. |
| `disabled` | `boolean` | `false` | Disable the field. |
| `label` | `string` | `''` | Accessible label for the field. |
| `clearable` | `boolean` | `true` | Show a clear (×) button when a value is selected. |
| `maxItems` | `number` | `8` | Maximum suggestions rendered at once. ⚠️ **IT IS A HARD BOUNDARY AND IT USED TO BE A SILENT ONE**. A query matching 500 options showed eight, offered eight to the keyboard, and said nothing at all about the other 492 — so a user whose entry was 300th in the list concluded it was not there. The panel now discloses the truncation; see `truncationNote`. |
| `totalCount` | `number \| null` | `null` | How many results exist in total, when the component cannot know. With `serverSide` the supplied `options` are already one page of a larger answer, so counting the array understates it. A host that knows the real total passes it here and the disclosure reads "8 of 4,312" instead of "8 of 20". Ignored without `serverSide`, where the array IS everything. |
| `grouped` | `boolean` | `false` | Render results in labelled sections using each option's `group`. |
| `loading` | `boolean` | `false` | Show a loading state (e.g. while fetching async results). |
| `stale` | `boolean` | `false` | The options on screen answer an **older** query — a newer request is still in flight. Distinct from `loading`, which cannot separate the two cases it covers: the first fetch (nothing on screen — show a skeleton) and a refinement of results already visible (keep them, and say they are provisional). Blanking the panel on the second is the most jarring thing a combobox can do; showing the old list with no indication is a quiet lie. Bind `svSuggestController(...).stale` from `@styloviz/data`, or `createRequestGuard().stale` from `@styloviz/core`. The results dim and report `aria-busy` while staying fully interactive. |
| `noResultsLabel` | `string` | `'No results found'` | Text shown when no options match. |
| `serverSide` | `boolean` | `false` | Let the server do the matching. The supplied `options` are shown exactly as given — filtering them again hides entries the server matched on fields the component cannot see. |
| `debounceMs` | `number` | `300` | Delay before `inputChange` fires, in ms. `0` emits immediately. |
| `minChars` | `number` | `0` | Characters required before a lookup is sent. Below this the panel says so instead of showing a misleading "No results found". |
| `error` | `SvDataError \| string \| null` | `null` | Failure loading the options, rendered inside the panel. |
| `icon` | `string` | `'search'` | Name of an icon in `@styloviz/icons`, e.g. `'search'`. This used to be a raw `<path d="…">` string. That put SVG geometry in every consumer's config and skipped the library's sizing, stroke and dark-mode handling — pass a name instead. |
| `errorMessage` | `string` | `''` | Client-side validation message. |
| `serverError` | `SvServerError` | `null` | A rejection reported by the server about this value. Self-expiring. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `selected` | `AutocompleteOption` | Emitted with the chosen option. |
| `cleared` | `void` | Emitted when the selection is cleared. |
| `inputChange` | `string` | Emitted on every query change (debounce upstream for async sources). |
| `retry` | `void` | The host should re-run the failed lookup. |
| `valueChange` | `string` | Emits the new `value` whenever it changes — the output half of `[(value)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/autocomplete

## Security — `sv-input-mask` with a card or SSN preset

**A masked field is not a compliant field.** `preset="credit-card"` formats the
number as it is typed; it does not encrypt, tokenise or shield anything. The
digits sit in a DOM node on your page, readable by every script you have loaded.

**That changes which questionnaire you fill in.** A page whose own JavaScript
never touches the PAN — the processor's iframe or hosted field — is SAQ-A. A page
with a script that can read the digits is SAQ-A-EP, which is longer and whose
scope pulls in every other script on that page: analytics, tag manager, chat
widget, A/B testing. `<sv-input-mask preset="credit-card">` is such a script.
Using it is a legitimate choice with a consequence, and the consequence should
not arrive from an assessor. **If you do not need to hold the PAN, don't.**

**Session replay is the leak nobody plans for.** FullStory, Hotjar, Datadog RUM,
Clarity, Smartlook and LogRocket record the DOM and ship it to a third party;
they read input values like any other attribute. "Masked" is masked to the eye —
a recorder sees the digits. So a card field added to a checkout that has had a
replay tool on it for a year puts every PAN into a third-party's storage in clear
text, with nobody having made a decision. On a sensitive preset this component
sets every opt-out those tools honour (`data-private`, `data-dd-privacy`,
`data-hj-suppress`, `data-clarity-mask`, `data-sl`, `data-recording-sensitive`,
and FullStory's `fs-mask fs-exclude` classes) — a best effort, not a guarantee.

**Use `maskedValue()` and `last4()` for everything that is not the one call to
your processor.** Confirmation screens, logs, analytics events, support tickets
and receipts all want "the card ending 4242", and every one of them is where a
full PAN ends up when the only value on offer is the full PAN. Never log it,
never put it in a URL, never persist it — including in a generic "save draft"
mechanism written for a different form.

Full guidance, including the scope checklist, ships inside this package as
`docs/pci-scope.md` (`node_modules/@styloviz/forms/docs/pci-scope.md`).

## Security — `sv-signature-pad`

**A drawn signature is not identity, and it is not consent.** It is a picture.
It does not establish who drew it, that they meant to agree to anything, or what
the thing they were agreeing to said — an unattended tablet in a lobby produces
the same artefact as a deliberate act by the named party. The affordance implies
otherwise, which is exactly why this paragraph exists.

E-SIGN, UETA and eIDAS all care about the same three things, and none of them is
ink: **intent to sign**, **attribution to a person**, and **association with the
record signed**. A stroke list addresses none of the three.

**What the component gives you towards them.** `consentText` puts the wording
above the pad, where it is readable *before* the act — "I didn't see that" is the
substance of most disputed e-signatures. `attest()` returns the wording, an
ISO-8601 timestamp, your own `signerMetadata`, and a SHA-256 digest over all of
it together with the strokes and the typed name. `svSignatureRecord` and
`svVerifySignature` are exported so your server can recompute and check it.

⚠️ **The hash is not tamper-evidence.** It is computed in the signer's own
browser by the party being attested, so anyone who can change the strokes can
change the digest. What it does is bind the consent wording to the artefact — a
hash over the image alone proves nothing about what was agreed to, which is the
flaw in most home-grown versions — and make accidental drift detectable. **The
evidentiary step is yours**: counter-sign or timestamp the record on receipt,
from a clock and a key the signer does not control.

⚠️ The component never invents consent wording. Without `consentText`, `attest()`
returns `null` rather than producing a record that attests to nothing.

💡 The typed name (`allowTyped`, on by default) is both the keyboard-accessible
route and, usually, the more legally meaningful artefact — E-SIGN cares about
intent and attribution, and a typed name attached to an authenticated session
says more than a squiggle from an unattended device.

## License

MIT
