# @styloviz/citation-sources

> Numbered citations attached to an answer, with the coverage strip that names the passages nothing supports. 3 variants: inline chips, source cards and a side panel.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/citation-sources
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
import { SvCitationSourcesComponent } from '@styloviz/citation-sources';

@Component({
  standalone: true,
  imports: [SvCitationSourcesComponent],
  template: `
    <sv-citation-sources [answer]="answer()" [citations]="citations()" [sources]="sources()" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the answer is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalise an `HttpErrorResponse`. |
| `variant` | `CitationVariant` | `'inline'` | Presentation: inline chips, source cards, or a sources panel. |
| `answer` | `string` | `''` | The answer text the citations point into. |
| `citations` | `readonly CitationSpan[]` | `[]` | The citations, each carrying the span of the ANSWER it supports and the passage of the source it rests on. |
| `sources` | `readonly SourceRef[]` | `[]` | The sources those citations resolve to. |
| `claims` | `readonly AnswerClaim[]` | `[]` | The answer's claims, as the host's pipeline structured them — an id and the claim's words as rendered. SUPPLY THESE AND A CITATION'S `claimId` IS ITS ANCHOR, ahead of `anchorText` and the offsets. A claim id that is not in this list is reported in the placement notice as a claim the answer no longer contains — never quietly re-placed by arithmetic. Leave it empty and `claimId` is identity only, handed back through `(claimsOpened)`. |
| `showCoverage` | `boolean` | `true` | Show the coverage strip. On by default, because the figure it carries — how much of the answer is attributed, and which passages are not — is the one thing a citation UI cannot show by drawing chips. |
| `allowedUrlProtocols` | `readonly string[]` | `SV_SOURCE_URL_PROTOCOLS` | URL schemes a source link may use. A SOURCE URL IS MODEL OUTPUT, WHICH IS UNTRUSTED INPUT. A retriever returns what the index holds and a model returns what it generated, and either can hand this component a `javascript:` URL. Angular renders that as a dead `unsafe:` link, which is safe and also silent — the reader clicks, nothing happens, and nobody learns the citation was fabricated. A refused URL is shown as text instead, with the scheme named: that the answer cited something unreachable is evidence about the answer. |
| `uncitedMinChars` | `number` | `SV_UNCITED_MIN_CHARS` | Shortest uncited stretch worth reporting, in characters. FORTY IS A SENTENCE IN ENGLISH PROSE — and two or three sentences in Chinese, where a claim fits in a dozen characters, and most of a bullet in a summary-style answer. A connective is not an unsupported claim, so a floor has to exist; where it sits is a fact about the language and the answer shape, which this component cannot see. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `sourceSelect` | `SourceRef` | The reader activated a citation chip or a source card. |
| `claimsOpened` | `readonly string[]` | The reader opened a source's passages; carries the distinct `claimId`s of the citations now on screen. Emitted only on open, and only when at least one of them carries an id. THIS IS HOW A HOST PERSISTS "THE READER CHECKED THIS". A claim id survives re-generation where offsets and wording do not, so the record still points at the right claim after the answer is rewritten. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/citation-sources

## License

MIT
