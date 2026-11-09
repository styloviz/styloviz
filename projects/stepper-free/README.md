# @styloviz/stepper

> 9 variants — eight wizard styles (default, pill, minimal, icon, dot, line, card, progress-bar) plus a non-interactive tracker — all free, in four sizes (xs–lg) and both orientations. The Pro package adds a timeline with a content panel per step, a circular ring, completed-step summaries, linear wizard mode, guard rules and telemetry.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/stepper
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
import { SvStepperComponent } from '@styloviz/stepper';

@Component({
  standalone: true,
  imports: [SvStepperComponent],
  template: `
    <sv-stepper [items]="steps" [activeIndex]="step" (stepChange)="step = $event" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `StepperItem[]` | `[]` | The steps to render (label, optional description, state). |
| `activeIndex` | `number (two-way)` | `0` | 0-based active step index. Supports two-way binding via `[(activeIndex)]`. |
| `orientation` | `StepperOrientation` | `'horizontal'` | Layout: horizontal or vertical. |
| `variant` | `StepperVariant` | `'default'` | Visual variant — and with it, whether this is a wizard or a tracker. `default`, `pill`, `minimal`, `icon`, `dot` and `line` are WIZARD styles: every step is a `<button>`, and the linear gate, keyboard, `stepClick` and the unsaved prompt are all live. `'tracker'` is a PROGRESS DISPLAY (an order-status strip): it renders a non-interactive `<ol>` with no buttons, so nothing in it can be clicked, focused or arrowed through and `stepClick` / `stepChangeRequest` never fire from it. `'card'` boxes each step (indicator, title, description) and stacks them on a phone; `'progress-bar'` is a segmented bar under the current step's label, for a narrow screen — both are wizard styles. Two axes share this one input — look and interactivity. Choose `tracker` to show where something IS, not to let the user move it; for a wizard's look without its navigation, keep a wizard style and set `interactive=false` instead. |
| `size` | `StepperSize` | `'md'` | Step size: xs (a table row or a toolbar), sm, md or lg. |
| `progressLabel` | `string` | `'Step {current} of {total}'` | The position text the `progress-bar` variant shows — `{current}` and `{total}` are filled in. Translate it here. |
| `mode` | `StepperMode` | `'standard'` | Navigation mode: standard sequence, or branch (conditional paths via `activeBranch`). |
| `interactive` | `boolean` | `true` | Whether users can click steps to navigate. |
| `showDescriptions` | `boolean` | `true` | Show step descriptions under labels. |
| `showConnectors` | `boolean` | `true` | Render connectors between steps. |
| `enableHotkeys` | `boolean` | `false` | Enables advanced keyboard shortcuts for rapid step navigation. |
| `announceBlocked` | `boolean` | `true` | Announce a refused move (and why) to screen readers through the shared live region. Turn it off when the host already moves focus to its own message on `(stepBlocked)`. |
| `activeBranch` | `string \| null (two-way)` | `null` | Active branch key used in `mode='branch'`. Supports two-way binding. |
| `customClass` | `string` | `''` | Extra CSS classes for the root element. |
| `urlKey` | `string \| null` | `null` | Put the current step's **id** in the URL under this key, so a step can be shared and the back button moves one step back. Needs `provideSvNavLocation()` at the app root. |
| `surfaceId` | `string \| null` | `null` | Names this stepper in the shared navigation-analytics stream, when a page has more than one. Ignored unless `provideSvNavTelemetry()` is wired up. |
| `persistKey` | `string` | `''` | Where `localStorage` keeps this workflow's position, so a reload resumes rather than restarting. Stores the step id and branch only — never the host's form data. Empty = no persistence. |
| `asyncValidation` | `boolean` | `false` | Ask before moving. With this on, activating a step emits `stepChangeRequest` and nothing happens until the host calls `allow()` or `deny()` — which is what lets a wizard validate the current step against the server before letting the user leave it. |
| `validatingIndex` | `number` | `-1` | Index currently being validated, or `-1`. That step shows a spinner and the stepper ignores further activations, so a double-click cannot start two validations. |
| `revisitPolicy` | `StepperRevisitPolicy` | `'preserve'` | What returning to an earlier step does to the steps after it. See StepperRevisitPolicy. The default, `'preserve'`, invalidates nothing, so a wizard only loses completed steps when it asks for that. |
| `invalidatesOnRevisit` | `((context: StepperRevisitContext) => readonly string[]) \| null` | `null` | With `revisitPolicy="custom"`, the step ids a revisit invalidates. Ids that are not visible steps are ignored. ```ts protected readonly recomputeTotals = (c: StepperRevisitContext) => c.step.id === 'billing' ? ['shipping', 'confirm']: []; ``` |
| `dirty` | `boolean` | `false` | Is there unsaved work in the step the user is on? Set this and a click on another step asks before leaving, instead of abandoning the step's form with no warning and no undo. The prompt comes from `createCloseGuard`, the same primitive Modal, Drawer and Confirm Dialog use, so it behaves identically in all four. |
| `canLeaveStep` | `((reason: StepperLeaveReason) => boolean \| void) \| null` | `null` | The host's own veto on leaving a step, consulted **before** the unsaved check. Return `false` to refuse; return nothing to have no opinion. A veto is silent — it does NOT raise the unsaved-changes prompt, because the host refused for its own reasons and owns its own messaging. That ordering is the primitive's, not this component's. |
| `showUnsavedPrompt` | `boolean` | `true` | Render the built-in unsaved-changes prompt. Turn it off to drive your own dialog from `promptingDiscard()` / `discardChanges()` / `keepEditing()`. |
| `unsavedTitle` | `string` | `'Leave this step?'` | Heading of the unsaved-changes prompt. |
| `unsavedMessage` | `string` | `'This step has changes that have not been saved.'` | Body of the unsaved-changes prompt. |
| `discardLabel` | `string` | `'Discard'` | Label of the button that leaves and loses the changes. |
| `keepEditingLabel` | `string` | `'Keep editing'` | Label of the button that stays on the step. |
| `loading` | `boolean` | `false` | True while the step definition is being fetched. A wizard defined server-side — onboarding flows, dynamic forms — arrives asynchronously. |
| `error` | `SvDataError \| string \| null` | `null` | Failure loading the step definition. Rendered in place of the content, with a retry. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `stepChange` | `StepperChangeEvent` | Emitted when the active step changes. |
| `unresolved` | `SvUnresolvedValue<number>` | Emitted when `activeIndex` names a step that does not exist. Carries what was asked for, what is shown, and whether `activeIndex` was corrected. |
| `stepClick` | `{ index: number; step: StepperItem }` | Emitted when a step is clicked. |
| `stepBlocked` | `StepperBlockedEvent` | Emitted when navigation to a step is blocked (e.g. linear validation). |
| `stepChangeRequest` | `StepperChangeRequest` | A move the host must approve. Only emitted when `asyncValidation` is on. See StepperChangeRequest. |
| `branchChange` | `StepperBranchChangeEvent` | Emitted when the active branch changes (branch mode). |
| `stepTransition` | `{ readonly step: StepperItem; readonly index: number; readonly transition: StepperTransition; readonly from: StepperStepLifecycle; readonly to: StepperStepLifecycle; }` | A named lifecycle transition just happened. The transition, not just the destination. `enter` and `reopen` both land in `active`, and a host that invalidates later work needs to know which of the two it was; `stepChange` cannot tell it. |
| `stepsInvalidated` | `StepperInvalidationEvent` | The revisit policy has marked these steps not done. See StepperInvalidationEvent. |
| `flowStatusChange` | `StepperFlowStatus` | `complete` and `valid`, reported separately — see StepperFlowStatus. |
| `discarded` | `StepperLeaveReason` | The user chose to abandon unsaved work; the move follows. |
| `leaveCancelled` | `StepperLeaveReason` | The user chose to stay on the step. Nothing moved. |
| `activeIndexChange` | `number` | Emits the new `activeIndex` whenever it changes — the output half of `[(activeIndex)]`. |
| `activeBranchChange` | `string \| null` | Emits the new `activeBranch` whenever it changes — the output half of `[(activeBranch)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/stepper

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
