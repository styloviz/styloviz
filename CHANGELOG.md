# Changelog

All notable changes to Styloviz are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
kit follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html): from
1.0.0, a breaking change ships only in a new **major** version (during `0.x` it
bumped the minor).

Every package in the kit shares one version, sourced from `packages.json`.

---

## [1.0.2] — 2026-10-14

A patch release from the 11 October audit: contrast and keyboard fixes found by
an axe pass over every showcase page, outputs and calls to action that now
fire, storage handling that survives blocked site data, four members that never
did anything marked deprecated, and notice of how icon registration changes in
1.1 and 2.0. No breaking changes: upgrading from 1.0.x needs nothing but the
version bump.

### Fixed — Split button: its outer corners are round again (Pro)

`sv-split-button` flattened the seam between its two halves with selectors that
counted children (`[&>*:first-child_button]:rounded-r-none`). The first child
of `sv-group` is its own layout wrapper, so both rules matched both buttons and
the control rendered with every corner square. The selectors now name the two
buttons by the component that renders them, and use logical corners, so the
seam stays on the inside under `dir="rtl"` as well.

### Fixed — Live spline chart and Sankey value labels meet WCAG AA contrast (Pro)

`sv-live-spline-chart` coloured each series pill's text with the series colour
on a 15 % tint of the same colour — 2.0–3.4:1 in light mode, below the 4.5:1 AA
floor on every default palette colour. The pill now uses the theme's ink on a
`color-mix()` tint, with the series colour on a swatch dot: at least 8.0:1
light and 10.4:1 dark across the whole hue circle. The `sv-sankey-chart` hover
badge had the same shape and gets the same fix.

### Fixed — Sidebar, sidebar nav and footer labels meet WCAG AA contrast

The section labels in `sv-sidebar-nav`, `sv-sidebar` and `sv-footer` used
`text-gray-500/70` and `/80` — 2.7–3.3:1 at 9.5–10 px. They are now
`text-gray-600` (at least 7.0:1 on the solid and the translucent surfaces).

### Fixed — Faded secondary text meets WCAG AA contrast (Pro AI Pack, product tour, templates)

Counts and hints that took their colour from `opacity-50`/`-70` fell below
4.5:1: the `sv-ai-agent-activity-log` filter counts, the
`sv-ai-writing-assistant` shortcut hint, and in the templates the POS filter
counts, the chat system-message time and the get-started filter counts. They
now use the full ink with a lighter weight for hierarchy. The
`sv-product-tour-pro` placeholder "Step x of y" (80 % white over the primary
gradient) now sits on a `primary-700` chip.

### Fixed — File upload: resume bookmarks are versioned (Pro)

`svLocalResumeStore` wrote each resume record as bare JSON and read it back
with a type cast, so a record in an unexpected shape was trusted as-is. Records
are now stored in the kit's `{ kind, version, state }` envelope
(`sv-file-upload/resume`, v1) and validated field by field on the way back; a
record that does not hold is ignored and, in development, reported to the
console. Bare records written by 1.0.0 and 1.0.1 are still read, so an upload
that was in progress across the upgrade still resumes.

### Fixed — Bar chart: horizontal bars no longer cut off their category labels

With `orientation="horizontal"`, `sv-bar-chart` and `sv-bar-chart-pro` reserved
a fixed 56-unit margin for the category labels, so a label such as "Product A"
could lose its first letter where the font measured slightly wider. The margin
is now sized from the longest label.

### Fixed — Date pickers no longer add global CSS to your app

`sv-date-picker`, `sv-date-picker-pro` and `sv-date-range-picker-pro` turned
Angular's style encapsulation off, so their stylesheets — including rules on
`.sv-dp`, a pressed-day transform and two keyframes — applied to the whole
application that imported them. They now use the default encapsulation; the
panels look and animate exactly as before.

### Fixed — Sidebar: the built-in logo reserves its space before it loads

`sv-sidebar`'s default logo now carries its intrinsic `width` and `height`, so
the brand row no longer shifts when the image arrives.

### Fixed — Dimmed states and selected-row labels meet WCAG AA contrast

States that faded a whole row now say what they are and keep their text
readable: a switched-off step in `sv-ai-workflow-builder` (was `opacity-50`,
1.98:1) shows an "Off" pill; a switched-off rule in `sv-guardrail-panel` (was
`opacity-55`) sits on a muted surface; a dismissed `sv-ai-writing-assistant`
suggestion (was `opacity-60`) keeps full ink. The time and "Sending…" under a
`sv-ai-chat` user message (2.54:1 on the bubble) are now `primary-50`, and the
`sv-artifact-panel` diff sign is no longer faded. Secondary text that sat at
4.36–4.44:1 on a selected or error row now uses the next step darker: model
details in `sv-ai-chat`, span timings in `sv-ai-agent-activity-log`, size,
progress and messages on a failed `sv-file-upload` row (Pro and free), item
descriptions in `sv-transfer`, the pending step number in `sv-timeline` (Pro
and free), the dial code in `sv-phone-input`, the variable count in
`sv-prompt-template-library`, the writing-assistant tone description, and the
HRMS template's leave-tab count.

### Fixed — List view: a windowed list can always be reached with Tab

In `sv-list-view` and `sv-list-view-pro`, when the host restored a saved
`activeItemId` whose row was outside the rendered window, no element in the
list was focusable and Tab skipped the whole list. The scroll viewport now
takes the tab stop while the active row is not rendered, and hands focus to
that row (scrolling it into view) as soon as it receives keyboard focus.

### Fixed — Speed dial: a menu larger than the screen stays on it (Pro)

`sv-speed-dial` clamped its menu's position into the viewport but never
its size, so a menu wider or taller than the screen (long labels on a phone)
started at the margin and ran off the far edge. The menu is now capped to the
room left to the far edges and scrolls inside it; a menu that fits is
unchanged.

### Fixed — Keyboard focus is visible on every chart mark (Pro and free)

On the bubble, funnel, pyramid, multi-axis, multi-level-label,
axis-label-template and waterfall charts, the only focus style was
`focus-visible:fill-opacity-100` — a class Tailwind does not have, so it
generated no CSS and a keyboard user saw nothing move. Their hover fade was the
same dead class. The date-time category chart had no focus style on its
category columns at all. Every one now draws the kit's focus ring on the
focused mark (a 2 px dark stroke, white in dark mode), the hover fades work,
and a `check:ui` rule rejects `*-opacity-N` classes that do not exist.

### Fixed — Mega menu: pausing on the way to the panel no longer closes it (Pro)

`sv-mega-menu` kept its panel open while the pointer crossed the gap from the
trigger only as long as the pointer kept MOVING: a pause longer than
`closeDelay` (150 ms) inside the safe corridor — a careful hand, a trackpad
lift, a busy page — closed the menu it was reaching for. The panel now stays
open while the pointer rests anywhere in the corridor, and still closes at
once when the pointer leaves it.

### Fixed — Carousel: every call to action works, and none submits a form

On a slide without an image, `sv-carousel` rendered the CTA as a `<button>`
with no `type` — inside a host `<form>` it submitted the form — that ignored
`ctaLink` and did nothing when pressed. Both slide layouts now share one CTA:
a link when the slide has `ctaLink`, otherwise a `type="button"` button, and
either one emits the new `(ctaClick)` output with the slide. The `ctaLink` doc
no longer claims the whole caption is clickable; only the CTA is.

### Fixed — Data table: a bare `svDtAutoFocus` attribute focuses

`DtAutoFocusDirective` (both tables) was the last `@Input()` in the kit; a
bare `svDtAutoFocus` attribute bound `''` and switched focusing off. It is a
signal input with a boolean-attribute transform now, and focuses after the
first render instead of on a 0 ms timer. `SvDataTableCellDirective.svDtCell`
(Pro) is a signal input too — template usage (`svDtCell="name"`) is unchanged;
code that read the property directly reads `svDtCell()`.

### Fixed — Blocked site data no longer crashes resumable uploads or the store and dev templates

With site data blocked (a browser setting, Safari's "Block all cookies", a
sandboxed iframe such as an embedded StackBlitz), even `typeof localStorage`
throws a `SecurityError`. `svLocalResumeStore()` (Pro file upload) and the
store and dev templates' cart, wishlist, currency, consent and theme services
guarded their storage reads that way, so the guard itself threw. They now go
through `svLocalStorage()` from `@styloviz/core`, which returns `null` when the
store is missing or blocked: uploads, carts and themes keep working for the
visit and are simply not remembered. A new `check:ui` rule,
`storage-global-unguarded`, fails any storage read outside `svLocalStorage()`
or a `try`.

### Fixed — Drag-and-drop list: `(itemClick)` fires, via the new `[clickable]` input

`sv-dnd-list` documented `(itemClick)` but never emitted it. Set
`[clickable]="true"` and each item's label renders as a button that emits
`(itemClick)` with the item on click, Enter or Space, in all four variants.
Without `clickable` the label stays plain text, so lists that only reorder gain
no extra tab stops.

### Fixed — Voice assistant: `(silenceDetected)` fires

`sv-voice-assistant` showed its "silence detected" hint but never emitted the
output. It now emits once each time a listening turn's trailing silence
reaches `silenceFrames`, and again only after speech resumes and falls silent
again.

### Fixed — Chip group no longer puts `aria-orientation` on its group

`sv-chip-group` set `aria-orientation`, which is not allowed on `role="group"`
(axe: critical). The attribute is gone; `orientation` is visual only — the
arrow keys walk the chips on both axes in either layout.

### Changed — Twelve AI Pack and data components work out each row once per change (Pro)

`sv-kanban-board`, `sv-pivot-table`, `sv-rag-knowledge-base`,
`sv-ai-model-selector`, `sv-ai-token-dashboard`, `sv-ai-insight-cards`,
`sv-ai-agent-activity-log`, `sv-ai-workflow-builder`, `sv-mcp-tool-registry`,
`sv-prompt-template-library`, `sv-sentiment-analysis-widget` and
`sv-widget-grid` called a formatting or styling method per row on every change
detection pass — up to twenty per row, 571 call sites in all. A 40-row pivot
with twelve columns and two measures looked up, formatted and titled nearly a
thousand cells on every pointer move, and the knowledge base re-ran its privacy
mask over every chunk. Each list now derives what its rows show in a `computed()`, once per
change of its data, settings or state. Nothing you bind to or listen for
changes: the same inputs, outputs and public methods, and `track` and every
output still carry your own objects.

One visible difference: a relative time ("4m ago" on an insight, the elapsed
time on a support card) is as of the last change to the list, where before it
also moved forward whenever something unrelated re-rendered. Neither component
has a clock of its own, before or after.

### Changed — Spotlight stat card's dark surface follows the theme (Pro)

`sv-spotlight-stat-card` painted its dark-mode surface with a literal
`#0d0d16`; it is the `gray-950` token now, so a theme's own canvas colour
reaches the card. Its contrast proof was re-run against the token.

### Changed — Tiles default to `role="group"` (Pro)

`sv-tiles` defaulted to `role="list"`, but projected tiles carry no
`listitem` role, which screen readers report as a broken list. The default is
now `group`, valid around any content. `[role]="'list'"` remains available for
collections a screen reader should count: give each tile `role="listitem"` —
in development, a `list` whose tiles are not list items logs a warning naming
the first one.

### Deprecated — Icons that resolve without being registered (fallback removed in 2.0)

Announced now so no upgrade surprises anyone; nothing changes in 1.0.2.

`<sv-icon>` and `<sv-icon-pro>` resolve any glyph name because each carries the
whole registry — about 57 KB gzipped for the free set and 126 KB for Pro — in
every app that uses a single kit component. Under the SemVer promise above, the
fix is split across two releases:

- **1.1 (no code change needed):** each kit component registers the glyphs it
  draws, so the full registry leaves your bundle. A name nobody registered
  still renders: the full registry loads on demand as a lazy chunk, and a
  development-mode warning names the glyph to register. 1.1 also adds
  per-glyph exports and an explicit "register everything" option for
  `provideSvIcons()`.
- **2.0:** the on-demand fallback is removed, and an unregistered name renders
  nothing (with the same warning). The 1.1 notes will give the one-line
  registration that makes 2.0 a no-op for your own templates.

### Deprecated — Four members that never did anything (removed in 2.0)

These were documented as working but have no effect. They are kept so 1.x
templates compile, marked `@deprecated` (your editor strikes them through), and
will be removed in 2.0:

- `sv-stat-card` `[variant]` and the `StatCardVariant` type — the free card has
  one colour treatment. The six semantic variants are `sv-stat-card-pro
  [variant]`.
- `sv-stat-card` `(cardClick)` — the free card is not interactive. Use
  `sv-stat-card-pro [clickable]` and its `(cardClick)`.
- `sv-product-tour` `[variant]` and the `TourVariant` type — the free tour
  renders the modal only. The other seven variants are `sv-product-tour-pro
  [variant]`.
- `sv-sidebar` `(toggleCollapse)` — the sidebar has no toggle of its own; the
  toggle is `sv-topbar`'s `(toggleSidebar)`, and the shell owns `[collapsed]`.

---

## [1.0.1] — 2026-10-07

A patch release: an install fix for the bundles, a drawer focus fix, and package
metadata. No API changes; upgrading from 1.0.0 needs nothing but the version bump.

### Fixed — `npm i @styloviz/all` installs every package where your app can import it

1.0.0's bundle declared only `@angular/core` and `@angular/common` as peers, so
npm nested the nine members that also need `@angular/forms` or
`@angular/router` (`input-field`, `select-dropdown`, `layout`, `display`,
`file-upload`, `pagination`, `search-bar`, `tag-input`, `toggle-switch`) inside
`node_modules/@styloviz/all`, and importing them failed to resolve. Both bundles
now declare every member's third-party peers. If you installed 1.0.0, run
`npm i @styloviz/all@1.0.1` (or install those nine packages by name).

### Fixed — READMEs say how to install Tailwind CSS 4

Not only how to import it: `tailwindcss`, `@tailwindcss/postcss`, `postcss` and
a one-line `.postcssrc.json`.

### Fixed — Drawer's unsaved-changes prompt keeps focus when it opens straight away (Pro)

`sv-drawer` moves focus into itself 60ms after opening. When a `[dirty]` drawer
was dismissed inside that window, the prompt focused "Keep editing" and the late
open-time focus then moved it back to the close button, so Enter closed the
drawer instead of keeping the edits. The open-time focus now stands down once
the prompt is showing or the drawer has closed.

### Changed — Package links and Pro manifests

Each package's npm `homepage` is its own docs page, and free packages' `bugs`
link goes to the community Discussions. Every `@styloviz-pro/*` manifest is
`"private": true`: Pro packages are served only by the licensed registry, and
nothing changes for installs.

## [1.0.0] — 2026-10-06

**The first stable release.** From 1.0.0 the kit follows Semantic Versioning
strictly: a breaking change to any public API — an input, output, exported
type, function, token or CSS class — ships only in a new major version, and a
rename lands first as a deprecated alias that keeps working for the rest of
that major. Every package is still released in lockstep at one version.

This release gathers everything since 0.4.0: a security pass (stored HTML in
the rich text editor, CSV formula injection), the kit stylesheet that npm
installs were missing, server-rendering fixes, and the P0/P1 re-checks of the
Forms, Overlays, Layout and AI families.

### ⚠ Upgrading from 0.4

Most apps need only steps 1 and 2.

1. **Add the kit stylesheet** — new, and required for any app that installs
   from npm (the template downloads already have it). Without it the components
   render unstyled. In your global stylesheet:

   ```css
   @import "tailwindcss";
   @import "@styloviz/core/styles/styloviz.css";
   @source "../node_modules/@styloviz";
   @source "../node_modules/@styloviz-pro";   /* Pro only */
   ```

2. **Upgrade every `@styloviz*` package together.** Internal peer ranges are now
   `^1.0.0`, so a 1.0 component will not accept a 0.x `@styloviz/core` or
   `@styloviz/icons`. `@styloviz/all` / `@styloviz-pro/all` do this for you.
   A **template downloaded before 1.0** pins `^0.4.0` in its `package.json`,
   which never resolves to 1.x — change every `@styloviz/*` and
   `@styloviz-pro/*` range there to `^1.0.0`, then reinstall.

3. **Renamed — the old names still work, deprecated until 2.0:**
   - `provideStylviz()` → `provideStyloviz()`
   - `StyloVizConfig` → `StylovizConfig`
   - `StylovizConfig.licenseKey` has no effect and can be removed.

4. **Breaking — only if your code does what each line says:**
   - **Relied on the AI demo default:** `simulate` now defaults to `false` on
     `<sv-ai-insight-cards>`, `<sv-ai-writing-assistant>` and
     `<sv-rag-knowledge-base>`. Add `[simulate]="true"` to keep the demo
     behaviour.
   - **Handled `sv-guardrail-panel`'s `(ruleToggle)`:** it now emits
     `{ rule, enabled, observedEnabled, at }` — use `$event.rule` where you
     used `$event`. The panel also masks event text by default
     (`[revealScope]`).
   - **Construct these objects yourself** (typically test doubles):
     `AgentApprovalResult` gained `risk`; `AgentTaskAction` gained
     `observedStatus` and `at`; `SvAnomaly` gained `minSamples`. Code that only
     reads them is unaffected.

5. **Behaviour you may notice — no code change needed:**
   - `sv-rich-text-editor` sanitises HTML it loads through `[value]` /
     `formControl` and from source view: classes outside `rte-` / `sv-` /
     `language-` (and your `mentionChipClass`) and box-escaping styles such as
     `position` are dropped. Replace the policy with `[htmlSanitizer]`.
   - CSV exports prefix text cells that start with `=`, `+`, `-`, `@`, a tab or
     a carriage return with `'`, so spreadsheets show them as text
     (`{ formulaGuard: false }` to opt out).
   - `ThemeService` stores a theme only when the user picks one, so the OS
     preference and `colorScheme` config are followed again on later visits.
   - `sv-form-error-summary` announces a changed error count;
     `sv-popout` / `sv-popover` leave focus where the user put it on close.
   - With a link adapter provided (`provideSvLinkAdapter`), `sv-button [href]`
     and `sv-site-footer` column links route in-app paths through it instead of
     reloading the page. If you also navigate from the footer's `(linkSelect)`,
     drop that — `linkSelect` still fires, for analytics.

### Fixed — Kit menus and dialogs no longer open behind the host app's overlays

- Every dropdown, popover, picker, drawer and dialog takes its z-index from the
  kit's overlay stack, and the stack started its band at 1000 — below
  Bootstrap's modal (1050–1070), MUI's (1300–1500) and the CDK overlay
  container. A kit select or date picker opened inside the host app's own
  dialog rendered behind it, while every component doc still promised 9999.
  The band now starts at 9999, exported as `SV_OVERLAY_Z_FLOOR` from
  `@styloviz/core`; `SV_MODEL_OVERLAY_Z_INDEX` is that value by construction.
  Nesting is unchanged (each surface opened later still paints above), and
  toasts and tooltips keep their own higher bands. A host whose layers sit
  above 9999 still sets the component's z-index input.
- **Rich Text Editor in native fullscreen:** every toolbar menu (format, font,
  size, colours, table, export) opened invisible, because it was mounted in
  `<body>` and a fullscreen element is the only thing the browser shows. Menus
  now mount inside the fullscreen editor and move back when it exits. The CSS
  fullscreen fallback sits one below the overlay floor, so menus clear it
  regardless of DOM order.

### Fixed — Keyboard, list and touch defects in the editor, menus, pickers and charts

Found by a new round of behavioural tests across the packages with the least
branch coverage:

- **Rich Text Editor**
  - Taking a list item out of its list kept a code block, quote, table or
    loose-list paragraph inside it intact. The bullet button used to wrap a
    `<pre>` in a new list nested inside the item, destroying the code block, and
    `<li><p>…</p></li>` came back as a `<p>` inside a `<p>`. Text and blocks in
    one item now leave as separate lines.
  - The caret stayed on the page after a list change that tidied up an empty
    wrapper; it could land in a node that had been detached.
  - After an image was deleted next to a table, Heading or a list button
    rebuilt the table as `<h1><tbody>…` / `<ol><li><tbody>…`.
  - Insert Table emitted `valueChange` twice, and ran in read-only mode.
  - Merge Cells on a malformed table now says so instead of doing nothing.
  - Shift+Tab in a code block with nothing to outdent no longer emits a change
    (or dirties a form control).
  - An editor rendered inside the host app's own `<li>` indents its paragraph
    instead of asking the browser to nest the host's list.
- **Dropdown Menu / Menubar:** Enter and Space on the focused trigger with an
  item highlighted run that item, as the WAI-ARIA menu-button pattern says;
  both closed the menu without running it. A disabled first menu, or a
  shortened `menus` list, no longer takes the menubar out of the tab order, and
  a disabled menubar's keyboard can no longer open a menu. A second long-press
  no longer leaks the first one's timer.
- **Product Tour (free and Pro):** a tour with skipping turned off lost its
  arrow keys and its Tab trap.
- **Time Picker:** a one-digit hour (`9:30`) left its column with no tab stop
  and ↓ selected 01:30; the trigger showed `9:30:undefined` with seconds on.
  It now shows exactly what the typed field shows. Home/End/PageUp/PageDown
  settle on the nearest reachable cell when `min`/`max` disable a column's ends.
- **Phone Input:** Enter or Space on the open trigger selects the highlighted
  country (it moved the highlight instead), and the highlight follows the list
  when filtering removes the highlighted country — `aria-activedescendant`
  pointed at an option that no longer existed.
- **Mention:** `[suggestions]="results$ | async"` (null until the first answer)
  reads as "no matches yet" instead of throwing.
- **Kanban:** on touch, releasing a lifted card on itself no longer drops it at
  the bottom of its own column.
- **Embedding Map:** a touch gesture the browser cancels (`pointercancel`)
  discards the half-drawn lasso — the `pointerleave` that follows used to commit
  it as a selection (new public `onLassoCancel()`). A tab stop survives the host
  narrowing the clusters or points under it.
- **AI Chat Transport:** one malformed or hostile frame number (`seq: 1e9`)
  could hang the tab while the gap check listed every missing number. Frames
  more than `maxGap` (default `SV_FRAME_GATE_DEFAULT_MAX_GAP`, 1,000) past the
  highest applied one now get the new `'out-of-range'` verdict and change
  nothing; `svFrameGate(options?: SvFrameGateOptions)` sets the limit.
- **Histogram:** extreme weights (one ~1e16× the rest) and values spanning
  ±1.7e308 no longer put `NaN` into marker positions, bin edges, the SVG or the
  accessible description; very large magnitudes no longer collapse into
  zero-width bins.

### Fixed — Tag Input and File Upload (free) bind to Angular forms, as documented

