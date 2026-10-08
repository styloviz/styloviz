# @styloviz/modal

> Premium dialog overlay with 6 semantic variants, 7 sizes, bottom-sheet & loading states, slot-based projection, focus trap and ESC/backdrop close.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/modal
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
import { SvModalComponent } from '@styloviz/modal';

@Component({
  standalone: true,
  imports: [SvModalComponent],
  template: `
    <sv-modal [(isOpen)]="isOpen" title="Edit profile" subtitle="Update your details" (closed)="isOpen = false">
      <ng-container slot="body"><p>Body content…</p></ng-container>
    </sv-modal>
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `isOpen` | `boolean (two-way)` | `false` | Controls open/closed state. Use `[(isOpen)]` for two-way binding. |
| `title` | `string` | `''` | Dialog title shown in the built-in header. |
| `subtitle` | `string` | `''` | Optional secondary line rendered beneath the title (also used for aria-describedby). |
| `variant` | `ModalVariant` | `'default'` | Semantic/visual variant. Drives the header icon badge + accent bar. |
| `showHeader` | `boolean` | `true` | Render the built-in header bar. |
| `showHeaderDivider` | `boolean` | `true` | Bottom dividing line under the header. |
| `showFooterDivider` | `boolean` | `true` | Top dividing line above the footer. |
| `showFooter` | `boolean` | `true` | Render the footer slot wrapper. |
| `size` | `ModalSize` | `'md'` | Size of the dialog panel. |
| `position` | `ModalPosition` | `'center'` | Placement of the dialog panel. |
| `showIcon` | `boolean` | `true` | Show the built-in variant icon badge in the header. |
| `closeOnBackdrop` | `boolean` | `true` | Close dialog when backdrop is clicked. |
| `closeOnEsc` | `boolean` | `true` | Close dialog on ESC key. |
| `backdropBlur` | `boolean` | `false` | Apply a frosted-glass blur to the backdrop. |
| `showCloseButton` | `boolean` | `true` | Show the built-in × close button in the header. |
| `loading` | `boolean` | `false` | Busy state. While `true` the panel shows a spinner overlay and all close paths (button, backdrop, ESC) are blocked so a running task can finish. |
| `loadingText` | `string` | `'Loading…'` | Accessible label announced while `loading` is true. |
| `closeOnNavigation` | `boolean` | `true` | Does a navigation close this dialog? A MODAL THAT OUTLIVES ITS ROUTE FLOATS OVER AN UNRELATED PAGE. The audit calls it the most common overlay bug in shipped dashboards, and the mechanism is simple — a link inside the dialog, a redirect from a guard, a host that navigates on success — after which the panel is still up, still modal, still describing a page that is no longer underneath it. IT ONLY HAPPENS IF THE APP ASKED. `provideSvOverlayRouteClose()` from `@styloviz/layout` is what tells the overlay layer a navigation happened; an app that wires nothing keeps today's behaviour exactly. Set this false for a dialog that belongs to the shell rather than to the page. |
| `backCloses` | `boolean` | `false` | Does the browser Back button close this dialog? Back is the gesture users reach for to undo "I opened this", and on a phone it is the system gesture — a dialog that ignores it sends the user off the page instead, losing whatever they were doing. OFF BY DEFAULT, AND THAT IS THE OPPOSITE DECISION FROM THE ONE ABOVE. Back closing a dialog is right when the dialog is a destination the user navigated TO — a details panel, a wizard step — and wrong when it is a transient question, where it eats a Back press meant for the page. Only the host knows which this is. The mechanism is a marked `history` entry, not a route: the URL is untouched and the host's own state is preserved. Giving a dialog its own URL is a routing decision, and leaves that to the host. |
| `dirty` | `boolean` | `false` | Is there unsaved work in this dialog? A FORM IN A MODAL CAN BE THROWN AWAY BY A MISSED CLICK. The backdrop is the whole screen around the panel, Escape is one key, and both discard everything the user typed with no warning and no undo. It is the single most-reported overlay complaint in any dashboard, and the reason "are you sure?" exists. SET THIS AND THE DIALOG ASKS instead of closing — once, in one place, from `createCloseGuard`, so Modal, Drawer and Confirm Dialog answer it identically. A prompt written four times behaves four ways. A PROGRAMMATIC `close()` STILL CLOSES. The prompt is for accidental dismissal; your own code calling `close()` has already decided, and a component that second-guesses its own API is unusable. See `createCloseGuard`'s `alwaysAllow`. |
| `canClose` | `((reason: ModalCloseReason) => boolean \| void) \| null` | `null` | The host's own veto, consulted before anything else. Return `false` to refuse a close; return nothing to have no opinion, so a guard that only cares about the backdrop needs one `if`. A veto is silent: it does NOT raise the unsaved-changes prompt, because the host refused for its own reasons and owns its own messaging. ```html <sv-modal [canClose]="notWhileUploading" /> ``` ```ts protected readonly notWhileUploading = (reason: ModalCloseReason) => reason === 'backdrop' ? !this.uploading(): undefined; ``` |
| `unsavedTitle` | `string` | `'Discard your changes?'` | Heading of the unsaved-changes prompt. |
| `unsavedMessage` | `string` | `'This dialog has changes that have not …` | Body of the unsaved-changes prompt. |
| `discardLabel` | `string` | `'Discard'` | Label of the button that closes and loses the changes. |
| `keepEditingLabel` | `string` | `'Keep editing'` | Label of the button that returns to the dialog. |
| `pendingDismissal` | `SvPendingDismissal` | `'block'` | May the user dismiss the modal while `loading` is true? IS TWO COMPLAINTS AND THIS IS THE FIRST: "no way out". Every close path — the × button, the backdrop, Escape — is blocked while `loading`, silently and with no stated policy. That is a defensible answer for a two-second save and the wrong one for a request that has hung: the modal simply stops responding, and the user's remaining move is to reload the page. `'block'` keeps exactly today's behaviour and is the default. `'abort'` lets the close through and emits `loadingCancelled` first, so the host can abort the work it started. The modal does not own the request — `loading` is an input — so the host has to do the aborting; what changes is that it is now told to. |
| `slowAfterMs` | `number` | `0` | Say "this is taking longer than usual" after this many ms of `loading`. `0` = never. |
| `stalledAfterMs` | `number` | `0` | Escalate to a stuck message after this many ms of `loading`, measured from the same start. `0` = never. |
| `slowMessage` | `string` | `'This is taking longer than usual…'` | Message shown over the panel at the `slow` stage. |
| `stalledMessage` | `string` | `'This seems to be stuck.'` | Message shown over the panel at the `stalled` stage. |
| `cancelLoadingLabel` | `string \| null` | `null` | Label for a cancel button in the loading overlay, shown once `stalled`. `null` = none — and an offer with nothing behind it is worse than none, so set this only when `loadingCancelled` is wired to something that stops the work. |
| `initialFocus` | `string` | `''` | CSS selector for the element to focus first when the modal opens (e.g. `'#name-input'`). Falls back to the first focusable element. |
| `customClass` | `string` | `''` | Extra CSS classes merged onto the dialog panel. |
| `resizable` | `boolean` | `false` | Let the user drag the panel's bottom-right corner to resize it. THE DRAG IS AN ENHANCEMENT, NOT THE ONLY WAY IN. A pointer-only affordance is unusable by keyboard, so turning this on also turns on the maximize/restore button unless `maximizable` is explicitly false — the button is the keyboard-reachable half of the same capability, and the panel can always be sized declaratively through `size`. |
| `maximizable` | `boolean` | `false` | Show the maximize / restore button in the header. |
| `minWidth` | `number` | `280` | Floor for a dragged resize, in pixels. |
| `minHeight` | `number` | `160` | Floor for a dragged resize, in pixels. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `discarded` | `ModalCloseReason` | The user discarded unsaved changes; the close follows. |
| `closeCancelled` | `ModalCloseReason` | The user backed out of a close and returned to the dialog. |
| `loadingCancelled` | `void` | The user asked to stop the work: they pressed the cancel offer, or they dismissed the modal with `pendingDismissal="abort"`. Emitted BEFORE the close, so a host that aborts synchronously is not racing the teardown. |
| `loadingEscalated` | `SvWaitStage` | Fires on each escalation of a `loading` wait: `'slow'`, then `'stalled'`. |
| `opened` | `void` | Emitted after the modal is opened (by any means). |
| `closed` | `void` | Emitted after the modal is closed (by any means). |
| `dismissed` | `ModalCloseReason` | Emitted alongside `closed`, describing what triggered the close. A close caused by a navigation or a Back press reports `'programmatic'` here — the published union cannot grow — and its exact reason on `dismissedBy`. |
| `dismissedBy` | `SvCloseReason` | Emitted alongside `dismissed` with the exact reason, including `'route'` (the app navigated) and `'history'` (the Back button) from |
| `resized` | `SvModalSizePx` | Emitted whenever the panel's pixel size changes — a drag or a maximize. |
| `isOpenChange` | `boolean` | Emits the new `isOpen` whenever it changes — the output half of `[(isOpen)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/modal

## License

MIT
