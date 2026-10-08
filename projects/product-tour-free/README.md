# @styloviz/product-tour

> 8 onboarding variants: modal (free) plus slideshow, tooltip, spotlight, beacon, checklist, progress steps and announcement (Pro). Portal-based overlay with keyboard navigation.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/product-tour
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
import { SvProductTourComponent } from '@styloviz/product-tour';

@Component({
  standalone: true,
  imports: [SvProductTourComponent],
  template: `
    <sv-product-tour [steps]="steps" [active]="touring" (complete)="finish()" (skip)="finish()" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` | `TourStep[]` | `[]` | Step definitions. |
| `variant` | `TourVariant` | `'modal'` | Visual variant. Free tier supports `'modal'` only. |
| `active` | `boolean (two-way)` | `false` | Two-way: controls tour visibility. Set to `true` to launch the tour. |
| `stepIndex` | `number (two-way)` | `0` | Two-way: current step index. |
| `nextLabel` | `string` | `'Next'` | Text of the button that advances to the next step; the last step shows `doneLabel` instead. |
| `prevLabel` | `string` | `'Back'` | Text of the button that returns to the previous step. |
| `skipLabel` | `string` | `'Skip tour'` | Text of the button that dismisses the tour before it is finished. |
| `doneLabel` | `string` | `'Done'` | Text of the advance button on the last step, which finishes the tour. |
| `allowSkip` | `boolean` | `true` | Show the skip / close controls. |
| `showStepCount` | `boolean` | `true` | Show the "step X of N" counter. |
| `showProgress` | `boolean` | `true` | Show the dot progress indicator. |
| `tourId` | `string` | `''` | Identity of this tour DEFINITION — not of the component instance. Required for persistence, and stored inside the blob as well as being part of the key, because the key is the host's and keys get reused. A progress blob from last quarter's onboarding tour, read by this quarter's, restores a `stepId` that means nothing. |
| `tourVersion` | `number` | `1` | Version of this tour's STEPS. Bump it when the steps change. STORED PROGRESS FROM ANOTHER VERSION IS NOT ADOPTABLE. The stored step id may still exist and mean something different, or the order may have changed — either way the position is a guess, so a version change restarts the tour and says so. |
| `expectedVersion` | `number \| null` | `null` | The version the HOST says its UI is at. `null` (default) = do not check. ONLY THE HOST KNOWS THIS, which is why it is an input and not an inference. A tour authored against v1 of a screen, running against v3, points at controls that have moved or gone — and nothing inside a component library can detect that from the outside. A mismatch is REPORTED through `(schemaStale)` and does not stop the tour: deciding whether a returning user sees it depends on things the component cannot see. The runtime half — `(targetMissing)` for a step whose target is not there — is Pro-only, because the free tier's one variant (`modal`) anchors to nothing. |
| `persistKey` | `string` | `''` | Where `localStorage` keeps this tour's progress. Empty = no persistence. |
| `resume` | `'step' \| 'restart' \| 'never'` | `'step'` | What a stored, unfinished tour does on the next visit. \| Value \| Meaning \| \|-------------\|----------------------------------------------------------\| \| `'step'` \| resume on the stored step (first step if it is gone) \| \| `'restart'` \| always from the first step \| \| `'never'` \| restore the ticks, not the position \| "resume, restart or exit" was undefined, which is the finding. It is a per-tour decision — a five-step onboarding wants resuming, a two-step feature announcement does not — so it is an input rather than a rule. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `stepChange` | `number` | Fires with the new step index whenever navigation occurs. |
| `complete` | `void` | Fires when the last step is confirmed (Next on final step). |
| `skip` | `void` | Fires when the user explicitly skips the tour. |
| `progressRestored` | `SvTourProgressRestored` | Stored progress was found and applied. THE TOUR DOES NOT DECIDE WHETHER TO SHOW ITSELF, for the same reason it does not navigate: whether a returning user sees it depends on a feature flag, a cohort, or the host's own "seen" table. What it owes is the RECORD — status, step, ticks — and this event, so the host's `[active]` can be an informed one. A `status` of `'completed'` or `'dismissed'` here is the "don't show this again" the audit said nothing recorded. |
| `schemaStale` | `SvTourSchemaStale` | `tourVersion` and `expectedVersion` disagree: these steps were authored against a different version of the UI they point at. |
| `routeRequest` | `TourRouteRequest` | A step with a `route` became current — the host should navigate there. Fires on arrival, including the step the tour opens on, and once per arrival. The tour never navigates itself: it cannot know whether the app uses `@angular/router`, whether the jump needs params or passes a guard, or whether the host would rather refuse. |
| `activeChange` | `boolean` | Emits the new `active` whenever it changes — the output half of `[(active)]`. |
| `stepIndexChange` | `number` | Emits the new `stepIndex` whenever it changes — the output half of `[(stepIndex)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/product-tour

## License

MIT