- The docs and the gallery have always shown `[formControl]`,
  `formControlName` and `[(ngModel)]` on the free `sv-tag-input` and
  `sv-file-upload`, but only their Pro twins implemented
  `ControlValueAccessor`. The documented binding threw `NG01203` ("No value
  accessor") at runtime — on the gallery it aborted the render of every demo
  on the Tag Input page. Both free components are now form controls with the
  Pro contract: the value is `string[]` / `File[]`, a disabled control
  disables the field, and a file the scanner flagged is never in the value.
  `scanPolicy="required"` stays the Pro upload's stricter mode.
- Both tag inputs now mark the control touched when focus leaves the field,
  not only when a tag changes — tabbing through a required, empty field showed
  no error before.
- A new `check:ui` rule, `form-binding-without-accessor`, fails a forms
  binding on any kit element that is not a value accessor — in a template, an
  inline template or a docs snippet. Strict template checking cannot see it.

### Fixed — Safari: Rich Text Editor "Export to Image" / "Export to PDF" no longer hang

- The export frame had been given a `sandbox` without `allow-scripts` as
  defence in depth. WebKit then disables scripting for the whole frame, so the
  editor's own listeners on it — image `load`, html2canvas's clone `onload` —
  never fired and the export waited forever. The frame is no longer sandboxed;
  its document carries `Content-Security-Policy: script-src 'none'` instead,
  which blocks the content's scripts and inline handlers and leaves the
  editor's listeners alone. The content is still sanitised first.

### Fixed — Developer template: the count-up figures land on the real value

- A figure that changed while its count-up was running (data arriving after
  the row scrolled into view) finished on the old number, so the screen said
  8 while the screen-reader copy said 10. The count now reads its target every
  frame.

### Fixed — Server-rendered pages: element ids match on hydration, kit-wide

- Element ids in ~50 packages — the targets of `aria-describedby`,
  `aria-controls`, `aria-labelledby`, `<label for>` and SVG `url(#…)` — were
  minted from 115 module-level counters. On a long-running SSR server that counter
  is shared by every request, so the second page rendered says `-2` where the
  browser, starting fresh, says `-1`: the server HTML and the first client
  render disagree, and the associations break after hydration. They now come
  from `svUniqueId()`, which counts per application. The navigation packages
  were converted earlier; `check:ui` now fails a module-level id counter in any
  package (data ids — a toast id, a request key — are marked as such).
- Ids generated this way read `sv-slider-ng-3` rather than `sv-slider-3`. Only
  code that parsed the number out of a component's internal id is affected.

### Fixed — Packaging and housekeeping

- **Bundles:** `@styloviz/all` and `@styloviz-pro/all` now ship a `LICENSE`
  (the Pro bundle's `license` field pointed at a file that was not there),
  `@styloviz-pro/all` has the restricted-registry `publishConfig` every other
  Pro package has, and the pinned-version examples in both READMEs follow the
  kit version instead of saying `@0.1.0`.
- **Package metadata:** every package has `keywords` (76 had none) and
  `sideEffects: false` (11 had none, which kept bundlers from tree-shaking
  them); npm descriptions over 300 characters are cut at a sentence (the README
  keeps the full text). `@styloviz/layout` declares the `rxjs` peer it imports.
  `@styloviz/pro`'s README no longer calls an MIT re-export package
  "Commercial" — it says the components it re-exports are.
- **`svReveal`** disconnects its observer when the element is destroyed before
  it was ever revealed (a route change mid-page).
- **Like** and **AI Model Selector** own their one-shot timers: a quick
  unlike → like no longer ends the second burst early, saving twice no longer
  hides the second "Saved" badge early, and destroying either clears them.
- **Admin and Store template READMEs** say Angular 21 or 22, not 21.
- **Release tooling:** a dry-run publish over an unbuilt `dist/` no longer ends
  in "✅ All N published"; it says how many it could not check.
  `check:template-escapes` (and the template packer) now reject an import of a
  tsconfig path alias (`@shared/*`, `@layout/*`, …) from template source — it
  compiles here and fails in a buyer's project, which has no such alias.
  Publishing (npm and the Pro registry), the component acceptance suite and the
  Angular compatibility check now refuse a `dist/` that is not the build of the
  current sources — a source file edited after the build, or a version or
  dependency range changed since — so a package can no longer ship, or pass a
  gate, as code that predates its own release commit.

### Fixed — READMEs and API docs: correct types, and no maintainer notation

- Inputs declared as `input(false, { transform: booleanAttribute })` were
  documented with type `unknown` and default `false, { transform:
  booleanAttribute }` — 15 rows across Button, Icons (animated), Forms, Search
  Bar, Select Dropdown, Tag Input, Toggle Switch and Number Ticker. The table
  now shows the type a binding accepts (`boolean`; `number | null` for an
  `input<T, TransformT>`) and the first argument as the default.
- API descriptions are the components' own source comments, and those carried
  maintainer bookkeeping into every README and the docs site: 529 `★` emphasis
  markers and 126 internal audit ticket ids. Both are stripped at generation
  time, and the README generator refuses to write either again.

### Fixed — Templates: no button inside a link, and no link to nowhere

- **35 buttons were nested inside links** across the Admin and Auth templates
  (`<a routerLink><sv-button/></a>`): a `<button>` inside an `<a>` — invalid
  HTML, two tab stops for one action, read out as "link, button". They are now
  `<sv-button [href]>`, one real anchor. 27 more buttons carried `routerLink`
  on the host — a navigation with no href — and the Launch template's "Book a
  walkthrough" and "Talk to us" handed a `mailto:` to the router, which routed
  to a 404. Those use `[href]` too. A `check:ui` rule (`control-in-link`) now
  fails either pattern.
- **`sv-button` link mode routes in-app paths through the app's link adapter**
  (`SV_LINK_ADAPTER`), like `sv-breadcrumb` does — a plain left click on a
  same-origin path transitions instead of reloading the page. ⌘/Ctrl/Shift/
  middle click, `target="_blank"`, `download`, external URLs and a `(clicked)`
  handler that calls `preventDefault()` all keep the browser's behaviour. With
  no adapter provided, it is a plain link, as before.
- **`sv-site-footer` no longer navigates twice.** A column link with an href
  was followed by the browser (a full page load) while the Store template also
  routed from `(linkSelect)`. In-app hrefs now go through the link adapter.
- **The router link adapter keeps query strings.** The adapter in `app.config.ts`
  (and the template scaffold, the ADR and the `provideSvLinkAdapter` example)
  built a URL tree from `['/path?x=1']`, which encodes the `?`. A string target
  is now parsed with `router.parseUrl` and followed with `navigateByUrl`.
- **Store:** eleven footer links (Help center, Shipping, Returns, Contact,
  About, Careers, Privacy, Terms, Cookies) and the journal / Instagram strip on
  the home page all pointed at the store home page, and the social icons at
  each platform's front page. The footer now lists real destinations only
  (orders, a `mailto:` built from `supportEmail`); socials and policy links are
  `STORE_BRAND.socials` / `legalLinks`, hidden while empty. The newsletter form
  did nothing — it now posts through `StoreApiService.subscribeNewsletter`
  (`POST <baseUrl>/newsletter`, demo delay when unwired) and the footer
  announces success or failure.
- **Mail:** "Sign out" navigated to `/auth`, a route only the kit gallery has.
  It is `MAIL_BRAND.signOutLink` now, and hidden while unset — like the Admin
  and AI Ops templates.
- **Errors:** the 401 page's "Sign in" target was a literal inside the
  component; it is `ERRORS_SIGN_IN_URL` in `errors.config.ts`.
- **Docs site:** "Edit this page" pointed at `github.com/example/pulse-docs`, a
  repository that does not exist. `DOCS_SITE_EDIT_BASE` is empty by default and
  the link is hidden until you set it.
- **Demo data** no longer uses the maintainer's own name and addresses as the
  signed-in user (Mail, Chat, Files, Helpdesk, Calendar, Projects, CRUD, the AI
  Chat sidebar and a showcase card); the persona is "Riley Morgan".

### Fixed — Security guides referenced in READMEs now ship with the package

- The security notes in the `@styloviz/forms`, `@styloviz-pro/commerce` and
  `@styloviz-pro/rich-editor` READMEs ended with a link to the full guide (PCI
  scope, sensitive values, HTML values and CSP) in the source repository, which
  is private — a 404 for every reader. The guides are now copied into each
  package's `docs/` folder and the README names that path. The README
  generator refuses to write a link into the private repository.

### Fixed — Popover: hover tracking starts with the first pointer move

- Follow-up to the move-listener change below: opening a hover popover now
  attaches its pointer tracking immediately rather than on the next render.

### Security — Streaming Markdown: hostile model output can no longer freeze the tab

- Two patterns in the Markdown parser (also used by the rich text editor's
  Markdown mode) backtracked quadratically on whitespace: a 50,000-space line
  under a table header, or a link URL of spaces, took ~2.5 s to parse — and
  `sv-streaming-markdown` re-parses on every streamed chunk, so prompt-injected
  output could lock the page. Both are linear now, with identical results
  (checked against the old patterns on 500,000 random inputs).

### Fixed — Rich Text Editor is ready immediately, not after 800 ms

- Every `sv-rich-text-editor` showed a loading skeleton and ignored input for a
  fixed 800 ms after it rendered — there was nothing to load; the delay was a
  timeout picked by eye. History, `autoFocus` and the toolbar handlers all
  waited on it. Setup now runs on the next task.

### Fixed — Moving the mouse no longer runs change detection across the page

- Line Chart (brush), Data Table (Pro, column resize), Gantt, Event Calendar,
  Splitter, Color Picker and Popover (hover) each listened to every
  `pointermove` / `mousemove` / `touchmove` on the document or window, all the
  time, for a drag that was almost never running. Angular treats every such
  event as a reason to check the view — so on a dashboard with a chart and a
  table, moving the pointer anywhere kept change detection busy. They now
  listen only while the drag (or the hover popover) is active, through the new
  `svListenWhile()` in `@styloviz/core`.
- New `check:ui` rule `global-move-listener` fails on an always-on
  document/window move listener in a published component.

### Fixed — Two instances on one page no longer share DOM ids

- `sv-data-table` (free + Pro) rendered its "Rows" select as `id="dt-page-size"`,
  so with two tables on a page the second table's label pointed at the first
  table's select. `sv-ai-model-selector` (`system-prompt-input`) and
  `sv-ai-workflow-builder` (node-type and connect-to selects) had the same
  shape. All are minted per instance now, and the Pro data table and model
  selector also moved from module-level counters to `svUniqueId`, so their ids
  agree between server and client.
- New `check:ui` rule `literal-dom-id` fails on any hard-coded `id`, `for`,
  `aria-labelledby`, `aria-describedby` or `aria-controls` in a published
  component.

### Changed — Package `bugs` links go somewhere you can file a report

- Every package's `bugs` URL pointed at the kit's private source repository, so
  the "Issues" link on npm was a 404 for everyone. Free packages now link to the
  public community repo's issues (`styloviz/community`); Pro packages to the
  buyer support portal (`support.styloviz.dev`). `repository` is unchanged on
  purpose: npm verifies trusted-publishing provenance against it.

### Fixed — AI Ops template: the account menu no longer offers dead buttons

- All five items in the sidebar account menu — Profile, Account settings,
  Billing, Help & docs, Sign out — only closed the menu. The menu now lists
  real destinations from `AI_OPS_BRAND.accountLinks` (default: "Usage &
  billing" → the template's usage page), and "Sign out" appears once
  `AI_OPS_BRAND.signOutLink` points at your auth — the rule the admin template
  already follows. See the template's CUSTOMIZING.md.

### Changed — `provideStyloviz` / `StylovizConfig`: the config API is spelled right before 1.0 freezes it

- The 0.x names were misspelled — `provideStylviz()` (missing an "o") and
  `StyloVizConfig` (capital V, unlike the brand). After 1.0 a rename is a
  major-version change, so the correct spellings land now:
  `provideStyloviz()` and `StylovizConfig`. The old names remain as
  **deprecated aliases** — existing code compiles unchanged — and will be
  removed in 2.0.
- `licenseKey` on the config is marked **deprecated**: nothing ever read it.
  Pro access is granted at install time by the key in `.npmrc` (it is the
  registry token), so no key needs to — or should — ship in your bundle. Its
  old JSDoc ("required for premium components") was wrong.

### Fixed — Blocked browser storage no longer breaks the app; the theme follows the OS again

- **`ThemeService` crashed when site data was blocked.** It read
  `localStorage` while being constructed, and with cookies/site data blocked
  (a browser setting, some sandboxed iframes) evaluating that global throws a
  `SecurityError` — taking down every component that injects it, `sv-topbar`
  and the app shell with it. Storage access is now guarded; the theme still
  works, it is just not remembered.
- **`ThemeService` froze the first theme it saw.** Applying the theme also
  stored it, so the OS preference (or `colorScheme` config) on a visitor's first
  load was saved as if they had chosen it, and a later OS or config change was
  ignored for every returning visitor. Only `setTheme` / `toggleTheme` store a
  theme now.
- **Stepper (free + Pro), Product Tour (free + Pro) and Widget Grid** guarded
  their `persistKey` storage with `typeof localStorage === 'undefined'` —
  which itself throws when storage is blocked. They now use the new
  `svLocalStorage()` from `@styloviz/core`, which returns `null` instead.

### Fixed — Server-side rendering: four components no longer hang a zone-based render

- `sv-carousel` (`autoPlay`), `sv-agent-task-queue` (its elapsed-time clock,
  on by default), `sv-agent-approval` (a request with `expiresAt`) started a
  `setInterval` from an effect with no platform check, so it also ran during
  server rendering. A zone-based Angular SSR app waits for the application to
  become stable before it sends HTML; with a live interval it never does, and
  the request hangs. (Zoneless apps — and this site — were unaffected, which is
  why it went unseen.) They now start their timers in the browser only.
- `sv-terminal` typed its intro on the server one `setTimeout` per character;
  it now prints the intro whole there, so the HTML sent is the finished text.
  It also stops typing when destroyed mid-intro.

### Security — CSV export: cells are guarded against formula injection

- `svToCsv` (core — used by the free and Pro data tables, the Gantt chart, the
  eval scorecard and the admin/LMS templates) only RFC-4180-quoted its cells. A
  text cell beginning with `=`, `+`, `-`, `@`, a tab or a carriage return was
  written as-is, and Excel/Sheets evaluate it as a formula when the export is
  opened — so `=HYPERLINK(…)` in a customer name ran for whoever exported it.
  Such cells now get a leading `'`. Numbers, and strings that are plain numbers
  (`-12.5`, `+44`), are untouched. Opt out with `{ formulaGuard: false }`;
  `svCsvFormulaSafe()` is exported for hand-built cells. XLSX export was never
  affected (it writes inline strings, never formulas).

### Added — The kit stylesheet ships: `@styloviz/core/styles/styloviz.css`

- **Components installed from npm rendered unstyled, and nothing said why.**
  They are Tailwind utilities against tokens Tailwind does not have
  (`bg-primary-600`, `text-accent-700`, the kit's radii) and a class-based
  `dark:` variant — all defined only in the showcase's own stylesheet, along
  with ~650 lines of runtime CSS (modal, popout, toast and command-palette
  animations, every chart's entrance, the skeleton shimmer, the reveal
  transition). Only the template zips worked, because the packer copies that
  stylesheet into them.
- `@styloviz/core` now ships `styles/styloviz.css` — tokens, dark variant, a
  gray default for bare `border`, and the component runtime CSS; no font, no
  showcase-only rules. It is generated from the marked regions of the
  showcase stylesheet (`npm run kit-css:sync`), kept current by
  `check:generated`, and a spec fails if a class a published component uses is
  defined outside those regions.
- **Setup** — in your global stylesheet:

  ```css
  @import "tailwindcss";
  @import "@styloviz/core/styles/styloviz.css";
  @source "../node_modules/@styloviz";
  @source "../node_modules/@styloviz-pro";   /* Pro only */
  ```

  Now step 2 of the install guide on `/docs`, and a "Styles (required)" section
  in every package README. Verified by compiling a consumer project with the
  built package: without the import there is no `.bg-primary-600` and no dark
  variant; with it both are present, a redeclared token rebrands, and pnpm-style
  symlinked packages are scanned the same way.

### Security — Rich Text Editor (Pro): stored HTML is sanitised on load

- **A stored document could run script.** `[value]` and `formControl`
  (`writeValue`) were assigned straight to the live editor's `innerHTML`, so a
  saved `<img src=x onerror=…>` executed in the host's origin for every reader
  who opened it. Paste and drop were sanitised; loading was not. Both now go
  through `svSanitizeEditorHtml`, a new editor profile in `@styloviz/core` that
  shares the paste sanitiser's walker, inert parse and URL rules but keeps what
  the editor itself writes (tables, uploaded `data:` images, font family/size,
  line height, indents, mention chips, task-list checkboxes).
- **Source view** applied its textarea to `innerHTML` unsanitised and emitted
  it; it now goes through the same sanitiser. It can also be hidden with
  `hiddenTools: ['source']`.
- **Print / PDF / image export** wrote raw HTML into an unsandboxed same-origin
  frame, where `<script>` ran. The content is now sanitised and the frame is
  sandboxed (`allow-same-origin allow-modals`, no `allow-scripts`) — verified in
  Chromium: the capture is pixel-identical and `print()` still opens.
- **New input `htmlSanitizer`** replaces the default policy (e.g. DOMPurify with
  your configuration). `null`, the default, means `svSanitizeEditorHtml`.
- ⚠️ **Behaviour change:** a loaded value is normalised — class tokens outside
  `rte-` / `sv-` / `language-` and the configured `mentionChipClass` are
  dropped, as are `position`, `z-index` and other styles that escape the
  editor. Server-side sanitising is still required; see
  `docs/html-value-security.md`.

### Fixed — Packaging: internal peer ranges

- **`@styloviz/pro` pinned `@styloviz-pro/image-editor` to exactly `0.3.0`**
  among 53 ranges (live in the published 0.4.0). Every package ships in
  lockstep, so at the next version `@styloviz-pro/all` — which depends on both —
  could not resolve (ERESOLVE). Now a range like the rest.
- **Every internal peer is now `^<kit version>`, derived — not `>=0.1.0`.**
  The 295 hand-written `>=0.1.0` ranges let a component install against a
  `@styloviz/core` or `icons` from before a breaking change, promised every
  future major, and matched no prerelease (`1.0.0-rc.1` does not satisfy
  `>=0.1.0`). `version:set` and `meta:sync` now stamp the range from
  `scripts/lib/peer-range.mjs`, packed templates use the same function, and
  `check:peer-deps` fails on anything else. At this version that is `^0.4.0`;
  after `version:set 1.0.0` it is `^1.0.0` (and `^1.0.0-rc.1` for an rc).

### Fixed — Copy to Clipboard: a blocked copy in an iframe read as "failed"

- `svBrowserClipboard` classified the browser's refusal with
  `err instanceof Error`. A `DOMException` from another realm — an iframe's
  `navigator.clipboard` — is not an instance of the host page's `Error`, so a
  permission refusal was reported as `failed` ("Copy failed") instead of
  `denied` ("Copy blocked by the browser…"). It now reads `err.name`.
- Test-only: the button API-table spec read a hand-typed table the showcase had
  replaced with the generated reference, and the confirm dialog's destroy-timer
  spec counted jsdom's own focus timer while never arming the timer it named.
  Both rewritten and mutation-checked; the unit suite is green again.

### Fixed — Behaviour that disagreed with its own documentation

Writing a description for every input and output meant reading what each one
actually does. Where the code and its documentation disagreed, the code was
fixed to keep the documented promise — or, where the promise was the mistake,
the documentation was corrected.

- **File Upload (Pro): `uploadComplete` waits for the scanner.** Under
  `scanPolicy="required"` it fired the moment the bytes landed — before any
  verdict existed — so a host that saved on it saved files nobody had scanned.
  A run now completes when every file has uploaded or failed and every
  uploaded file is `'clean'` or `'flagged'`; the last `markScanned()` reports
  it, once.
- **File Upload (Free + Pro): removing an in-flight file no longer stalls the
  batch.** Removing it freed its concurrency slot but started nothing, and the
  run was never reported — a batch whose stuck file the user deleted sat at
  "queued" forever. It now starts the next queued file and settles the run,
  and a run is reported exactly once (`uploadComplete` was also documented as
  "all uploads finish successfully"; it has always included failures).
- **Record Grid (Free + Pro): card actions run their `handler`.**
  `TableRowAction.handler` is required and the data table calls it, but the
  card view only emitted `actionClick` — the same `rowActions` array worked in
  a table and silently did nothing in the cards. The handler now runs, then
  `actionClick` is emitted.
- **Chart option defaults now say what the charts do.** 28 documented
  defaults disagreed with the fallback the chart applies. `placementRatio`
  was documented as 0.7 and backwards (it is the *foreground* width as a
  fraction of the background, default 0.5) — and is now clamped to 0.05–1,
  since above 1 the foreground covered the bar it sits on. The cylinder cap is
  0.18, Live Sort's corner radius 6, and the waterfall's colours are theme
  tokens, not hex values. `BarChartOptions` is shared by twelve charts with
  different defaults, so it no longer claims one; each chart's `options`
  input states its own. New gate `npm run check:option-defaults` (in
  `verify:static`) compares every documented options default with the code.
- **Three chart options that did nothing now work.** Each was declared,
  documented, and read by nothing:
  - `gradientDirection` (gradient bar chart): `'vertical'` now runs each
    bar's gradient across it; `'horizontal'` (the default) along it, as before.
  - `showArea` (date-time category chart): `false` now drops the area fills;
    a series' own `fill` still wins either way. Default unchanged (on).
  - `gapRatio` (funnel): sizes the gap between stages as a fraction of a
    stage's band, clamped to 0–0.5. Omitted, the gap stays a fixed 3 px.
- **Product Tour's free tier is shown as the free tier.** The gallery's free
  "Modal" demo rendered the Pro component, and its copy-paste snippet imported
  the free `SvProductTourComponent` while using the `<sv-product-tour-pro>`
  element — code that does not compile. The demo now renders the free
  component, the snippet uses `<sv-product-tour>`, the API Reference marks the
  modal Free and the other seven variants Pro, and the gallery blurb no longer
  calls all eight "premium". Every product-tour snippet passed steps an
  `iconPath` field that no longer exists (it is `icon`), and `TourStep.icon`
  claimed to accept SVG path data — it renders as text, so it takes an emoji.
- **Copy-paste snippets and live demos speak the icon-name API.** The icon
  sweep renamed `iconPath` (a raw SVG `d` string) to `icon` (a library name),
  the copy-paste snippets still used the old field in 48 places — search-bar
  suggestions,
  empty-state actions, stepper trackers, accordion headers, command palette,
  stat cards, the gradient KPI / glassmorphism tiles, the number-ticker hero
  cards and the popout notifications — so pasting them did not compile. They
  now pass icon names and render `<sv-icon>` / `<sv-icon-pro>`; the matching
  live demos dropped their inline `<svg [attr.d]>` for the same components
  (the "Customer Satisfaction" card also stops showing a padlock). The
  "Generic Data Table" snippet passed actions as `{ label, action }`, a shape
  the table never had; it is now `{ label, icon, handler }`, and the table's
  row actions render library icons. `check:icons` now fails on any `iconPath`
  left in the showcase or the shared UI it demos.
- **The "Generic Data Table" demo is a table you can install.** It rendered
  `sv-simple-data-table`, a copy of the table that lived only inside the demo
  site, and its copy-paste snippet imported it from an internal `@/shared/ui`
  path no buyer has. The demo — and the query-builder demo that paired with it
  — now render the free `<sv-data-table>` from `@styloviz/data-table`, and the
  snippet is a complete, compiling component (typed `TableColumn` /
  `TableRowAction`, keyed rows, two-way selection, working edit and delete
  handlers). The app-local copy is deleted.
- **Every complete copy-paste snippet now compiles.** Compiling all 776
  component snippets the way a buyer's project would (ngc, `strictTemplates`)
  found 148 that did not. The causes were API drift the binding check cannot
  see: renamed data fields (`TimelineItem.date` → `timestamp`, calendar
  `start` → `date`, kanban `wipLimit` → `limit`, `SelectOption.avatar` →
  `avatarUrl`), types no package exports (`TableRow`, `TableAction`,
  `StepItem`, `KanbanCardAddEvent`), variant values that do not exist
  (`floating`, `underline`, `rounded-square`, `xs`), Pro-only features on a
  free import, and Pro elements rendered over a free class import. Each was
  fixed against the live demo and the library's own types. 25 snippets call
  the buyer's own services (`./task.api`, `./agent-runtime`); the gate
  compiles them too, against typed stand-ins kept in
  `scripts/snippet-host-stubs.json`, so nothing is skipped. Two new gates in `verify:static`
  keep it this way: `check:snippets-compile` and `check:snippet-imports`
  (every kit import exists in the package it names, and every kit element a
  snippet renders is imported).
- **The colour picker's "Preset Swatches" demo showed eight blank swatches.**
  It passed bare hex strings through `$any()` to an input typed
  `ColorSwatch[]`, so every swatch had no colour, no accessible name and one
  shared track key. It now binds labelled swatches, and `check:ui` fails on
  `$any()` around a literal in a binding.
- **Snippet and demo text that described a different component.** 40 snippets
  had `//` comment lines inside their template, which render as visible text
  once pasted — they are now HTML comments, and `check:snippet-imports`
  rejects new ones. Fourteen demo descriptions were copied boilerplate
  ("xs, sm (default), and md sizes. xs is ideal for data tables" on avatars,
  inputs, search bars, toggles, alert banners…) or listed variants that do not
  exist; each now states the component's real sizes and variants. The
  "Icon Position — Left" accordion demo lost a Pro badge it never needed.
  The dnd-list checklist and kanban snippets used fields the list ignores
  (`checked`, `status`); they are typed and use `completed` and `column`. The
  watermark integrity snippet clears its interval on destroy.
- **The Record Grid snippet refunded twice.** It bound
  `(actionClick)="$event.action.handler($event.row)"`, but the grid already
  runs each action's handler before it emits `actionClick` — so every click
  ran the handler a second time. The live demo did the same (harmlessly,
  since its handler only logged). Both now leave the handler to the grid.
- **Four snippets shipped empty lists.** The record grid, the comment
  delete demo and two filter-panel snippets declared their data as
  `[/* … */]`, so a paste rendered nothing. They now carry the live demo's
  data. Four snippets that called an undeclared `this.api` / `this.runtime` /
  `this.audit` now inject that service like the rest.

### Fixed — Gallery "API Reference" sections are generated, not typed

Every `/components` page carried its own hand-typed Inputs/Outputs tables —
167 copies of an API that changes weekly — and they had drifted. AI Agent
Activity Log documented the AI Model Selector's inputs; AI Token Dashboard
documented one of its 13 inputs, with three variants that do not exist;
Address Card listed inputs it never had; a dozen pages still described
`iconPath`-style inputs the icon migration removed. The `/docs` page for the
same component, generated from the source, was right all along.

- **`<sv-showcase-api-reference>` renders the section's tables** from the same
  `getDoc()` the docs page reads, including the family's companion selectors
  (Address Card now shows `sv-address-form`; Date Picker shows
  `sv-date-range-picker`). Each section links to its full docs page.
- **Two-way inputs now document their change output.** A `model()` owns its
  `<name>Change` output, so it never appeared as an `output()` in the source —
  `periodChange`, `openIdsChange` and 165 others were missing from every API
  table, the docs pages and the package READMEs.
- What the generator cannot see stays hand-written beside the tables, and was
  checked against the source: a **Methods** table on 11 pages (each method
  verified to exist), slots, data-shape interfaces and type unions.
  `ToolbarAction.icon` still said "SVG path data"; it is an icon name.
- **Every input and output now has a description.** 383 members across 70
  components had no JSDoc and rendered as "—" in the gallery, on the docs
  pages and in the package READMEs. The gate now fails on any undocumented
  generated member.
- **104 feature cards corrected** in the API Reference sections, each checked
  against the component source. Among them: AI Chat listed Assistant / Agent /
  Sidebar variants that do not exist (it ships copilot, fullscreen, inline,
  bubble); Stat Card claimed five card styles that do not exist; Badges,
  List View, Alert Banner, Toggles, Accordion, Search Bar, Skeleton, File
  Upload and Steppers listed wrong variants, sizes or counts; Waterfall had its
  two orientations swapped; Widget Grid's six dashboard cards named metrics
  the dashboards do not show. Two cards describing features that do not exist
  were removed (tree inline edit, creatable select), and three missing
  variants gained a card (insight anomaly, prompt playground, workflow debug).
- New gate `npm run check:showcase-api` (in `verify:static`): every API
  Reference renders the generated section for its own page, no hand-written
  Input/Output table comes back, and every documented method exists.

### Fixed — Icons: `solid` and `duotone` drew most glyphs as blobs

The `solid` weight (and Pro's `duotone` fill layer) needs a filled silhouette.
Only **32 of 688** glyphs had one; every other glyph had its *line* geometry
filled instead. An outline's interior detail vanished under the fill —
`calendar`, `mail`, `globe`, `clock`, `credit-card` and `camera` rendered as
solid shapes with nothing inside — and open strokes closed along an invisible
edge, so `check` and `phone` grew wedges in `duotone`.

- **Every glyph now ships a silhouette** (640; the 48 brand marks are already
  filled and need none). 608 are derived from the line glyph by the new
  `scripts/derive-solid-icons.py`: closed shapes are filled, the detail inside
  them is cut out at the line weight, and a glyph with no closed shape (arrows,
  chevrons, `menu`) draws at the same weight as `line` instead of a hairline.
  The 32 hand-drawn ones are unchanged.
- **`@styloviz/icons` `solid` draws silhouettes too.** The free renderer had no
  silhouette support at all. New: `ICON_SOLID_REGISTRY`, a `solidNodes` input
  on `SvIconSvgComponent`, and `fill-rule` passed through (an `evenodd`
  knockout was being drawn solid).
- **`sv-icon-pro` takes the silhouette from the glyph's own set.** The 18
  hand-drawn silhouettes of free-tier glyphs (`heart`, `star`, `bell`, …)
  moved from `ICON_PRO_SOLID_REGISTRY` to the free `ICON_SOLID_REGISTRY`, so
  `<sv-icon weight="solid">` and `<sv-icon-pro weight="solid">` now draw the
  same shape. `ICON_PRO_SOLID_REGISTRY` holds Pro glyphs only.
- **`sharp` dropped 33 glyphs' dots.** A dot drawn as a zero-length stroke
  exists only through its line cap, and `sharp`'s `butt` cap has none: the
  eyes of `smile`, the dot of `alert-circle` and `help-circle`, the core of
  every `wifi` and the dots of `circle-ellipsis` were not drawn. Those nodes
  now get a `square` cap in `sharp`.
- New gate `npm run check:icons-solid` (in `verify:static`): every glyph has a
  silhouette, none is stale against its line glyph, none is orphaned in the
  wrong tier, and none contains stroke-only geometry.
- Bundle: the full-registry bundles grow — `@styloviz/icons` 47.6 → 56.1 kB
  and `@styloviz-pro/icons` 83.7 → 123.0 kB gzipped. Per-icon imports add the
  one silhouette each icon uses.

### Added — Every template downloads as a runnable Angular project

The in-app "Download source .zip" used to build three Markdown files in the
browser, and the release zips held only the template folder — no
`package.json`, no `angular.json`, none of the images or fonts it renders, and
nothing telling Tailwind to scan `node_modules/@styloviz`. Each zip is now a
complete project: `npm install && npm start` opens the same screen as the demo.

- `package.json` lists exactly the Styloviz packages the template imports, plus
  their peers; `angular.json`, tsconfigs, a bootstrap that mounts the template,
  the kit stylesheet narrowed to that template, the fonts, and every public
  asset its source references. A root `README.md` (setup, licence key,
  troubleshooting) and `INSTALL.md` (adding it to an existing app).
- Downloads are served by the registry Worker at `GET /-/templates[/<id>]`: the
  free templates are public, Pro templates need the license key, and a 12-month
  key gets the newest release published inside its update window.
- `verify:template-projects` unzips each download, installs only what it
  declares, runs `ng build` with warnings as errors and opens it in Chromium.
- ★ **Each zip's `LICENSE.txt` now follows the template's tier.** The three free
  templates had shipped the Pro commercial licence while the site sold them as
  MIT, and the Pro text ended in `{{LICENSE_HOLDER}}`-style placeholders that
  nothing ever filled in. Free zips carry MIT, Pro zips the commercial terms, and
  both name the third-party assets inside (Manrope under the OFL, CC0
  photographs). The README's *Tier* row reads the registry too — `launch`, a
  Pro template built only from free packages, had said "Free".

### Changed — The home page lives at `/`, under one site header

The home page moved from `/get-started` (now a 301) to `/`, every page of the site
shares one `sv-site-header`, and every template card on the home page and the gallery shows
a real screenshot of that template in the current theme
(`check:template-shots`). The figures the home page prints are generated
(`check:home-facts`), never typed.

### Added — Real photography in the store template

The store's SVG placeholders are replaced by 48 photographs dedicated to the
public domain under **CC0 1.0** (StockSnap / rawpixel, found through Openverse),
served locally as `public/demo/store-*.webp`. Each is credited — title,
photographer, source and edits — in the store README, and
`check:demo-assets` fails on a listed-but-missing, unlisted or unused photo.
Seven templates (chat, POS, projects, helpdesk, portfolio, dev and store) were
also redesigned in the same stretch; behaviour, routes and data are unchanged.

### Changed — License terms revised 2 October 2026

`/license` now reads **Last updated October 2, 2026**, and every earlier revision
is published as plain text and linked from that page, because clause 14 binds
each buyer to the terms in force at their purchase:

- **28 July 2026** — `/legal/eula-2026-07-28.txt`.
- **18 August 2026** — `/legal/eula-2026-08-18.txt`. Clause 3's seats changed
  that day (Team 5 → 10, Enterprise unlimited → 25) and the page kept the
  28 July date; the archive records the revision it actually was.
- **This revision**: the Free templates are named as MIT-licensed Free Software
  (clauses 1 and 6), and clause 7 states the supported Angular majors as the
  packages' peer range — Angular 21 and 22 — rather than "the latest major",
  with older releases installable from the registry rather than "via
  version-control tags", which buyers have no access to.

`scripts/archive-license-terms.mjs` writes an archive; run it before the next
edit. The Pro package `LICENSE` stubs now also say what the EULA says about
compiled distribution inside an application you build.

### Fixed — Site copy re-checked against the kit

Every page was read against the generated sources after the template, header
and Angular 22 work above. What was wrong, and what now derives it:

- **Counts**: `/welcome` said 3 templates (21), `/pricing` "Ten" AI components
  (20), `/capabilities` 22 (it counted the two free teasers), the accessibility
  statement named three templates, and the `/templates` hero claimed "50+"
  pages — now `HOME_FACTS.templatePages`, generated from the template routes.
- **Angular**: "Angular 21" alone on the gallery, the fallback `<title>`, every
  package README (now built from `angularPeerRange`), and the blog said
  "Angular 22"; the EULA and pricing said "the latest Angular major".
- **Templates**: the home FAQ said the free templates install from npm (they
  download from `/templates`); the gallery hero said "copy the source folder";
  the auth card still advertised its old two-page set.
- **Docs**: `PRO_INSTALL.md` imported a component that does not exist
  (`SvGanttComponent`) and blamed a 401 on a "lapsed subscription" with the old
  payment provider; three code examples used variants only the `-pro` twin has;
  two docs entries named the removed `iconPath` input.
- **Blog**: prices are interpolated from the Polar snapshot, as the blog already
  claimed; the literal-count gate now catches spelled-out numbers ("the nine
  composed screens").
- **SEO**: the `noindex` headers named `/auth`, `/errors` and `/account`, which
  only 301 now — the real demo pages under `/templates/` carried none. The rules
  name the rendered pages, cover `/chart-states` and the `/welcome` receipt
  (now noindex), and `check:sitemap` derives the set instead of listing it.
- **THIRD-PARTY-NOTICES.txt** listed the Angular 21 tree and no font or photo; it
  is generated from `package-lock.json` (`npm run notices:sync`) and gated by
  `check:notices`.
- **A crawl of the built site** (every route and every internal link, in
  Chromium) found one crash: the docs-site template's bare `/search` died on
  `undefined.trim()`, because `withComponentInputBinding()` hands a missing `?q=`
  `undefined` rather than the input's default. Normalised there and on the three
  HRMS pages with the same shape, as the POS pages already were.
- **Gates**: `sv-data-table`'s `revealedColumnKeys` is a `model()` like
  `hiddenColumnKeys` (`check:collection-identity`), and its filter chips use
  logical spacing, which ratchets the RTL baseline from 49 to 44.

### Fixed — The site's initial bundle is back under its budget

`npm run build` failed: the initial bundle was 1.71 MB against a 1.65 MB limit,
almost all of it the global stylesheet (1.03 MB raw). Tailwind writes every
opacity-modified colour twice — a static fallback, then the real value behind
`@supports (color: color-mix(in lab, …))` — and the stylesheet carried 1,637 of
those pairs. Every browser Angular 22 supports has `color-mix()`, so the
fallbacks were downloaded and parsed for nothing; they also inlined the colour
literal, ignoring the per-template `.tpl-<id>` token remaps.

`scripts/postcss/collapse-color-mix-fallbacks.cjs` runs after Tailwind in the
app build and keeps only the value the browser was already using. The
stylesheet drops to 733 kB and the initial bundle to **1.42 MB** (241 kB
transferred), under the 1.55 MB warning as well as the limit. Screenshots of 50
routes in light and dark are pixel-identical before and after, apart from
single antialiased pixels. The published packages ship no CSS and the template
zips keep their own PostCSS config, so neither is affected.

Splitting each template's CSS out of the global stylesheet was measured and
rejected: a later-loaded bundle re-orders Tailwind's cascade. Even the most
conservative split (only utilities no other source uses) left 58 class lists
where a template utility would beat a global one it is meant to lose to.

### Fixed — Auth and Errors templates: support and status links went nowhere

"Contact support" and "System status" (auth) and "Check system status"
(errors, on the 500 and 503 pages) pointed at `/support` and `/status`, app
routes that exist in no app: on the live demo they landed on the kit's home
page. Support is now a `mailto:` that opens a mail client, and the status page
an absolute URL on the invented brand's reserved `.example` host, opened in a
new tab. Both stay in `auth.config.ts` / `errors.config.ts` for a buyer to point
at their own, and CUSTOMIZING.md says so.

### Changed — Angular 22 toolchain; Angular 21 still supported

The workspace (showcase app, library builds, tests) now runs on **Angular 22.2.0**,
TypeScript 6.0 and Node 24.20. The published packages support **Angular 21 and
Angular 22**, and the peer range now says so:

- Every `@angular/*` peer is `>=21.0.0 <23.0.0` (was the unbounded `>=21.0.0`).
  The range lives once, in `packages.json` → `angularPeerRange`, and
  `npm run meta:sync` / `bundle:sync` stamp it everywhere.
- The Angular 22 `ng update` migration wrapped four template expressions in
  gantt and kanban in `$safeNavigationMigration()`, a builtin that exists only in
  Angular 22. Those templates are compiled by the *consumer's* Angular, so it
  would have broken both on Angular 21. They were left as they were: both give
  the same result whether `?.` yields `null` (21) or `undefined` (22).
- `check-angular-compat` ran green on both majors for all 106 packages: install,
  strict `.d.ts` typecheck, and each major's linker over every bundle. The highest
  emitted `minVersion` is still `17.2.0`.

Nothing changes for an Angular 21 app.

### Changed — Overlays & Feedback: a P0/P1 re-check (`STYLOVIZ_OVERLAYS_FEEDBACK_TODO.md`)

All 183 P0/P1 items were checked again against the rendered components, every
variant and the specs, and then checked a second time by an independent review.
About 100 of them were only partly done, and each is now fixed with a spec that
renders the component. Every public input, output, type and default is
unchanged: new behaviour comes in optional inputs, optional fields and new
exports (`svStackedPopup`, `SvLiveAnnouncer.history()`, `ConfirmDialogTextMatcher`,
`SV_POPOUT_PRESET`, `PopoverAlign`, `SV_ALERT_READING_MS_PER_CHAR`). Two
lifecycle methods whose bodies moved (`SvAlertBannerComponent.ngOnInit` and
`SvResultComponent.ngAfterViewInit`) are kept and marked `@deprecated`.

These are the **intentional behaviour changes**. Each corrects something the
docs already promised, and the opt-back is given where one exists:

- **The fullscreen spinner is a real modal surface** (`OF-18-I6`). `[overlay]="true"`
  now portals the backdrop to `<body>`, makes the page behind it `inert` and moves
  focus onto it. Its `data-sv-*` hooks therefore render under `<body>` rather than
  inside `<sv-spinner>`. **Opt-back:** `[portal]="false"`. A blank `label` now
  falls back to "Loading…", so the status region always has a name.
- **The overlay stack makes everything below the topmost blocking surface inert**,
  including other overlays such as a drawer under a modal (`X-4`, `X-5`). Toasts,
  tooltips and the shared live regions stay live.
- **Popups and pickers joined the stack** (`X-4`, `OF-09-I1`). These are the time,
  date and colour pickers, autocomplete, cascader, tree-select, mention, select,
  tag input, phone input and the menu-like popups. Escape in one of them inside a
  modal now closes only the popup.
- **Toast host.** `maxVisible` is validated: `0` used to mean "no cap" (a
  `slice(-0)` accident) and now means 1. `Infinity` is the explicit no-cap
  value. New opt-in `[portal]` keeps toast actions pressable above a modal.
- **Dropdown Menu.** Tab closes an open menu, as the WAI-ARIA menu pattern does. A
  menu with nothing projected (the shared row-menu pattern) no longer renders an
  invisible `role="button"` wrapper, and focuses its own panel instead. New
  `openAtElement()` anchors a keyboard-opened kebab to the kebab.
- **Popover.** With `[interactive]="false"` it renders no Close button.
- **Confirm Dialog.** Cancelling while busy now asks `[canClose]` before it aborts
  the running `[action]`.
- **Alert Banner.** The auto-dismiss timer is never shorter than the reading time
  of the message (60 ms per character). It is refused when projected content holds
  a control.
- **Notification Center.**
  - The `drawer` variant is now a real modal: the page is inert, focus is trapped,
    and focus returns to the bell on close.
  - With `unreadTotal` bound, the All/Unread tab counts show the server total.
  - Opening or dismissing a collapsed row acts on its whole group, and the event
    carries a new optional `collapsedIds`.
- **Progress Bar and Progress Ring.** A value just below the maximum no longer
  draws or announces 100%. `NaN` renders as 0. The ring's centre label shows the
  clamped value, and the `dashed` ring (the high-contrast fallback) now draws its
  progress.
- **Empty State.** While "Clear filters" is offered, it is the one primary action,
  and the host's primary actions render as secondary.
- **Modal and Drawer close reasons are type-truthful.** A close caused by a
  navigation or the Back button used to be emitted on `(dismissed)`,
  `(discarded)` and `(closeCancelled)` as `'route'` / `'history'` through a
  cast, values the published `ModalCloseReason` / `DrawerCloseReason` unions
  say cannot occur. They now report `'programmatic'` there, and `[canClose]`
  is asked in the same terms. The exact reason is on the new `(dismissedBy)`
  output (`SvCloseReason`), and `svDismissReason()` is exported for hosts that
  fold reasons themselves.
- **`provideSvOverlayRouteClose({ closeOn: 'path' })`** is a new option. It closes
  route-bound surfaces only when the path changes, so a page that mirrors
  filters into `?q=` or scroll position into `#section` does not close the dialog
  being typed in. The default (`'url'`) is unchanged. The showcase app now wires
  it with `'path'`.
- **`svOverlayCanDeactivate`** is a new router guard in `@styloviz/layout`. On a
  route whose page opens editable overlays, a dirty Modal or Drawer holds the
  navigation and asks on the current page. Before, it asked over the page the
  user had already been taken to. Discard re-issues the navigation with its
  original extras, and Keep editing stays. `SvRouteAwareOptions` gains optional
  `dirty` and `requestLeave`, and `SvOverlayRouteService` gains `requestLeave()`.
- **Popups take their z-index from the overlay stack** (`X-4`). The old `9999` is
  only a fallback while the popup is closed. The rich-editor toolbar dropdown
  joined the stack too.
- **Command Palette ids are unique per instance** (`cp-results` was a fixed id).
  The shortcut registry never fires a binding during IME composition, which
  includes the palette's ⌘K.
- **Spinner and Skeleton Loader announce through `SvLiveAnnouncer`**, once and
  politely, when they first render in a browser. A status region born with its
  name is often not announced at all. The spinner's visually hidden duplicate of
  its label is removed; the label is still the region's accessible name.
- **Notification Center optimistic writes survive host pushes.** A read or
  dismiss the user just made is no longer undone on screen by an unrelated
  realtime update. `rollback()` now undoes its own write only, where it used to
  refuse once a later change existed, and does nothing once the host has
  confirmed the write.
- **`toSvDataError`** never puts Angular's own `Http failure response for <url>`
  message, Angular's placeholder `statusText` (`OK`, `Unknown Error`, `Request
  timeout`), an HTML error page, a stack trace or a dump longer than 300
  characters into `SvDataError.message`. It falls through to the caller's
  `fallbackMessage` instead (`OF-16-I6`).

### Fixed — Popover, Popout and Tooltip: a P1 re-check (`OF-12`, `OF-11`, `OF-20`)

Every public input, output and type keeps its name, type and default; the new
behaviour is in new optional inputs and new exports.

- **`sv-popover [interactive]`** (`OF-12-I10`, `OF-12-M1`). The anchored-surfaces
  ADR decided a passive/interactive axis; the component never had it and
  hard-coded `role="dialog"`. `false` is a passive callout (`role="tooltip"`,
  the trigger `aria-describedby` it while open, no `aria-haspopup`, never takes
  focus); `true` is a mini form (`role="dialog"`, focus to the first field or
  the panel, Tab / Shift+Tab kept inside). Unset is the old behaviour.
- **The hover corridor could strand a popover open** (`OF-12-I1`, `OF-12-M2`).
  Entering the corridor cancelled the close timer and nothing restarted it when
  the pointer then turned away. Leaving the corridor now restarts the close, and
  re-entering the trigger forgets the old departure point.
- **Anchor loss is watched** (`OF-12-I3`, `OF-11-I3`). Popover and Popout only
  re-checked the trigger on scroll/resize; a collapse with nothing moving left
  the panel floating. Both now size-watch the trigger while open.
- **Popout is a Popover preset** (`OF-11-I1`, `OF-11-M2`). New `align` input on
  `sv-popover` (adds `left-start` … `right-end`), new exports `SV_POPOUT_PRESET`
  and `PopoverAlign`; `sv-popout` is marked `@deprecated` and otherwise unchanged
  until the next major.
- **`sv-tooltip [forDisabledControl]`** (`OF-20-I4`). The wrapper is now described
  by the tooltip from the start (a description written after focus lands is not
  read), and Enter/Space on the wrapper toggle a `trigger="click"` tooltip.

### Changed — Layout & Utilities pass (`LU-01` … `LU-12`)

Every public input, output and type keeps its name, type and default: new
behaviour lands in new optional inputs or new exports. The items below are the
**intentional behaviour changes** and the **install-time changes** — the places
where the old behaviour was the bug. Read them before upgrading a layout-heavy
page.

**Install-time**

- **New `@styloviz/core` peer dependency** on `@styloviz/affix`,
  `@styloviz/scroll-area` and `@styloviz/watermark`. They now measure through the
  shared `svElementSize` primitive, join the floating layer and use the core
  dev-mode warnings. Most apps already have `@styloviz/core` installed through
  another package; if not, `npm i @styloviz/core`.

**Behaviour**

- **`sv-scroll-area`** is a tab stop only while it can actually scroll, on
  either axis (`tabStop`, default `'auto'`). A region whose content fits no
  longer adds an empty tab stop; a region that holds focus keeps it while its
  content shrinks. `tabStop="always"` restores the old unconditional stop. Content
  is observed automatically, and horizontal `scrollLeft` is normalised for RTL.
- **`sv-expand`** now wraps the projected content in a `div[data-sv-expand-content]`
  (the observed box), and a collapsed panel is `inert` as well as `aria-hidden`
  from the moment the collapse starts. `prefers-reduced-motion` is now honoured:
  the height change is instant. Style rules that targeted the content as a direct
  child of the panel need one more level.
- **`sv-splitter`**: a collapsed panel is `inert`, so its content leaves the tab
  order. Enter on the separator toggles collapse (ARIA window splitter); when a
  panel is already collapsed, Enter restores that panel.
- **`sv-affix`** stays static until its first `measure()`, instead of pinning on
  first paint against an unmeasured anchor. A host that drives the public
  `scrollY` / `anchorTop` / `height` signals directly must call `measure()` once.
  The pinned `z-30` is unchanged and is now named by `SV_FLOATING_Z.affix`.
- **`sv-site-footer`** generates per-instance ids, so two footers on one page no
  longer collide. The old literal ids (`sv-site-footer-heading`,
  `sv-footer-email`) are gone: a selector or `aria-labelledby` that named them
  must use the component's own markup instead. The newsletter status region is
  always present (a `role="status"` region must exist before it speaks), and
  external social links carry `rel="noopener noreferrer"`.
- **`sv-scroll-to-top`**, in its viewport-fixed mode, positions itself with inline
  insets from the shared floating layer (plus the safe-area inset) and carries
  `data-sv-floating`, so it stacks clear of a floating Speed Dial, affixed blocks
  and host-registered regions. Focus is no longer stranded on the button as it
  hides: a keyboard user who activates it is moved to the page heading (or a
  focusable fallback). An explicit `focusTarget` still wins.
- **`sv-speed-dial`**: the menu's z-index now comes from the shared overlay stack
  (above page chrome, below a dialog opened later) instead of a hard-coded value,
  and the portalled menu is wrapped in a `[data-sv-portal="speed-dial"]` host
  that carries theme, `dir` and `lang`. The default dial (`floating` unset) is
  still host-positioned and registers nothing — set `floating` to coordinate with
  Scroll to Top.
- **`sv-toolbar`**: the roving tab stop follows a click or focus as well as the
  arrow keys, so Tab returns to the action last used, and each button carries
  `data-sv-toolbar-index`.
- **`sv-watermark`** now re-tiles automatically (`observeResize`, default on,
  through `svElementSize`) and after web fonts load. Before, it drew **no marks at
  all** until the host called `measure()`. New: `viewerId` / `viewerSalt` and
  `svViewerToken()` put an opaque token in the mark instead of a name or email
  (dev mode warns on an email-shaped mark, without logging it). `checkIntegrity()`
  is stricter: it now also inspects the rendered overlay, so a hidden or restyled
  overlay reports `tampered`. That flag is documented for what it proves (a
  client-side DOM change) and what it does not (protection, compliance).
- **`sv-number-ticker`**: a new `value` now **retargets** from the displayed value
  (`updatePolicy`, default `retarget`); the old count-from-`from` is
  `updatePolicy="restart"`. A scroll-triggered ticker that had already run used to
  ignore updates entirely; it now takes them. `NaN`, `Infinity` and `null` render
  `invalidPlaceholder` (en dash). The live region announces the settled value once
  (`announce`). Formatting is exported on its own: `svFormatTickerDisplay` and the
  `svTickerNumber` pipe.
- **`sv-copy-to-clipboard`** writes through the new `SV_CLIPBOARD` adapter
  (default `svBrowserClipboard`) and its live region now announces a
  **reason-specific message** on failure (blocked, needs HTTPS, unavailable —
  each telling the user to copy manually — or "Copy failed") instead of one
  generic error. `copyError` still emits `unknown`; the value is now an `SvClipboardError`
  with the same `message` plus `reason` (`denied`, `insecure-context`,
  `unavailable`, `failed`) and `cause`. A click while a copy is in flight is
  ignored (`aria-busy`), and a copy that settles after destroy emits nothing.
  Opt-in `sensitive` mode joins the kit's sensitive-value policy: masked label,
  gated reveal, `copyAudited` (`SvSensitiveCopyEvent`).

### Added — `sv-select-dropdown` features as opt-in children, and `svSelectSource` (`FI-23-M1`)

The first half of the split in `docs/select-dropdown-split-adr.md`. It is
**non-breaking**: every existing input and output still works with the same
defaults. The advanced settings now have an opt-in shape:

```html
<sv-select-dropdown-pro [options]="rows()" [(value)]="v" [source]="people">
  <ng-container svSelectSearch [minChars]="2" />
  <ng-container svSelectVirtual [optionHeight]="36" />
  <ng-container svSelectBulk selectAllLabel="All people" />
</sv-select-dropdown-pro>
```

- **`@styloviz/core`:**
  - `svSelectSource({ search, pageSize, minChars, debounceMs })` owns search,
    paging and async state together.
  - `SV_SELECT_FEATURE` and `SvSelectFeature` are the contract a feature
    registers through.
- **`@styloviz-pro/select-dropdown`:**
  - new `SvSelectSearchDirective`, `SvSelectVirtualDirective` and
    `SvSelectBulkDirective`;
  - a new optional `source` input.
- **`@styloviz/select-dropdown` (free):**
  - `SvSelectSearchDirective` and `source`;
  - Pro-only feature children placed in it are ignored.

Each setting resolves in this order: `source`, then the feature child, then the
legacy input. The 21 moved Pro inputs (16 in free) are marked `@deprecated` in
JSDoc and name their replacement. There is no runtime warning. They are removed
in the next major.

### Fixed — `SvAutofillDirective` stopped reporting a fill that was still there (`FI-27-I2`)

A real-Chrome check (`scripts/probes/autofill-real-chrome.mjs`, Chrome 153, a
throwaway profile, a password filled on page load) confirmed that floating labels
sit above autofilled text before anything is touched. It also showed that Chrome
follows the fill with a trusted plain `Event('input')`. The directive read that
event as typing, so `autofilled()` and `autofillChange` flipped back to `false`
while the field was still filled. Only an `InputEvent` clears the state now.

### Fixed — the writing assistant lost paragraph breaks and textarea selections

The previous fix (the triple-click on the last paragraph) read the selected text
from the clipped `Range`, not from the `Selection`. `Range.toString()` joins
paragraphs with nothing and returns `''` for a selection inside a text control,
so a drag across two paragraphs sent `"…team.Figures"` to the model, and a
selection inside a textarea never opened the toolbar. The selection's own text is
used again unless the range had to be clipped. Caught by `e2e:at`.

### Fixed — a Forms & Inputs re-check: 59 P0/P1 items that were only partly done

On 2026-09-26 every P0 and P1 entry in `STYLOVIZ_FORMS_INPUTS_TODO.md` (138 of
them) was re-read against the tree. Each one was checked against every variant's
template, the free and Pro twins, the showcase and the docs data. **59 were
partly done**; the other 79 held. As in the AI and Data Display re-checks, the
usual cause was a fix that reached one variant or one twin only, or a docs claim
the code did not back. Every fix comes with a spec that renders the component.

**No breaking changes.** No union gains a member, no required input is added,
nothing public is removed or renamed, and no default changes. New information
went into optional inputs, additive outputs, or new exports:

- **Checkbox and Rating:** `pending`, `error` and `(changeRequest)` inputs and
  outputs (`X-6`). New types `SvCheckboxChange` and `SvRatingChange`.
- **Date range picker:** `locale`, `weekStart`, `timeZone` and `dateDisabled`
  (`FI-09-M1`–`M3`). The deprecated `weekDays` member is kept.
- **Rich text editor:** `showColorTools` (`FI-19-M1`).
- **Cascader:** `checkedChips`, `removeChip()` and the type `CascaderCheckedChip`.
- **Select dropdown (both twins):** `removeStale()`.
- **Core:** `svCaretRangeFromPoint`.

**Security:**
- **Drag-and-drop was a way round the paste sanitiser.**
  - In `sv-rich-text-editor`, content dropped in from outside the editor now
    goes through the same sanitiser as paste (`X-4`).
  - In `sv-mention`, dropped HTML could create a forged mention chip. Dropped
    content is now plain text, the same rule as paste (`FI-14-M3`).
- **`sv-form-builder`:** a schema field named `toString` or `valueOf` read a
  built-in object member (`FI-04-I1`). It could break the whole form or skip
  `required`.
- **`sv-input-mask`:** redaction missed card numbers typed in non-Latin digits
  (`FI-13-M3`).

**Data loss and wrong values:**
- **`sv-number-input`:** Enter submitted an out-of-range value unclamped.
- **`sv-inplace-edit`:** "Keep mine" on an unopened field wrote `''` over the
  value.
- **`sv-input-mask`:** form-written and autofilled values lost their letters or
  country code.
- **`sv-signature-pad`:** a restored signed record was re-dated.
- **`sv-select-dropdown` (both twins):** in multi mode, stale values vanished
  from view but were still submitted.
- **`sv-tag-input`:** it ignored `compareWith` when removing duplicates. The
  free twin also had no paste splitting.
- **`sv-file-upload` (both twins):** a file still awaiting a virus scan counted
  as uploaded.
- **`sv-cascader`:** in multiple mode, a stale path became a chip that could not
  be removed.

**Keyboard and accessibility:**
- **`sv-chip-group`:**
  - every remove button was its own tab stop;
  - Enter on × did nothing.
- **`sv-toggle-switch`:** with `lockReason`, the switch was unreachable by
  keyboard.
- **`sv-tree-select`:** lazy branches could not be opened from the UI.
- **Date pickers:** an arrow key could move focus onto a disabled day, and focus
  was lost.
- **`sv-inplace-edit`:** focus was lost around the conflict choice.
- **`sv-time-picker`:** its columns had no name or pressed state.
- **`sv-color-picker`:**
  - the hue rail had no value text;
  - with alpha, contrast was graded on the opaque colour.
- **`sv-slider`:**
  - `minGap` held in the model but not on screen;
  - in RTL the value bubbles sat away from their handles.
- **`sv-rating`:** the `sm` half-star targets were under 24×24.
- **`sv-segmented-control`:** in tabs mode, `aria-controls` pointed at panels
  that were not rendered.
- **Input group:** the error count was not announced.
- **`sv-select-dropdown`:** with `hasMore`, `aria-setsize` reported only the
  loaded count.
- **`sv-rich-text-editor`:** it took keys during IME composition.

**Docs:**
- The migration notes named `@styloviz/split-button`. The package is
  `@styloviz-pro/split-button`.
- The range picker was described as having no value model. It has
  `[(startDate)]` and `[(endDate)]`; it is not a `ControlValueAccessor`.
- The button API table listed an `accent` variant that does not exist.
- `autocomplete` now reaches the textarea and the select in `sv-input-field`.

Some behaviour now differs where the old behaviour was the defect:
- A scan-pending upload no longer counts as a success.
- `hiddenTools: ['fontFamily']` no longer also hides font size.
- A `selectionMode="none"` chip group no longer turns `selectable` chips into
  filters.
- `aria-setsize` is `-1` while `hasMore` is set.

### Fixed — a second AI-pack re-check: 2 P0s and 23 P1s that still fell short

A second re-check of every P0 and P1 in `STYLOVIZ_AI_COMPONENTS_TODO.md` on
2026-09-25 read each item against the templates of every variant, not only
against the helpers and specs. The suite was green at the start: 131 spec files,
2,942 tests. Two P0s (`X-1` and `AI-07-I1`, which share one root cause) and 23
P1s still claimed more than the component did. Another 17 held, but with a weak
spec or a small defect beside them, and those were tightened too. As in the first
pass, the usual cause was a fix that reached only one variant. Every fix below
comes with a spec that renders the component.

**No breaking changes.** No public type is narrowed, no union gains a member,
no required field is added to anything a host builds, and nothing public is
removed or renamed. Compile-level specs (`*.compat.spec.ts` in
`ai-chat-transport`, `citation-sources` and `ai-model-selector`) hold the
`HEAD` unions with exhaustive `never` switches. Where a fix needed new
information, it went into an optional field or a new export:

- **Transport:**
  - A step boundary is a `text` part with an optional `stepBoundary: true`.
    A reducer that ignores it appends `''`.
  - An abort is a `finish` part with `reason: 'abort'`.
  - `SvStreamState.stepBreak` is optional.
- **Citations:**
  - A claim match reports `placement: 'anchor'` plus an optional `claimId`.
  - `SvCitationPlacements.missingClaims` is optional.
- **Routing:**
  - A retired step reports the existing `unknown-model` fault, with a label
    that says it is retired.
  - Region and deprecation are the optional step fields `unreachableInRegion`
    and `deprecated`.
  - The labels come from the new `svStepFaultLabels` and
    `svStepWarningLabels`.
- **Writing assistant:**
  - `toneApplied` is kept, with its type, and deprecated in favour of
    `toneFeedback`. It is now `true` only for a tone that was actually applied.
  - A history entry without its own `protectedRanges` is checked against
    `protectedRanges`, as before.
- **Embedding map:** the default `knnMaxPoints` stays at 1,200. Set it to
  `SV_CANVAS_MIN` to measure every SVG-drawn map exactly.
- **Guardrail feed:**
  - The row button keeps `data-sv-event` and the event's text.
  - The reveal moved beside it, found by `data-sv-reveal-for`.

**What you will see differently.** These are the fixes themselves:
- With `simulate` off, tone and inline actions say **requested**, not applied.
- A retired model bound through `[selectedId]` / `[config].modelId` is replaced
  with the first selectable model, written back through the two-way binding,
  and named on screen.
- A multi-step AI-SDK stream keeps its later steps.
- A write that would change a protected range is refused.

**P0**

- `sv-ai-writing-assistant` (`AI-07-I1`, `X-1`): with `simulate` off, the tone
  variant still said **Tone applied!**, and the inline actions announced
  "… applied to …", while the text was unchanged. A status now claims a rewrite
  only when one actually happened.

**Honesty and enforcement**

- `sv-ai-writing-assistant`:
  - `AI-07-M1`: protected ranges were only a warning, and only in `history`.
    Now every write the component makes is refused if it would change a
    protected range. A history entry can carry its own `protectedRanges`
    (`RevisionEntry.protectedRanges`). That covers a simulated action or tone, an inline rewrite
    and a restore. A refusal shows an alert and emits the new `protectedRefused`
    output (`svProtectedRefusal`, `ProtectedRefusal`). A suggestion whose
    original overlaps a range cannot be accepted, and `acceptAll` skips it.
  - `AI-07-I2`: over the diff cap, **Words touched** now reads "At most N · not
    compared". The degraded notice shows even when the diff is hidden.
  - The suggestions header counts now include this session's accept and reject
    decisions. "1 suggestion" is now singular.
- `sv-agent-task-queue` (`AI-09-M2`): `pendingTaskIds` was documented as
  disabling a task's controls, but the template never read it. Cancel and Retry
  are now disabled and `aria-busy` in every variant, and the handlers refuse a
  second press.
- `sv-ai-model-selector` (`AI-04-M2`):
  - Retired ids arriving through inputs are refused.
  - Fallbacks skip retired models.
  - `routing` shows the lifecycle and region marks, and a chain that uses a
    retired model no longer reads "Chain sound".
- `sv-tool-call-card` (`AI-13-M1`): a `transport` failure no longer shows a
  duplicate-action warning beside "Nothing ran, so retrying is safe".
- `sv-guardrail-panel` (`AI-19-M1`):
  - The version line shows `[policyVersion]`, and says so when the history's
    latest entry is behind it (`svPolicyHistoryIsBehind`).
  - The line also shows before and after, and the rule that was touched.
- `sv-ai-insight-cards` (`X-3`): the naive-detector note followed a hard-coded
  3σ. It now follows `[anomalyNotable]`.

**Every variant, not one**

- `sv-ai-chat`:
  - `AI-02-I1`, `X-4`: the scale notice was only in `copilot`, so the other
    three variants dropped messages silently. It is now in all four.
  - `AI-02-M2`: user-message attachments, including the refusal reason, render
    in all four variants.
  - `bubble` no longer renders the delivery status twice.
  - `AI-02-I2`: the copy button's label names the platform's own keys.
- `sv-ai-agent-activity-log`:
  - `AI-01-I1`, `X-4`: `timeline`, `compact` and `trace` now cap their rows and
    say when they have. `trace` keeps the first spans, so no child span is left
    without its parent on screen.
  - `AI-01-M1`: the out-of-order notice shows in `timeline` and `compact` too.
- `sv-rag-knowledge-base` (`AI-14-M1`): who can retrieve a source is shown on
  every row in `overview` and `sources`, not only in the expanded panel.
- `sv-ai-insight-cards` (`AI-03-M1`): the panel's other insights carry their
  provenance.
- `sv-ai-token-dashboard`:
  - `AI-05-M2`: the cached and reasoning notes also show as totals across
    models on `overview`.
  - `AI-05-M1`: the quality-adjusted multiple now comes with a cost per passing
    result (`svCostPerPassingResult`, `svTotalTokenBreakdown`).

**Streaming (`AI-02-M1`)**

- AI SDK v5 UI message streams:
  - A multi-step (tool → answer) run no longer loses everything after step 1.
  - Steps are separated by a paragraph break.
  - Lifecycle markers are no longer counted as unknown.
  - `abort` ends the reply as interrupted.
  - `tool-input-error` fails the call.
- The AI SDK v4 data stream protocol is decoded, with `svDataStreamReader` for
  line-per-part bodies.
- OpenAI Responses function calls are decoded.

**Privacy and accessibility**

- `sv-reasoning-trace` (`AI-12-I1`):
  - A step's `raw` text is masked through the privacy policy.
  - The dev warning also fires for `raw` on nested steps.
- `sv-guardrail-panel` (`AI-19-I1`): the "show original" button was nested
  inside the row button, so screen readers could not reach it. It is now a
  sibling.
- `sv-eval-scorecard` (`AI-18-I1`): the missing provenance fields were
  tooltip-only. They are now visible text, which the badge points at with
  `aria-describedby`.
- `sv-mcp-tool-registry`: the scale notice no longer sits directly inside a
  `<ul>` or `<tbody>`.

**Proof, where only a helper was tested**

Rendered specs were added for:
- claim ids (`sv-citation-sources`, `AI-16-M1`). Claim ids are now the first
  anchor through `[claims]`, and `(claimsOpened)` is new.
- receipts identical across `inline`, `modal` and `inbox`, including
  edit-then-approve (`AI-11-I3`, `AI-11-M2`).
- policy-source on the `policy` variant (`AI-11-M3`).
- the offscreen clock pause (`AI-09-I1`).
- the "deleting" status dot (`AI-14-M2`).
- the owned-rule miss and "Kept indefinitely" rows (`N-3`).

### Fixed — 21 AI-pack items that were marked done and weren't

In a re-check against `HEAD` on 2026-09-24, 21 of the 74 P1 items in
`STYLOVIZ_AI_COMPONENTS_TODO.md` claimed more than the code did. Every spec
passed. The usual cause was a correct, tested helper that the component never
called, or called in only one variant. Every fix below now has a spec that
renders the component, not just the helper.

**⚠ Behaviour changes. Check these before you upgrade:**

- **`SV_AI_COMMON_PATTERNS` masks more.** It adds two rules: `url-credentials`
  (a `user:pass@` or long-token userinfo becomes `[CREDENTIALS]`) and
  `url-secret-param` (the values of `token`, `api_key`, `secret`, `password`,
  `sig`, `X-Amz-Signature` and similar parameters become `[REDACTED]`). Hosts
  that opted into the common set will see URLs masked that were shown before.
  This includes the default scan in `sv-prompt-template-library` and the rule
  count in `sv-ai-privacy-inspector`.
- **`svDisplayCost().currency` is `'USD'` when there is no usable rate.** Before,
  it named the requested currency while returning an unconverted USD amount.
  The code is also upper-cased now.
- **`replayOnChange: 'cancel'` now exits the replay** (`sv-ai-agent-activity-log`).
  Before, it behaved like `'extend'`. `stepChange` now reports the replayed
  event, which is the one on screen.
- **`svDeletionLabel()` returns plain text.** It used to contain Markdown `**`,
  which rendered as literal asterisks. Use the new `svDeletionParts()` for
  emphasis.

**Privacy (`X-2` follow-through)**

- `sv-voice-assistant` (`AI-17-I1`): each segment's `aria-label` was built from
  the raw transcript, so screen readers read what the screen masked. It is now
  masked. The "N characters settled" count also leaked the length of the hidden
  text, and it now counts the masked text.
- `sv-guardrail-panel` (`AI-19-I1`, `AI-19-M2`): the redaction variant's
  "As generated" toggle showed originals to anyone. It now follows
  `revealScope`. With `'none'` there is no control. With `'on-request'` a reveal
  emits `revealRequested` once per event and joins `revealedEventIds`.
- `sv-tool-call-card` (`AI-13-I1`): `call.error` and `call.stack` are masked.
- `sv-mcp-tool-registry` (`AI-10-M1`): the server URL, the server error and the
  call-log errors are masked. With `reveal: true`, each server gets a Reveal/Hide
  control. **New:** output `revealChanged` and type `McpRevealChange`.
  `svAiMask` still ignores `reveal`, and this is deliberate: `reveal` permits a
  per-value control, it does not switch masking off. A spec pins this.

**The UI said things that weren't true**

- `sv-ai-token-dashboard` (`AI-05-I1`): every figure now goes through
  `svDisplayCost`, so "discount and tax applied" is true of the numbers, and
  the billing note shows in all five variants. **New:** `SvBillingContext.rateAsOf`
  and `svCurrencySymbol()`. `svFormatRate` and `svFormatSpend` take an optional
  symbol.
- `sv-ai-token-dashboard` (`AI-05-M1`): a $0 model showed "NaN× its raw cost",
  and a pass rate above 1 read "No pass rate recorded". Both are now labelled
  correctly.
- `sv-prompt-template-library` (`AI-08-I2`, `AI-08-M2`): the host tokenizer now
  drives every count on screen. The playground's `/4` estimate is no longer
  labelled with the tokenizer's name. **New:** `svPromptTokenCount()` and
  `SvPromptTokenCount`.
- `sv-ai-model-selector` (`AI-04-M2`): a retired model could be selected. It is
  now refused on every path and marked `aria-disabled`. Lifecycle, retirement
  and region marks show in all four variants.
- `sv-ai-agent-activity-log` (`AI-01-I2`): see the behaviour change above. The
  held-events notice now says they join the feed when you leave the replay.
- `sv-rag-knowledge-base` (`AI-14-M2`): the deletion notice renders a real
  `<strong>`. **New:** `svDeletionParts()` and `SvDeletionPart`.

**Now in every variant, not just one**

- `sv-ai-insight-cards` (`AI-03-M1`): the evidence link, the "assertion" label
  and the provenance label now show in `grid`, `inline` and `panel`, as well as
  `feed`.
- `sv-prompt-template-library` (`AI-08-M1`): the secret warning shows in the
  `editor` and scans the text with variables filled in. **New:** output
  `secretScanChange` and type `PromptSecretScanEvent`. The component has no
  save action, so it emits the scan and the host decides whether to block.
- `sv-sentiment-analysis-widget` (`AI-15-I1`, `AI-15-M1`): the missing-classifier
  notice shows wherever scores do, and undeclared fields are listed. The dev
  warning never fired before, and it does now. **New:** optional
  `FeedItem.language`, with a note when the classifier can't read that language.
- `sv-tool-call-card` (`AI-13-M1`): the retry warning sits beside the Retry
  button, so it is visible on a collapsed card too. It only shows when a retry
  is actually offered.
- `sv-mcp-tool-registry` (`AI-10-I2`): parameter tables have a ceiling you can
  expand, and the call log pages instead of cutting off silently. **New:** input
  `maxParamsPerTool` (default 8). `logLimit` is now the page size.

**Missing behaviour**

- `sv-ai-chat` (`AI-02-I1`): new messages no longer scroll you down when you have
  scrolled up. A "Jump to latest" button appears instead. **New:** input
  `stickToBottomThreshold` (default 48) and method `jumpToLatest()`.
- `@styloviz-pro/ai-chat-transport` (`AI-02-M1`): Anthropic streaming
  (`content_block_delta`, tool-input JSON deltas, `message_delta`) and OpenAI
  Chat Completions chunks were dropped. Both are now decoded, along with the
  Responses API's `response.completed`/`incomplete`/`failed`. Unrecognised
  events are kept as `unknown` parts. **New:** `svFinishReason()` and an
  optional `index` on tool-call parts.
- `sv-artifact-panel` (`AI-20-I2`): it had no copy or export. It now has both,
  acting on the revision on screen and honouring the privacy `copy` flag.
  **New:** outputs `copied`, `copyFailed` and `exportRequested`, type
  `ArtifactExport`, and functions `svArtifactExport()` and `svArtifactFileStem()`.
- `sv-ai-workflow-builder` (`AI-06-I2`): new e2e tests cover refusal
  announcements, redo (Ctrl+Shift+Z and Ctrl+Y), and Tab leaving the canvas.
  They found that undo and redo announced node ids instead of names. They now
  announce names.

### Added — `sv-ai-privacy-inspector`, the privacy contract on screen (`N-3`)

`X-2` gave the AI pack one privacy contract — mask patterns, reveal, copy,
telemetry — and eight surfaces that honour it. What none of them could do was
show you the contract. `provideSvAiPrivacy()` is a provider in a bootstrap file,
so four things were true and invisible: a policy with no patterns looked exactly
like one whose patterns found nothing; a rule with a typo masked nothing for the
life of the app and said so in one console line nobody reads; `reveal: true` was
one word in a file with no screen anywhere that mentioned it; and "what do you
redact, where does it go, how long do you keep it" had no answer outside the
source.

The `policy` variant is that answer. It lists the rules with whether each one
actually compiles, states the three switches in words as well as colour,
describes the state the policy is in rather than naming the flag, and orders its
findings so that everything which leaks content comes first — a panel that
opened with "copy enabled, worth knowing" while content was flowing to analytics
further down would be worse than no panel. It names the categories the shared
pattern set deliberately does not look for, with the reason for each. And it
carries an order-independent fingerprint, so "are staging and production on the
same policy" is answerable at a glance.

The `scan` variant runs the policy against your own content. A pattern list says
what is looked for; only your prompts say whether that is the right list. So it
reports what was masked and what went through — by shape, length and last two
characters, never by value, because printing the card number to prove a card
number got through would be the leak the row is warning about. A category you
have a rule for that leaked is reported separately from one nothing looks for:
the first is a rule that does not work, the second is a decision to review.

There is no score anywhere. You cannot know what share of the secrets in
arbitrary text a pattern set catches, and one invented number would be quoted
back. "Nothing matched" is never rendered as "no sensitive data found" — with no
patterns configured, nothing is being looked for.

Nothing leaves the browser: no fetch, no telemetry, no output carrying sample
text, and the panel says so rather than leaving it in a README.

The `retention` variant answers the half masking does not: how long content is
kept, on what basis, and who else receives it. All three are host declarations —
no component can detect a deletion job — and each row says which it is. A
retention window with nothing showing the deletion happening reads as a stated
policy, not a verified one. Evidence older than ninety days is reported as too
old to stand for anything, because a deletion report from last year is not
evidence that deletion ran last night. An indefinite window is said out loud
rather than left blank, since a blank reads as "no policy here".

An expired grant is not consent, and this will not render it as one. Withdrawal
beats a live grant whatever the dates say, and "no record" is kept apart from
"declined" — treating nobody-asked as a refusal looks safe and hides the finding.

And the sharpest of them: on-screen masking is not wire masking. `svAiMask` runs
in the renderer, so the model call, the log line and the analytics event all
receive the original. A team that sees masked transcripts on screen will tell an
auditor their data is redacted, so a content destination marked unmasked now
produces that sentence in as many words.

The `surfaces` variant renders the `X-2` adoption table and labels it a
declaration rather than a detection: Angular gives a component no way to ask
which others injected a token, so any adoption list is somebody's note, and one
rendered as measured is the worst kind of compliance UI. An exemption with no
reason recorded is named as an omission wearing the word.

### Added — a browser gate for the AI pack, and the five bugs it found (`X-5`)

`npm run e2e:at` runs Playwright against the **built** packages through a
one-component harness (`e2e/at-harness/main.ts`) that exposes `window.sv` —
`mount(name, inputs)`, `set`, `call`, `read`, `events()`. A page-level
accessibility scan tells you the PAGE is clean; it cannot put a component into a
portalled, half-edited, permission-denied state and assert on what changed. This
can. Three AI components are covered, 41 tests, and every defect below was
passing in jsdom.

**`sv-ai-writing-assistant` — four fixes (`AI-07-I3`, now closed).**

- **A selection inside a `<textarea>` anchored the toolbar to the corner of the
  viewport.** Chromium reports such a selection normally — the text through
  `getSelection()`, the editor as the range's common ancestor — and gives it a
  `{0,0,0,0}` rectangle, because the selection lives in the control's shadow
  text rather than in the document. The toolbar now falls back to the focused
  element, then to the editor, and still honours a rect that is flat in only one
  axis (a caret on an empty line is a real place on the page).
- **The inline toolbar had no keyboard route at all.** Focusing the editor and
  pressing Shift+ArrowRight fifteen times selects *nothing* without caret
  browsing, which is off by default, unknown to almost everybody and absent on
  touch. Each paragraph is now a focusable, named target: `Enter` or `Space`
  selects it and opens the toolbar over it, focus follows in, and `Escape`
  brings it back.
- **The key that opened the toolbar pressed its first button.** A key's
  activation behaviour is dispatched *after* the keydown listeners return,
  against whatever is focused by then — so moving focus into the panel made the
  same `Enter` run the first action and bounce focus straight out again.
- **`Escape` closed the toolbar and its own `keyup` reopened it.** The editor
  re-derived the selection on every key release, so the panel was rebuilt inside
  the same key press that dismissed it. `keyup` is now filtered to keys that can
  actually move a caret.

**`sv-voice-assistant` — one fix (`AI-17-I2`, narrowed from P1 to P2).** While
the recording-consent gate was up, the microphone button rendered *enabled*,
named "Start listening", and a real click on it did nothing whatsoever: no turn,
no output, no announcement, no focus move. It is now `aria-disabled` rather than
`disabled` — disabling it would remove the explanation from the tab order along
with the control — is `aria-describedby` the gate that says what is needed, and
a press sends focus to the decision that has to be made first.

The same spec file also establishes what bounds the whole item: **the component
touches no media API.** `getUserMedia`, `permissions.query`, `AudioContext`,
`MediaRecorder`, `SpeechRecognition` and `speechSynthesis` are instrumented to
count calls and to fail when called; a full turn cycle makes zero calls, and the
component works identically in a page where those APIs have been deleted. A
denied microphone or a blocked autoplay breaks the host, not this component.

**`sv-ai-workflow-builder` (`AI-06-I2`, now closed).** No fix needed: the
keyboard editing shipped in the previous entry is confirmed in a real browser —
real Tab order, `c` → `c` to connect, `Escape` to cancel a half-made edge, the
live region carrying each edit and each refusal, undo and redo from the
keyboard, axe clean while editing.

⚠️ **What the gate cannot do, and is not claimed to.** The harness ships no
Tailwind, so contrast and layout-dependent behaviour stay with `check:contrast`
and the showcase scan. It is desktop Chromium, so iOS Safari, mobile viewports
and real hardware remain unproven — measured, not assumed: this headless
Chromium reports audio playback without a user gesture as *allowed*, so a green
run here says nothing about a phone. And axe can say an announcement exists and
is named; it cannot say a screen reader reads it usefully.

### Added — `sv-ai-model-selector` hands its dropdown to your overlay stack (`AI-04`)

`[overlayContainer]` and `[overlayZIndex]` (default 9999, exported as
`SV_MODEL_OVERLAY_Z_INDEX`). A host with a modal layer, a toast layer and a
command palette has one element every overlay has to live inside for its own
ordering to hold; a panel appended to `<body>` regardless is outside those rules
and lands under or over the wrong layer by document order, which no z-index on
our side can fix — stacking contexts do not compare across them. The default is
unchanged.

**And the browser gate found two defects on the way (`AI-04-I3`, now closed).**

- **A transformed overlay root silently re-based every coordinate.**
  `position: fixed` is viewport-relative only while nothing above the element has
  made itself a containing block — and `transform`, `filter`, `perspective`,
  `will-change` and `contain: paint` all do, which is exactly what an app puts on
  an overlay root for compositing and modal animations. Mounted inside one, the
  dropdown appeared offset by wherever that root sat: the bug that reads as "the
  dropdown is in the wrong place on one page". The panel now finds that ancestor
  and converts into its space. `e2e/ai-model-selector.at.spec.ts` measures the
  trap with a probe element first, so the test proves the browser fact and then
  the fix.
- **`role="listbox"` was on the whole panel**, which also holds the search box
  and the footer. axe reports it critical, and rightly: a listbox may own only
  `option` and `group` children, so the search input was an illegal child — and
  the options, nested a div deeper, were not the listbox's children at all. A
  screen reader had an empty listbox and five options belonging to nobody. The
  role is now on the scrolling list, named, with the options as its direct
  children, the "no models match" state beside it rather than inside it, and
  `aria-controls` on the trigger while the panel is open.

A container that is not yet in the document falls back to `<body>` with a dev
warning, because appending to a detached element renders nothing and raises
nothing — the least debuggable failure the input could have.

### Changed — two `@styloviz-pro` barrel names in `sv-ai-privacy-inspector`

`check:pro-barrel` could not run its collision check while `dist/` was missing
the two newest packages; with both built it found that the privacy inspector had
claimed two names that were already taken, and an unresolved collision silently
deletes one of them from the barrel. The incumbent keeps the plain name:

- `DEMO_POLICY` → **`DEMO_PRIVACY_POLICY`** (`@styloviz-pro/ai-model-selector`
  publishes a model-routing `DEMO_POLICY`).
- `svConsentBlocks` → **`svConsentRecordBlocks`** (`@styloviz-pro/voice-assistant`
  publishes a capture gate of that name; this one asks whether a stored grant,
  with its expiry and withdrawal dates, still authorises processing — two
  different questions).

Both were introduced in this unreleased version, so nothing published changes.

### Fixed — the guardrail showcase reported the state before the press

`(ruleToggle)` began emitting an `SvRuleToggle` — the rule, what the reader
asked for, and the state they saw when they pressed it — and the showcase
handler still read `rule.enabled`, so the demo announced the state *before* the
toggle as though it were the request. Also fixed a `string | undefined` in the
form-error-summary demo that predates this release.

### Added — `sv-embedding-map` draws a hundred thousand points (`AI-21`)

The ceiling was twelve hundred, and it was two things: one `<circle>` per point,
and a neighbourhood statistic that compared every point with every other one.

`[renderer]` now picks the surface — SVG below two thousand points, a canvas
above, and either on demand. Neither answer is right at both ends: real nodes
mean real hover and a `<title>` per dot, and a hundred thousand of them is a
layout the browser does not finish.

The statistics run on a uniform grid instead of a full scan. Forty thousand
points take about 0.6 seconds where the scan takes about ten minutes, and a
complete k=10 pass over a hundred thousand takes under three. The grid is
*exact* rather than approximate — it returns the same neighbours the scan does,
tie-breaks included, which the specs check point by point on a uniform cloud, on
a cloud flat in one axis, and on a lattice where every distance is a tie. The
`[knnMaxPoints]` sampling budget is still yours; what changed is what it costs.

Clicking and lassoing go through the same index. A click resolves to the
*nearest* point rather than the first one in range — on a canvas there are no
per-point events, so "first in range" would mean clicking between two dots
selects whichever sits earlier in your array — and the lasso tests only the
cells its bounding box touches.

The canvas has no per-point nodes, so the dots are not focusable and carry no
`<title>`. That is why the keyboard browse list came first: it renders under
both renderers, the plot keeps its summary label, and a line on the chart says
the dots are not individually reachable and points at the list. Fills are
resolved from your live theme tokens, because a canvas silently ignores
`var(--color-…)` and paints black.

Zoom and pan are still not here.

### Added — `@styloviz-pro/ai-chat-transport`, a new package (`AI-02`)

`sv-ai-chat` takes a `ChatMessage[]` and left every host to write the same three
hundred lines: read the response body, frame the SSE, work out which of a
provider's several part shapes this one is, append or replace the text, track the
tool calls, and decide what a stream that just stopped means. Everyone writes it.
Nobody writes the last part.

It is a separate package, and that is the point: the chat UI imports nothing from
it. A transport baked into the component is a component that has picked your
backend for you, and a provider renaming a field would ship as a new version of
the chat.

**`svSseReader`** keeps a carry buffer, because a network chunk is not a message.
Without one, `JSON.parse` throws on the half of an object that arrived, the catch
swallows it, and one token in a few hundred disappears — which presents as "the
model sometimes drops a word", and nobody debugs it because nobody believes it.
It flushes nothing at the end (a block with no blank line after it is not an
event) and reports that the stream ended mid-event instead. Heartbeat comments
are counted rather than discarded: an idle timeout that watches only events kills
a stream that is demonstrably alive while the model is still thinking.

**`svFrameGate`** applies each numbered WebSocket frame once. A replayed frame is
not appended twice — that reads as "the the answer is is 42" — a late frame is
dropped rather than inserted after text written later, and a gap is *reported*,
because a gap is text that never arrived and a transcript with a hole in it shown
as complete is the failure. Frames with no sequence number are accepted and
marked unordered, so nothing claims completeness on the strength of a convention.

**`svDecodePart`** tells an incremental delta from a cumulative snapshot. Confuse
them and the reply either repeats itself — "HelloHello there" — or loses
everything but its last token, and nothing on the wire says which one you are
holding. A part of a kind it does not model is kept and counted, not dropped: a
decoder that ignores the unknown produces a transcript missing content that looks
whole.

**`svStreamEnd`** is the part nobody writes. A stream that stops arriving without
a terminal event has not completed, so it is `interrupted`, and
`svToChatMessage` renders that as an `error` message — the reason and a resend
control beside the half answer. Mapping it to complete, which is tempting because
there is text to show, tells the reader the half answer is the whole answer.

Not included, and said so rather than implied: no reconnection, no auth, no
backpressure, no `Last-Event-ID` resumption. The `id` and `retry` fields are
decoded and handed over.

### Added — `sv-ai-workflow-builder` has undo and redo (`AI-06`)

A builder without undo is not a builder. `Delete` on a focused node takes that
node and every connection to it in one keystroke, and until now there was no
way back.

It is a command stack rather than a stack of snapshots, and the difference
matters later: a snapshot can only say "mine" or "theirs" when two people edit
at once, where a command can say what each person did. Collaboration is not in
this release — there is no presence, no merge, no conflict resolution, and the
docs say so — but the shape that makes it possible costs nothing now and cannot
be retrofitted.

Undoing a delete puts the node back with its edges and the list variant's
matching step, each at the index it was at. Membership alone would not do: the
debug trace maps nodes in array order, so an undo that appended would reshuffle
the whole trace for an edit that changed nothing about the graph.

Recording an edit clears the redo branch, because those commands describe a
graph that no longer exists. The 50-edit ceiling drops the oldest rather than
refusing the newest — a stack that stops recording at its limit makes the next
edit permanent, and nothing on screen would say why. A fresh `[workflow]` clears
the stack: the history belongs to the graph it was recorded against.

The buttons are named after the edit they will reverse — "Undo deleting Classify
and 3 connections", not "Undo" — because somebody who has just pressed the wrong
key is the least able to remember what it was. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z
work on a node card, and every step is announced in the same live region as the
other edits.

`svRecord`, `svUndo`, `svRedo`, `svApply` and `svInvert` are exported for a host
that keeps the workflow in its own store.

### Added — `sv-ai-workflow-builder` can be built without a mouse (`AI-06`)

The canvas could be read and not written. Nodes were selectable, the graph was
laid out, the run could be triggered — and there was no way to add a node or
connect two, by keyboard *or* by pointer. So this release builds the editing
operations, and builds them keyboard-first: a native `<select>` and real
`<button>`s, which work before anybody writes a drag gesture, rather than an
accessible equivalent bolted onto one afterwards.

`[editable]` (off by default) turns the canvas into an editor. On a node, `n`
adds one after it, `c` starts a connection and `c` on a second node completes
it, `Delete` removes it, `Escape` cancels. A pointer finishes the same way:
activating a node while a connection is pending completes it, because a reader
who pressed `c` and then clicked expects a connection rather than a selection.
The shortcuts are written on the canvas — a single letter nobody can discover
is not a feature.

Every edit, and every refusal, goes into a live region. An edit a screen reader
cannot hear did not happen, and a connection dropped in silence is how somebody
presses the same two keys four times believing it worked. The Add control says
which column and row the node will land in *before* it lands there, and the
connection control offers only the nodes that can be connected with the reason
beside the one on offer, instead of a disabled button that implies the reader is
holding it wrong.

A connection is refused in four cases: a node feeding itself, a duplicate, a
source with no output, and a target that accepts none. A cycle is not one of
them — a `loop` node is a cycle by design — but an edge that leaves no node
without a predecessor is reported, because the debug trace measures depth from
those and with none of them every node reads at the same level.

The operations are exported as pure functions (`svCreateNode`, `svPlaceAfter`,
`svCheckConnect`, `svConnect`, `svDeleteNode`), so a host holding the workflow
in its own store can run the same rules, and `(workflowEdit)` reports the result.
Undo/redo is not here yet; these are the commands a stack would record.

### Added — `sv-embedding-map` can be read without a pointer (`AI-21`)

A `<title>` on every dot was never an accessibility story: an SVG `<circle>` is
not focusable, so nothing in the plot answered an arrow key — and `tabindex="0"`
on the circles, the fix that satisfies the same audit rule, would make five
thousand tab stops in whatever order the host's array happened to be, with no
way out but Tab. That is worse than the bug, because it looks solved.

There is now a two-level walk in a `<details>` beside the chart — in the reading
order, not `sr-only`. Clusters first, which is the level these plots are
actually read at, then the points inside one: one tab stop per level, arrow keys
inside it, `Enter` to drill in, `Escape` to come back, and focus returning to
the cluster just left. Arrow keys clamp at the ends rather than wrap, because
wrapping at row 200 of 200 restarts the walk and a reader hearing an unfamiliar
ticket title cannot tell that from having moved by one.

A point row reads its name, its cluster, its position in the list, and what is
*around* it — the share of its nearest points carrying the same label — never
its coordinates. Those are layout units, and comparing them is precisely the
reading the caveat on the chart refuses. The neighbour list is a fair substitute
for looking at the dot here and nowhere else, because the projection fits both
axes with one scale and a uniform scale cannot reorder distances.

The list is capped at the new `[maxKeyboardPoints]` (200) and says how many of
the cluster it did not reach: a list that claims to be the alternative to the
plot and silently holds 200 of 5,000 is worse than no list, because the reader
who reaches the bottom believes they have seen the data. Points with no cluster
label get a row of their own, or a half-labelled dataset — which is most of them
before someone does the labelling — leaves half its points reachable by pointer
and by nothing else. `navCluster` is two-way, so a host can put a reader back
where they were.

In the `selection` variant, activating a row toggles that point. A lasso is a
pointer gesture and cannot be anything else; one point at a time is slower and
is not nothing.

### Fixed — `sv-embedding-map` had two verdicts on one number

The per-cluster weak marker compared against a literal `0.6` while the summary
sentence above it used `[lowPurity]`. A host that lowered the threshold for
forty fine-grained intents that genuinely overlap got "the clusters are
separated" in the summary and a warning marker on the rows between the two
figures, at the same time, from one number.

### Added — `sv-ai-writing-assistant` protects what must not be rewritten (`AI-07`)

`[protectedRanges]` marks quotations, legal clauses, code and names, and the
component checks the *result*: a protected range in a prompt is a request, and a
model asked to "make this clearer" will reword a quotation while doing exactly
what it was told. Protection is about containment, not position — a rewrite that
shortens the paragraph above a quotation has not touched it.

And a diff abandoned for length now says so. One enormous red block beside one
enormous green block is what a from-scratch rewrite looks like too, and the
colours cannot tell those apart.

### Added — `sv-ai-insight-cards` shows its evidence, or admits it has none (`AI-03`)

`evidenceUrl`, `confidenceBasis`, `model` and `modelVersion`. An insight with no
evidence renders as what it is — an assertion, not a finding. That is stronger
than the required field the backlog asked for: a required field is satisfied by
an empty string, and this cannot be satisfied by typing quotes.

Every bundled demo insight now carries `sample: true` and the card says so. A
board rendering believable insights with no data wired is indistinguishable from
one rendering real ones, and `DEMO_INSIGHTS` is one copy-paste from a host's
fixture — so the label travels with the data rather than with the mode.

### Added — `sv-ai-agent-activity-log` says who owns a replay (`AI-01`)

`[replayOnChange]` — `hold` (the default), `cancel` or `extend` — decides what an
arriving event does to a replay in progress. Nothing used to say: the feed
re-sliced against whatever had arrived, so "step 4 of 20" quietly became step 4
of a different list. Under `hold` the waiting events are counted and announced.

Events are never re-sorted by timestamp. Two agents on two machines produce
clocks that disagree, and sorting by them would put a tool result before the call
that produced it — so an event whose time runs backwards is flagged instead.

### Changed — `sv-guardrail-panel` publishes `[(revealedEventIds)]`

It was a private signal, which `check:collection-identity` correctly refused: a
host logging reveals needs to be able to restore the same set after a route
change, or its audit trail and what the panel shows disagree.

### Added — `sv-ai-token-dashboard` admits what the invoice will say (`AI-05`)

`[billing]` names the gaps between this page and the bill — list prices, tax, a
contract discount, unsettled usage — because a cost dashboard that disagrees with
the invoice destroys trust in one billing cycle, and saying "estimated" without
saying *which direction* does not help.

`cachedInputTokens` and `reasoningTokens` are subsets of the existing figures.
Cached input bills at a fraction, so counting it with fresh input overstates the
workload somebody optimised; reasoning output is billed and never shown, so a
reader counting the words they got back concludes the provider is overcharging.

`[passRates]` turns spend into cost per result that *passed*, as a multiple of
the sticker price. A model at a third of the price that passes two thirds as
often is not cheaper.

### Added — `sv-sentiment-analysis-widget` says what produced its scores (`AI-15`)

`[classifier]` — model, version, languages, calibration date, agreement with
human labels — renders above every variant. A sentiment number without a
classifier identity cannot be defended when somebody disputes it, and two figures
from either side of a model swap are not comparable at all: the change measures
the classifier, not the customers.

`languages` is the field every dashboard omits, and its absence is a silent
failure that looks like data — an English-only classifier scores German reviews
as *neutral* because it cannot read them.

### Added — `sv-prompt-template-library` scans for secrets and names its tokenizer (`AI-08`)

A prompt library is where API keys get pasted into a system message and shared
with a team: somebody drops a working key in to see whether the call goes
through, it works, and the template is saved, named and handed to nine
colleagues — no commit, no code review anywhere in the path. Detection is on out
of the box, using the pack's own `SV_AI_COMMON_PATTERNS`, and the warning names
the blast radius rather than the rule. It is a detector, not a redactor.

`[tokenizer]` drives every token figure and its label renders beside them. Four
characters per token is an English-prose approximation — Chinese runs closer to
one — so an unlabelled figure is a budget built on somebody else's language. A
tokenizer that throws or returns nonsense falls back to the estimate.

### Added — `sv-rag-knowledge-base` says who can retrieve, and what deletion left behind (`AI-14`)

`KbSource.audience` names the groups that can retrieve a source, and an
undeclared audience reads as *everyone* and says so. A roll-up counts how many
sources are open to everyone, because a reviewer scanning forty rows will not
notice the one without a lock.

`status: 'deleting'` with `KbSource.deletion` reports chunks remaining,
embeddings remaining, and whether the source **can still be retrieved**. Deleting
a source and its answers leaving the index are different moments, and a panel
that says "deleted" the moment the button is pressed is making a compliance claim
it cannot support.

### Added — `sv-ai-chat` attachment limits and a real clipboard fallback (`AI-02`)

`svCheckAttachments(list, { maxCount, maxBytes, accept })` decides what may be
attached, and the refusal is the part that matters: a refused attachment stays in
the transcript, struck through, with its reason. One that disappears is
indistinguishable from one that uploaded, and the user sends "here's the
recording" to a model that never saw it.

Attachments now render on user messages as well as assistant ones — they used to
render only under an assistant message, so a file the user attached was invisible
on the message that carried it.

When the clipboard refuses, the component selects the message text and says which
keys to press. Telling somebody "copying failed" leaves them to select three
paragraphs by hand.

### Added — `sv-agent-approval` emits an immutable decision receipt (`AI-11`)

`(receipt)` carries who decided, when, through which variant, the risk class it
was approved under, the policy that routed it, and the arguments **as executed** —
frozen, arguments included. `(decided)` is the instruction; this is what happened.

`inline`, `modal` and `inbox` are three shapes for one act, and one function
builds the receipt for all of them, so the record is identical apart from
`through`. An audit trail whose contents depend on which shape the operator
happened to be looking at cannot be reconciled with anything.

`policySource` answers "why am I being asked?" in every variant, and the expiry
countdown now says in the surface that it is the browser's clock and not the
enforcement point — a host that treats "the button went grey" as authorization
having lapsed has put its access control in the client.

### Added — `sv-reasoning-trace` governs what a viewer may see (`AI-12`)

`[disclosure]` is `summary`, `steps` (the default) or `full`. The field it exists
for is new: `ReasoningStep.raw`, a step's verbatim provider reasoning, which
several providers' terms prohibit displaying and which is the text most likely to
contain a user's own words repeated back. It is separate from `content` —
narration written to be read — so a host cannot expose one while meaning the
other, and it renders only at `full`, with a dev warning when it actually does.

The default is `steps` rather than summary-only on purpose: defaulting a
component whose whole purpose is showing reasoning steps to "hide the steps"
would be a silent breaking change dressed as a safety fix.

`[confidenceBasis]` names what the confidence figure is. With the meter on and no
basis it still renders and says "no method recorded" — hiding a number the host
already shows would be a regression, and "80%" reading as calibrated when it is
the model rating its own certainty is the actual problem.

The prose throughout now says **reasoning summary** rather than
"chain-of-thought". The package name and selector are unchanged.

### Changed — `sv-guardrail-panel` masks by default, and logs who looked (`AI-19`)

**Breaking:** `(ruleToggle)` now emits `{ rule, enabled, observedEnabled, at }`
rather than the bare `PolicyRule`. Migrate `$event` to `$event.rule`.

The feed used to render every event's raw text, on the argument that a reviewer
needs the exact characters to judge whether a rule fired. That was half right —
the feed is not only read by that reviewer, and it is the surface that gets
screenshotted into tickets. `[revealScope]` resolves it by scope: masked by
default, revealed for a role that reads raw matches all day, or on request for
one event, with every reveal reported through `(revealRequested)` so the host can
log it.

The masking is **by span**, using the ranges the policy itself found, so it is
offset-exact — which is why it does not hit the objection that keeps the
pack-wide pattern policy out of this component.

Also: `[editable]` for the authorization the component cannot know,
`[pendingRuleIds]` so one click cannot fire the same privileged change twice, and
`[policyVersion]` / `[policyHistory]`, because "who turned this off, and when" is
the first question asked after an incident.

### Added — `sv-voice-assistant` calibrates its silence, and asks first (`AI-17`)

`[ambientLevels]` calibrates the silence threshold from the room. `0.04` is a
guess about a quiet office: in a car, a café or a warehouse the ambient floor
sits above it, so every frame reads as speech, the auto-stop never fires and the
meter claims to hear a user who has not spoken. Measured from the 90th percentile
of ambient — the mean sits under most of the room, and the maximum lets one cough
deafen the session — capped at 0.35 so a loud room cannot stop the assistant
hearing anybody, and floored at 0.02 so a clean digital input cannot calibrate
zero.

`[consentRequired]` with two-way `[(consent)]` gates capture behind an explicit
"this records your voice" prompt. The browser's microphone permission is not
consent: it asks whether the page may use the microphone, not whether the user
agrees to being transcribed, stored or sent to a third-party model. The gate
blocks `start` only — stop and interrupt always work — and a **Recording**
indicator now shows whenever the microphone is open, in every variant, with no
host opt-in.

### Added — `sv-eval-scorecard` records what judged the run (`AI-18`)

`provenance` on a run — judge model and version, rubric version, seed, trial
count, dataset hash and size — rendered as only the fields the run declared, with
the rest named as gaps behind a **Not reproducible** badge. Nothing is defaulted:
a missing seed does not mean "unseeded".

The compare view now performs the check no eval harness performs. Two runs judged
by different models, against different rubrics, at different trial counts or over
different datasets are not the same experiment, and the delta between them
measures *the judge* — while arriving with the same arrow, the same colour and the
same confidence as a real regression. A different seed is deliberately not
flagged: two runs at different seeds are the same experiment sampled twice.

And the case list exports. The **Cases (CSV)** button downloads it and emits it
through `(exportRequested)`, with the provenance in the comment header.

### Added — `sv-citation-sources` anchors citations to text (`AI-16`)

`anchorText` on a citation is the exact words of the *answer* it covers, and a
citation carrying one is placed by finding those words. Character offsets were
the wrong anchor: a trim, a collapsed double space, a markdown pass or a
prepended greeting shifts every one of them by the same amount, and the chips
slide off the claims they belong to without anything failing.

The silence was the worse half — a misaligned citation was clipped away without a
word, so an answer whose chips had all moved looked exactly like a correctly cited
one. Drift and loss are now counted and stated in the surface.

`claimId` is identity rather than placement: the same claim re-worded keeps its
id, so a host can persist "the reader checked this" across re-generations.

### Fixed — a source URL is untrusted input (`AI-16-I2`)

`[allowedUrlProtocols]` defaults to `http:`, `https:` and `mailto:`. A refused
URL is shown as text with its scheme named rather than hidden: Angular already
rendered `javascript:` as a dead `unsafe:` link, which is safe and silent — the
reader clicks, nothing happens, and nobody learns the citation was fabricated.

### Added — `sv-ai-model-selector` dates, explains and deprecates (`AI-04`)

Every number on this component goes stale on its own: context windows, prices and
availability change monthly and it renders them in the present tense.
`[catalogueAsOf]` is when the figures were true, shown under every variant and
marked stale past `[staleAfterDays]` (30). Supply nothing and nothing is
rendered — the dev warning goes to the console, where the person who can fix it
is looking.

`isFeatured` now has to answer for itself: `featuredReason`, or a catalogue-wide
`[recommendationPolicy]`, is rendered beside the star, and with neither the card
says that no reason was recorded. "Recommended" with no visible policy reads as
authority and cannot be told apart from a vendor placement.

`lifecycle`, `retiresAt` and `regions` (with `[region]` for the deployment) keep
a dying model **visible and marked** rather than silently absent — dropping it is
how a team finds out about a retirement from a 404 in production. Only `retired`
is unselectable, because calling it cannot succeed.

### Added — five failure causes on `sv-tool-call-card` (`AI-13-M2`, `AI-13-M1`)

`failure: 'transport' | 'tool' | 'policy' | 'timeout' | 'cancelled'` replaces one
error state that stood for five different facts — three of which are not the
tool's fault. Each cause renders its own chip label, meaning and recovery line.
Leave it unset and the card keeps the generic **Failed** state it always had: an
undeclared cause is not guessed at, because blaming the tool for a network fault
sends the reader to the wrong owner.

A `policy` refusal is now offered no retry at all — a second press does not
change a refusal. And `idempotent: false` grows a warning beside the retry,
loudest on a `timeout`: "charge the card" timed out, it may have charged, and the
button could charge it again.

### Added — `createOffscreenPause` in `@styloviz/core`

`createVisibilityPause` stops a live surface when the *tab* goes away. It never
covered the case that matters on a wallboard: an element scrolled three screens
down a page, visible to the browser and invisible to the reader, paying for a
timer, a signal write, a change detection pass and a reflow once a second.

`createOffscreenPause()` watches one element and reports `offscreen`. With no
`IntersectionObserver` — SSR, a DOM shim, an old browser — it stays false and the
caller keeps ticking: a pause that fired because the environment lacks an
observer would freeze a surface somebody is watching.

`sv-agent-task-queue` is the first consumer and stops on either signal.

### Changed — `AgentTaskAction` carries the status the reader saw (`AI-09-I3`)

**Breaking for anyone constructing an `AgentTaskAction`** — a test double, say.
Consumers of the `(action)` output are unaffected.

A cancel is a conditional instruction: "stop this task, which I was looking at as
`running`". The 200ms it takes to reach the server is long enough for the task to
finish, and without the condition the host must either reject a click the queue
itself offered, or cancel whatever has since taken that task's place. The payload
now carries `observedStatus` and `at`; `svTaskActionIsStale()` compares, and
`svTaskActionNoopMessage()` says so in a sentence that calls it neither an error
nor a failure.

### Added — `sv-artifact-panel` states whether the document is saved (`AI-20-M1`)

`saveState` — `'saved' | 'saving' | 'unsaved' | 'conflict'` — with one sentence
per state and the last two styled as needing action. `saving` and `unsaved` are
the pair a reader confuses when one indicator serves both: the first means the
store has the edit, the second means it does not.

The component never infers this from a changed input, because only the host knows
whether its write landed, and it does not resolve a `conflict` — it states one,
persistently. The merge stays the host's.

### Fixed — an approximate diff no longer opens an empty box (`AI-20-I1`)

Past `SV_DIFF_LINE_CAP` (2,000 lines) `sv-artifact-panel` does not compute the
exact diff, so pressing **What changed** rendered nothing at all: the loudest
possible claim that nothing changed, on exactly the documents where the most is
at stake. The diff surface now carries the reason — the cap, the counts that are
known, and the fact that the positions are not.

### Added — one privacy and redaction policy for the AI pack (`X-2`)

`provideSvAiPrivacy({ patterns, reveal, copy, telemetry })` in
`@styloviz/core` configures masking once for `sv-ai-chat`,
`sv-agent-approval`, `sv-tool-call-card`, `sv-reasoning-trace`,
`sv-voice-assistant`, `sv-mcp-tool-registry` and `sv-rag-knowledge-base`
instead of seven times. `SV_AI_COMMON_PATTERNS` is an opt-in set covering
provider keys, bearer tokens, JWTs, AWS keys and private-key blocks.

**An app that provides no policy is unchanged.** Nothing is masked, copy works,
no reveal control appears, and no content telemetry is sent — those are the
defaults, and three of the four are the conservative choice deliberately.

**Masking is display-only.** Your `messages`, arguments, transcript and chunks
are never edited, and neither are the numbers computed from them: the approval
receipt and the risk classifier see the real arguments, and a permitted copy
carries the original.

**Two behaviours change when you DO provide patterns.** A masked argument in
`sv-agent-approval` becomes read-only, because an input showing `[API KEY]`
submits `[API KEY]` — set `reveal: true` to offer an unmask that restores both
the value and the editability. And `copy: false` hides `sv-ai-chat`'s copy
button, refuses `copyMessage()` (a hidden button is only styling; the method is
public API), and withdraws `sv-voice-assistant`'s settled-text footer.

`sv-guardrail-panel` is exempt by design: its spans are offsets into the event
text, so masking that text would shift them and colour the wrong characters —
and it is the surface where over-redaction is meant to be visible.

### Added — every list-shaped AI surface now states its scale ceiling (`X-4`)

Six surfaces were unbounded: the chat transcript, the agent activity feed, the
MCP registry (servers, and each server's tools), the task queue, the eval case
tables and the knowledge base's source list. Each now has a documented ceiling,
windows its list, and says what it left out — `svScaleWindow`, `svScaleLabel`
and `<sv-scale-notice>` in `@styloviz/core`, generalising the pattern
`sv-artifact-panel` and `sv-ai-writing-assistant` already used for approximate
diffs.

**Nothing changes for a list under the ceiling**, which is every list in a demo
and most lists in production. Past it, the surface renders a window and a
sentence rather than either freezing or silently showing a hundred of five
thousand rows — the second being worse, because a page that freezes is at least
honest about being in trouble.

**Defaults:** `[maxMessages]` 300, `[maxEvents]` 500, `[maxServers]` 100,
`[maxToolsPerServer]` 50, `[maxTasks]` 200, `[maxCases]` 300, `[maxSources]`
200. Pass `0` to any of them if you virtualize that list yourself.

The direction is part of the contract: a transcript and a feed keep the NEWEST
rows, everything else keeps the host's order from the top. Counts, rates and
writes are unaffected — they still run over the whole list, so the queue's
"940 queued", the registry's per-server tool count and the scorecard's pass
rate mean what they meant before.

### ⚠ Breaking — `SvAnomaly` gained a `minSamples` field (`X-3`, `AI-03-I4`)

`sv-ai-insight-cards` now takes its anomaly scale from the host:
`[anomalyMinSamples]`, `[anomalyNotable]` and `[anomalySevere]`, defaulting to
the exported `SV_ANOMALY_MIN_SAMPLES` (14), `SV_ANOMALY_NOTABLE` (3σ) and
`SV_ANOMALY_SEVERE` (5σ). Those constants are still exported, `svAnomaly` still
works with two arguments, and a page that sets none of the three renders exactly
what it did before.

**Why.** Fourteen observations, 3σ and 5σ are reasonable for a daily business
metric and wrong nearly everywhere else: a fortnight of hourly data is 336
observations, a fortnight of monthly data is not a baseline at all, and a
seasonal series needs a season. The figures were well reasoned and still a guess
about somebody else's domain.

**What is breaking.** `SvAnomaly` now carries `minSamples` — the floor the
finding was judged against — so only code that CONSTRUCTS one (a test double,
most likely) has to add the field. Reading it is unaffected. The field is there
because the explanation has to agree with the verdict: `svAnomalyLabel` says
"under N there is no baseline", and reading N from the module constant while the
verdict came from a host's 336 would have stated a number with nothing to do
with the decision it was explaining.

A `severe` below `notable` is refused rather than applied: every finding past
the notable line would also be past the severe one, so the middle band would
vanish while the legend still offered three. The two are clamped together and
the component says so once, in a dev warning. A threshold that is not a positive
finite number falls back to its default rather than being clamped near it.

### ⚠ Behaviour — `sv-form-error-summary` now speaks when its list changes (`N-3`)

**A summary that changes while the reader is elsewhere is announced.** The
component is still not a `role="alert"` — an alert would re-announce the whole
list over the top of the field the reader had just reached — but a server error
joining a list already on screen used to be known only to someone looking at
it. The new count is now announced politely through the kit's one announcer.
The announcement and the focus move are exclusive (focusing the region already
reads the heading and the count), a burst of async validators supersedes itself
under one key rather than queueing counts the user has already passed, and a
change that leaves the count alone says nothing. If your host already announced
the count itself, remove that: two voices for one event is the failure this
rule exists to prevent.

**`SvFormError.fieldId` is now optional**, which is additive — every existing
error object still compiles. Omit it for a problem that is not a field's ("your
card was declined", "your session expired"): the entry renders as text rather
than as a link, counts toward the heading, and never attempts a jump. If you
were inventing an id for those, drop it; the invented link reported "(could not
jump to this field)" and told the user the page was broken on top of the error
they already had.

**And a new `busy` input** marks the list as the last attempt's verdict while a
recheck is in flight: `aria-busy` on the region, a `busyMessage` note, and
every announcement HELD rather than skipped, so the reader hears the outcome of
the recheck instead of a count that was obsolete when it was spoken.

### ⚠ Behaviour — `sv-popout` and `sv-popover` focus, and a disabled popover that opened anyway (`OF-11-I2`, `OF-12-I9`)

**`sv-popout` no longer pulls focus back unconditionally.** It used to return
focus to its trigger on every close — including a close caused by the user
clicking a control somewhere else, one frame after they clicked it, so the page
took the click and then moved focus away from it. It now uses the same
contained-restore scope as `sv-popover`: focus goes back to the trigger when it
is still inside the panel or nowhere at all, and is left alone when the user has
placed it somewhere themselves. If you relied on the old behaviour, there is
nothing to change — the difference only shows up in the case that was wrong.

**And the panel now has a defined landing place.** The open path focused the
panel's first *element child*, whatever that happened to be, and `focus()` on a
non-focusable node is a silent no-op — so where focus ended up depended entirely
on your markup: the panel, the first button, or nowhere, with nothing to tell
you which. It now lands on the first focusable thing in the panel and falls back
to the panel itself (`tabindex="-1"`, `role="dialog"`). The panel is
deliberately **not** a focus trap: it does not make the page inert, so Tab can
leave it. Use `sv-drawer` or `sv-confirm-dialog` when the surface really is
modal.

**`sv-popover` now honours `[disabled]` on the host-driven path.**
`openPopover()` always refused while disabled, but a host writing
`[(open)]="true"` reaches no method of the component — so the panel opened, took
the overlay stack, captured focus and emitted `opened` while the component's own
API said it was disabled. It now refuses and writes `open` back to `false`, so
your binding matches what is on screen. Bind `[(open)]` two-way: a one-way
`[open]` goes stale the moment the popover closes itself, because nothing writes
the value back and Angular then has no change to push.

Both components also drop their local copies of the "what is focusable"
selector in favour of `svFocusableWithin` from `@styloviz/core` — the local one
missed `[contenteditable]`, `summary`, `iframe` and media with controls, so
`[autoFocus]` on a popover holding a rich-text field moved focus nowhere.

### Documented — the date picker's free/pro split, and why range is not a mode

No code changed here. Three things about `sv-date-picker` had shipped without
being written down anywhere, and each one costs a consumer an afternoon.

#### 1. The package is called `input-field`, and the directory names are inverted

There is no `@styloviz/date-picker`. Both pickers ship inside the input-field
packages, and **the source directory does not match the package it builds**:

| Tier | Package | Source directory | Component | Selector |
|---|---|---|---|---|
| Free | `@styloviz/input-field` | `projects/input-field-free/` | `SvDatePickerComponent` | `<sv-date-picker>` |
| Pro | `@styloviz-pro/input-field` | `projects/input-field/` | `SvDatePickerProComponent` | `<sv-date-picker-pro>` |
| Pro | `@styloviz-pro/input-field` | `projects/input-field/` | `SvDateRangePickerComponent` | `<sv-date-range-picker>` |

```ts
// free
import { SvDatePickerComponent } from '@styloviz/input-field';
// pro — note BOTH the package scope and the component name change
import { SvDatePickerProComponent } from '@styloviz-pro/input-field';
```

Upgrading free → Pro is **two edits, not one**: the import scope and the
selector. `<sv-date-picker>` does not become Pro by installing the Pro package.

`CalendarDay` is exported from **both** packages with an identical shape. They
are still two distinct types — import it from the same package as the component
you are using, and alias it if you import both.

#### 2. `sv-date-range-picker` is not `sv-date-picker` with a `range` input

They do not share a value contract, so this is not a tag swap:

```html
<!-- single: a two-way bound model, one ISO date string -->
<sv-date-picker-pro [(value)]="due" />

<!-- range: two separate two-way models, plus a change event -->
<sv-date-range-picker [(startDate)]="from" [(endDate)]="to" />
```

```ts
// single
readonly due = signal('2026-09-10');          // 'YYYY-MM-DD'

// range
readonly from = signal('2026-09-01');         // 'YYYY-MM-DD'
readonly to = signal('2026-09-10');
// or listen once for the completed pair:
// (rangeChange)="onRange($event)"  →  DateRangeChangeEvent { start; end }
```

The single picker is a `ControlValueAccessor` with `model<string>`, so
`[(value)]`, `formControlName` and `ngModel` all work. **The range picker is not
a `ControlValueAccessor`** — it exposes `[(startDate)]` / `[(endDate)]` models and
a `rangeChange` event, but no `formControlName` / `ngModel`. If you need a range
in a reactive form today, bind the two models (or `rangeChange`) to two controls
yourself.

#### 3. The value is a calendar date string, not a `Date`

Both components speak `'YYYY-MM-DD'`, never a `Date` object and never an ISO
instant. That is deliberate — a `Date` is a point in time and a due date is not,
so round-tripping one through a timezone is how a date lands a day early for
users west of UTC. `minDate` and `maxDate` take the same string form.

```ts
// ✅ correct
value = '2026-09-10';
// ❌ these do not work
value = new Date();
value = '2026-09-10T00:00:00Z';
```

The locale policy (track **T5** in `STYLOVIZ_FORMS_P0_P1_WORKING_TODO.md`) has
since landed: `locale`, `weekStart`, `timeZone` and a `dateDisabled` predicate on
both pickers (the range picker gained them on 2026-09-26). Non-Gregorian
calendars remain out of scope.

### Fixed — a bullet-chart value label ran off the edge of its own SVG

`sv-bullet-chart` reserves its gutters from a per-character estimate, because
real measurement needs `getComputedTextLength()` — which needs the text in the
DOM, which is one layout pass too late, and would make the geometry `computed()`
depend on the render it produces. The estimate is the right call. The **constant
in it was folklore**.

`LABEL_CHAR_W = 5.6` is documented, correctly, as the mean advance "for
mixed-case English". It was then used to size the gutter for `"340ms of 800ms"`
— which is digits, unit letters and one short word. Measured in the same face:

| | px/char |
|---|---|
| mixed-case prose | 6.48 |
| digits only | 7.65 (**+18 %**) |
| `"340ms of 800ms"` | 7.28 (**+12 %**) |

Short by roughly one character's width across the string — which is exactly the
**5.6px of overflow** observed. `VALUE_CHAR_W = 6.6` now sizes the value gutter
and fits the value text.

🔺 **The ellipsis fitter used the same constant**, so the estimate and the fitter
agreed with each other and both disagreed with the renderer. That is why the
label was never shortened — `fitLabel` was satisfied it fit. **Two things
deriving a number the same wrong way is not a cross-check.**

💡 **Chromium could not have found this.** Its shaping of the same string
happened to land inside the 12px padding. Nothing about the estimate was ever
right, only lucky — and a second engine is what turns luck back into a
measurement. This is the first defect `webkit-desktop` caught, on the run it
was added.

`scripts/probes/text-advance.mjs` (`npm run probe:text-advance`, `SV_BROWSER`
aware) measures the advances per engine so the numbers stop being folklore.
⚠️ It reports the **ratio** first on purpose: the charts name no `font-family`,
so the pixels are the host platform's UI face and must not be copied into a
constant.

---

### Added — WebKit joins the test suite (`X-12`)

`playwright.config.ts` gains a `webkit-desktop` project, `e2e:install` installs
it, and `npm run webkit:report` runs both engine probes plus all 252 specs under
WebKit and prints one summary.

★★ **The argument was never "three engines beat two".** `SvAutofillDirective`
— which every floating label in the Text Field family now depends on — is built
on `:-webkit-autofill` and on the claim that entering that state fires
`animationstart`. That claim was measured in Chromium and had **never been
measured in the engine the selector is named after**. It now holds in both.

🔺 **Two harness defects surfaced on the way, and both had been reporting
green.**

- **Half the suite was skipping itself.** `visual-matrix` and `chart-keyboard`
  skipped everything except `chromium-desktop`, with the reason "not
  viewport-dependent — one project is enough". That was true while the only
  other project was `chromium-mobile`: same engine, different size. Adding
  WebKit made it false, and the first run reported **108 passed, 144 skipped**
  under a green summary. **A different engine is not a different viewport.**
  `skipViewportDuplicate()` now names the duplicates rather than the survivors.
- **One chart-keyboard test opened a gallery its block was never on** —
  `?c=other-charts` for a chart whose `galleryId` is `datetime-chart`. It could
  not have passed in any engine. It failed as a 120-second timeout naming a
  selector, which is true and explains nothing, so `requireDemoBlock()` now
  bounds the wait and lists the blocks that *are* on the page.

---

### Fixed — the browser filled the field and told nobody (`FI-27-I2`)

Every floating label in the kit computed its position from
`isFocused() || !!value()`, and had no autofill handling at all.

★★ **Chrome's page-load autofill fires no `input` event.** It sets the
element's `value` directly and marks the control `:autofill`; the event arrives
on the user's first interaction, or never, if they submit without touching the
field. So `value()` stayed `''`, the label stayed in its resting position, and
it sat on top of the text the browser had just put there — on a sign-in form,
the single most common first impression the kit makes.

**`SvAutofillDirective`** in `@styloviz/core`. The fill is not observable as an
event, so it is observed as one: entering `:autofill` restarts any animation the
selector declares, and `animationstart` is a real event on the element at the
right moment. The keyframes it installs are empty — `from {} to {}` — a
notification channel wearing an animation's clothes. Nothing moves, so
`prefers-reduced-motion` has no claim on it.

Wired into **`sv-input-field` and its free twin**, and deliberately nowhere
else: the kit's other three floating labels sit on controls the browser does not
fill — select-dropdown's is on a custom trigger, search-bar's on a search field.

💡 **Two defects found by measuring rather than reasoning.** Both probes live in
`scripts/probes/` (`npm run probe:browser`) and are kept for exactly this
reason — they caught these in code that had already been written and reviewed:

- 🔺 **The first stylesheet overwrote `animation-name` on every text input in
  the host application.** It matched `input, textarea, select`, and
  `input:not(:-webkit-autofill)` at specificity (0,1,1) beats a consumer's own
  `.my-spinner` at (0,1,0) — so a kit that was supposed to fix a label was
  quietly cancelling animations on inputs it did not own. The rules are scoped
  to `[svAutofill]` now.
- 🔺 **A `matches(':autofill')` readback looked correct because jsdom lies.**
  jsdom answers `true` to `matches(':autofill')` for **every** input — a
  pseudo-class it parses but does not implement — so under test every text field
  in the kit reported itself autofilled. The line was also redundant: the
  stylesheet is installed by the directive's own constructor, and a CSS
  animation begins when its declaration begins to apply, so an already-filled
  element animates *after* the listener is attached. Confirmed in Chromium 141.

⚠️ **Limitation, measured and documented rather than discovered later.** On a
control that carries `svAutofill`, the kit's `animation-name` wins over a host's.
Animate a wrapper rather than the native control itself.

⚠️ **The last mile is manual and cannot be otherwise.** Real autofill needs a
saved browser profile and a user gesture; no automation API exposes it. The
four-step check is at the foot of `scripts/probes/autofill-mechanism.mjs`.

---

### Documented — server-error clearing asked for the wrong proof (`FI-27-I1`)

The backlog had this as "needs cross-browser proof", which it does not: the
clearing is `createFieldError`, Angular signals, with no engine-dependent
behaviour in it. What **is** engine-dependent is the step before — whether an
edit reaches Angular at all. A value that changes without firing `input` leaves
every signal stale, and an error anchored to the old value stays on screen
describing something the user has already fixed.

`scripts/probes/value-change-events.mjs` runs the seven ways a field's value can
change against a real Chromium. Two fire **nothing**, by specification, in every
engine:

- **A script assigning `.value`** — which is how some password-manager
  extensions fill a field. The browser's own autofill is covered, because it
  also sets `:autofill`; an extension that only assigns `.value` sets no such
  state and is genuinely undetectable. A host supporting one must dispatch
  `input` itself.
- **`form.reset()`.** A host resetting a form must clear its own signals; the
  controls will not tell it.

Everything a user can do with a keyboard or a pointer fires `input`. So the
expiry is engine-independent, and the one real gap was `FI-27-I2`.

---

### Fixed — a group is a fieldset, and some errors belong to it (`FI-06-M1`, `FI-11-M1`, `FI-11-M2`)

Three backlog items that turned out to be one component's problem.

**`sv-group` had no error surface at all.** A form could reject a group of
fields and have nowhere to say so, which is why "select at least one" kept
ending up hung on the first checkbox — the only place there was room for it.
That says the first option is invalid, which it is not, and leaves every other
option in the set describing itself with nothing.

It now takes **`errorMessage`**, rendered in a `role="alert"` slot, with
`aria-invalid` and `aria-describedby` on the `role="group"` container.

- 🔺 **The `description` was associated with nothing.** It rendered under the
  legend and no screen reader reaching the group ever heard it — there was no
  `aria-describedby` in the component. It is composed with the error now, via
  `svDescribedBy`, so neither displaces the other.
- 🔺 **The container is focusable while invalid** (`tabindex="-1"`, never `0`).
  Without it, `<sv-form-error-summary>` cannot keep its promise: an entry that
  claims to take you to the thing that is wrong reports `reachFailed` and moves
  nobody. The two features only work in combination, which is the combination
  they were both built for.

**There is deliberately no `serverError` on a group**, unlike every field
control in the kit. `createFieldError` expires a server rejection against the
value it was reported about; a group owns no value and cannot see its children
change, so the anchor could never move. A self-expiring error that never expires
is worse than not offering one.

**`errorCount` puts the tally on the collapsed header** (`FI-11-M1`) — and only
there. Expanded, every one of those errors is on screen beside the field it
belongs to, and a second count next to the legend is noise. The number alone is
not a sentence, so it carries an `sr-only` completion: "3 fields need
attention", "1 field needs attention".

**`expandOnError` (default on) refuses a collapse that would hide an error**
(`FI-11-M2`) — on the initial `collapsed` value as much as on a later one, so a
form re-rendering with server errors cannot open with them already hidden; and
a collapsed group **expands the moment an error appears inside it**.

⚠️ **`collapsed` is now honoured after init.** It was read once in `ngOnInit`
and ignored thereafter, so a bound `[collapsed]` did nothing past the first
render. A host binding a static value sees no change.

💡 **A collapse the *user* asked for is still honoured**, errors or not.
Refusing the chevron would give them a control that visibly does nothing when
clicked, and they collapsed the section on purpose — what they must not be is
uninformed about what they just hid, which is exactly what `M1`'s badge is for.
The two halves compose: `M2` stops the *application* hiding an error, `M1` tells
the user who hides one that it is there.

💡 **`collapsedChange` now always carries the group's real state**, including
when that is not the state that was asked for. A refused collapse emits `false`.
Silently ignoring the request is how an application ends up believing a section
is shut while the user is looking at it open.

💡 **`check:ui`'s `field-error-unreferenced` rule had to be widened** — the
second gate in two releases to argue for the worse implementation. It demanded
the literal string `fieldError` inside the `aria-invalid` binding, so it
reported `sv-group`, whose invalidity is broader than one message (a
legend-level check *or* any invalid child). It now checks for what it always
meant: an expression that reads state rather than a constant. Fire-tested
against a static `aria-invalid="true"` to confirm it still catches the defect.

---

### Fixed — the loading state on `sv-button` was presentational, and its announcement was dead code (`FI-02-I3`, `FI-02-M3`)

**`loading` cannot prevent the double-submit that matters.** The sequence that
creates a duplicate order is: click → `clicked` emits → the host's handler
starts a request and sets `loading` → **second click** → the host's signal write
has not been rendered yet → `isDisabled()` is still false → `clicked` emits
again. A user who double-clicks a submit button, or a trackpad that reports one
press as two, lands both clicks inside that frame.

**`preventDoubleSubmit`** (off by default) with **`doubleSubmitWindowMs`**
(400ms) closes exactly that gap and nothing more; `loading` still covers the
rest of the request. Off by default because the guard is wrong for a button
meant to be pressed repeatedly — a stepper's "+", "next slide", "add row". The
window runs from the click that was *accepted*, not from the last one thrown
away, so a burst cannot extend it indefinitely and a user who clicked, saw
nothing and clicked again is not ignored twice. The suppressed event is
`preventDefault`ed as well as unreported, because `type="submit"` submits the
form whether or not anyone listens to `clicked`.

- 🔺 **The busy announcement never fired in the case it was written for.** It
  was an `sr-only` span *inside* the control, rendered when the button was
  icon-only. An icon-only button must carry `ariaLabel`, `ariaLabel` is bound to
  `aria-label`, and `aria-label` replaces an element's contents outright when
  the accessible name is computed — so the span was never part of the name, and
  never announced. The only configuration where it worked was a button with no
  accessible name at all. There is now **one live region outside the control**,
  saying the same string the same way in every configuration, and announcing on
  the *transition* rather than only to someone who arrives afterwards. Turn it
  off with `announceLoading` where the page already says so.
- 🔺 **`loadingLabel` broke WCAG 2.5.3 (Label in Name).** It replaced the
  *visible* text with "Saving…" while the accessible name stayed "Save", so a
  speech-input user saying what they saw did not match the control. The name is
  computed from the displayed label now; an explicit `ariaLabel` still wins.

---

### Fixed — a rejected one-time code was left in the field (`FI-16-M3`)

A rejected OTP cannot be repaired, only replaced: either the user mistyped and
will re-read the whole thing from the message, or it expired and every digit is
wrong. Leaving it in place made retrying **harder than starting over** — each
cell takes one character, typing into a full one does nothing until it is
emptied, so the user had to backspace six times before they could begin.

`sv-otp-input` now clears the code on the **arrival** of a rejection, through
either error channel (`status="error"`, `errorMessage`, or `serverError`).

⚠️ **On by default.** Turn `clearOnError` off for a rejection that is *not about
the code* — "too many attempts, wait 30 seconds", or a network failure — where
throwing away a very likely correct code is the wrong move. The better fix is
usually to not report those through `status="error"` at all.

💡 **On the arrival, never on the presence.** `status` is a plain input the host
holds at `'error'` until it decides otherwise, so an effect keyed on the current
value would delete each digit as the user typed it — a field that cannot be
filled at all, which is the same trap one turn worse.

- 🔺 **Six cells going blank is silent.** Sighted users watch the code vanish; a
  screen-reader user hears the rejection and carries on believing they are still
  editing it. An `sr-only` line in the existing status region now says the code
  was cleared, alongside the message saying why.
- 🔺 **Focus is only recovered if the user was already in the field.** A
  rejection can land while they have tabbed away to "Resend"; pulling focus back
  into a field they deliberately left is worse than leaving it alone.
- 🔺 **`clear()` never told the form.** The public method emptied the cells and
  skipped `onChange`, so a reactive form's control kept the old code after the
  component had visibly discarded it — and a validator would pass on a value
  nobody could see.

---

### Fixed — "we found nothing" and "type to begin" were the same picture (`FI-20-I2`, `FI-20-M2`)

And the picture was no picture at all. `sv-search-bar` and its free twin opened
the panel only when it held at least one row, so a search that came back empty
**closed the dropdown**, stopped the spinner, and left the user staring at their
own query with no way to tell whether anything had happened.

Both now take **`emptyReason`** — bind `svSuggestController(...).emptyReason`
from `@styloviz/data`, which already distinguishes `'no-data'` from
`'no-results'` and holds `null` while a first load is in flight, so an "opening"
message cannot flash over a search in progress. The two states get different
copy, different icons and a different `data-sv-state`, and the no-results one
quotes the term back — which is also how someone notices the trailing space they
cannot see in the field. Copy overridable via `noDataLabel`, `noResultsLabel`
and `noResultsHint`.

Leaving `emptyReason` unbound keeps the previous behaviour exactly: an empty
`suggestions` array closes the panel and says nothing.

- 🔺 **The error surface added in `X-5` could never render.** A failed lookup
  usually returns no suggestions, and the panel holding `<sv-error-shell>` only
  opened when it had rows — so the error had nowhere to go and `(retry)` was
  unreachable in exactly the case it existed for. The existing async spec missed
  it because it always passed a populated `suggestions`. The panel now opens for
  rows, a failure, **or** an explanation of the emptiness.

💡 **The live region is in the component, not in the panel.** The panel is
portalled into `<body>` and torn down on close, and a live region inserted with
its text already in it is frequently not announced at all. The region is mounted
for the life of the control and only its contents change — which is also where
`FI-20-M4`'s result counts will go.

---

### Fixed — `aria-describedby` is a list, and the kit was treating it as one id (`FI-27-I3`, `FI-27-M1`)

The shape was everywhere:

```html
[attr.aria-describedby]="fieldError.showError() ? errorId() : null"
```

That is not "describe this field". It is "describe this field with the error
**instead of** the hint" — and the hint is usually what makes the error make
sense. Invisible to every gate that checks ids resolve, because both ids do
resolve; only one of them is ever named.

**`svDescribedBy({ hint, error, count, extra })`** in `@styloviz/core` composes
the list and owns the order — **hint → error → count**, matching GOV.UK. Each
call site choosing its own order is how a kit ends up with fields that read
differently for no reason a user could name. Pass the same condition the
template renders on, so an id can never name an element that is not there; the
result is `null` rather than `''`, because `aria-describedby=""` is a present
attribute naming nothing.

**Two real defects it found.**

- 🔺 **`sv-tag-input` and its free twin described themselves with nothing at
  all.** The hint, the validation message and the `n / max` counter rendered as
  bare `<p>` elements with no ids, and there was no `aria-describedby` anywhere
  in the component. A screen-reader user reaching the combobox was told neither
  the instruction nor the rejection, and learned a limit existed only by hitting
  it. **Absence is the one defect a reference check cannot see** — there was no
  wrong id to catch, because there was no id.
- 🔺 **`sv-file-upload` (both twins) dropped the hint.** Error-only binding, on
  a control whose hint carries the size limit and the accepted types — so the
  moment a file was rejected the user lost the one sentence saying which files
  are allowed.

**Adopted by eight more controls**, with no behaviour change beyond the shared
order: `sv-checkbox`, `sv-otp-input`, `sv-number-input`, `sv-toggle-switch`, and
`sv-input-field` (both twins, which had the same composer written out twice).

⚠️ **One ordering change.** `sv-number-input` put a host-supplied
`ariaDescribedby` **before** its own description; it now comes after. The
field's own hint and rejection are the primary description, and a host adding to
them is adding — the previous order was never chosen, it fell out of how the
array happened to be written.

💡 **`check:ui`'s `describedby-drops-a-description` rule had to be widened**, and
that is worth recording: it accepted `.join(' ')` as proof of composition, so it
reported every component that adopted the shared helper — which joins inside the
helper rather than at the call site. **A gate whose heuristic is "the correct
code looks like THIS" starts arguing for the worse implementation the moment a
better one arrives.** It now accepts `svDescribedBy(` too, and was fire-tested
against a reverted component to confirm it still catches the original defect.

---

### Added — `<sv-form-error-summary>`, the way into a field the form is hiding (`N-8`)

A long form fails validation and the user is told so beside each field. That is
fine right up until the invalid field is one they cannot see: an accordion group
they collapsed, a wizard step they have moved past, a control whose panel is
portalled to `<body>`. The form refuses to submit, **nothing visible on screen
looks wrong**, and there is no way to find out why. That is `FI-11-I1`, and it is
not a styling problem — the information genuinely is not reachable.

It is also a documented WCAG technique (G139, and the error-identification half
of 3.3.1), which makes it the cheapest of the eight proposed new components: it
consumes error state the host already has and owns none of its own.

**Three decisions worth knowing.**

- **It is a focusable region, not a `role="alert"`.** An alert interrupts, and
  this list changes on every submit — the reader would get the whole thing
  re-announced over the top of the field they had just reached. Focus arrives
  once instead (`autoFocus`, or `focusSummary()`), announcing the heading and
  the count, and the reader moves through at their own pace.
- **The entries are buttons, not `href="#field-id"`.** An anchor can only reach
  an element that is in the DOM, and the fields this exists for are exactly the
  ones that are not. Activating an entry emits `(errorActivated)` **first** —
  the host's chance to open the group or change the step — and focus is
  attempted on the next frame. A target that is not itself focusable (a
  `<fieldset>` holding a required radio group) falls through to the first
  control inside it.
- **It says when it could not get there.** An entry that silently does nothing
  is worse than no summary: the user has now been told where the problem is AND
  that they cannot go to it, with no way to tell a broken link from a field that
  is merely off-screen. `(reachFailed)` fires and the entry is marked, which is
  also the loudest possible signal that a `fieldId` is wrong.

Focus uses `preventScroll` and then centres the field deliberately — a plain
`focus()` scrolls to the nearest edge on its own, so scrolling again after it is
two scrolls and reads as the page fighting the user.

`@styloviz/forms`, free. 88 free / 164 total components.

---

### Added — one pending / revert / error contract for immediate-write controls (`X-6`)

Controls that write on interaction rather than on submit had no shared story for
a failed write. A toggle that silently flips back three seconds later is the
defining trust failure of a settings screen, and it happens for a structural
reason: the component has no vocabulary for "the write is out", and the host has
no handle to undo with.

**The contract already existed here too.** `createOptimisticEdit` and
`svRequestKey` have been in `@styloviz/core` since the data-display audit's
`X-7`, `check:optimistic-writes` has been deriving the surface from each
component's own API, and **eleven components already spoke it**. Toggle Switch
and Inplace Edit were the two that did not. As with `X-5`, this was adoption.

**`sv-toggle-switch`**

- `(toggleRequest)` — additive beside `(toggled)`, carrying
  `{ checked, requestKey, rollback }`. Both fire for one interaction, in that
  order, so a switch writing only to local state keeps working untouched.
- `pending` — the write lock, and **deliberately not `loading`**. They wear the
  same spinner and mean opposite things: `loading` says *we do not know what
  this switch is* (a settings screen that rendered before its settings arrived),
  so dimming it is honest; `pending` says *we know exactly what the user asked
  for, it is already drawn, and the server has not agreed yet*, so it spins
  without dimming — fading a value the user just chose reads as "this did not
  take". It is also the lock that makes `rollback()` unambiguous: with two
  writes outstanding there is no single previous state to return to.
- `error` — a failed write, typed `SvDataError | string | null`. **Not
  `serverError`:** that is the field-error contract and self-expires on the next
  value change — and a rollback *is* a value change, so a failure routed through
  it would clear in the same tick the switch moved back. `check:optimistic-writes`
  caught that before it shipped.
- `lockReason` — the third state a disabled switch cannot express. A disabled
  control says "not you, not now" and leaves the user guessing between "not on
  your plan", "your admin turned this off" and "this is broken" — three
  different next actions. The reason renders, `aria-describedby` points at it,
  and the switch stays in the tab order so the readers most likely to need it
  can reach it.

**`sv-inplace-edit`**

- `(saveRequest)` — additive beside `(save)`, carrying
  `{ value, previous, requestKey, rollback }`.
- `conflict` / `(conflictResolved)` — **two people editing one field is the
  normal case in any collaborative app**, and the two usual answers are both
  wrong: last-write-wins destroys someone's work and tells nobody, and refusing
  the save leaves the user holding text with nowhere to put it, so they paste it
  over the top anyway — having now lost the other version as well. Setting
  `conflict` shows both values with a button each and lets the person who is
  actually there decide. A 409 is not a failure to report; it is a question to
  ask.
- `lockReason` — the same name as the switch's, on purpose: a field the user may
  not edit says so *before* they type. Letting them type and failing on save
  costs them the edit as well as the answer.
- `error` widened to `SvDataError | string | null`, so a normalized
  `HttpErrorResponse` binds without unwrapping.

**⚠ Behaviour — `trigger` now defaults to `auto`.** The old default, `click`,
offered itself with a hover underline. Tailwind compiles `hover:` to
`@media (hover: hover)`, so **on a phone that affordance does not render
faintly — it does not render at all**, and the field is indistinguishable from
plain text. `auto` adds a pencil that appears on hover or focus on a
mouse-driven screen and is **always visible on a touch screen**. The pencil is
`aria-hidden` (the value button beside it already carries the name and offers
the same action). Pass `trigger="click"` to keep exactly the old rendering —
right for a dense table of many fields, but choose it deliberately.

`check:optimistic-writes` now reports **13 components** persisting a change, 11
of them handing back `rollback()`.

---

### Added — one async cancellation and stale-result contract (`X-5`)

Six picker families independently asked for the same thing: cancel the request
the user has typed past, discard the answer that arrives out of order, and say
so on screen. Built once.

**What already existed, and was not found.** `createRequestGuard` has been in
`@styloviz/core` since the wiring work, and `svDataController` in
`@styloviz/data` has done debounce + guard + `AbortController` + retry for every
table in the kit. The audit that filed these eleven items searched the *form*
packages, found no `AbortSignal` in any of them, and concluded the contract did
not exist. It existed; it was page-shaped, and no picker could use it.

**`SvRequestGuard` gained abort and a third state.**

- `start()` returns `{ token, signal, settle() }` — the token and its
  `AbortSignal` together, so the two cannot drift apart. It supersedes and
  **aborts** the previous request in one step. `begin()` is unchanged for
  transports that cannot be aborted.
- `stale` — true while a newer request is in flight **and** an earlier one has
  already been applied. This is the state a picker had no vocabulary for:
  `loading` is true both while the first results are fetched (nothing on screen
  — show a skeleton) and while a refinement of them is fetched (results on
  screen — keep them, mark them). A cancel does not feed it, because a cancel is
  not an answer.
- `svDataController` now exposes `stale` too, and its hand-rolled
  `AbortController` is gone — the guard owns it.

**`svSuggestController` — the term → options sibling.** `@styloviz/data` gained
the picker-shaped controller: `search()`, `flush()`, `reload()`, `cancel()`,
`clear()`, and `options` / `loading` / `stale` / `error` / `term` / `typing` /
`tooShort` / `emptyReason` out. It has **no retry policy on purpose**: a table's
user is waiting and has nothing else to do, so backoff is right there; a
picker's user has a keyboard, and their next keystroke is a better retry than
any timer.

**`SvStaleDirective` — one treatment, not six.** `[svStale]="stale()"` sets
`aria-busy="true"`, publishes `data-sv-state="stale"`, and dims to 60%. It
deliberately does **not** disable pointer events: the whole point of keeping the
previous results is that they stay usable, and a dimmed list nobody can click is
worse than a blanked one because it looks available.

**Adopted by eight components** — `sv-autocomplete`, `sv-search-bar` (both
twins), `sv-tag-input`, `sv-select-dropdown` (both twins), `sv-cascader` and
`sv-tree-select`, each with a `stale` input. `stale` is **free**, not Pro: a
race is a correctness bug, not a premium feature. The one Pro-only entry is
`sv-tag-input`'s, for the same reason its `loading`, `error` and `asyncOptions`
are — the free tag input has no remote-options surface at all, so there is no
request for a newer one to supersede.

**Still open in `X-5`:** the async *features* three of those items also ask for
— `sv-tree-select` lazy children (`FI-05-M1`), `sv-cascader` async children
beyond the existing `loadData` (`FI-03-M3`), `sv-select-dropdown` server search
(`FI-23-M3`), and `sv-form-builder` async validation (`FI-04-M3`). Those are
builds, not adoptions, and they now have a contract to build against.

---

### ⚠ Breaking — three AI components no longer fake their work by default

**What changed.** `simulate` now defaults to **`false`** on
`<sv-ai-insight-cards>`, `<sv-ai-writing-assistant>` and
`<sv-rag-knowledge-base>`. It used to default to `true`.

**Why.** With the old default, dropping any of the three into a page produced a
component that looked live and was not. `sv-ai-insight-cards` re-ran a timer and
dealt bundled insights; `sv-ai-writing-assistant` replaced the user's prose with
a hard-coded sample; `sv-rag-knowledge-base` ramped an uploaded file's progress
bar to "ready" while no index had been touched. Each of those needs a deliberate
opt-in, not an opt-out: production behaviour must not depend on an integrator
remembering to turn a demo switch off, and the failure mode was a shipped app
that appeared to work.

**Migrating.** Grep for the three selectors. If a usage is a demo or a
storybook-style page and you *want* the canned behaviour, say so explicitly:

```html
<sv-ai-writing-assistant [simulate]="true" />
```

If it is real, there is nothing to change in the template — but check you are
handling the outputs, because the component now does nothing on its own:

| Component | Wire this | And render the result via |
| --- | --- | --- |
| `sv-ai-insight-cards` | `refreshRequested` | `insights` + `loading` |
| `sv-ai-writing-assistant` | `actionRun`, `toneChange` | `text` (two-way) + `busy` |
| `sv-rag-knowledge-base` | `sourceAdded` | `sources` |

A `simulate` left on in a development build now logs one warning per component
naming itself and stating that nothing left the component. The warning is
stripped from production bundles.

### ⚠ Breaking — `AgentApprovalResult` gained a `risk` field

`decided` now reports the risk class the decision was **made under**, which is
not always the class that was requested — see the section immediately below.
Reading the payload is unaffected; only code that *constructs* an
`AgentApprovalResult` (a test double, most likely) has to add the field.

### Security — `sv-agent-approval` classified the request, not the call

The whole point of the component is that the operator can correct the arguments
before approving. Risk was read straight off `request.risk`, fixed at the moment
the agent asked — so everything risk drives described the call as *requested*
while the operator approved a different one.

The concrete path: a request arrives as `delete_rows(table: 'staging_events')`,
classified low. It renders a green "Low risk" chip, offers **always allow this
tool**, and approves on a single press. The reviewer edits `table` to `users` —
which the component invites them to do — and presses once. A production table is
dropped by a control that was styled, worded and gated for a staging one. The
same path turns a `$412` refund into a `$25,000` one with no second press and no
warning, and "always allow" could be ticked on the way through.

Risk is now classified from the arguments as they stand, via a new
`riskFor: AgentApprovalRiskFn` input — `(request, args) => AgentApprovalRisk`.
Only the host knows which values are destructive, so nothing is inferred here;
without `riskFor` the old static behaviour is unchanged, which is why the input
is the fix rather than a heuristic. When an edit moves the class:

- the chip, border and copy follow it;
- **always-allow is withdrawn** if the call is now above medium, and a ticked box
  no longer upgrades the decision;
- a high or critical call **arms** and needs the second press;
- `riskReclassified` fires with `from`, `to` and the arguments that did it;
- `decided.risk` reports the class approved under, for the audit record.

Editing an argument also **drops any arm already granted**, at every class: the
"this cannot be undone" notice the operator read described the previous
arguments, so the second press has to be earned again.

**If any argument you mark `editable` can change what the call destroys, pass
`riskFor`.** Nothing else in the API changed.

### Added — twenty-one page templates, eighteen of them in this release

The kit now ships **21 page templates** as independently copy-pasteable folders,
zipped alongside the packages: 18 Pro, 3 Free. Eighteen of them landed after
0.3.0 and had gone unrecorded here, because this file tracks packages and the
templates are tracked in `STYLOVIZ_TEMPLATE_ROADMAP.md`. They are shipped
artifacts, so they belong in both.

A template is not a screenshot. Each one is a folder you can copy out whole —
config, mock data, a store, routes, pages, and its own specs — with **no
cross-template imports**, so taking one does not drag in the other twenty.
Every one runs against `provideZonelessChangeDetection()`, renders loading,
error and empty states through the shared `sv-skeleton-shell` /
`sv-error-shell` / `sv-empty-shell`, and derives its state rather than storing
it.

- **admin** · **ai-ops** — the SaaS admin panel the kit opened with, and a dark-first console for AI/LLM products.
- **crud** · **mail** · **files** · **calendar** · **chat** — the workhorse app surfaces.
- **auth** · **errors** · **account** — the three Free templates: the pre-session screens, the status pages, and account settings.
- **store** · **launch** · **portfolio** · **dev** · **docs-site** — the public-facing column: storefront, marketing site, studio site, personal site, documentation site.
- **estate** · **helpdesk** · **projects** · **pos** · **hrms** · **lms** *(new)* — the verticals: property portal, support desk, project workspace, till, people ops, course platform.

### Added — the `lms` template: a course platform that stores no percentage

Six pages at `/templates/lms` — catalogue, learn, lesson player, assessments,
gradebook, instructor studio — over one store owned by the layout, split across
the two people who use a course platform. Catalogue and assessments serve their
own `:id` detail route through `withComponentInputBinding()`. The studio is not a
second data model; it reads the same derivations the learner reads, from the
other end.

**No progress percentage is stored anywhere** — not on the enrolment, not on the
lesson, not on the course:

- **Coverage is the merged union of the second-ranges actually watched.**
  Scrubbing to the end credits nothing, and rewatching the opening credits it
  once. A stored percentage is what lets a progress bar exceed its own track, and
  what somebody sets to 100 to unstick a support ticket — after which nobody can
  tell who watched what.
- **A lesson completes by its own kind's rule**, not one shared threshold:
  coverage for a video, a pass for a quiz, a hand-in for an assignment,
  attendance for a live session. So "watch it all" cannot complete a lesson that
  is a room you have to turn up to, and the learn page can say *the next thing is
  on Thursday* instead of offering a play button that would be a lie.
- **The watch ledger is the one mutation in the kit that does not roll back.**
  Elsewhere, restoring what was there is the honest thing to do; here it would
  delete minutes somebody genuinely watched because a request timed out, and then
  ask them to watch them again. The ledger stands, the lesson stays dirty, the
  debounced flush retries, and the banner says progress is *not syncing* rather
  than pretending it is.
- **An unmarked paper is an em dash, never a zero.** The weighted average is
  taken over the assessments actually marked. A zero for work a human has not
  read yet is a grade the learner did not earn and the instructor did not give,
  and it is the number that makes a mid-term gradebook useless. The **floor and
  the ceiling sit beside the average** — one says what happens if you stop here,
  the other whether carrying on can still change the outcome, and no single
  number says both.
- **A mark freezes at submission; a regrade sits beside it.** Answers are marked
  once, against the key as it stood — never on render, and never again later
  against a key that may since have been corrected, which is how a grade changes
  without anybody deciding it should. A correction is a record with an author and
  a reason, pointing at the mark it supersedes. A short-answer question scores
  nothing at submission and stays ungraded, because awarding it zero has the same
  shape as marking it wrong and the learner cannot tell which happened.
- **Late work is a window with a stated price, not a red date.** The penalty is
  in basis points, the cost of submitting now is said before the button is
  pressed, and once the window has shut the refusal names the address to email —
  the work is saved, it just needs a person. One function backs both the button's
  disabled state and the store's pre-patch check.
- **The studio prices a curriculum change against the people already enrolled
  before it will save**: how many learners it un-completes, how many certificates
  it makes stale. Reordering a module is free to type and not free to do.
  Prerequisite cycles are **returned, not thrown**, because a page that throws on
  load because of a cycle is a page nobody can use to fix it.
- **A drop is recorded, never deleted.** Deleting the row leaves a certificate
  earned before the learner left pointing at a course they were never on.

**160 specs** — 112 on the domain layer and 48 on the store and the six pages.
The domain suite proves each rule computes the right answer; the store suite
proves the store **asks those rules before it writes** and the pages **put the
answer on screen**. A store that patches first and validates in the component has
a green domain suite and a corrupt gradebook, and neither `tsc` nor a screenshot
can see the difference.

Two fixture defects surfaced building it, both the same species — a feature that
is correct, tested and unreachable by clicking. **The studio's marking queue was
empty**, because every attempt on the viewer's own courses was already graded: the
headline count was zero, every tab badge was absent, and the mark form could not
be opened at all. And **a seated enrolment cannot be dropped** in the demo, since
the window is 14 days and every seat was taken months ago; that one is stated
rather than papered over, and the specs drive both branches through a waitlist
place, which can be left at any time because a queue is not a commitment.

### Added — the `hrms` template: people ops without a status column

Six pages at `/templates/hrms` — employee directory, org chart, leave requests,
attendance, payroll run, onboarding checklist — over one store owned by the
layout. Directory and leave serve their own `:id` detail route through
`withComponentInputBinding()`, so the detail view cannot render a record the
list would have drawn differently.

**Nothing in it carries a status field.** Every state is derived, because a
status column is a second copy of the truth and the second copy is the one that
goes stale:

- **Employment comes from hire and end dates**, so *serving notice* is its own
  state rather than a person who is somehow both current and former — which is
  exactly the group a manager is about to have to replace.
- **The org chart is resolved from manager edges on every render** into roots,
  orphans and cycles, so it can say *three people are missing* instead of
  dropping them off the bottom. An edit that would create a reporting loop is
  checked against the **proposed** graph before the save, and the refusal names
  the loop.
- **Leave is integer half-days** — the money-in-cents rule applied to time, so no
  `0.5` exists anywhere in the arithmetic — counted across **working days only**,
  and the balance is never stored. A **pending request is shown but not
  deducted**: deducting it makes the balance read as though a decision has
  already gone against you.
- **Approval authority is derived from the reporting graph, never granted**, and
  never over your own request whatever your title. Requests you cannot decide
  **stay in the queue** with a refusal naming the manager who can — filtering
  them out turns "ask Devin" into an empty screen. One function backs both the
  button's disabled state and the store's pre-patch check, so the form cannot
  encourage something the store will reject.
- **Attendance is an append-only punch ledger**, and a day nobody clocked out of
  **counts zero and says so** rather than being given an invented end time. That
  is what keeps a forgotten clock-out visible as an anomaly instead of becoming a
  field somebody quietly fills in on Friday.
- **A posted payroll run freezes its payslips; a draft recomputes.** So the open
  draft reflects a salary changed this morning, and last March still prints what
  people were actually paid — after that salary changed and after they left.
  There is **no edit control on a posted run**: a mistake is corrected by a signed
  adjustment on the next one, because editing the closed run reaches the right
  total and destroys the evidence the first payment was wrong.
- **Onboarding leads on "day-1 ready", not a percentage.** A hire at 6 of 8 may
  have signed everything and still have no laptop on Monday, and a progress bar
  cannot say which two are missing. A blocked step names its blocker by label,
  and a tick is a record with an author and a timestamp, so there is no untick.

**199 specs**, run at five different clocks — the first of a month, the last day
of February, a Sunday, a holiday that is also today — because a fixture built
relative to "now" proves nothing about the other 364 days.

Two defects surfaced building it, both a rule that was right in one direction
and wrong in the other. The approval refusal blocked a **rejection** on the
grounds the request would overdraw the balance — backwards, since rejecting it
is how the overdraw is avoided. And all four hand-written pages had a pulse
skeleton and **no whole-page error branch at all**, so a failed load would have
drawn an approval queue reading "Nothing is waiting on a decision" when the
truth was that nothing had arrived. That is the worst class of error state,
because it is indistinguishable from good news. `check:ui` caught it;
`check:contrast` then caught the blocked checkbox at 1.94:1, on the grounds that
a disabled control still has to be seen to be understood as disabled.

## [0.4.0] — 2026-08-23

A correctness release. Nothing here is a new feature: it is what a fortnight of
writing specs for components that had none turned up. Every component in the kit
now has one — 201 of 201 — and the suite is **4,339 tests across 212 files**.

Six of the fixes below were found by a gate written for a *different* bug. Three
were found only because a spec was written and watched to fail. One was found by
generating a real `.xlsx` and opening it.

Since then it has also absorbed the **kit-wide icon sweep**, which is the one
part of this release that needs work on your side. Read the next section before
you upgrade.

### ⚠ Breaking — every glyph now comes from the icon library

**What changed.** The kit used to accept, and internally carry, raw SVG path
data: `iconPath="M12 4.5v15…"`. 471 glyphs were drawn that way across 63
packages, hand-copied and quietly drifting. Every one is now a **name** resolved
against `@styloviz/icons` (or `@styloviz-pro/icons`), and every public input that
took a `d` string has been renamed or removed.

**Why it is worth the migration.** A `d` string is one `<path>`, and several
glyphs in the set are not one path — `video` is a body plus a lens wedge,
`settings` a gear plus a circle, `plus` two lines, every `chevron-*` a polyline —
so flattening them into a single `d` silently dropped geometry. Not theoretical:
this release fixes a call-type icon that had been shipping **half a video
camera**, a "clap" reaction that drew a **bell**, two opposite menu actions that
shipped the **same glyph**, 61 tree nodes with **no icon at all**, and a
breadcrumb demo whose custom separator silently fell back to the default. A name
cannot lose half a glyph.

---

#### ★★★ Read this first — the failure mode is SILENT

Angular reports an unknown **property binding** and says nothing at all about an
unknown **static attribute**. So this still compiles, and draws nothing:

```html
<!-- fine in 0.3.x — now renders no icon, with no error anywhere -->
<sv-button label="Save" iconPath="M12 4.5v15m7.5-7.5h-15" />
```

while the bound form fails loudly, as it should:

```html
<sv-button label="Save" [iconPath]="savePath" />
<!--                     ^ NG8002: Can't bind to 'iconPath' -->
```

**Grep your templates before you upgrade** — the compiler will not do it for you:

```bash
grep -rnE '(icon|Icon)(Path|ViewBox)=' src/
```

A second, quieter case: a number of members **kept their name and changed
meaning**, because they were already called `icon`. `sv-badge`'s `icon`,
`TabItem.icon`, `SuggestedPrompt.icon`, `ToolbarAction.icon`, `StatCardItem`'s
`icon`, `SegmentedControlOption.icon`, `AutocompleteOption.icon`,
`DividerItem`'s `icon` and the `FILE_ICONS` map all held a `d` string and now
hold a name. **Nothing errors — the icon simply disappears.** One pass catches
every remaining case, renamed or not:

```bash
# any 'M…' path data still being handed to a Styloviz input
grep -rnE '(icon|Icon)[a-zA-Z]*\s*=\s*"M[0-9]' src/
```

---

#### Renamed inputs and interface fields

Each right-hand column takes an icon-library **name** (`'star'`, `'trash'`,
`'chevron-right'`). The full set is browsable at `/icons`.

| Package | Was | Now |
|---|---|---|
| `@styloviz/button` | `iconPath`, `trailingIconPath` | `icon`, `trailingIcon` |
| `@styloviz/input-field` (+ Pro) | `leadingIconPath`, `trailingIconPath` | `leadingIcon`, `trailingIcon` |
| `@styloviz/toggle-switch` | `onIconPath`, `offIconPath` | `onIcon`, `offIcon` |
| `@styloviz/accordion` (+ Pro) | `customIconPath`, `customIconOpenPath`, `AccordionItem.iconPath` | `customIcon`, `customIconOpen`, `AccordionItem.icon` |
| `@styloviz/alert-banner` | `iconPath` | `icon` |
| `@styloviz/empty-state` | `iconPath`, `EmptyStateAction.iconPath` | `customIcon`, `EmptyStateAction.icon` |
| `@styloviz/stat-card` (+ Pro) | `iconPath` | `icon` |
| `@styloviz/breadcrumb` | `BreadcrumbItem.iconPath`, `customSeparatorPath`, `separatorPath` | `.icon`, `customSeparatorIcon`, `separatorIcon` |
| `@styloviz/timeline` (+ Pro) | `TimelineItem.iconPath` | `TimelineItem.icon` |
| `@styloviz/select-dropdown` (+ Pro) | `SelectOption.iconPath` | `SelectOption.icon` |
| `@styloviz/list-view` (+ Pro) | `ListViewItem` / `QuickAction` / `BulkAction` `.iconPath` | `.icon` |
| `@styloviz/data-table` (+ Pro) | `TableRowAction` / `BulkAction` `.iconPath` | `.icon` |
| `@styloviz/search-bar` (+ Pro) | `SearchSuggestion.iconPath` | `SearchSuggestion.icon` |
| `@styloviz/tree-view` (+ Pro) | `fileIconPath` | `fileIconName` |
| `@styloviz/layout` | `FooterSocial.iconPath` (a *fallback*, now removed), `FooterPayment.iconPath` | `FooterSocial.iconName` (now the only way), `FooterPayment.icon` |
| `@styloviz-pro/split-button` | `iconPath` | `icon` |
| `@styloviz-pro/overlays` (`sv-result`) | `iconPath` | `icon` |
| `@styloviz-pro/command-palette` | `getIconPath()` | `getIconName()` |
| `@styloviz-pro/ai-token-dashboard` | `trendArrow()` | `trendIcon()` |

`COMMAND_ICONS`, `TYPE_ICONS`, `FILE_ICONS` and the other exported icon maps keep
their **keys** and now hold **names** as their values.

#### Removed

- **`iconViewBox`** — on `sv-button`, `sv-alert-banner`, `sv-empty-state` and
  `sv-stat-card`. It existed only to say whether a raw path was drawn on a 20-box
  or a 24-box grid; a library name is always 24-box, so the escape hatch has
  nothing left to escape. **Delete the binding — there is no replacement.**
  (`iconTemplate` / `trailingIconTemplate` are untouched. *That* is the escape
  hatch, and it is for third-party icon components.)
- **`stateIconPath`** on `sv-input-field` and its Pro twin — replaced by
  `stateIconName`, which the free twin already published. `error` and `warning`
  deliberately resolve to the same `alert-triangle`: the two raw paths they
  replaced were the same triangle with the exclamation mark one unit apart, so
  they always drew the same shape. Colour is what tells them apart.
- **`SUGGESTION_ICONS`** and **`getSuggestionIconPath()`** on `sv-search-bar`, and
  **`sv-stepper`'s `icon()` method** — in both cases dead code sitting beside a
  name map the template had never been switched to.
- **`RadioOption.icon`** on `sv-radio-group`, and **`ListViewItem.icon`** on
  `sv-list-view` and its free twin — **declared, documented, and drawn by
  nothing.** Both were `iconPath` before the sweep and were already unrendered
  then; renaming them kept a dead field alive one release longer. No template
  ever read either one and no consumer in this repo set them, so a host passing
  a value saw nothing and got no error. **Delete the property — there is no
  replacement.** If you want an icon per radio option or per list row, say so:
  it is a design decision the kit has not made, and shipping the field without
  the rendering was what made it look like one it had.

  `ListViewQuickAction.icon` and `ListViewBulkAction.icon` are **unaffected** —
  those are rendered, and are the `.icon` fields the table above refers to.

#### Migration footer

```
BREAKING CHANGE: every public input that took raw SVG path data now takes an
icon-library name. `iconPath` → `icon` and `trailingIconPath` → `trailingIcon`
on @styloviz/button; the same rename on @styloviz-pro/split-button,
@styloviz/alert-banner, @styloviz/stat-card, @styloviz-pro/overlays (sv-result)
and fourteen other packages listed in the table above. `iconViewBox`,
`stateIconPath`, `SUGGESTION_ICONS`, `getSuggestionIconPath()`,
`RadioOption.icon` and `ListViewItem.icon` are removed with no replacement.
Members already named `icon` kept their name and changed meaning from a `d`
string to a name — these fail silently. Migrate by replacing path data with the
glyph name from /icons; grep for `(icon|Icon)[a-zA-Z]*\s*=\s*"M[0-9]` to find
every remaining site.
```

#### New peer dependency

**`@styloviz/core` now requires `@styloviz/icons`.** This is the first time the
base package has depended on another workspace library, and it is not optional:
`<sv-field-error>` — the one-line validation slot rendered by **17 form
controls** — drew its alert circle by hand, which made it the most-rendered
hand-drawn glyph in the product.

There is no dependency cycle (`@styloviz/icons` peers only on Angular). If you
install with a package manager that does not auto-install peers, add it:

```bash
npm i @styloviz/icons
```

`@styloviz/toggle-switch` and `@styloviz/tree-view` gained the same peer, for the
same reason. `@styloviz/all` and `@styloviz-pro/all` already carry it.

#### Glyphs moved from Pro to free

Nineteen glyphs moved into the free set so free components could draw their own
defaults: `clipboard-list`, `video`, `music`, `align-justify`, `equal`,
`file-archive`, `file-audio`, `file-spreadsheet`, `file-video`, `files`,
`printer`, `truck`, `landmark`, `graduation-cap`, `inbox`, `arrow-down-left`,
`arrow-up-right`, `undo`, `minimize`.

`undo` came across for `sv-signature-pad` and `minimize` for `sv-modal`'s new
restore button. A free component cannot draw a Pro glyph — a signature pad with
no undo is one where a slipped stroke means signing again from nothing, and a
maximize button with no restore only goes one way. Their existing Pro consumers
(the Gantt chart, the rich-text editor, the AI writing assistant) draw through
`<sv-icon-pro>` and are unaffected, because the Pro renderer resolves pro ∪ free.

**The free and Pro sets are disjoint**, so each is now exported from
`@styloviz/icons` as `Sv<Name>Icon` and **no longer** from `@styloviz-pro/icons`
as `Sv<Name>ProIcon`. Only a direct per-icon component import is affected —
`<sv-icon-pro name="truck">` keeps working, because the Pro renderer resolves
pro ∪ free.

Totals: **free 170 · Pro 503 · 673 in the catalogue.**

#### Behaviour corrected while converting the glyphs

Three things the sweep surfaced and deliberately did **not** change silently.
They are changed now, and each is visible to a user.

- **`sv-list-view` drew every call backwards.** In `call-history` mode
  `incoming` rendered an **up** arrow and `outgoing` a **down** arrow — the
  opposite of iOS Phone, the Android dialer, WhatsApp, Skype and Teams, all of
  which draw an incoming call coming down-and-in. They are now
  `arrow-down-left` and `arrow-up-right`, the call-log idiom. **A host reading
  direction off the glyph was reading every row wrong.**
  - `missed` is its own branch instead of the default, so an item with **no
    `callType`** no longer draws a red cross and claims a missed call that never
    happened; it gets a neutral handset.
  - The direction is now announced. The glyph is decorative and the colour says
    nothing, so a call-history row previously told a screen-reader user — and
    anyone who cannot tell green from red — nothing at all about the call.
    `callTypeLabel()` is public if you want the same string elsewhere.

- **Seven admin-template buttons wore a glyph that contradicted their label** —
  a **Filter** button with an academic cap, four **Save …** buttons with a
  `bookmark` (a different action the kit also ships), **Create Task** with the
  `check` that means *Mark Complete* two buttons away, and **Permissions** with
  a tick rather than a shield. Two showcase buttons whose accessible name is
  **Delete** drew a dismiss cross. A new `check:ui` rule, `label-icon-drift`,
  now fails the build when one action label wears two different glyphs.

- **The storefront footer advertised its payment methods as grey uppercase
  words.** `FooterPayment.icon` had existed as long as the footer had, every
  consumer left it unset, and the pill's text fallback made the omission look
  deliberate — while `@styloviz/icons` shipped all 45 card and wallet brands.
  The store, the showcase and the playground now pass real marks, and a mark
  carries an `sr-only` label so replacing the text does not lose the name.

### Added — the Theme Builder is now a real theming tool

`/theme-builder` used to edit three things — primary, accent, radius — preview
them on a row of five controls, and export two files. It was honest and it was
ordinary. It could not touch the colour that paints most of the kit, could not
touch the family the page templates run on, showed palettes in a context where
every palette looks fine, and said nothing about whether the result was legible.

**Every token family `src/styles.css` declares is now editable**, plus two that
were not offered before: the neutral ramp (`--color-gray-*` + `--color-white`,
the trick `.tpl-ai-ops` already used by hand) and `--font-sans`. That is
`primary` · `accent` · `warning` · `danger` · `brand` · `brandaccent` ·
neutrals · typeface · radius scale · shell dimensions — up to 56 tokens against
the previous 18. Each control says, from generated data, how much of the kit it
actually paints (`primary`: 2,731 utilities across 185 files; `brandaccent`:
22). `scripts/generate-token-usage.mjs` produces those counts and
`check:generated` fails when they drift, because a number typed into a string
rots in the flattering direction.

**Ramps are generated in OKLCH, not HSL.** HSL lightness is not perceptual — at
L = 0.5 a yellow is blinding and a blue is nearly black — so the old fixed-delta
ramp came out washed for one hue and muddy for the next. Fed Tailwind's own
`blue-500`, the new generator reproduces Tailwind's own blue ramp to within
ΔL 0.015 and ΔC 0.03; that comparison is a test, and it is the only kind of test
that can tell a correct ramp from a plausible one. Out-of-gamut colours are
mapped by chroma bisection rather than channel clipping, so lightness and hue
survive. Step 500 is returned byte-identical to what you typed.

**The preview is a whole dashboard, in light and dark at once** — shell,
sidebar, topbar, KPI row, chart, table, form controls, banner — because what
goes wrong when you rebrand is *relationships*, and a row of buttons has none.
⚠️ The old preview's "Light" button silently did nothing whenever the site
itself was in dark mode: it set `.dark` to force dark and removed it to force
light, but the ancestor `<html class="dark">` still matched. The light pane now
carries `.sv-force-light`, the opt-out `src/styles.css` declares for exactly
this.

**The neutral ramp is a real control, not a label.** Its four generated options
first shipped at chroma 0.008–0.009 and changed nothing you could see — because
Tailwind's stock `gray` is *already* cool-tinted at chroma 0.027–0.034, so
"Cool" at 0.008 made the interface **less** blue than the default it replaced,
and six of the ten pairs of options sat below the just-noticeable threshold (two
of them at ΔE 0.007). The values are now calibrated against the two ramps this
repo can check itself against — the Tailwind family each option resembles
(`slate`, `neutral`, `stone`) and `.tpl-ai-ops`, the kit's own hand-made warm
ramp — and every option's real eleven-step ramp is drawn inside its own button,
so you judge it before you pick it. A test fails the build if any two options
come within a just-noticeable difference of each other; "Brand-tinted" is
exempted only against a blue primary, where landing on Cool is the definition of
the option rather than a defect.

**A live WCAG audit** covers 18 colour pairs the kit actually renders — named
components, not an abstract palette score — with the ratio, the AA/AAA grade,
and the exact step that would fix each failure. **Auto-fix** applies every fix
it can in one undo step. The generated neutral ramps put `gray-500` at OKLCH
lightness 0.535 rather than Tailwind's 0.554, which takes `text-gray-500` on
`bg-gray-100` from **4.39:1 to 4.66:1** — the pair `check:contrast` and axe both
measured below AA. Keep the stock ramp and you keep Tailwind's number, and the
panel says so.

⚠️ **The audit reports real failures in the kit's own default palette**, and
they are not the builder's doing: `sv-stepper` renders `text-white` on
`bg-accent-500` / `bg-warning-500` / `bg-danger-500` (2.2:1, 2.1:1 and 3.7:1),
and `sv-accordion` renders `text-accent-600` on `bg-accent-50` (3.0:1). Those
are shipped components failing AA today. They are recorded here rather than
changed, because moving a component's fill from 500 to 600 is a behaviour change
that deserves its own entry.

**Apply across the site** paints the theme over every page of the showcase —
components, docs, and all three page templates — so a buyer can click through
the whole kit in their own brand before paying. It survives navigation and
reload, and a banner at the app root turns it off from anywhere, because a
feature that repaints everything and can only be undone from the page that
started it is a trap. The injected CSS is validated against a tiny accept-list
grammar on the way *out* of `localStorage` as well as in.

**Also:** nine curated presets, three of which restate palettes the repo already
ships; accent suggestions derived from your primary by OKLCH hue rotation;
undo/redo with ⌘Z, coalesced per control so a colour drag is one step; a
shareable URL and a restorable draft; import from a pasted `@theme` block, a
`.tpl-*` scope or design-token JSON; and five exports — CSS `@theme`, a scoped
block, a Tailwind v3 config, W3C design-token JSON, and SCSS — plus all five as
one `.zip`. Every format is generated from the same `resolveThemeTokens` call
the preview uses, and a test asserts the CSS export contains exactly that token
set, so what you see cannot drift from what you get.

Density stays preview-only and still says so: this kit has no global density
token, and inventing one would be the easy lie.

### ⚠ Breaking — nothing else

Two components gained behaviour they should always have had (see the first two
entries under **Fixed**); beyond the icon sweep and the two sections above, no
import, selector or input changed. Ten `sv-rich-text-editor` toolbar controls
changed BEHAVIOUR — see the section immediately below — but nothing was removed
or renamed.

### ⚠ Behaviour — ten `sv-rich-text-editor` toolbar controls

Ten controls were reported as broken or half-working, and every one reproduced.
Six of the fixes change what a control *does*, not just whether it works, so
they are listed here rather than under **Fixed**. No import, selector or input
was removed; the additions are `exportFailed` (output) and `svSafeLinkUrl`.

| Control | Was | Is |
| --- | --- | --- |
| **Paragraph format** | Picking the already-ticked entry reverted the block to Normal | Single-select, like every other editor's block-format menu. **Normal** is the way back, and it was always in the menu — the old justification for the toggle ("no way back to Normal") was simply wrong. The menus are `role="menuitemradio"` + `aria-checked` now, so the check mark means something to a screen reader |
| **Blockquote** | Retagged the block, so `<h2>Heading</h2>` became `<blockquote>Heading</blockquote>` — the heading was destroyed. One-way: a second press did nothing | Wraps, so the heading survives. A second press unquotes. A multi-paragraph selection makes one quote, not one quoted paragraph |
| **Insert code block** | `setBlockFormat('pre')`, so a two-paragraph selection made two separate `<pre>`s | One `<pre><code>` for the whole selection — the shape `svHtmlToMarkdown`/`svMarkdownToHtml` already round-trip. **Enter now writes a newline instead of escaping the block, and Tab indents instead of moving focus out of the editor**; Shift+Tab outdents, Shift/Ctrl+Enter leaves |
| **Ordered / Unordered list** | With a collapsed caret, converting one item of a `<ul>` to `<ol>` lifted that item out and inserted the new list *above* the old one | Retags the whole list, which is what Word, Google Docs and TinyMCE do. Selecting a run of items still converts just that run, splitting the list around it |
| **Insert link** | Always opened blank | Pre-fills from the link under the caret and **edits it**, rather than nesting `<a>` inside `<a>` |
| **Print** | A popup window | A hidden same-document iframe — nothing for a popup blocker to block |

### Security — the link dialog wrote its `href` unchecked

`javascript:alert(1)` typed into the URL field was stored verbatim as
`<a href="javascript:alert(1)">`. This component's value is read back out of
`innerHTML` for the host to persist, so any host that stored it and rendered it
to another reader had **stored XSS whose injection point was a text field
labelled "URL"** — the same class as the clipboard path closed in 0.4.0's paste
work, and reached far more directly.

The check is `svIsSafeUrl`, the same allow-list already guarding every pasted
`href` in the package, rather than a second copy that would drift. It resolves
through `new URL`, which is what catches ` javascript:`, `JaVaScRiPt:` and a
scheme split by an embedded tab — all of which navigate, because the HTML
parser strips those characters before anything resolves the URL.

The new exported `svSafeLinkUrl` is that check plus the normalisation a link
field needs: `example.com` used to be stored exactly as typed — a **relative**
path, so the link resolved against the host's own domain and 404'd. It is now
`https://example.com`. Anchors, `/paths`, `mailto:` and `tel:` pass through.

### Fixed — the exported document did not match the one on screen

Reported as list bullets and numbers being misaligned in exports. The export
carries **its own stylesheet**, separate from the editor's, because an export
renders into a fresh document — an off-screen iframe, or a `.doc` that Word
opens — with none of the app's Tailwind, none of the component's CSS and no
reset of its own. It had drifted, and the shapes added to the editor in this
release (`<pre><code>`, a `<blockquote>` that wraps blocks, nested lists,
`<h5>`/`<h6>`) were never added to it.

Every number below is a measurement from a real run: this stylesheet rendered
in headless Chromium and put through the actual html2canvas and jsPDF calls the
component makes, not an estimate.

- **The list indent was 63% too deep, and that is what "misaligned" was.** The
  rule was `margin: 0 0 12px 24px` and said nothing about padding, so the user
  agent's own `padding-inline-start: 40px` survived underneath it: list text
  landed **104px** from the page edge where the stylesheet intended 64px. The
  indent is carried on padding now, with the left margin at 0 — setting both is
  what doubled it.
- **A nested ordered list repeated its parent's numbering.** `1. 2. 3.` inside
  `1. 2. 3.`, with no way to tell the levels apart. The nesting sequence now
  matches the editor: `disc → circle → square` and `decimal → lower-alpha →
  lower-roman`.
- **A long line of code was cut off.** `<pre>` was `overflow: auto` with
  `white-space: pre` — a scroll container, which has no meaning in a bitmap, a
  PDF or a Word document. Measured: **72px of a line was clipped off the right
  edge and simply absent from the file.** It wraps now.
- **`list-style-type` was never stated**, and it is an inherited property.
  Browsers filled the gap from their defaults; Word substitutes its own list
  formatting when the HTML does not insist.
- **A quote that wraps a paragraph grew a blank line at each end** — the
  children's outer margins were not collapsed, so the border rule was visibly
  taller than the text beside it.
- **`<pre><code>` had no rule**, so the inner element carried an inline
  `<code>`'s treatment inside the block; **`<h5>` and `<h6>` had none either**,
  so choosing them from the format menu exported text the size of a paragraph.
- **`.doc` now says it is a Word document.** Without `ProgId`/`Originator` a
  `.doc` blob can open in the browser rather than in Word, which reads as a
  failed export; and without an explicit charset on the way in, Word renders the
  curly quotes and em dashes a rich text editor produces as mojibake.
- **The printed and exported document can be given a name.** New
  `documentTitle` input. It becomes the export's `<title>`, which is what a
  browser offers as the default filename in its print dialog — otherwise every
  document in the product is a PDF called "Document Export".

**One hypothesis that measuring disproved.** html2canvas is widely held to be
unable to paint an `outside` list marker, since it sits at a negative offset
from the item's content box; the standard workaround is
`list-style-position: inside`. Rendered both ways through real html2canvas,
`outside` came out complete and correctly spaced and **`inside` was visibly
worse** — a wide gap between marker and text, and a wrapped line indenting under
the marker instead of under the text. The workaround was for a defect this
version does not have, and it was removed again rather than kept "just in case".
`table-layout: fixed` went the same way: added here to stop a wide table
overflowing, it forced every column to equal width and squeezed the one prose
column in a three-column table. Both negatives are now pinned by tests.

**Structural.** The stylesheet and the document builder moved out of the
component into `rich-text-editor.export.ts` and are exported as `svExportStyles`
/ `svBuildExportDocument`, so a host that post-processes a `.doc` or builds its
own export starts from the same sheet rather than a second copy that drifts —
and so all three consumers can be rendered and asserted against directly. The
`.doc`, PDF and print paths now share one stylesheet, which is the only way
"Export to Image" and Print can be relied on to agree.

### Fixed — `sv-rich-text-editor` content had never been styled at all

Reported as "the DOM changes but nothing changes visually" for Unordered list
and Insert link. The cause is not a specificity fight with the host page. **Not
one of the editor's content style rules had ever matched an element**, in either
stylesheet, since the component was written.

**The component's own stylesheet.** Every content rule was written as
`:host .rte-content ul`, and Angular's emulated encapsulation compiles that to

```
[_nghost-abc] .rte-content[_ngcontent-abc] ul[_ngcontent-abc]
```

The editor's content is not in the component's template — it is built with
`document.createElement` and by assigning `innerHTML` — so those nodes never
carry `_ngcontent-abc` and the selector matched nothing. They are
`:host ::ng-deep .rte-content :where(…)` now, which compiles to
`[_nghost-abc] .rte-content :where(…)`: still bounded to the component's own
host element, so nothing leaks into the page, but no longer requiring an
attribute the content cannot have.

**The app's global stylesheet.** `src/styles.css` carried ~130 lines that
diagnosed this correctly — *"content is injected via innerHTML, so it does not
receive Angular's emulated component scope attributes"* — and then selected
**`app-rich-text-editor`**, an element that does not exist. The component's
selector is `sv-rich-text-editor`; a repo-wide search finds
`app-rich-text-editor` in that file and nowhere else. That block has been
removed, and the `<pre>` treatment it defined — a gradient, a border, a shadow
and styled scrollbars, none of which had ever rendered — now lives in the
component, so it ships to buyers of the package too.

**Why only two controls looked broken.** The browser's own defaults cover for
most of it: a `<blockquote>` is still indented and a `<pre>` is still monospace
with no help from a stylesheet. The two shapes with nothing useful left are
exactly the two that were reported — Tailwind's Preflight resets
`ul, ol { list-style: none; margin: 0; padding: 0 }` and
`a { color: inherit; text-decoration: inherit }`, so a list rendered with no
bullet and no indent, and a link rendered as plain black text, while the markup
underneath was completely correct.

**Hardening, since a host page will have opinions.** `list-style-type` and
`list-style-position` are inherited properties, so a host that sets
`list-style: none` on any wrapper would otherwise reach in; both are now stated
on the list itself. `display: list-item` is stated on `<li>` for the same
reason — any other `display` value removes the marker outright. Angular emits
component styles unlayered, so these also outrank anything in Tailwind's
`@layer base` regardless of specificity. Nested lists get their own markers
(`disc` → `circle` → `square`, `decimal` → `lower-alpha` → `lower-roman`), which
matters now that the editor promotes real sublists.

To restyle editor content from an application, name an ancestor so the rule
outweighs the component's own `(0,2,0)`:

```css
.my-theme sv-rich-text-editor .rte-content ul { … }
```

**And a guard.** `rich-text-editor.styles.spec.ts` asserts that every selector
reaching *into* `.rte-content` carries `::ng-deep`, that every `::ng-deep` rule
is still anchored to `:host`, and that the specific declarations Preflight
removes are stated explicitly. It was fire-tested both ways: reintroducing the
original `:host .rte-content :where(ul)` fails it, and it asserts up front that
it found rules to check at all — a detector that matched nothing would have made
every assertion in it vacuously true, which is the exact failure mode this whole
entry is about.

### Fixed — `sv-rich-text-editor`, the rest of the toolbar report

**Lists and block formatting — one bug copied five times**

- **A formatting command reordered the document.** Taking a line out of a list
  used `list.before(replacement)`, which is only correct for the *first* item:
  applying Heading 2 to the middle line of `one / two / three` put it above the
  whole list, and the document came back reading `two / one / three`. The same
  line had been copied into `replaceBlockElement`, `applyBlockFormatToBlocks`,
  `toggleList`, `toggleListForBlocks` and `resetBlocksForClearFormat` — five
  times, because there was no shared helper to be right in once. There is now,
  and a split `<ol>` recomputes its `start` so the numbering keeps counting.
- **The list buttons did nothing at all on an empty editor** — the single most
  likely first action on a fresh document. There was no block for the target
  search to find, so the command fell out of every branch and returned.
  `setBlockFormat` had guarded against this since the beginning; the list, code
  block and quote buttons never did. All four share one entry point now, which
  also opens the undo history — so those commands are reachable by Undo.
- **Adjacent lists were never merged.** Bulleting the paragraph between two
  bulleted lists produced *three* lists: three bullet runs, and an `<ol>` in
  that shape restarts its numbering at 1.
- **Unwrapping an item with a sublist produced `<p><ul>…</ul></p>`**, which no
  parser accepts — it closes the `<p>` before the `<ul>`, so the document that
  came back out of `innerHTML` was not the one that was written. The sublist is
  promoted to a sibling now.
- **Toggling a top-level list rebuilt the editor's entire `innerHTML`** from
  `outerHTML`, replacing every other node in the document on every click:
  O(document) work for a one-line change, and any caret, selection or element
  reference elsewhere was destroyed. The `<li>`s are moved now, so the caret
  survives the conversion.
- **"Preformat" welded the lines together.** `<pre>` was filled from
  `textContent`, which drops `<br>`, so `line one<br>line two` became
  `line oneline two` — in the one block type whose meaning *is* its line
  structure. Both directions keep the breaks now.
- **The format dropdown reported a format the caret was not in.** `LI` is a
  block with no entry in the format map, and a bare `<td>` resolves to no block
  at all, so moving the caret from a heading into a list item or a table cell
  left the control still reading "Heading 1". Both read "Normal", which is true.

**Line height**

- **It did nothing at all inside a table cell** — and that is the ordinary case,
  not an edge one, because `insertTable` emits bare `<td>`s with no block inside
  them. `TD` is deliberately not a block tag (the block commands must never
  retag a cell), so the target search walked past the cell to the editor and
  found nothing. The control then relabelled itself "1.50": it reported a
  spacing it had not applied.
- **A collapsed caret inside a quote set the spacing on the quote**, not on the
  paragraph being typed in. Only a real multi-block selection resolves
  top-level blocks now.

**Links**

- **`insertLink` had no `canEdit()` guard** — the only formatting entry point in
  the component without one. The dialog could be opened and committed on a
  `readonly` or `disabled` editor and it rewrote the document. Same class as the
  colour swatches fixed earlier in this release.
- **Insert was enabled on an untouched dialog.** The guard was `!linkUrl()`, and
  the field opens pre-filled with `https://`, which is truthy — so the button
  looked live and ran a handler that refused. It now tracks whether the address
  can actually be stored, and shows why when it cannot.
- **Unlink threw the caret to the start of the paragraph**, so the next thing
  typed landed in the wrong place. What was the link is selected instead.
- **Unlink and Insert link each fired `emitChange` twice**, pushing two identical
  history entries — so Undo had to be pressed twice to reverse one click.
  Cancelling the dialog also emitted, marking a bound `FormControl` dirty and
  potentially tripping a host's autosave for a dialog the user had dismissed.
- Unlink is disabled away from a link, rather than silently doing nothing.

**Print and export**

- **`window.open('', '_blank')!`** — a non-null assertion on the one call in the
  file that returns `null` as a matter of routine. Every popup blocker in its
  default configuration returns `null` for a `window.open` that is not a direct
  navigation, so Print threw a `TypeError` for anybody who had not allowed
  popups for the site.
- **The printed page had no stylesheet whatsoever.** It wrote the raw
  `innerHTML` into a bare `<body>`: no table borders, no code styling, no image
  sizing, no quote rule. The export stylesheet now serves both, with print rules
  for page margins, orphans and widows, avoiding a break inside a code block or
  a table row, and writing out link targets — which are invisible on paper.
- **`win.print(); win.close();`** destroyed the window out from under the print
  job. `print()` does not block until the dialog is dismissed in Firefox or
  Safari, so the user got a blank sheet, or no dialog at all. Teardown waits for
  `afterprint`, with a timeout for Safari, which never fires it from an iframe.
- **Print read the rich `innerHTML` directly**, so printing from source view or
  Markdown mode printed a different document from the one on screen.
- **Export to Image rendered into a frame one pixel tall.** html2canvas renders
  against the target's own window, so a 960×1 viewport put everything past the
  first pixel row below the fold: the PNG came back holding the first line of
  the document over white space, or nothing at all.
- **Every export failure went only to `console.error`** — which is exactly what
  a successful export with a suppressed download looks like. Failures are now
  reported in the status bar and through a new `exportFailed` output, and an
  empty document says so rather than doing nothing.

### Fixed

**Forms**

- **`sv-date-picker-pro` was not a `ControlValueAccessor`.** The free twin has
  been one all along, so `[formControl]` and `[(ngModel)]` worked on
  `sv-date-picker` and did **nothing** on the paid one — no error, no warning,
  just a control that never received a value and never reported one. It now
  implements the interface, and `[disabled]` on the input and a disabled parent
  `FormControl` are finally the same fact.
- **`sv-input-field` (free and Pro) now uses the shared field-error contract**
  instead of a ninth hand-written copy of the same anchor-and-expire logic.
  Behaviour is unchanged and pinned; there is now one implementation to keep
  correct rather than nine.

**Excel export**

- **Dates reached Excel as text.** `svToXlsx` wrote a `date`-formatted cell as
  an inline string carrying a `yyyy-mm-dd` number format, so it *displayed* as a
  date and behaved as a label: it would not sort chronologically, would not
  filter by range, and could not be subtracted from another date. Dates are now
  real Excel serials — including the 1900 leap-year bug Excel inherited from
  Lotus 1-2-3, so 1900-01-01 is serial 1 and the 29th of February 1900 is never
  emitted. `svExcelValue` converts an unambiguous ISO date for the same reason,
  and deliberately refuses to guess `15/03/2026`.

**Layout and state**

- **`sv-items-with-more` threw away the reader's expansion whenever it was
  hidden.** Its inline variant measures whether the sentence fits; a
  `display:none` tab panel reports width 0 for both the text and the container,
  `0 <= 0` read as "it all fits", and "it all fits" also means "the container
  grew, so collapse the expansion". Switch to another tab and back, and
  "Show less" had silently become "+3 more". A measurement of an unlaid-out box
  now yields no conclusion at all.
- **`sv-avatar-pro.onClick` is back.** The Pro component had renamed it to
  `onActivate`, which made the free→Pro upgrade a breaking change for anyone
  calling it. Both names work; `onClick` is the one the free component
  established.

**Inputs that did nothing**

Six published, documented inputs were read by no code. Setting them changed
nothing and nothing said so.

- `sv-tree-view` (free) `showLines` — declared, defaulted to `true`, and drew no
  line, because indentation was a `padding-left` with nothing to hang one on.
- `sv-cascader` `expandTrigger="hover"` — a host that asked for hover got click.
  Hover now opens branches without selecting the leaves a pointer merely
  crosses, and without firing a lazy load for a branch it grazed.
- `sv-rich-text-editor` `autoFocus` — now focuses once the editor's loading
  state clears, not before, and never when disabled or read-only.
- `sv-sentiment-analysis-widget` `busy` — a re-analysis over results already on
  screen. The widget dims, marks the region `aria-busy` and announces once,
  rather than blanking.
- `sv-color-picker` `triggerAriaLabel`, and the `aria-labelledby` /
  `aria-label` conflict below.

**Accessibility**

- **`aria-labelledby` silently outranked `aria-label` on three pickers.** The
  date, time and colour pickers carried both on the trigger, with the
  `aria-labelledby` target inside an `@if` that had not rendered — so the
  reference dangled AND still won, leaving the control with no accessible name
  at all while the code read as though it had two.
- **`aria-describedby` named one description where there were several** in
  `sv-toggle-switch`, `sv-input-mask` and `sv-input-field`. The attribute takes a
  list; whatever was not in it was announced never.
- **`sv-rich-text-editor`'s colour pickers ignored `disabled` and `readonly`.**
  Twelve formatting entry points checked; these two did not, and the swatches
  carry no `disabled` attribute — so the palette rewrote a document nobody was
  allowed to edit.
- Eight portalled panels could not hear their own Escape key, 40 element ids
  were built from data rather than per-instance (SVG `url(#…)` included, which
  is document-global and first-match-wins), and every roving tabindex now clamps
  at the edge of its window instead of walking onto a disabled button.
- `sv-drawer`, `sv-popover`, `sv-confirm-dialog` and `sv-dropdown-menu` now take
  their glyphs from the icon library rather than hand-written `<svg>`.

### Fixed — the mail template rendered a mailbox with no loading or error state

`MailStore` already carried `loading`, `error` and `reload()`; the inbox page
never used them. A buyer wiring the template to a real backend got a blank white
pane while the first request was in flight, and **the same blank pane** when it
failed. The demo never sets either signal, which is why it survived — it is
invisible until the day it is not. The list now renders `sv-error-shell` with a
retry, `sv-skeleton-shell` while loading and `sv-empty-shell` when there is
nothing, ordered error → loading → rows so a failed reload is not hidden behind a
skeleton that will never finish.

Two contrast pairs went with it: the `/` keyboard hint at 2.49 against a 3.0
threshold, and the message-count badge at 4.39 against 4.5.

### Added — `<sv-form-builder>`, a schema-driven form that prunes what it hides

`@styloviz-pro/forms` gains `SvFormBuilderComponent` and the engine behind it,
exported separately because the same questions have to be answered on a server:
`svVisibleFields`, `svPruneHidden`, `svSchemaErrors`, `svSchemaProblems`,
`svSchemaDefaults`, `svCoerce`, `svIsAnswered`, `svFieldErrors`,
`svEvaluateCondition`, `svConditionCycles`, `svFlattenSchema`, `svValueAt`,
`svFieldPath`, `svSetAt`, `svMergeValue`.

**A schema form has four silent failure modes and this exists for them.**

- **A hidden field's value is still submitted.** Tick "I have a company", type
  the name, untick. The section leaves the screen, the value stays in the form,
  and it is submitted, stored and shown back later on a record the user believes
  says the opposite. Nothing errors and nothing is red; the screen and the
  payload simply disagree. The component keeps the working value and prunes at
  the edge, so `value()` and `payload()` are deliberately different objects —
  ticking the box back restores the typing, and none of it can leave. A group
  left with nothing visible is **dropped**, not sent as `{}`.
- **A required field in a hidden branch blocks the form forever.** Submit
  disabled, every visible field green, and the thing stopping the user not
  rendered at all. A field that is not shown is not asked, so it cannot be
  unanswered. And a field inside a hidden group is hidden *whatever its own
  condition says* — evaluating each `showIf` independently, which a `filter()`
  invites, is what makes a "hidden" section come back one field at a time.
- **`required` implemented as `!value`.** It rejects `0`, a perfectly good number
  of seats, and `false`, a perfectly good answer to a yes/no select. Emptiness is
  `null`, `undefined` and blank — with one deliberate exception: on a **checkbox**
  "required" means *must be ticked*, because unticked is already an answer.
- **The schema's own mistakes never surface.** It comes from a database or a CMS,
  so its author has no compiler and often no console. `svSchemaProblems` reports
  duplicate keys, conditions naming fields that no longer exist, selects with no
  options, empty conditions, and **visibility cycles** — which do not crash, they
  pick a winner by evaluation order, so both fields stay hidden forever while the
  schema reads perfectly sensibly. They are rendered, not logged.

Two smaller ones with the same shape: patterns are **anchored** (`^(?:…)$`, so an
alternation is grouped rather than half-anchored) and rebuilt per call, because an
unanchored `\d{4}` accepts `not-a-year-1999` and a cached `RegExp` with a `g` flag
carries `lastIndex` between fields. And the submit button is **never disabled** —
a disabled submit refuses silently, and pressing it is what reveals the
objections.

`svSetAt` copies every object along the path, not just the root: sharing a nested
group with the previous value makes a `computed()` read the old object, find the
new field inside it, and agree with itself — validation that runs one keystroke
behind.

**Not included: repeatable rows.** The `array` kind was written and then removed.
A row's paths live in the *value* and the prune walks the *schema*, so a hidden
field inside a row would not be pruned — reintroducing, inside every row, the
exact defect the module exists to prevent. Better absent than half-implemented.

### Added — `@styloviz-pro/image-editor`, a cropper that says what it will produce

`<sv-image-cropper>` plus the geometry it is built on: `svDefaultCrop`,
`svClampCrop`, `svMoveCrop`, `svResizeCrop`, `svCropToSource`, `svOutputPlan`,
`svOrientedSize`, `svOrientationTransform`, `svNeedsOrienting`, `svDescribeSize`,
`SV_MAX_CANVAS_DIMENSION`, `SV_MAX_CANVAS_PIXELS`.

**An image cropper fails by producing a picture rather than an error**, which is
why this one reports the *plan* rather than the selection. Four of those failures
are the reason the package exists:

- **A canvas past the browser's ceiling is not an error.** Over ~16 384 px on a
  side, or ~16.8 M pixels, the canvas is silently allocated blank: `toBlob`
  succeeds, the callback fires, and the user receives a fully **transparent
  image**. `svOutputPlan` reduces the output to fit and puts the reduction in
  `plan().warnings`, on screen, before the user commits.
- **`quality` does nothing for PNG**, and every cropper takes the argument
  anyway. A host that sets `quality: 0.6` to keep an upload small gets a lossless
  PNG at full size and no indication why. `qualityApplies` says so.
- **The crop box is held in *display* coordinates and converted in exactly one
  place.** Storing it in one space and using it in the other is the defect that
  crops the top-left corner of a photo and calls it the middle; `naturalWidth` is
  not the size the user is dragging over.
- **A drag's delta is measured from where the drag started, not from the last
  move event.** Accumulating per-move deltas re-applies the clamp every frame, so
  a drag that touches an edge and comes back never returns — the box "sticks".

It is also operable without a pointer: the crop box takes focus and reports its
size, each handle is a real `<button>`, arrows nudge by a pixel and Shift by ten,
Escape resets. `preventDefault` is called **last and only on a key that was
handled**, so Tab and Escape are not swallowed.

EXIF orientation is an input, not a guess. The tag lives in the file's bytes and
an `<img>` does not expose it; a component that pretended to read it would be
lying. A host that decoded the file already has it.

### Added — inline crop in `sv-file-upload-pro`

`cropImages`, `cropType`, a `cropQueue()` signal, `applyCrop()`, `skipCrop()`,
`skipAllCrops()`, and `cropRequested` / `cropApplied` outputs. The file helpers
— `svIsCroppableImage`, `svCropOutputType`, `svCropOutputName`,
`svCropReplacement`, `svCropWarnings`, `svCropSizeRatio` — are exported for hosts
with their own crop UI.

**`file-upload` does not depend on `image-editor`, and will not.** A host that
wants inline crop composes the two; a host that does not should not ship a canvas
cropper it never renders. The seam between them is a `Blob`.

- **A file waiting to be cropped is a distinct status, not a flag.** `uploadAll()`
  sends everything `pending`, so modelling the wait as a pending file with a
  boolean beside it means the submit button uploads the un-cropped original while
  the crop dialog is still open — the single defect an inline cropper exists to
  prevent. As a status, every existing gate that asks "is this ready to send?"
  answers no without being taught about cropping. `retryFile()` and
  `uploadAll()` both refuse to release a held file.
- **The blob's own type wins over the type that was requested.** `canvas.toBlob`
  is specified to fall back to `image/png` when it cannot write the type it was
  handed, and does so silently, with no error and no flag. Naming the result from
  the request is how `photo.webp` ends up full of PNG bytes — invisible on the
  client, because browsers sniff content, and broken later on a server or CDN
  that sets `Content-Type` from the extension.
- **The cropped result is re-validated, because a crop can make a file bigger.**
  PNG is lossless, so re-encoding a JPEG's compression artefacts stores them
  perfectly; a 2 MB photo can come back at 14 MB. Validating only at intake
  uploads a file past the limit the component advertises — after the user cropped
  pixels *away*. `cropType` therefore defaults to `'auto'`, which keeps the
  family it was given rather than picking either fixed answer, both of which are
  wrong: always-PNG inflates photos, always-JPEG composites transparency onto
  solid **black** (not white — that is what the HTML spec requires).
- **HEIC, TIFF, SVG and ICO are never offered a cropper.** An `<img>` pointed at
  an HEIC outside Safari never fires `load`, so the cropper sits blank forever
  with no error to react to — worse than not offering the crop. An SVG rasterises
  at whatever size the browser guessed, and one carrying an external reference
  *taints* the canvas so `toBlob` throws at the very end. All of them upload
  untouched. `image/jpg` **is** accepted: not a registered MIME type, but Windows
  emits it, and a photo should not be skipped over a spelling.
- **The stale thumbnail is cleared synchronously, and a late read cannot
  resurrect it.** Cropping starts a second `FileReader` while the first is still
  in flight; whichever `onload` landed last used to win, so a row could settle on
  the thumbnail of the *un-cropped* picture, non-deterministically, in the exact
  place the user looks to confirm the crop. Found by a test precondition, not by
  a hunch.

`svCropWarnings` reports what the round trip cost: lost GIF frames, transparency
flattened to black, a double JPEG re-encode, and a result larger than the
original.

### ⚠ Behaviour — `UploadFileStatus` gained a fifth member

`'cropping'` joins `'pending' | 'uploading' | 'success' | 'error'`. Nothing
changes unless `cropImages` is on — no file reaches the new state otherwise — but
an exhaustive `switch` over `UploadFileStatus` in host code will stop compiling
until it handles the new member, which is the point of it being a union.

### Added — chunked and resumable uploads in `sv-file-upload-pro`

`svChunkedUploader` builds an `SvUploader` — resumability is a property of the
transport, and the component's contract is deliberately transport-agnostic, so
this is a factory rather than a change to the component. `svPlanChunks`,
`svResumePlan`, `svIsRetryableStatus`, `svRetryDelay`, `svChunkProgress` and
`svUploadKey` are exported for hosts with their own transport.

**What makes this worth a module is that every way of getting it wrong produces
a green tick.** None of these raises an error anywhere in the client:

- **A zero-byte file planned as zero chunks uploads without a single request.**
  `Math.ceil(0 / n)` is 0, so the loop never runs, every chunk "succeeds"
  vacuously and the upload resolves — with the server never having heard of the
  file. Empty files are ordinary: a `.gitkeep`, a truncated log, a failed export.
- **A server offset that lands mid-chunk, resumed from that exact byte,
  duplicates or skips.** The server has bytes from a request it never
  acknowledged, and whether its own bookkeeping counts them decides which. The
  whole chunk is discarded and re-sent, and `discardedPartial` says so.
- **A resume keyed on the file NAME splices two documents together.** Two
  different `report.pdf`s is the common case. `svUploadKey` is
  `size + lastModified + name` — a hint, not an authority, so the server must
  still verify a length on completion.
- **Parallel chunks to an append-only endpoint store a shuffle of the file.**
  `concurrency` therefore defaults to **1**: the safe default rather than the
  fast one. Raise it only when the endpoint takes an explicit range or part
  number.

`413 Payload Too Large` is deliberately **not** retryable — the chunk is over the
body limit, so five attempts upload five over-sized bodies in full to fail
identically every time. `501` is excluded from the 5xx sweep for the same reason:
"not implemented" does not become implemented by waiting. `0` — no response at
all — is retryable, and is the reason resumable uploads exist.

Backoff is **full jitter**, not "exponential plus a nudge". When two hundred
clients get a 503 in the same second, plain exponential retries all two hundred
at the same instants, so the retry logic is what keeps the server down.

### Added — paste-to-upload and folder upload in `sv-file-upload-pro`

`pasteToUpload` (`off` · `zone` · `page`), `directory`, `maxScannedFiles` and an
`intakeSkipped` output. `UploadFile` gains `path`, the file's location inside the
folder it came from. `svExpandDrop`, `svReadDirectory`, `svNamePastedFiles`,
`svFilterIntake` and `svMatchesAccept` are exported.

**`readEntries` returns at most 100 entries per call and says nothing about it.**
The contract is to keep calling on the same reader until it hands back an empty
array; Chrome returns them a hundred at a time. Code that calls it once — which
the callback shape invites, because one call looks like it returns "the entries"
— silently drops everything past the hundredth file in any directory. No error,
no warning, the upload completes. A user drops 250 photos, watches 100 upload,
and has no way to know the rest were never considered. This is the defect in most
folder-upload implementations on the web.

`webkitGetAsEntry()` is called **before the first `await`**, because
`DataTransfer` items are only valid during the drop event's synchronous
dispatch. Awaiting inside the loop reads `null` for every entry after the first,
so dropping one folder works and dropping two loses the second — which is why
that bug survives manual testing.

**Every pasted screenshot is called `image.png`.** Paste three into a form and
the server receives three identical names: the last wins and two are lost, or all
three are stored indistinguishably, or a uniqueness constraint rejects the second
and the user is told their upload failed for no visible reason. Pasted files are
renamed from the clock and their ordinal, with the extension derived from the
MIME type because there is no name to take it from.

Paste is **off by default**. A document-level paste listener is what makes "just
paste a screenshot" work and is also how an upload zone steals a paste meant for
the comment box beside it — so `page` ignores any paste aimed at an input,
textarea or contenteditable, and `zone` requires focus to be inside the dropzone.
A paste carrying only text is never touched and never `preventDefault`-ed.

`.DS_Store`, `Thumbs.db`, `desktop.ini`, `__MACOSX/` forks and `._` resource
files are dropped and counted. A folder from a Mac carries `.DS_Store` in every
subdirectory; a photo library of forty folders would otherwise queue a fifth of
itself as metadata the user cannot see in their own file manager.

#### Fixed — a dropped folder was queued as a broken zero-byte file

`dataTransfer.files` contains an entry for a dropped **directory**: a `File` with
size 0, no type and the folder's name. The drop handler read it straight, so the
folder appeared in the queue at 0 bytes, uploaded, and produced a corrupt object
on the server. There is no reading of `dataTransfer.files` that gets this right —
the entry API is the only way to tell a folder from a file at all — so folder
drops are now expanded whether or not `directory` is set.

#### Fixed — `accept` matched a double extension

The extension check compared with the wrong operator under one of the mutations
fired at it, and the fixtures did not distinguish: `invoice.pdf.exe` passed an
`accept=".pdf"` filter. It reads as a PDF to a human scanning a list and runs as
an executable, and it is the oldest filename trick there is. Now anchored to the
end of the name, with a test that says so.

### Added — Markdown mode in `sv-rich-text-editor`, which says what it lost

`toggleMarkdownMode()`, `markdown()`, `setMarkdown()`, `markdownNotice()` and a
`markdownChanged` output. `svHtmlToMarkdown`, `svMarkdownToHtml`,
`svEscapeMarkdown`, `svEscapeLineStarts` and `svMarkdownLossLabel` are exported.

**The round trip is lossy, and this is the part every implementation gets wrong
by staying quiet about it.** A rich text editor can express red 18px Georgia,
centred, underlined, in a cell spanning three columns. Markdown can express none
of it. The usual behaviour is: switch to Markdown, switch back, and the
formatting is simply gone — no warning, no record, and undo is the only way back,
which nobody reaches for because nothing appeared to fail.

So `svHtmlToMarkdown` returns `{ markdown, lost }` rather than a string. A bare
string would have made the lossy path the easy one, and a signature is the only
place an API can force a caller to notice. `lost` names each dropped property
with a count — text colour, highlight, font size, font, line height, alignment,
underline, super/subscript, merged cells, nested tables, header-less tables,
multi-paragraph quotations, hard line breaks and rejected link addresses.

The notice is computed **on the way in**, while the HTML that carried the colour
still exists; derived afterwards it would always read "nothing was lost". It is
`role="status"`, not an alert: it reports a consequence of the button the author
just pressed.

**The other half is escaping, and it is what corrupts documents.** Round-tripping
ordinary prose rewrites it as markup unless the characters that *start* markup
are defused: `press the * key` becomes emphasis, `1985. It was a good year`
becomes a numbered list starting at 1985, `- see below` becomes a bullet. The
escaper is contextual rather than blanket — notably `_` is **not** escaped inside
a word, because escaping it produces `snake\_case\_name`, which every other
Markdown tool then shows the reader *with* the backslashes. Under CommonMark's
flanking rule an underscore between two word characters cannot open emphasis, so
the escape buys nothing and costs every identifier in the document.

Nothing is re-rendered until the mode is left: reformatting under the caret while
a `[` is still half-typed is the single most hated behaviour in dual-mode
editors. Source view closes when Markdown mode opens, because two buffers each
claiming to be the document means whichever is written back last silently wins.

Tables go through the same slot map the merge feature uses, so a row a `rowspan`
passes through still comes out the right width; the span itself cannot be
expressed and is reported.

The Markdown → HTML direction reuses `parseMarkdown` from
`@styloviz/streaming-markdown` rather than adding a second parser, so the product
has one definition of the dialect.

#### Fixed — six defects in the shared Markdown parser

All six were found by round-tripping a document through it, not by reading it,
and all six were **wrong renders** rather than edge cases. They affect
`sv-streaming-markdown`, `sv-ai-chat`, `sv-reasoning-trace` and
`sv-agent-approval` as much as the editor.

- **`![alt](src)` was not image syntax.** It parsed as a stray `!` followed by a
  link, so every image in model output reached the page as a bang and a clickable
  filename. `MdInline` gains an `image` kind and `safeImageSrc` is exported —
  `data:image/*` is accepted for `<img src>` and still refused for `href`,
  because one is a fetch and the other is a navigation.
- **A pipe inside a table cell split the cell in two** and shifted every column
  after it. The row splitter now honours `\|`, and `|` joins the escape set.
- **`snake_case_name` rendered with an italic run through the middle.** The
  parser had no flanking rule, so every `snake_case` identifier in technical
  prose came out wrong.
- **A code span could not contain a backtick.** `` `a` `` closed at the
  character it was written to contain; a run of N now closes only on a run of N,
  with CommonMark's single-space padding rule.
- **A four-backtick fence closed on an inner three.** Any document *about*
  Markdown spilled its remaining blocks out as prose, several blocks downstream
  of the cause.
- **A URL containing parentheses was truncated at the first one** — every
  Wikipedia disambiguation link — and the truncated address then failed the path
  check, so the link silently became plain text with a stray `)` beside it.

#### Fixed — `@styloviz-pro/all` did not build

`svFormatRate` was exported by both `@styloviz-pro/ai-token-dashboard` (cost per
request, in dollars) and `@styloviz-pro/eval-scorecard` (a pass rate, as a
percentage with a margin). Legal in either package alone and fatal in the barrel
that re-exports both: `TS2308`, and the whole bundle stopped compiling. Nothing
caught it, because every gate and every test looks at one package at a time. The
eval-scorecard export is now **`svFormatPassRate`**.

### Added — merged table cells in `sv-rich-text-editor`

`mergeTableCells()`, `splitTableCell()`, `tableMergeRefusal()`,
`caretInMergedCell()` and `lastTableNotice()`. Tables were previously
insert-only, with no span handling at all.

**Once a cell has a `colspan` or `rowspan`, the DOM stops telling you which
column a cell is in.** The row below a `rowspan` has no element for the column
that span occupies, so anything expressed in DOM child indices puts data in the
wrong column of every row a span passes through — and the table still renders,
because browsers are extremely tolerant here. So this is built on the slot map
the HTML spec itself uses, and every operation is expressed in grid coordinates.

- The selection rectangle **grows to whole cells**: dragging from a plain cell
  into one that is already merged would otherwise cut that cell in half.
- Merging **refuses**, with a reason, when the region is not exactly covered —
  a merge that went ahead would leave rows of different widths.
- Merging **keeps the content of every absorbed cell**. Keeping only the
  top-left of four destroys three values, and nothing on screen says so.
- Splitting puts the restored cells back **in their grid positions**, not at the
  end of the row.
- A `rowspan` running past the last row is clamped, as browsers do silently, and
  the clamped cells are reported rather than left to diverge from the render.
- A selection crossing two tables, or in a table outside the editor, is refused.

`svTableGrid`, `svSelectionRect`, `svMergeRefusal`, `svMergePlan`, `svApplyMerge`,
`svSplitCell`, `svGridIsWellFormed`, `svCellAt`, `svCellsIn` and `svFindCell` are
exported from `@styloviz-pro/rich-editor`, because a host doing its own table work
needs the same model.

### Added — mentions in `sv-rich-text-editor`, and a shared trigger scan

`mentionTriggers`, `mentionSuggestions`, `mentionQuery` and `mentionInserted` on
`sv-rich-text-editor`; `mentions()`, `mentionRepairs()` and `plainText()` read the
document back. Any number of triggers — `@` people, `#` topics, `/` commands.

**The inserted chip is atomic.** Every rich-text mention ships as a styled span,
which is twelve characters the author can edit one at a time: one backspace
leaves `@Priya Sharm`, which still looks like a mention, still carries that
user's id, and displays a name that is not theirs. The chip is
`contenteditable="false"` — and because that is necessary and **not** sufficient
(a drag-drop into it, an IME composition across its boundary, and several mobile
keyboards' autocorrect all still change the inside), it also carries its label as
data. `mentions()` returns only chips whose rendered text still matches what they
claim to be; `mentionRepairs()` names the rest without repairing them, because
repairing means choosing between the id and the text and the author may have been
deleting the mention or correcting a name.

`mentions()` reads the **document**, never a list kept alongside it — a list
drifts on the first delete, undo or paste of a document that already contains
mentions, and the drift is invisible until a notification goes to somebody who is
no longer mentioned.

The panel is a `role="listbox"` that never takes focus: the editor keeps it and
announces the active option through `aria-activedescendant`, because moving focus
out of the contenteditable loses the caret the insertion needs. Arrows move,
Enter and Tab insert, Escape closes — and only while the panel is open, so Enter
still makes a paragraph the rest of the time.

**New in `@styloviz/core`:** `svScanTrigger`, `svMentionHtml`, `svTokenIntegrity`,
`svParseMentions`, `svMentionRepairs`, `svMentionPlainText`, `svMentionLabel` and
`SV_MENTION_ATTRS`. The scan is shared with `sv-mention` rather than copied.

#### Fixed — `sv-mention` opened a people-search inside email addresses

Its trigger scan looked backwards for the character and nothing else, so typing
`priya@example.com` opened a lookup on `example.com`. It now requires the trigger
not to follow a letter or digit — Unicode-aware, so `José@example.com` and
`佐藤@example.com` are caught too. A trigger after punctuation (`(@alice`,
`—@alice`, `.@alice`) still opens the panel, because that is not the middle of a
word.

### Security — `sv-rich-text-editor` now cleans what the clipboard brings in

**There was no paste handler at all.** The visible consequence was cosmetic —
pasting from Word dragged in `mso-` styles, class soup and `<o:p>` tags — but the
same absent handler meant *whatever markup the clipboard carried* landed in the
contenteditable. The editor reads its value back out of `innerHTML`, so a host
persisting that value and rendering it to another reader had a stored-XSS path
whose injection point was somebody else's clipboard.

`cleanPaste` is **on by default**. Clipboard markup is parsed inertly with
`DOMParser` and rebuilt from an allowlist:

- The browser's own paste is cancelled **first**. Cleaning after the fact runs
  once `<img onerror>` has already fired and the request to the attacker's host
  has already gone out.
- **Allowlist, not denylist** — of tags, of attributes per tag, of style
  properties, and of URL schemes. A denylist has to be right about every attack;
  an allowlist has to be right about the twenty tags a document needs.
- URLs are resolved with `new URL`, not prefix-matched, so ` javascript:`,
  `JaVaScRiPt:` and a scheme split by a tab or newline are all refused.
- `position` is not a permitted style property: a pasted
  `position: fixed; inset: 0` is a full-screen overlay over the host's own page.
- An unknown tag is **unwrapped, not deleted**, so an author never loses prose to
  an unfamiliar wrapper.
- `target="_blank"` links get `rel="noopener noreferrer"`.
- What was removed is reported through the new `pasteCleaned` output and
  `svPasteSummary()`. A sanitiser that eats content silently is indistinguishable
  from a broken paste.

New inputs: `cleanPaste` (default `true`), `pastePlainText` (default `false`),
`allowPastedDataImages` (default `false` — an inlined screenshot is megabytes
heading for whatever you persist the value into). New output: `pasteCleaned`.

`svCleanPastedHtml`, `svPlainTextFromHtml`, `svPlainTextToHtml`, `svIsSafeUrl`,
`svCleanStyle`, `svEscapeHtml` and `svPasteSummary` are exported from
`@styloviz-pro/rich-editor`, so the same rules can be applied to content arriving
from an import, a webhook or a migration.

**This is a client-side control and does not replace server-side sanitisation.**
Anything that can POST to your API can send markup that never went near it.

### Changed — the Gantt critical path is now computed

**What was wrong.** `sv-gantt-chart` did compute a critical path, but by walking
backwards from the last-finishing task along links that "looked tight". Deciding
tightness needs a tolerance; the tolerance was a **whole day**. So a task with a
day of genuine slack came out critical, and on a three-month plan that is most of
the plan. The failure is invisible: a critical path that is too large still looks
like a critical path.

It is now the actual critical path method — forward pass, backward pass, and
`totalFloat = lateStart − earlyStart`. Float cannot be known from a forward pass,
which is why every heuristic version of this is wrong.

- **`taskFloat()` and `floatLabel(id)`** — how many days each task can slip
  before the project finish moves. That is the question a planner asks far more
  often than "is this critical", and the old implementation could not answer it.
- **`lag` on dependencies** (`{ taskId, type, lag }`, negative for a lead). Non-
  breaking; absent means zero. Without it a planner encodes "two days after the
  concrete is poured" by moving the successor's dates by hand — identical on the
  chart, and it does not follow when the predecessor slips.
- **All four link types in both passes.** `ff` and `sf` were understood going
  forwards and not coming back, so a critical chain through one of them was cut
  off there and its feeders drawn as though they had slack.
- **`scheduleCycles()`** — two tasks each waiting for the other can never be
  scheduled. The old code answered a cycle by treating the second visit as
  "finishes at the epoch", drawing a plausible chart over an impossible plan.
  Cycles are now named, kept on their supplied dates rather than collapsed to day
  zero, and excluded from the critical path.
- **A dependency naming a task that does not exist** is reported and ignored. It
  used to be walked into and **added to the critical set**, so the chart could
  report a critical task that was not in the data.
- **Manually scheduled tasks stay put** and still constrain what follows them.
- Scheduling is iterative (Kahn's algorithm) rather than recursive, so a
  four-thousand-task chain no longer risks the stack.
- **Float is counted in working days, not calendar days.** The first cut of this
  measured in calendar days on the argument that the bars span weekends, so a
  path that skipped them would disagree with the picture. That was the wrong way
  round: the chart already shades Saturday and Sunday as non-working, so it was
  the *arithmetic* that disagreed — it spent two days a week the picture had just
  greyed out. The visible cost was that a Mon–Fri plan could have no critical
  path longer than one week, because every Friday-into-Monday link carried two
  days of float nobody can spend, and the highlight broke at each weekend it
  crossed. The axis now follows the chart's own `workWeek` input, so the shading
  and the schedule are one decision; a host on a seven-day week gets exactly the
  calendar-day numbers it got before. Durations in the *data* are unchanged —
  `workWeek` and `holidays` still do not compress a bar's dates.
- The algorithm ships as `svCriticalPath` / `svCpmInputs` / `svDayIndex` /
  `svWorkingDayIndex` / `svFloatLabel` from `@styloviz-pro/gantt`, so a host can
  run the same arithmetic the chart does. 63 tests.

Behaviour that changes for existing charts: tasks with a day of slack are no
longer drawn as critical, and neither are dangling ids or tasks inside a cycle;
and on a Mon–Fri `workWeek`, float readings drop by two days for every weekend
that used to be counted inside them — which usually means *more* of the plan
reads as critical than before, correctly.

- Removed an `sv-image-gallery` example that had been pasted into the Gantt
  documentation entry.

### Added

- **`sv-barcode-1d`** (Free, `@styloviz/barcode-1d`) — Code 128, EAN-13 and EAN-8
  rendered as SVG from a real encoder. Three variants: `labelled`, `bare`,
  `inspect`.
  - **A barcode with the wrong check digit does not fail to scan. It scans as a
    different number.** That is the whole reason this is arithmetic and not CSS.
    Every "pure CSS barcode" draws stripes from the digits and stops, and the
    result is a picture of a barcode: a scanner either rejects it or — with
    EAN-13, where the thirteenth digit is a checksum over the other twelve —
    reads a valid-looking article number belonging to something else. A
    mislabelled shipment is a worse outcome than a label that obviously failed.
    So the mod-103 (Code 128) and mod-10 (GTIN) characters are computed here, and
    a value that cannot be encoded is refused with the reason in words rather
    than drawn anyway.
  - **Thirteen digits in twelve digits' worth of bars.** An EAN-13 symbol only
    draws twelve digits; the first is carried by the L/G parity pattern of the
    left half and by nothing else. Miss it and you have printed a valid EAN-13
    for a different country prefix and a different product.
  - **The GTIN weights run from the right.** Anchoring them at the left is
    accidentally correct for EAN-13 (12 payload digits, even) and wrong for every
    EAN-8 — so the bug ships, passes every EAN-13 test anyone writes, and
    corrupts every short code.
  - **Subset C is not an optimisation.** It packs two digits into one symbol
    character, so a 16-digit serial is 8 characters instead of 16 and the printed
    symbol is half as wide. Encoders that only use subset B produce barcodes that
    overflow the label stock, and the operator's fix is to shrink the module width
    until it stops scanning. The switch thresholds are the spec's and are
    deliberately asymmetric: four digits at the start (the start character is
    free) against six mid-string (a switch costs a character), plus a free switch
    for an even run that reaches the end, and a separate rule for a value that is
    exactly two digits.
  - **The quiet zone is part of the symbol, not padding around it.** 10 modules
    for Code 128, 11 left and 7 right for EAN — the scanner uses them to find the
    edges. Lay a barcode flush against a table cell border and it stops scanning,
    and every bar is still correct. `showQuietZone` draws them.
  - **A sub-pixel module is an unscannable barcode that looks fine.** At 1.7px
    per module the browser antialiases every edge and neighbouring bars end up a
    pixel wider or narrower essentially at random; a scanner measures *ratios*
    between runs, so that jitter reads as different run lengths. The module width
    snaps to whole device pixels and reports when it moved.
  - 89 tests. Accessible name is the encoded value including the appended check
    digit, not "barcode"; a refusal renders as text, not an empty box.

- **`sv-image-compare`** (Free, `@styloviz/image-compare`) — a before/after wipe
  that admits when it is not one. Three variants: `slider`, `bare`, `inspect`.
  - **Two images of different aspect ratios cannot be compared by wiping.** One
    of them is scaled or cropped to fit, so part of what the reader is shown as
    "the change" is the reframing, and the conclusion they draw is about the
    crop. The failure is invisible: the widget looks exactly right, the
    difference it shows is real, and it is the wrong difference. So both
    intrinsic sizes are measured — from the files, never from the boxes on
    screen, because the layout stretches both into the same rectangle and the
    rendered sizes agree even when the pictures do not — and a mismatch is
    stated above the images, plus emitted once with its size.
  - The tolerance is 1% rather than zero (two exports of the same source
    routinely differ by a pixel, and refusing that trains people to ignore the
    warning) and it is measured *relative* to the ratio: an absolute threshold
    treats 0.50 against 0.48 — a 4% reframing — as the same as 3.00 against 3.02.
  - **It is a real slider.** This control is almost never keyboard-operable, and
    it is the one widget with an unambiguous, universally-implemented keyboard
    contract that every screen-reader user already knows: arrows nudge, Page keys
    jump, Home and End go to the extremes. Every other key is left alone, so Tab
    still moves on. The spoken value names the images — "25% the retouch, 75% the
    original" — rather than reporting a percentage.
  - 56 tests.

- **`sv-scroll-area`** (Free, `@styloviz/scroll-area`) — a styled scrollbar drawn
  over a real scrolling element, never in place of one. Three variants: `auto`,
  `always`, `hidden`.
  - Custom scrollbars built on a `transform` inside an `overflow: hidden` box
    lose Page Up/Down, Home/End, the arrow keys, the spacebar, trackpad momentum
    and rubber-banding, `scrollIntoView` from anchor links, find-in-page
    auto-scroll and every screen reader's virtual cursor. All of that is free if
    the element genuinely scrolls, and none of it can be faithfully
    reimplemented. So the element scrolls, `scrollbar-width: none` hides the
    native chrome, and the drawn thumb is a read-out of `scrollTop`.
  - **The minimum-thumb correction is the whole function.** Thumb length is
    viewport² ÷ content, so a 40 000px document in a 400px box gives a 4px thumb:
    drawn, correct, and unhittable. Clamping the size is the easy half; the half
    almost every custom scrollbar gets wrong is that a thumb of length `s` can
    only travel `viewport − s` while the naive offset formula still assumes it
    can travel `viewport`. The thumb then runs off the end of its track, or stops
    short of it, by exactly what the clamp added — and the drag handler must use
    the same arithmetic, or the thumb drifts away from the pointer.
  - Pressing the track pages by one viewport, as every native scrollbar on every
    platform does; jumping the thumb to the pointer throws away the reader's
    place in a way they cannot undo. Edge fades, because once the chrome is
    hidden a list that scrolls looks exactly like one that does not.
  - 50 tests.

- **`sv-affix`** (Free, `@styloviz/affix`) — pin an element while the page
  scrolls, without the jump.
  - **Going `position: fixed` removes the element from flow and everything below
    jumps up by its height** — and it is worse than it sounds: the jump changes
    the page height, which changes `scrollY`, which can move the element back
    past its own threshold and unpin it, which puts the height back and re-pins
    it. The element flickers and the page shudders at exactly the scroll position
    where somebody is reading. The fix is not a smaller threshold or a debounce;
    it is a placeholder of the measured height.
  - **The anchor is re-measured from the placeholder, not from the element.**
    Once pinned, the element's own rect reports the viewport position it was
    moved to, so re-deriving the threshold from it yields the threshold that
    keeps it pinned — a one-way latch that never unpins on the way back up.
  - Optional container boundary: without one a pinned sidebar floats over the
    footer, over the next section, and — being fixed — over whatever the reader
    scrolled down to look at. `docked` counts as pinned for the placeholder's
    purposes, because an absolutely-positioned element is out of flow exactly as
    a fixed one is.
  - 36 tests.

- **`sv-watermark`** (Free, `@styloviz/watermark`) — a tiled overlay, tiled
  correctly. Three variants: `tiled`, `single`, `inspect`.
  - **The tile must be sized from the rotated box, not the unrotated one.** Every
    implementation computes the repeat interval from the text's own width and
    height and then rotates it. At any angle but zero those are the wrong
    numbers: a 120×20 label rotated 30° occupies a 114×70 box, so a 120×20 repeat
    overlaps vertically and gaps horizontally, and the result is a moiré of
    clipped, colliding text that looks like a rendering bug. The usual "fix" is to
    pad the tile by eye until it stops looking wrong at the one angle it was
    tested at. The rotated extent is exact and takes one line.
  - Rows stagger by half a tile, because a square grid reads as columns and
    columns leave clean vertical stripes a screenshot can be cropped to.
  - **The opacity band is narrow and nobody documents it.** Below about 4% the
    mark dies the moment the screenshot is saved as a JPEG — which is what happens
    to every screenshot. Above about 25% the document underneath is hard to read
    and somebody turns the feature off. The `inspect` variant names which side you
    are on and what happens there.
  - `pointer-events: none` so the overlay never swallows a click meant for the
    content — the commonest way this control ships broken, and one whose symptom
    (buttons that do nothing) never looks like a watermark bug. The marks are
    `aria-hidden` and `select-none`; the watermark is announced once, in words.
  - A `signature()` / `checkIntegrity()` pair for restore-on-removal, and the
    component says in the product that it is **not a security control**: anything
    rendered client-side can be removed by somebody with the page source. The
    point is to defeat the casual crop-and-share, which is what almost every real
    leak actually is.
  - 48 tests.

- New free icon `chevrons-left-right` (the horizontal sibling of the existing
  `chevrons-up-down`), used by the image-compare handle. Free set: 170 → 171.

- **`sv-guardrail-panel`** (Pro, `@styloviz-pro/guardrail-panel`) — safety policy
  as an operating surface: the rules, what they caught, and the answer the policy
  actually produced. Three variants: `rules`, `feed`, `redaction`.
  - **Every guardrail product ships the count and none of them ships the output.**
    "3 violations blocked" is compatible with a policy working perfectly and with
    a policy that ate the answer, and the only way to tell them apart is to read
    the text that came out the other side. Over-redaction ("Your order [REDACTED]
    ships on [REDACTED]") and under-redaction look identical on a chart of hits
    per hour.
  - **Blocks and redactions get separate counters.** "142 violations" is three
    users who got a refusal and a hundred and thirty-nine who got their answer
    with a phone number masked. One of those numbers generates support tickets.
  - **Overlapping spans are merged before anything is masked.** Two rules matching
    the same address produce overlapping ranges, and splicing them one at a time
    shifts every offset after the first replacement — the visible result is
    `[RE[REDACTED]D]`, the invisible one is that the address survives and
    something else gets masked instead. A merged run keeps the *lowest*
    confidence and the *strongest* action of its contributors.
  - **Rules that never fire are listed first.** Each one costs latency on every
    request, and volume ordering — what every dashboard does — puts them below
    the fold forever. Needs 200 events behind the claim; disabled rules are never
    called dormant, because they cost nothing.
  - A redaction is flagged as destructive by share *or* by longest run, because
    those catch different failures: thirty per cent removed as twenty short spans
    is twenty phone numbers gone, and thirty per cent as one span is the
    paragraph that answered the question.

- **`sv-artifact-panel`** (Pro, `@styloviz-pro/artifact-panel`) — conversation and
  generated document side by side, with a revision history that records why each
  version says what it says. Three variants: `split`, `focus`, `history`.
  - **Every canvas shows what the document is and none shows what changed.** A
    user asks to shorten one paragraph; the document re-renders, the paragraph is
    shorter, the change looks right — and three sections down a sentence nobody
    asked about has been rewritten. That is the commonest failure mode of
    assistant-edited documents and it is invisible by construction.
  - **The number that catches it is the region count, not the line count.**
    "+3 −7 lines" is compatible with one tightened paragraph and with edits
    scattered across five places. One instruction should produce one region.
  - **`causedBy` is the field every implementation leaves out.** Without it the
    document remembers its content and forgets its reason, and six turns later
    "why does it say thirty days?" has no answer.
  - **The pane does not swap under the reader.** Every split view pins the newest
    revision and jumps mid-sentence; never jumping is the opposite failure, and
    leaves somebody reviewing a document two revisions out of date. Both are
    fixed by saying which one is on screen and offering the jump.
  - Diffs by longest common subsequence, so inserting a sentence at the top does
    not report the rest of the file as a rewrite. Past 2 000 lines the counts
    still come but are labelled `approximate` rather than silently degraded.

- **`sv-embedding-map`** (Pro, `@styloviz-pro/embedding-map`) — a 2D projection
  with clusters and lasso selection, drawn without inviting the reading every
  t-SNE plot invites. Three variants: `scatter`, `clusters`, `selection`. Pure
  SVG, no chart dependency.
  - **Distance between clusters carries no meaning in these layouts**, blob size
    is set by perplexity rather than by the data, and the space between blobs is
    empty because the optimiser pushed things apart. So there are no axes, no
    distance scale, and the caveat is rendered as text on the chart rather than
    hidden in a tooltip.
  - **In their place, the one question a projection can answer**: k-NN label
    agreement. For each point, the share of its nearest neighbours *in the
    projection* that carry the same cluster. Low means the clusters are drawn
    apart and mixed together — a picture that produces a confident, wrong reading
    every time it is shown. The component also names which pairs are entangled,
    which the eye cannot judge from five thousand semi-transparent dots.
  - **One scale for both axes.** Stretching x and y independently to fill the box
    destroys local shape, which is the only property these layouts preserve.
  - **Overplotting is reported.** Once dozens of points share a dot the darkness
    saturates, and a region holding 40 looks identical to one holding 400.
  - Above 1 200 points the statistics come from a deterministic even sample and
    say so. The lasso is point-in-polygon with the half-open vertex rule and
    closes on release, not on every pointer move.


- **`sv-citation-sources`** (Free, `@styloviz/citation-sources`) — the numbered
  citations on a generated answer, and the strip that names what nothing
  supports. Three variants: `inline`, `cards`, `panel`.
  - **One source gets one number, however often it is cited.** Numbering per
    occurrence — what you get from mapping over the citation list — turns one
    page quoted five times into `[1][2][3][4][5]`, so a reader scanning the
    answer sees five sources agreeing where there is one. The whole reason to
    show citations is to let somebody judge how well supported a claim is, and
    that inflates the answer by whatever factor the retriever chunked the
    document into.
  - **Every character of the answer appears exactly once.** Segments are cut on
    citation *boundaries* rather than emitted per citation, so overlapping
    citations — ordinary, because chunks overlap — cannot render a clause twice
    and hand the reader an answer the model never wrote.
  - **The coverage strip points at the passages nothing supports**, longest
    first, above a 40-character floor so the connective between two adjacent
    citations is not filed as an unsourced claim. An answer carrying six chips
    looks thoroughly grounded; the paragraph between the third and fourth chip
    is the one that needed one.
  - An answer with nothing attributed is **not** an empty state. The shell is
    for having no answer.

- **`sv-voice-assistant`** (Pro, `@styloviz-pro/voice-assistant`) — a voice turn
  whose meter is driven by measured amplitude and nothing else. Three variants:
  `button`, `transcript`, `call`.
  - **A level meter that is not driven by the microphone is the worst bug a
    voice UI can have.** Almost every voice interface animates its bars on a
    timer, and the result moves identically whether the microphone is live,
    muted, permission-denied or capturing a dead headset — so the one question
    the control exists to answer, *is it hearing me*, is the one it cannot
    answer. Pass `levels` from a real `AnalyserNode`; the component invents
    nothing.
  - The silence floor is **0.04, not zero** — a live microphone in a quiet room
    reads a non-zero noise floor, so a `> 0` test calls silence "speech" forever
    and an auto-stop built on it never fires. And a live-but-silent microphone
    still draws a 6 % floor, because drawing nothing is indistinguishable from
    a dead meter.
  - **Interim transcript is replaced by its final, not followed by it.** The
    naive fold leaves the running guess above the settled text, so the
    transcript reads "I want to / I want to cancel." — the user's sentence
    twice, once wrong.
  - `denied` is **terminal until `reset`**, and says where the browser hid the
    permission. Barge-in out of `speaking` is one transition on the machine, not
    a flag somebody remembers to check.

- **`sv-eval-scorecard`** (Pro, `@styloviz-pro/eval-scorecard`) — two eval runs,
  compared honestly. Three variants: `summary`, `compare`, `cases`.
  - **A pass-rate drop is not a regression until you know which cases flipped.**
    "84 % → 81 %" is what every harness prints and it supports none of the
    decisions made from it: three points could be three new failures in one
    suite, or thirty cases flipping both ways and netting out — ship-blocking
    versus a flaky grader, identical in the headline, opposite responses.
  - **And a difference that small may not be a difference.** Rates carry a 95 %
    *Wilson* interval — Wilson because eval suites are small and rates sit near
    0 or 1, where the textbook normal interval returns bounds outside 0–100 —
    and the delta stays grey until the two intervals stop overlapping. A red
    arrow on noise is what teaches a team to stop reading its own eval board.
  - **`error` is not `fail` and neither is `skipped`.** Both leave the
    denominator and surface as an "ungraded" count. A case that passed before
    and errored now is classified `ungraded`, not `broken` — counting a provider
    500 as a regression sends an engineer to debug a prompt over a timeout.
  - **Only cases present in both runs are compared.** `added` / `removed` are
    reported apart and drawn neutral: a case that exists in one run has not
    regressed or improved, it was not measured.
  - **A case that flips both ways is flaky** — marked, not dropped, because a
    case suppressed for flakiness is one nobody looks at again and some of them
    are genuinely broken. Needs three runs; two can only show a change.
  - The arithmetic ships as plain exported functions (`svCompareRuns`,
    `svRateMargin`, `svIsSignificant`, `svFlakyCases`) with no DOM in them, so
    the first useful place for it is a CI gate rather than a page.


- **`sv-choropleth-map`** (Pro, `@styloviz-pro/charts`) — a value per region,
  drawn as a colour per shape. Three defaults are deliberately not the usual
  ones, because each of the usual ones is a way a choropleth misleads:
  - The projection defaults to **Equal Earth**, which is equal-area, not
    Mercator. Colour carries the value but the eye reads importance from *area*,
    and Mercator inflates a region by `1/cos²(latitude)` — Greenland is a
    fourteenth of Africa and Mercator draws them the same size. The spec proves
    the equal-area property numerically and shows Mercator drawing two
    equal-area cells 6.3× apart.
  - Class breaks default to **quantile**, not equal-interval. Geographic data is
    long-tailed, and equal-interval puts almost every region in the palest band:
    on the sample in the spec, 12 of 13 regions and three unused colours.
    `equal-interval`, explicit `threshold` and `continuous` are all available —
    they answer different questions, and the point is that you choose.
  - **A region with no figure is never painted at the bottom of the ramp.** It
    gets its own fill, its own legend entry, "No data" in its `aria-label`, and
    `value: null` in the event — and it is excluded from the scale rather than
    counted as zero.

  Also: one path per feature with `fill-rule="evenodd"` so holes stay holes; a
  single scale for both axes so the map is never stretched; and **one tab stop
  for the whole map** with arrow-key navigation in reading order, rather than a
  `tabindex` per region — which on a world map is 170 presses of Tab to get
  past the chart.

  The library ships **no geometry**. A world is 25 KB of coordinates and borders
  are a decision you should be making; pass your own GeoJSON as
  `{ id, name, polygons }`. `projection="identity"` takes coordinates you have
  already projected, which is the only way to draw a composite such as Albers
  USA — it insets Alaska and Hawaii at their own scales, and no point-wise
  `(lon, lat) → (x, y)` function can express that.
- **`sv-rag-knowledge-base` gains `chunks` and `retrieval` variants** (Pro).
  The kit could count chunks and watch them being made; it could not show you
  one. Every RAG failure that is not a retrieval failure is a chunking failure,
  and none of it is visible in a count. The inspector reports the overlap
  between neighbouring chunks — text embedded, stored and returned twice, a
  deliberate trade nobody displays — and the **gaps**, stretches of a document
  that no chunk covers at all: present in the source, absent from the index,
  unreachable by any query, while the source sits in the list marked ready.
  Tokens are estimated by content type rather than a flat characters-over-four,
  because JSON and code run about 2.5 characters to the token against prose's
  four; a splitter sizing by character count lands at double the intended budget
  on code, and those are the chunks that get **silently truncated at embedding
  time** — the tail is still in your store and still shown to the model, but it
  had no influence on the vector, so it can never be the reason the chunk comes
  back.

  The retrieval panel draws each hit's bar from its position within the result
  set rather than its raw score, since a cut-off tuned to one embedding model's
  distribution drops everything on the next one. It reports the **shape** of the
  set, which is what actually predicts a hallucination: a flat profile means the
  retriever could not tell the candidates apart, and that is exactly the input a
  model invents a confident synthesis from. Flatness and shape are two separate
  measurements on purpose — `0.710 / 0.708 / 0.700` is `0.9 / 0.5 / 0.1`
  rescaled, so any scale-free statistic calls them identical, and they are
  completely different retrievals. It also counts the distinct **documents**
  behind the hits, because five chunks of one page look like five sources
  agreeing and are one source repeated, and shows rank deltas so a reranker that
  changes nothing is visibly changing nothing.
- **`sv-prompt-template-library` gains a `playground` variant** (Pro). A
  template library that cannot compare two templates is a folder. Both sides run
  on one shared set of variable inputs — giving each side its own is the
  commonest way a prompt A/B is run, and it measures the inputs rather than the
  prompts — and a variable only one side reads is flagged as the confound it is.
  Unfilled placeholders are called out above the figures, because they do not
  error: they reach the model as literal braces and it answers around them, so
  an estimate over an unresolved prompt is an estimate of a prompt nobody will
  send. Cost is computed on the resolved text, since the value pasted into a
  variable is usually the longest part of the prompt, and the difference is
  shown per run **and** compounded over a month — a fraction of a cent reads as
  free, which is precisely why nobody optimises prompts.
- **`sv-sentiment-analysis-widget` gains an `aspects` variant** (Pro). A
  document does not have a sentiment; it has several, about different things.
  "Delivery was quick but the app crashed twice" scores as mildly negative
  overall and counts as one mention each of two topics — neither says what the
  review says. The overall mean is not merely less useful than the per-aspect
  breakdown: a product whose delivery is adored and whose checkout is hated
  scores exactly the same as one where everything is mediocre, so the extremes
  now sit beside it. Mentions and people are counted separately, because one
  long review complaining four times is four mentions and one customer.
  Polarisation separates a fifty-fifty split from indifference, which share a
  mean of zero and need opposite responses. And an aspect needs five mentions
  before it is ranked — without that, one furious comment scores −1.0 and tops
  the needs-attention list every week for a feature nobody else has mentioned.
- **`sv-ai-insight-cards` gains an `anomaly` variant** (Free). An insight feed
  without a baseline is a list of opinions: a card saying "checkout errors are
  up" at 87 % confidence never says up from what, by how much against the
  ordinary swing of that metric, or whether there is enough history to support
  the claim. Deviation is measured with a median and a median absolute deviation
  rather than a mean and a standard deviation, because an outage lands several
  bad readings in the window and those drag the mean up and inflate sigma until
  today's reading scores as unremarkable — the detector blinded by the very
  event it exists to catch, which is what happens every time something genuinely
  goes wrong. The naive figure is computed too, purely so the panel can say
  which findings it would have missed. The sign is kept, since a four-sigma drop
  in errors is the deploy working, and a metric with four days of history claims
  no severity at all.
- **`sv-ai-workflow-builder` gains a `debug` variant** (Pro), plus a
  `subworkflow` node type. A run list tells you a run failed; it does not tell
  you where. The inspector separates the failure that caused the others from the
  ones it caused — a tool call times out and four nodes fail on its empty
  output, so a plain failure list sends an engineer to the symptom first — and
  separates a stretch a failure blocked from a branch nobody took, which arrive
  as the same `skipped` status and mean opposite things: one is damage, the
  other is the workflow working as designed. It reports a blast radius per
  failure, because the same error is a retryable annoyance at the end of a
  workflow and a total outage at the start of one.
- **`sv-ai-token-dashboard` gains a `tenants` variant** (Pro). The other four
  slice usage by model and by budget; between them they will tell you that
  $6,100 of a $9,000 month went to Opus, which nobody has ever been able to act
  on. Finance, the on-call watching spend triple overnight and the account
  manager writing an overage email all ask the same different question: who
  spent it. Bind a raw `usage` export — one record per tenant/key/user slice,
  the shape a billing pipeline already emits — and the variant groups it along
  whichever of the three axes you toggle to, because one tenant across six keys
  and one key shared by six tenants are different problems with the same total.

  Spend carrying no id at the chosen axis gets **its own row**, pinned last
  however large it is. Dropping those records makes the page disagree with the
  invoice by however much the internal traffic came to; folding them under a
  default tenant charges whichever customer sorts first for somebody else's
  usage. Every share is taken against the **whole** bill including them —
  against the attributed subtotal each customer reads heavier by exactly the
  fraction nobody owns, and that is the figure that ends up in an email.

  Cost per request is compared with the **request-weighted** fleet rate, not the
  mean of the per-row rates: the account making 99 % of the calls is the fleet
  rate and cannot be an outlier against it, whereas a mean lets a few tiny
  expensive accounts drag the baseline until the bulk account reads as
  suspiciously cheap. A row is only judged once it has 25 or more requests,
  because $3.00 a request over three requests is not a rate — without that floor
  the column meant to find a runaway agent points every month at somebody who
  owes nine dollars. A pareto figure says how few accounts make up 80 % of the
  bill, which is the difference between a pricing conversation and a
  platform-wide cost problem. `svAttribute`, `svAttributionTotals` and
  `svParetoCount` are exported for hosts that want the arithmetic alone.
- **`sv-ai-model-selector` gains a `routing` variant** (Pro). The other four
  variants all answer the same question — which single model do you want? —
  and that is not the question a deployment asks. Production has a primary,
  fallbacks for when it rate-limits or errors or blows its context window, and
  a spend cap that has to do something when it is reached. Bind a `policy` and
  the variant draws that chain, prices every step per request against the
  primary, and checks two classes of defect that are arithmetic rather than
  taste.

  **Red** means the runtime can never land on the step: the model id is not in
  the catalogue, no trigger routes to it, it routes on `budget` while the
  budget policy blocks rather than downgrades, or — the one worth the whole
  variant — it catches `context_overflow` with a window no larger than the step
  above it. A request that would not fit in 200K tokens does not fit in 128K
  either, so that step fails every time it is invoked; it is the commonest
  mistake in a fallback chain, because the fallback is usually the cheap model
  and the cheap model is usually the small one, so the policy reads perfectly
  sensibly in the YAML file where it lives. **Amber** means the step runs but
  not as its author expected: it costs more per request than the primary it
  replaces, which on a `budget` trigger means the fallback accelerates the
  overrun rather than slowing it.

  A step whose model id does not resolve is kept and flagged, not filtered
  out — a three-step policy rendered as two is a chain shorter than the one
  production runs, and the step that vanished is the one naming a retired
  model. The spend cap shows an **unclamped** percentage above a bar clamped to
  its track, because "124 %" and "at the cap" are different facts and only the
  bar has to lie; what is left is quoted in requests as well as dollars, priced
  at whichever step is live rather than at the primary. `svRoutingSteps`,
  `svBudgetState` and `svRequestsRemaining` are exported for hosts that want
  the arithmetic without the markup.
- **`sv-ai-agent-activity-log`'s `trace` variant is now a span waterfall**
  (Pro). It used to be a two-level list of titles, badges and clock times: the
  ORDER of the steps, which the `feed` variant already gave you, and nothing
  about where the time went — which is the only question anybody opens a trace
  to answer. Eighteen seconds of agent run, and the call that took six of them
  looked exactly like the one that took forty milliseconds.

  Every span now sits on **one shared axis** for the whole trace, so bar length
  is comparable across levels rather than only against a span's own parent, and
  the nesting is **unbounded** — the old markup hard-coded a single level and
  dropped everything below it, so run → step → tool call → retry silently lost
  the layer you were looking for.

  Each row also reports **self time**: its duration minus the wall-clock spent
  inside its children. On totals alone a parent includes everything underneath
  it, so the root is always 100 % and every ancestor looks slow. Children that
  ran **concurrently are merged before subtracting**, so three 400 ms calls
  inside a 500 ms parent leave 100 ms of self time rather than −700 ms of it.
  Tokens and cost roll up the same way, with each span showing its own figure
  beside its subtree total — an orchestrator that spends nothing itself and
  calls three models is not free.

  `ActivityEvent` gained optional `durationMs` and `costUsd`; existing data
  stays valid. A span with no duration draws **no bar and says so**, rather than
  a zero-width one that reads as "this step took no time", and a 0.5 % floor
  keeps a 2 ms span inside a 40 s trace visible. Costs format as `<$0.01`
  rather than `$0.00`, because a column of zeroes teaches you to ignore the row
  that cost eleven dollars. The arithmetic ships as `svFlattenSpans` /
  `svSpanScale` / `svSpanBar` for hosts that want to draw their own.
- **`sv-ai-writing-assistant`'s revision diff now diffs.** Show Diff used to put
  the whole "before" in a red box and the whole "after" in a green one, side by
  side — for a revision that changed six words out of two hundred, the reader
  got both paragraphs and had to find the difference themselves. It now computes
  a word-level diff and marks the changes inline: deletions struck through,
  additions underlined, each labelled, so it survives greyscale and
  colour-vision deficiency. The stats strip reports **words touched** as well as
  the net delta, because "−5 words" is what you get from a thirty-word rewrite
  and from trimming one clause.

  The algorithm ships as `svProseDiff` / `svProseDiffStats` / `svProseDiffHunk`.
  The last of those emits the shape `sv-code-block`'s `[hunks]` input consumes,
  so a host that already has the code block gets its presentation without this
  package depending on it.
- **`sv-ai-chat` gains multi-agent threads** (Pro). An `agents` roster
  attributes every reply by **name** — one sparkle avatar for everything means
  an answer from Billing and one from Security render identically, and the
  transcript cannot say which of them told the customer their refund was
  approved.

  `handoffs` are their own entries, not inferred from `agentId` changing between
  messages. That matters because **a handoff can produce no message at all** —
  the specialist is consulted, has nothing to add, and hands straight back —
  and inference shows nothing in that case: an unexplained pause with no trail
  of who was consulted. Each handoff names the message it comes after, carries
  its own reason, and renders as a `role="separator"` with a written accessible
  name. The agent header repeats after any handoff, including one that returns
  to the same agent, since that is still a real change of control.
- **`sv-ai-chat` gains regenerate branching** (Pro). With `[branching]="true"`,
  pressing Regenerate keeps the answer it replaces as a *version* and the reply
  grows a "2 / 3" switcher, instead of deleting it outright. Off by default,
  because it changes what `regenerate()` does.

  It is a tree, not a list of alternative strings. Each message carries a
  `parentId`, so switching a version switches **everything that came after it**
  — the conversation continued differently under each attempt, and a switcher
  that only swapped the message text would leave the other branch's follow-up
  hanging underneath. Turning it on cannot blank an existing chat: a transcript
  with no parent links is relinked from list order first.

  The tree helpers (`svChatPath`, `svChatVersion`, `svChatSelectVersion`,
  `svChatStepVersion`, `svChatAddVersion`, `svChatLinkSequential`) are exported
  for hosts building their own switcher.
- **An imperative dialog API for `sv-modal`** (free). `SvModalService.open()`
  takes any standalone component and returns a handle you can await:

  ```ts
  const ref = modal.open<boolean>(ConfirmDeleteComponent, { data: { project } });
  const result = await ref.result;
  if (result.dismissed) return;   // Escape, backdrop, the ×
  if (!result.value) return;      // the user answered: no
  ```

  - **The result is a discriminated union, not `R | undefined`.** The
    conventional shape makes every caller write `if (result)`, which is correct
    until the dialog resolves something falsy — a confirm resolving `false`, a
    quantity picker resolving `0`, a rename resolving `''`. Those read as
    cancels, take the wrong branch silently, and present as the dialog
    "sometimes not working".
  - **The promise always settles** — including when the injector is destroyed
    mid route change, which is the case most likely to strand an `await`.
  - **There is no host component to add to your layout.** The service creates
    its own container, so `open()` cannot silently do nothing.
  - The dialog receives its arguments through `SV_MODAL_DATA` and closes itself
    through an injected `SvModalRef`.
- **`sv-modal` gains `resizable` and `maximizable`.** Every size is clamped to
  the viewport and to a floor, because an unclamped drag puts the header — with
  the ×, the footer buttons and the resize handle itself — off screen with no
  gesture left to bring it back. `resizable` also turns on the maximize button,
  which is the keyboard-reachable half of the same capability; the drag handle
  is a pointer-only enhancement and is hidden from assistive tech rather than
  offered as a tab stop that does nothing.
- **Fixed: two open modals no longer unlock the page when one closes.** The
  body scroll lock was per-instance, so closing the upper of two dialogs cleared
  `body.overflow` and the page began scrolling behind the one still open. It is
  now reference-counted, which also fixes the scrollbar compensation being lost
  on the second lock, and the host page's own `overflow` being wiped instead of
  restored.
- **`sv-select-dropdown-pro` gains virtual scrolling and a "select all".** Both
  are Pro-only; the free twin is unchanged.
  - Flat option lists longer than `virtualThreshold` (150) render only the
    visible window. The part worth knowing: windowing a listbox breaks the
    combobox pattern unless it is handled — `aria-activedescendant` names the
    active option by DOM id, and a window that unmounts it leaves that id
    dangling, at which point a screen reader announces *nothing* as the user
    arrows through the list. The active option is therefore always kept
    mounted, and the spacer rows are `aria-hidden` so they are not reported as
    unreachable list items. Row height is derived from `size` and from whether
    any option has a sublabel; `optionHeight` and `virtualViewportHeight`
    override. **Grouped lists are deliberately never windowed** — headers and
    options are two different index spaces, and half-doing it would produce a
    list that looks windowed and navigates wrongly.
  - `showSelectAll` adds a tri-state bulk control to a multi-select. It acts on
    the **visible, enabled** options — not the whole array, which with a filter
    on would select the rows the user just filtered out, and with a disabled
    row would pick something they are not allowed to. Deselect is symmetric: it
    removes what is on screen and leaves selections made under another filter
    alone. Under a `maxSelected` cap it is **disabled rather than filled to the
    cap**, because "which five of these two hundred" has no defensible answer.
    The rules ship as `svEligibleForBulk` / `svBulkState` / `svApplyBulk` /
    `svBulkWouldExceed` for hosts building their own bulk bar.
- **`check:parity` compares capability, not just names.** It used to compare
  inputs, outputs and models; a `ControlValueAccessor` is none of those, which is
  how the date-picker defect above stayed green for a release. It now also
  compares implemented interfaces and ARIA roles, giving a native `<button>`
  credit for `role="button"` so the twin with the *better* markup is not the one
  reported.
- **Two new `check:ui` rules** — `aria-label-outranked` and
  `describedby-drops-a-description` — for the two accessibility classes above.
- **A test for every fix.** Six of the behaviours in this release were written,
  verified by hand, and shipped with no test at all; that gap is closed, and the
  `ControlValueAccessor` block was run against the pre-fix component first to
  prove it fails.

### Testing

*(A snapshot from the first correctness pass, kept as recorded; the suite has
grown well past it since.)*

- **4,339 tests, 212 files.** 201 of 201 components have a spec.
- `sv-gantt-chart` and `sv-rich-text-editor` — the two largest and least covered
  files in the kit — gained 83 tests between them covering export, MS Project
  XML round-tripping, the command bus, hierarchy predicates, the working
  calendar, and every formatting guard. Branch coverage went from 15.6% to 36%
  on the gantt and from 9.6% to 17% on the editor — the rest of the editor is
  `execCommand` against a live selection, which no jsdom test can honestly
  exercise; that is what `e2e/` is for.
- Coverage overall: **lines 72.05%, branches 54.09%**, statements 69.78%,
  functions 70.67% — every metric up on 0.3.0, and all four ratcheted so they
  cannot regress.

---

## [0.3.0] — 2026-07-31

A same-day fix for a tier leak that shipped in 0.2.0. Breaking, so it takes the
minor bump this kit gives breaking changes while on `0.x`.

### ⚠ Breaking

**`sv-cascader` and `sv-mention` moved to `@styloviz-pro/forms`.** Both are
authored `tier: 'pro'` with licence-gated demos, and 0.2.0 published them inside
the FREE `@styloviz/forms` on public npm — the site charged for them while npm
gave them away.

```
- import { SvCascaderComponent, SvMentionComponent } from '@styloviz/forms';
+ import { SvCascaderComponent, SvMentionComponent } from '@styloviz-pro/forms';
```

Everything else in `@styloviz/forms` is unchanged. 83 packages now (38 free,
43 Pro, 2 infra).

### Fixed

- **The gates could not see the Forms & Inputs category — at all.**
  `loadKitData` globbed `docs/categories/*.data.ts`, but those 24 doc entries
  live in a `const FORMS` array one directory up in `component-docs.data.ts`.
  So `check:tier` reported *"96 checked"* while never reading a single form
  control, and that is how the leak above reached npm. The loader now includes
  them; the gate reports **120 checked**.
- **The headline count was short by exactly those 24.** `/pricing`, the nav
  badge and the `/get-started` hero said **96 components**; the catalogue has
  **120** (70 free / 50 Pro). Derived, so it corrected itself once the loader
  was fixed.
- `rich-text-editor` was documented `tier: 'free'` but only ships in
  `@styloviz-pro/rich-editor` — a component a buyer could not install on the
  tier the docs promised. Now authored `tier: 'pro'`, which immediately exposed
  **two ungated demo blocks** ("Accessibility", "Reactive Forms") that were
  publishing Pro source. Both gated.
- **`/get-started` "114 components take live data"** came from the 2026-07-26
  wireability audit and had gone stale across the tier split — re-derived to
  **92**. **"4 shared state shells"** was wrong: `@styloviz/core` ships **five**.
  `connection-status` was missed because the other four are the
  request/response set and it belongs to the streaming one the ai-ops template
  runs on.

### Note on `/components` vs the headline

They count different things and both are right: `/components` counts **gallery
entries** (123), the headline counts **doc pages** (120). Pro now agrees at 50
across both. The free gap is `icons`, `animated-icons` and `like` — gallery
entries with no doc page, which the dashboard counts as free by subtraction.

---

## [0.2.0] — 2026-07-31

Two rounds of work ship together. The packaging and tier-integrity pass below
was written up on 2026-07-28 but never released — npm carried 0.1.5 and no
v0.2.0 tag was ever cut — so it is folded in here rather than left looking
like a release buyers already had.

**Part one — tier integrity, export and accessibility.**

A packaging and tier-integrity release. Nothing about a component's behaviour
changed; what changed is **which package ships it**, and every number, snippet
and import path that described the old arrangement.

### ⚠ Breaking

**Twenty Pro components moved out of free packages.** They were authored
`tier: 'pro'` with licence-gated demos, but the packaging waves had grouped
family packages by docs *category* and never consulted tier — so a buyer could
`npm i @styloviz/overlays` and use `sv-drawer` for nothing. Each family is now
split by tier, the same shape `charts` / `charts-free` already had.

| Was | Now | Components |
| --- | --- | --- |
| `@styloviz/overlays` | `@styloviz-pro/overlays` | drawer, popover, popout, dropdown-menu, confirm-dialog |
| `@styloviz/commerce` | `@styloviz-pro/commerce` | product-card, thumbnail-card, cart-line-item, order-summary, credit-card, gift-card |
| `@styloviz/display` | `@styloviz-pro/display` | tiles, comment, transfer, filter-panel, heatmap-calendar, widget-grid |
| `@styloviz/layout` | `@styloviz-pro/layout` | splitter, speed-dial, number-ticker |

The free packages keep everything else and their import paths are unchanged.

**Four `tsconfig` path aliases removed** — `@styloviz/gantt`, `@styloviz/kanban`,
`@styloviz/rich-editor` and `@styloviz/command-palette` mapped free-scope names
onto Pro-only projects. They made a wrong import compile locally and fail only
for the buyer. Use the `@styloviz-pro/` name.

### Fixed

- **108 code snippets named packages that have never existed.** The showcase
  democode map told buyers to `import … from '@styloviz/price'`,
  `'@styloviz/tiles'`, `'@styloviz/number-ticker'` and 19 other per-component
  names; those components ship inside family packages, so every one of those
  installs 404s. All now point at the real package.
- **The first Pro example a buyer sees after paying did not compile** — the
  /get-started and /welcome snippet imported `SvGanttComponent` and used
  `<sv-gantt>`; the real names are `SvGanttChartComponent` and `<sv-gantt-chart>`.
- **Five Pro chart demos were publishing their source ungated** (live stream,
  dynamic data source, axis label template, date-time category,
  high-performance). They relied on inferred tier, and `check:gating` reads the
  authored `tier: 'pro'` line — now explicit on all six affected doc entries.
- **Six Pro components were live in the free playground** with full knob control
  and a generated copy-paste snippet. Removed; they keep their padlocked
  showcase demos.
- **17 phantom `@angular/*` peer dependencies** left behind by components that
  moved between packages — `@angular/forms` in 14 packages, `@angular/router` in
  two, `@angular/platform-browser` in one. npm was warning buyers to install
  things the packages do not use.
- **The pricing page advertised 75 free components when 49 were free.** The
  headline counts were hand-maintained and did not move with the split.
- A fake `npx @styloviz/cli init` terminal block, shown with a copy button, now
  offers a command that exists.

### Added

- `npm run check:tier` — a component's documented tier must match the tier of the
  package that publishes it. Fails on a *leak* (documented Pro, published free)
  and a *tease* (documented free, only in a Pro package).
- `npm run check:playground` — the playground stays free-tier: no Pro entry, and
  no `@styloviz-pro/*` import anywhere under that folder (a Pro *type* counts).
- `npm run check:package-refs` — every `@styloviz` specifier printed anywhere
  under `src/` or `projects/` must name a real package, and `tsconfig` aliases
  must match `packages.json` in both directions. Ledger:
  `scripts/package-refs.allow.json`.
- Three barrel name collisions introduced by the split are resolved explicitly:
  `HeatmapVariant` stays with charts (the calendar's is `HeatmapCalendarVariant`),
  `BadgeColor` with tree-view (`ThumbnailBadgeColor`), `PipelineStage` with
  rag-knowledge-base (`WidgetGridPipelineStage`). An ambiguous `export *` is
  silently omitted rather than reported, so each one would have deleted a name
  from `@styloviz/pro` without a build error.
- `check:pro-barrel` no longer reports a clean pass when its collision half was
  skipped for want of a `dist/`. It exits 2 with an INCOMPLETE notice — that
  false green is exactly how the three collisions above reached `ng build`.
- `typecheck:all` skips a target whose `dist/`-mapped dependencies are unbuilt,
  naming them, instead of emitting one TS2307 per missing module.
- `check:peer-deps` now covers the `@angular/*` scope. `@angular/core` and
  `@angular/common` are exempt from the phantom half — declaring them is the
  standing convention for an Angular library.
- `stats:sync` now **derives** the component counts from the documented
  catalogue and writes them back into `packages.json`. They can no longer drift.

### Added — export

- **Excel and PDF export in the Pro data table.** `@styloviz-pro/export` shipped
  in the last round but nothing consumed it. `[exportFormats]="['csv','xlsx','pdf']"`
  turns the Export button into a format menu; a single format still renders a
  plain button, so an existing `[exportable]="true"` is unchanged.
  - `TableColumn.exportFormat` (`'currency'`, `'percent'`, `'integer'`, …) types
    the column in Excel. Without it a revenue column arrives as text and will
    not sum — the most common complaint about generated spreadsheets.
  - Both engines load with `await import()`, so neither the Excel writer nor
    `jspdf` reaches a bundle that never exports one. `@styloviz-pro/export` is an
    **optional** peer.
  - New `exportFailed` output: PDF resolves `jspdf` / `html2canvas` at click
    time, so a host without them gets an event instead of an unhandled rejection
    and a button that appears to do nothing.
- **Chart export is now demonstrated and documented**, not just shipped: a gated
  showcase demo with working PNG / SVG / PDF buttons, a copy-paste snippet, and
  an example plus a customization note on the Charts docs page.
- **Excel export in the gantt chart**, alongside CSV / JSON / MS Project. Column
  formats are derived — `progress` is written as a real percentage rather than
  the text "45".

### Fixed — the backend-wiring promise

The /get-started hero promises "loading, error, retry and empty states included".
Audited against it:

- **Two `retry` outputs could never fire** — declared, but nothing emitted them,
  so a host binding `(retry)="reload()"` waited forever. That is the exact
  failure the async contract exists to prevent, wearing the shape of compliance.
  - `sv-sparkline` drew its error state as a static dash. The dash is now the
    button: at 120×36 there is no room for a control beside it.
  - **`sv-toolbar` gains `loadError` + `retryLoad`** (⚠ new inputs, no breaking
    change). Its existing `error` means *"the action you just triggered
    failed"* — the control group stays on screen and you retry by clicking that
    action again, which is why its strip is deliberately not retryable. The
    **definition fetch** failing is a different event with nothing left to
    click, and it had no state of its own. Splitting them follows the
    `sv-agent-task-queue` precedent: where `error` already means something
    else, the load states take the `…Load` spelling.
- `check:ui` gains **`data-retry-unreachable`**: a declared `retry` / `retryLoad`
  must appear somewhere other than its own declaration. It ignores both TS and
  HTML comments — the first two versions of the rule passed on the very defect
  that prompted it, once because the output's JSDoc says "re-run the failed
  load", and again because the fix's own explanatory comment says "retry".
- The hero now reads **"Every data component"**. 81 components own a server
  collection and all 81 ship the four states (9 more are exempt with stated
  reasons) — but the kit has 203 selectors, and a badge has no backend to wire
  to. Verified separately: all three templates do wire it — admin through
  loading/error/retry, store through skeletons plus empty-state and error-shell,
  ai-ops through an SSE feed's connection state and reconnect.

### Added — charts & accessibility

- **Chart export — PNG, SVG and PDF — in `@styloviz-pro/export`.** A chart is
  already an `<svg>`, so the browser rasterises it natively: **PNG and SVG need
  no runtime dependency at all**, and PDF needs `jspdf` alone, not the
  `html2canvas` that `svElementToPdf` requires for arbitrary DOM.
  - `[svChartExport]` is a directive, not a control on each chart. The shared
    `<sv-chart-frame>` lives in FREE `@styloviz/core`, so Pro export UI cannot go
    there, and the alternative was 52 copies of the same menu. A host opts in
    with `<div svChartExport #x="svChartExport">` and calls `x.png()`.
  - Computed paint styles are inlined onto a clone before serialising. Without
    that step a serialised SVG is a separate document that cannot see the page's
    stylesheet, so every Tailwind class resolves to nothing — the chart exports
    black-on-transparent, and any `fill: none` trend line becomes a filled blob.
    Verified by rendering both paths in headless Chromium.
- **120 decorative `<svg>` elements are now `aria-hidden="true"`**, across 25
  files — the whole rich-editor toolbar, every notification-center action, the
  carousel arrows, the image gallery, the widget grid. Each sits inside a control
  that already carries an `aria-label`, so the graphic was being exposed to
  assistive tech on top of a name that already described it.
- **Every unlabelled `<svg>` in the kit is now resolved — 0 findings, down from
  150.** Three of them were not tidiness but broken controls: an icon-only
  *Remove* button in the kanban list, *Add a note* in the scheduler and *Clear
  search* in the tree view had no accessible name at all, so a screen reader
  announced each as just "button". They now carry real labels. The tag-input
  spinner is announced as "Loading suggestions" rather than hidden, because it
  reports state. The rest were decoration and are `aria-hidden`.
- `npm run check:pipes` — a pipe used in a template must be in the component's
  `imports: []`. `NG8004` is reported by `ng build` and nothing else, since an
  unresolved pipe still parses cleanly. Ignores `|` inside string literals, which the
  API-reference tables are full of (`{ type: 'number | null' }`).
- `npm run check:host-bindings` — every `host.<member>` in a showcase template must
  exist on `ComponentShowcaseComponent`. The showcase is one host plus eight children
  binding back through it 1739 times, and a wrong name there is invisible to every fast
  check: `tsc` does not typecheck Angular templates, `check:demo-api` only resolves
  `<sv-*>` bindings, and an unknown property still parses. Only `ng build` caught it.
- `check:ui`'s `svg-not-hidden` counts **`title`** as an accessible name — the
  HTML accessible-name algorithm falls back to it, so `<button title="Move
  left">` IS named. Leaving it out put eight already-named buttons in the
  needs-a-human bucket.
- `check:ui` gains **`svg-not-hidden`**, which splits the case in two: an `<svg>`
  inside a *named* ancestor FAILS (the intent is unambiguous and the fix is
  mechanical), while one with no name anywhere WARNS — that might be decoration
  or it might be meaning with no label, and guessing `aria-hidden` there deletes
  information rather than tidying it. 79 warnings are tracked, 0 failures.
  The rule walks a tag stack rather than grepping, because `aria-hidden` is
  inherited and a grep reports every icon inside a hidden wrapper.

### Fixed — export

- **gantt's CSV was the fourth hand-rolled copy.** It emitted bare `LF` (Excel on
  Windows reads a bare LF as one long line in some locales), quoted every field
  unconditionally, and duplicated the download helper. It now uses `svToCsv` /
  `svDownloadText` from `@styloviz/core` like the other three, and the column
  switch it does keep is shared with the Excel export so the two formats cannot
  disagree about what a column contains.
- Both components now inject `DOCUMENT` instead of reaching for the global, so
  exporting is SSR-safe and testable.

### Changed

- `PACKAGE_DESCRIPTIONS` in `scripts/lib/kit-data.mjs` is keyed by the full
  package name. Keyed by base name, `@styloviz/display` and
  `@styloviz-pro/display` collided and the free README advertised Pro members.
- Four new Pro packages: `@styloviz-pro/overlays`, `@styloviz-pro/commerce`,
  `@styloviz-pro/display`, `@styloviz-pro/layout` — 82 packages in total.

**Part two — accessibility, correctness and packaging.**


An accessibility, correctness and packaging release. It carries breaking output
renames, so it is a minor bump rather than a patch.

### ⚠ Breaking

**Outputs renamed away from native DOM event names.** An output called `select`,
`change` or `cancel` collides with the native event of the same name, so
`(select)` on a component was ambiguous with the DOM's own event.

| Component | Was | Now |
| --- | --- | --- |
| `sv-list-view`, `sv-list-view-pro` | `(queryChange)` | `(searched)` |
| `sv-address-card` | `(select)` | `(addressSelected)` |
| `sv-address-form` | `(cancel)` | `(cancelled)` |
| `sv-filter-panel` | `(change)` | `(filterChange)` |
| `sv-gauge-chart` | `(select)` | `(selected)` |

```diff
- <sv-list-view [serverSide]="true" (queryChange)="load($event)" />
+ <sv-list-view [serverSide]="true" (searched)="load($event)" />
```

`list-view`'s rename is the load-bearing one: `query` is a `model()`, which
already owns an output named `queryChange`, so the explicit debounced output was
claiming the same binding name. The documented "debounced by `debounceMs`, never
emitted twice for the same term" contract could not be relied on. `[(query)]` is
unchanged — only the debounced notification moved to `(searched)`.

**Duplicate outputs removed.** `sv-ai-token-dashboard`'s `periodChange` and
`sv-cart-line-item`'s `quantityChange` were declared twice — once implicitly by a
`model()`, once explicitly. **Template bindings are unchanged**; only *programmatic*
access breaks, because a `model()` owns its `Change` output as binding metadata
rather than as a class member:

```diff
- component.periodChange.subscribe(p => …);   // no longer a class member
+ component.period.subscribe(p => …);         // the model IS the output
```

**Directive selector prefixed.** `DtAutoFocusDirective`, exported from both
data-table tiers, now matches the kit's `sv` prefix convention:

```diff
- <input [dtAutoFocus]="true" />
+ <input [svDtAutoFocus]="true" />
```

**New peer dependencies.** These were always imported but never declared, so a
standalone install resolved only by accident when a workspace hoisted them:

- `@styloviz-pro/rich-editor` → `jspdf` and `html2canvas`, both **optional**
  (they back the PDF/image export actions and load via dynamic `import()`)
- `@styloviz-pro/file-upload`, `@styloviz-pro/tag-input` → `@angular/forms`

### Added

- **`createAnchorScrollGuard`** (`@styloviz/core`) — shared guard for portalled
  panels. A scroll *event* is not the anchor having *moved*; this re-measures and
  only closes when it genuinely did.
- **`SvStopPropagationDirective`** (`@styloviz/core`) — replaces 37 hand-written
  `(click)="$event.stopPropagation()"` bindings.
- **`createFieldError` + `<sv-field-error>`** (`@styloviz/core`) — one validation
  error contract, rendered by all 22 form controls; a server error self-expires
  when the user edits the field.
- **`sv-filter-panel`**: `debounceMs` (default `300`). The price inputs are bound
  to `(input)`, so a host wired to an API previously received one request per
  keystroke. `(apply)` and `(clear)` stay undebounced.
- **`sv-click-add-point-chart`**: keyboard support. Adding a point was mouse-only —
  the handler needs a pointer position. Enter/Space now append at a fixed step.
- **`sv-data-table`, `sv-data-table-pro`**: mobile card rows are keyboard
  activatable. Keys originating in the row's own checkbox are ignored so Space
  keeps its meaning there.

### Fixed

- **Enter did nothing on `sv-dropdown-menu` and `sv-popover`.** Both bound
  `toggle()` to `(click)` *and* `(keydown.enter)`. Enter on the projected trigger
  fires `keydown` **and** a browser-synthesised `click`, so the panel opened and
  instantly closed.
- **Same double-fire** on `sv-tag-input`'s remove button (both tiers) and an
  `sv-event-calendar` chip.
- **`sv-mention` closed itself the moment it opened** — two independent causes: an
  uncancellable 150 ms blur timer, and the panel's own insertion queueing a scroll
  event the component then acted on.
- **Portal insertion order across 25 blocks.** Panels were appended to `<body>`
  before being rendered, briefly growing the document and queueing a spurious
  scroll.
- **`sv-select-dropdown`** (both tiers) carried a second scroll listener that
  bypassed its own 400 ms grace window — defeating the guard for exactly the case
  it was written for.
- **WCAG AA contrast.** Code-block syntax tokens (8 of 12 light-mode kinds were
  below 4.5:1, worst 2.60), a chip idiom on 49 elements at 4.39:1, and 52 further
  foreground/background pairs. Icon-only elements are held to 3:1 per WCAG 1.4.11,
  and disabled controls are exempt.
- **Keyboard accessibility: 147 template warnings → 0.** Among the real defects
  found: the Pro date-range-picker calendar could be opened but never used by
  keyboard; `sv-cascader` options had no keyboard path at all; the `sv-rich-editor`
  and `sv-event-calendar` dialogs had no Escape.
- **`sv-file-upload`** (both tiers): timer handles typed as `number` only held
  while Node's types were out of scope.
- **The published API tables were missing 25 members.** The doc generator read a
  member's type with `<([^>]+)>`, which cannot see past a nested generic, so
  anything typed `input<TableColumn<T>[]>` or `model<Set<string>>` was dropped
  without a word. `columns`, `actions` and `selectedIds` on both data-table
  tiers, `selectedIds` / `checkedIds` / `bulkHotkeys` on list view, `expandedIds`
  on tree view, `featureFlags` on the Gantt chart, `guardRules` on the Pro
  stepper and the `pendingIds` family on four components had shipped for months
  with no row in any README or docs page. The same pass also invented three
  members that never existed, by reading `value = model()` and
  `searched = output()` out of the prose in a JSDoc comment.
- **Code samples that did not match the components.** The snippets in the
  showcase, the docs pages and the READMEs are plain strings — Angular never
  compiles them — and they had drifted: `<sv-search-bar (queryChange) (search)>`
  for outputs named `searched` / `submitted`, `<sv-input-field type="textarea"
  [rows]="4">` for a field that has neither, `[bones]` on a skeleton loader that
  never shipped the input, `(cancel)` / `(filterRemove)` / `(nodeMove)` for
  `cancelled` / `filterRemoved` / `nodeMoved`, `[masked]`, `[showRing]`,
  `[showSeconds]`, `groupStyle`, `legend`, and a `[(checkedValues)]` two-way
  binding on a plain input.
- **Pro-only props shown under free selectors.** The docs examples for
  `clickable` (stat card), `linear` (stepper), `groupByCategory` (search bar),
  `layout` / `transparent` / `highlightRowId` (data table) and async tag search
  all used the free tag, which does not have them. They now use the Pro tag.
- **Every dropdown-menu trigger in the showcase was missing its chevron.** Nine
  live `<sv-button>`s carried `iconRight`, and the input is `trailingIconPath`.
  Angular reports a mistyped *property binding* but silently drops a static
  attribute that matches no input, so this rendered wrong without ever failing a
  build.
- **`@styloviz/data` usage examples.** The JSDoc on `svDataController` and
  `[svDataSource]` bound `[source]`, `[total]` and `[filtered]` — the alias is
  `svDataSource`, the table input is `totalCount`, and `filtered` picks the empty
  state's `reason` rather than binding to the table.

### Security

- **Angular 21.2.13 → 21.2.18** — closes two XSS sanitization bypasses in
  `@angular/compiler`/`@angular/core`, a DoS in `@angular/common`'s date and
  number formatting, and cross-request data leakage via `HttpTransferCache`.
- **DOMPurify → 3.4.12** (transitively, via `jspdf`) — closes several `IN_PLACE`
  sanitization bypasses.

No runtime advisories remain. The advisories that do remain are confined to build
tooling and are not reachable by shipped code.

### Internal

Regression gates added to `npm run verify`, each covering a defect class that
`tsc`, `ngc` and ESLint were all blind to:

- `model-output-collision` — a `model()` and an explicit `<name>Change` output
  cannot coexist
- `native-activation-double-fire` / `projected-trigger-double-activation` — the
  Enter double-fire, direct and projected
- `portal-insertion-order`, `portal-scroll-close-guard`
- `check:contrast` — same-element pairs against the threshold that governs them
- `check:peer-deps` widened to every runtime import, including dynamic `import()`
- `typecheck:all` now includes `tsconfig.spec.json`, which nothing had ever
  type-checked
- `check:demo-api` — every `<sv-*>` element in the app, the libraries, the
  snippet strings and the published READMEs is parsed and each binding resolved
  against the generated API. Directives and content-projection markers are
  discovered from source rather than listed, so a new one needs no edit. This is
  what turns "the samples happen to be right today" into something the build
  enforces.

`scripts/lib/ng-members.mjs` is now the one comment-aware, nesting-aware reader
for `input()` / `model()` / `output()` members, shared by the doc generator and
the new gate so the two can never disagree about a component's surface.

The kit is at zero ESLint errors *and* warnings across all TypeScript and templates.

---

[0.2.0]: https://github.com/styloviz/styloviz/releases/tag/v0.2.0
