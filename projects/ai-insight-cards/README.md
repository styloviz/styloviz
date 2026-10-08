# @styloviz/ai-insight-cards

> 5 variants: `feed` (priority-ordered list), `grid` (confidence-ring cards), `inline` (single featured insight), `panel` (detailed insight with evidence) and `anomaly` (the baseline behind each claim) — with confidence provenance, evidence links, trend arrows, sparklines and action buttons.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/ai-insight-cards
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
import { SvAiInsightCardsComponent } from '@styloviz/ai-insight-cards';

@Component({
  standalone: true,
  imports: [SvAiInsightCardsComponent],
  template: `
    <sv-ai-insight-cards variant="grid" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the data is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `variant` | `InsightVariant` | `'feed'` | Presentation: `'feed'`, `'grid'`, `'inline'`, `'panel'` or `'anomaly'`. |
| `insights` | `readonly AiInsight[]` | `[]` | The insights to show. Decisions are layered locally, never written back. |
| `baselines` | `readonly SvInsightBaseline[]` | `[]` | The series behind each claim, for the `anomaly` variant. One entry per metric: its recent history and its current reading. The deviation is computed here rather than taken from the host because the arithmetic is where the mistakes are. |
| `busy` | `boolean` | `false` | A fetch is in flight. |
| `simulate` | `boolean` | `false` | Reload with the bundled sample when Refresh is pressed. **Off by default.** Refresh emits `refreshRequested` and waits for a new `insights` — production behaviour must not depend on an integrator remembering to turn a demo switch off. Set it explicitly to `true` in a showcase, where a fabricated reload is the point. |
| `anomalyMinSamples` | `number` | `SV_ANOMALY_MIN_SAMPLES` | Observations required before any severity is claimed. THE DEFAULT IS A POLICY ABOUT SOMEBODY ELSE'S DOMAIN. Fourteen is right for a daily business metric and wrong almost everywhere else: a fortnight of hourly data is 336 observations, a fortnight of monthly data is not a baseline at all, and a seasonal series needs a season. The figure was well reasoned and still a guess, so it is a default and not a rule — and it is the number the card SHOWS when it refuses to judge, so moving it moves the explanation with it. |
| `anomalyNotable` | `number` | `SV_ANOMALY_NOTABLE` | Sigma at which a finding is worth a look. Also the line the anomaly variant's "a mean-and-sigma detector would have missed this" note judges by and quotes. |
| `anomalySevere` | `number` | `SV_ANOMALY_SEVERE` | Sigma at which it is worth waking somebody. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `insightAccept` | `string` | Emitted with the id of an insight the user accepts. |
| `insightDismiss` | `string` | Emitted with the id of an insight the user dismisses. |
| `refreshRequested` | `void` | Emitted when the user asks for fresh insights. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/ai-insight-cards

## License

MIT
