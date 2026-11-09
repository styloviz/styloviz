# Changelog

All notable changes to Styloviz are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
kit follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html): from
1.0.0, a breaking change ships only in a new **major** version (during `0.x` it
bumped the minor).

Every package in the kit shares one version, sourced from `packages.json`.

---

## [2.0.0] — 2026-11-09

The breaking release. Every 1.x API kept only for compatibility is gone, every
thing has one name, and the kit is translatable, locale-correct and WCAG 2.2 AA.

### ⚠ Upgrading from 1.x — one line per break

Run `ng update @styloviz/core` first — or `ng update @styloviz/all` (`@styloviz-pro/all`)
if you installed a bundle. `ng update` only updates what `package.json` lists, so if
npm installed core as an unlisted peer, `npm install @styloviz/core@1` before it. Every
package lists the whole kit as its package group, so the one command moves every free
and Pro package to 2.0 and runs `v2-register-icons`, `v2-pie-family` and
`v2-data-table-responsive`. Then build with
strict templates — a selector or input that is gone fails with its file and line —
and look each one up on `/migrate/v2`, which lists every 1.x selector and exported
class 2.0 takes away. Each line below names the section that holds the full table.

- **Icons** — glyphs are registered per glyph; `ng update` (`v2-register-icons`) keeps
  every icon showing, then trim to what you use. *Changed — Icons are registered per glyph.*
- **Locale** — every display format reads `SV_LOCALE` (defaults to `LOCALE_ID`), not
  `'en-US'` or the browser; bind `locale=""` on a date picker for the 1.x Monday-first
  English. *Changed — One locale for the whole kit.*
- **Labels** — English accessible names, visible text and input defaults are labels;
  output is unchanged in English, and `provideSvLabels()` replaces them. *Added —
  Translatable accessible names; Changed — Visible text / English composed in TypeScript
  / English inside `{{ }}`.*
- **App shell** — `sv-dashboard-shell`, `sv-sidebar`, `sv-topbar` and `sv-footer` are
  slot-based; project your own brand, links and outlet. *Changed — App shell.*
- **Pie charts** — `sv-default-pie-chart(-pro)` is `sv-pie-chart(-pro)` and `sv-donut-chart`
  is `sv-pie-chart-pro variant="donut"`; `ng update` (`v2-pie-family`). *Changed — Pie chart.*
- **Performance chart** — removed; use `renderer="large-data"` on `sv-line-chart(-pro)`.
  *Removed — Performance chart.*
- **Live charts (Pro)** — `sv-live-spline-chart`, `sv-live-stock-chart`, `sv-live-sort-chart`
  removed; use `sv-line-chart-pro [live]`, `sv-candlestick-chart [liveWindow]` and
  `sv-bar-chart-pro sort`. *Removed — Live spline, live stock and live sort charts.*
- **Data table** — `cardOnMobile` is `responsive="cards"` and `sv-record-grid` is
  `responsive="records"`; `ng update` (`v2-data-table-responsive`) renames the input and lists
  each record grid to fold by hand. *Changed — Data table.*
- **Popout (Pro)** — removed; use `sv-popover` with `SV_POPOUT_PRESET`. *Removed — Popout.*
- **Tooltip** — the bubble is portalled by default; `[portal]="false"` restores 1.x.
  *Changed — Tooltip.*
- **Form builder (Pro)** — control ids are `sv-fb-<n>-<path>`; select by `name` or a
  `data-sv-*` hook. *Changed — Form builder.*
- **Stepper** — `verticalRowPaddingClass()` removed. *Removed — Stepper.*
- **Select dropdown** — the 1.x search, async, windowing and bulk inputs are removed; use
  the feature children and `[source]`. *Removed — Select dropdown.*
- **Deprecated members** — every member 1.x kept only to compile is removed, each with
  its replacement in the table. *Removed — Deprecated members across the kit.*
- **AI chat** — `sv-ai-chat` internals moved into the new chat parts; `copyMessage()`
  returns `Promise<boolean>`. *Removed — `sv-ai-chat` internals.*
- **Catalogue** — variants no longer count as components and their demos live in the
  family's gallery; no code change unless a line above names a selector. *Changed —
  catalogue: one name per thing.*
- **Peer dependencies** — some packages need new `@styloviz/*` peers. *Changed — New peer
  dependencies.*
- **Category changes** — behaviour and API changes from the 2.0 build sets, each with its
  own *Migration:* line: *Changed — Data Display / Overlays & Feedback / Forms / AI /
  Charts / Layout / Navigation · migration.*
- **Defaults** — no API change, but defaults that now behave differently. *Changed —
  Behaviour you may notice after upgrading.*


### Added — `ng add`, `migrate-primeng` and `ng update` migrations

- **`ng add @styloviz/core`** sets up an Angular 21 or 22 app in one command:
  - Tailwind 4, the kit stylesheet and an `@source`;
  - a PostCSS config, and `provideStyloviz()` in `app.config.ts`;
  - a demo page at `/styloviz`.
  It also adds jspdf's CommonJS modules (`html2canvas`, `canvg`, `raf`,
  `rgbcolor`, `core-js`) to `allowedCommonJsDependencies`, so adding a PDF or
  PNG export later does not fill the production build with warnings.
  It keeps versions you already pin, and running it again changes nothing.
  Proven on fresh `ng new` apps on Angular 22.2 and 21.2 with every kit package
  installed, one page per family: the production build has no warnings and
  every page renders without a console error.
- **`ng g @styloviz/schematics:migrate-primeng`** (new free package
  `@styloviz/schematics`) applies the map `/primeng-alternative` shows:
  - renames all 60 mapped PrimeNG elements in templates;
  - imports the Styloviz classes and drops the PrimeNG modules it no longer needs;
  - adds the packages to `package.json`.
  It reports inputs to translate, directives such as `pTooltip`, and PrimeNG
  components with no equivalent. It is tested on `e2e/fixtures/primeng-app`.
- **`ng update`.** Every package now declares `"ng-update"` with its own
  migrations and the whole kit as its `packageGroup`, so the kit moves together.
  The **2.0.0** `v2-register-icons` migration opts an upgraded app into the full
  glyph set (`provideSvIcons(svAllIcons)`, plus `svAllProIcons` with Pro icons),
  so no icon disappears on upgrade; `v2-pie-family` and `v2-data-table-responsive`
  are described in the Pie chart and Data table sections.

### Added — `@styloviz/mcp` and agent skills

A free MCP server, so a coding assistant asks the kit about itself instead of
guessing. Run it with `npx -y @styloviz/mcp`, or in Claude Code with
`claude mcp add styloviz -- npx -y @styloviz/mcp`. Its tools are `search`,
`get_component`, `list_components`, `find_variants`, `find_icons`, `get_tokens`
and `list_templates`.

- Every answer comes from one index generated from the docs, the showcase demo
  titles, the template registry, the icon sets and the kit stylesheet
  (`scripts/generate-mcp-index.mjs`, `npm run mcp:sync`, part of
  `check:generated`). It ships in the package at the kit's version.
- No dependencies and no network calls. The same questions work from a
  terminal: `npx @styloviz/mcp search "data table grouping"`.
- `skills/styloviz/SKILL.md` (Claude Code) and
  `skills/styloviz/cursor/styloviz.mdc` (Cursor) tell an assistant how Styloviz
  is imported, themed, translated and registered. Both are in the public mirror.
- The Data Table docs gained a "Grouped rows (Pro)" example.

### Added — WCAG 2.2 AA: target size, focus not obscured, dragging

The kit now targets **WCAG 2.2 Level AA**, and `/accessibility` publishes an
Accessibility Conformance Report (VPAT® 2.5, WCAG edition) with a downloadable
copy at `/accessibility/styloviz-acr-wcag22.html`. The report is generated by
`scripts/generate-acr.mjs` from the gates that enforce it, and
`check:generated` fails when it drifts.

- **2.5.8 Target Size (Minimum).** New kit utility `sv-target`: a control drawn
  under 24×24 px keeps its look and gets an invisible 24×24 hit area centred on
  it. Every small control in the kit carries it, and small checkboxes now sit in
  a `<label class="sv-target">`. The carousel's indicators are spaced so their
  hit areas don't overlap. `check:ui` rule `target-size-minimum`; axe's
  `target-size` now runs in the e2e gate (`wcag22aa`).
- **2.4.11 Focus Not Obscured (Minimum).** Every sticky header, footer and
  pinned column declares the edge it holds with `data-sv-sticky`. New directive
  `SvRevealFocusDirective` (`svRevealFocus`, `@styloviz/core`) on a scroller
  scrolls a focused row or cell clear of the bands it measures. A bar stuck to
  the page (`data-sv-sticky="page-top"` / `"page-bottom"`) reserves its band
  through `html { scroll-padding }` in the kit stylesheet. Set
  `--sv-page-sticky-top` on `<html>` when your header is taller than 4.5rem.
  `check:ui` rule `focus-not-obscured`.
- **2.5.7 Dragging Movements.** Every drag now has a single-pointer
  alternative (keyboard alone does not satisfy 2.5.7). Each is listed in
  `scripts/dragging-alternatives.mjs` with its proof in source and a spec that
  taps it. `check:ui` rule `dragging-alternative`.

New single-pointer paths (no new inputs or outputs):
- **Kanban:** a Move button on every card (Move up / down / to a column).
- **Tree view (draggable):** a Move button on every row (Move up / down, Indent / Outdent).
- **Data table:** Narrow / Widen and Move left / right in the Columns panel.
- **File upload:** Move earlier / later buttons beside every grip.
- **Sidebar navigation (Pro):** Narrow / Widen buttons on the resize edge.
- **Splitter:** step buttons on the gutter, on by default.
- **Range slider:** a tap on the track moves the nearer thumb.
- **Image cropper:** tap to place the crop box, Shrink / Grow, and pan buttons.
- **Line chart brush:** Zoom in / out and Pan left / right.
- **Gantt:** an Edit button on the selected bar, which opens the task dialog. Without the command bus, that dialog now saves dates through the same commit as a drag.
- **dnd-list kanban variant:** Move up / down within a column, with the move buttons always visible.

**Also fixed by the WCAG 2.2 scan of every route:**
- Small icon buttons are now real 24 px boxes: alert-banner dismiss, dnd-list, pivot-table, breadcrumb menu, splitter steps.
- Clear buttons, the number input, mini-calendar days, sidebar group toggles and breadcrumb links have 24 px minimums.
- The event-calendar planner keeps its day columns at least 88 px and scrolls sideways on phones.
- The heatmap calendar adds a "Go to a day" field as the 24 px equivalent of its 13 px squares.
- The range slider's tap strip is the equivalent of its stacked thumbs.
- `sv-heatmap-chart` warns in development when `cellSize + gap` is under 24.
- A hidden tooltip is now `inert`, so nothing inside it takes focus.

### Changed — Icons are registered per glyph

`<sv-icon name="…">` used to resolve against a registry the component imported
whole, so one icon in one button put every glyph in the set into the app: a
production app holding a single `<sv-button>` shipped 186 glyph paths and
92.9 kB gzipped. Now nothing is bundled by name. Each glyph is a definition you
import by subpath and register; the kit's components register their own:

```ts
import { provideSvIcons } from '@styloviz/icons';
import { bellIcon } from '@styloviz/icons/glyph/bell';

providers: [provideSvIcons([bellIcon])]
```

The same one-button app now ships 3 glyph paths and 53 kB. On this site the home
page's script went from 1,318 kB and every glyph in both sets to 805 kB and the
82 glyphs it draws.

**Breaking:**

- **Register the names your templates draw.** A name nobody registered renders
  nothing and warns once in development. To keep the old behaviour while you
  migrate, opt into everything: `provideSvIcons(svAllIcons)` (and
  `svAllProIcons` for `<sv-icon-pro>`), imported from
  `@styloviz/icons/registry` / `@styloviz-pro/icons/registry`. Kit components
  register the glyphs they draw themselves; a name you pass in (a button's
  `icon`, a nav item's icon) is yours to register.
- `provideSvIcons(...items)` takes glyph definitions and/or your own
  name → nodes map, any number of them, and returns `EnvironmentProviders`
  (it was a single map returning a `Provider`). `SV_ICON_REGISTRY` is replaced by
  the `SvIconRegistry` service. New: `registerSvIcons([...])` for a component,
  `SvIconDef`, a `<name>Icon` / `<name>ProIcon` definition for every glyph.
- Import glyphs by subpath — `@styloviz/icons/glyph/<name>`,
  `@styloviz-pro/icons/glyph/<name>`, and free glyphs through
  `@styloviz-pro/icons/free/<name>`. Each subpath is its own small module
  holding that glyph's data (its per-icon component is re-exported from the
  main entry), so a glyph a lazy route imports loads with that route, not in
  the initial bundle. The main entry still exports every glyph and per-icon
  component.

Gates: `check:icon-register` (every kit template registers the glyphs it draws,
every template project provides its own), `check:bundle-size` builds a real
one-button app (`consumer:@styloviz/button`) and caps the glyphs it ships, and
`check-landing-payload` now measures the home page's whole static closure — the
modulepreload list alone had been undercounting it by more than a third.

### Added — Signal Forms on every form control

Every form control in the kit — 27 of them, in 22 families — binds with
Signal Forms' `[formField]` on Angular 21 and 22:

```ts
readonly model = signal({ seats: 5 });
readonly plan = form(this.model, (p) => { min(p.seats, 1); max(p.seats, 250); });
```
```html
<sv-number-input [formField]="plan.seats" label="Seats" />
```

They are ControlValueAccessors, which `[formField]` drives identically on both
majors, so nothing about Reactive or template-driven forms changes. Each docs
page for a form control now ends with a compiled Signal Forms example
(`check:signal-forms`), proven on Angular 21 by `check-angular-compat`.

The inputs Signal Forms writes to by name — `min` / `max` (number input,
slider, rating, time picker, text field), `minLength` / `maxLength` (text
field, rich-text editor) and `pattern` (text field) — now accept any value and
fall back to their default, so `[formField]` compiles on them; a field's
`min()` / `max()` validators set the slider's range and the rating's star
count. Binding them explicitly next to `[formField]` is an Angular error
(NG8022): use the validators. New in `@styloviz/core`: `svNumberOr`,
`svStringOr`, `svBoundOrNull`, `svPatternAttr`.

### Added — Language packs in 12 languages

Every package now exports its labels in English plus eleven translations —
German, French, Spanish, Brazilian Portuguese, Italian, Dutch, Polish,
Turkish, Japanese, Simplified Chinese and Arabic — as
`SV_<PACKAGE>_LABELS_<LANG>` from its main entry point. Pass the ones for the
packages you use; each is typed with the package's full labels interface, and
a bundler drops the languages you do not import:

```ts
providers: [
  provideSvLocale('de'),
  provideSvLabels(SV_CORE_LABELS_DE, SV_DATA_TABLE_LABELS_DE, SV_CHARTS_PRO_LABELS_DE),
]
```

`provideSvLabels()` now takes any number of packs (a single object still
works); later ones win key by key, so your own corrections go last. Plurals
carry each language's CLDR forms (Polish `few`/`many`, Arabic all six), and a
count that arrives pre-formatted still picks the right form. The packs are
machine-translated and awaiting native review. Guide: `/docs/translating`.
Gate: `check:labels` — every pack has every key, translated from the current
English, with the same slots and the plural forms its language needs.

### Changed — `@styloviz/core` is split into entry points; a page loads only the parts it uses

`@styloviz/core` was one module, so a bundler put everything any page used
from it into the initial bundle. Each of its areas is now a secondary entry
point of its own — `@styloviz/core/a11y`, `/ai`, `/data`, `/dev`,
`/directives`, `/export`, `/feedback`, `/forms`, `/gestures`, `/i18n`,
`/layout`, `/models`, `/nav`, `/overlay`, `/persist`, `/security`,
`/services`, `/tokens`, `/virtual` — and every kit package imports from the ones it
needs, so their code loads with the pages that use them. On the Styloviz
site the initial `main` chunk went from 140.5 kB to 58.7 kB (36.3 → 17.4 kB
gzipped) and the home page's script from 855.1 kB to 776.7 kB.

- **`/persist` is small on purpose.** `svPersistState`, `svRestoreState` and
  `svPersistedStore` are what an app's first screen reaches for — a session, a
  consent, a theme — so they have their own entry point. Read them from
  `@styloviz/core/persist` on that path, and `/data`'s loading shells and chart
  frame stay out of your initial bundle; `/data` re-exports them as well.

- **Nothing to change in your imports.** `@styloviz/core` re-exports every
  entry point, so `import { provideStyloviz } from '@styloviz/core'` works as
  before. Importing from an entry point (`@styloviz/core/data`) is the way to
  keep the rest out of a chunk in your own code.
- **One change if you add your own label namespace:** augment
  `SvLabelRegistry` in `'@styloviz/core/i18n'`, where it is declared —
  `declare module '@styloviz/core/i18n' { interface SvLabelRegistry { … } }`.
  An augmentation of `'@styloviz/core'` no longer merges.
- Three text-folding helpers that one entry point shares with another are
  exported as `ɵsvFoldWithMap`, `ɵsvFoldedHits` and `ɵsvUnfoldRange`; the `ɵ`
  marks them internal, as in Angular.

### Added — Right-to-left: the kit mirrors under `dir="rtl"`

Set `dir="rtl"` on the page (or any container) and every component lays out
from the right — with no second stylesheet and no input to set.

- **Logical utilities throughout.** All 1,236 physical-direction utilities and
  styles in the library (`ml-`, `left-`, `text-right`, `border-l`,
  `rounded-r`, `[style.left.px]`, `padding-left:`…) are now their logical
  twins (`ms-`, `start-`, `text-end`, `border-s`, `rounded-e`,
  `inset-inline-start`…), which render identically left-to-right. Where a
  side is meant — centring with `left-1/2`, a position measured in viewport
  pixels, a chart's x axis — the source says why with an `sv-physical:` note.
- **Behaviour follows the direction**, each with an RTL spec: arrow keys in
  the data tables (cells, range selection, column reorder and resize), tree
  views and tree select, kanban, carousel, lightbox, date pickers, month and
  year calendars, OTP input, rating, product tour and the dnd-list board
  (whose move buttons are now named by the way they move); pointer maths in
  column and modal resizing, the rating's half stars and the gantt split
  view; the toggle switch's thumb; panels that align to their trigger's
  start or end edge (breadcrumb, notification centre, mega menu, toolbar
  overflow, workspace switcher, command-palette actions, items-with-more).
- Direction glyphs (next / previous chevrons and arrows) flip; disclosure
  chevrons point toward the inline end.
- **Kept physical on purpose:** the gantt time axis and image compare run
  left to right in both directions (the timeline gets `dir="ltr"`); toast,
  drawer, tooltip and scroll-to-top positions named `left` / `right` keep
  their physical side, as the names say.
- `svLogicalArrowKey(key, rtl)` in `@styloviz/core` swaps ArrowLeft and
  ArrowRight under RTL for code that walks a row of items.
- The modal scroll lock now pads the inline end of `<body>` — the
  scrollbar's side in an RTL page — instead of always the right.
- Gates: `check:ui` `kit-logical-direction` fails on any physical utility in
  library code without an `sv-physical:` reason; `e2e/rtl.spec.ts` lays out
  every component gallery both ways and fails on any box inside a component
  that does not mirror (its own step in CI).

### Changed — English inside `{{ }}` is translatable too

`check:ui` read a template's text with every `{{ … }}` blanked out, so English
typed inside an interpolation — `{{ open ? 'Hide' : 'Reveal' }}`,
`{{ label() || 'Top' }}`, `{{ n === 1 ? 'point' : 'points' }}` — was never
checked. There were 46 such literals in 20 templates. They are now labels in
their packages, translated in all 11 packs, and plurals are ICU plurals
("1 point", "2 points" and the Polish and Arabic forms). `literal-ui-text`
now also reads the literals inside interpolations in text and in
word-carrying attributes (placeholder, title, alt, `aria-label` and the other
ARIA text attributes). Comparison operands (`x === 'cards'`), keys, date pipe
formats and other attributes (class, style, href, data-*) are let through. A
literal that is not language is marked `<!-- sv-i18n-ignore: <why> -->` on its
line or the line above: the pivot table's "Excel" / "PDF" export names are
the one example.

**Added:** `@styloviz/button` has a labels namespace, `button`
(`SV_BUTTON_LABELS` and its packs), for the "Loading" a loading button
announces when `loadingLabel` is empty. New keys in other packages:
- `agentApprovalPro`: `argHide`, `argReveal`
- `charts`: `scatterBinCount`
- `chartsPro`: `scatterBinCount`, `multiAxisSideLeft`, `multiAxisSideRight`
- `commandPalettePro`: `searching`
- `commercePro`: `cardIssuerFallback`
- `dataTablePro`: `groupNoValue`
- `display`: `showLessShort`
- `displayPro`: `commentEdit`, `commentEditing`, `filtersPending`, `filtersUpToDate`
- `embeddingMapPro`: `pointClusterNone`
- `forms`: `ratingReviewCount`, `timePickerPlaceholder`, `timePickerInvalid`
- `guardrailPanelPro`: `ruleStateOn`, `ruleStateOff`, `revealOriginal`, `concealOriginal`, `directionUserPrompt`, `directionModelAnswer`
- `layout`: `scrollToTopShort`
- `promptTemplateLibraryPro`: `closeTemplateEditor`
- `richEditorPro`: `exporting`, `editLinkTitle`, `insertLinkTitle`, `linkSave`, `linkInsert`
- `voiceAssistantPro`: `speakerYou`, `speakerAgent`

English renders as before, except that the scatter chart's bin count now gets
locale grouping from 1,000 up.

### Changed — English composed in TypeScript is translatable too

The last English the registry did not reach was the text components build in
code: status words, relative times ("5 min ago"), chart summaries and table
captions, announcements, notices, validation reasons, and every sentence glued
from fragments. All of it now comes from the package's `*.labels.ts` — one
template per sentence, with named slots and ICU plurals, filled in the kit's
locale — so `provideSvLabels()` translates it like any other label. A new
`check:ui` rule (`literal-ts-text`) fails on any prose literal in library
TypeScript; a literal that is not language (CSS, a regex, a data key, demo
data) carries a `// sv-i18n-ignore: <why>` marker.

English renders as before, with three exceptions: counts in a plural get
locale grouping from 1,000 up ("1,000 rows"); plurals that ignored the
singular are fixed ("1 stage", "1 node", "1 root cause" — no more "(s)");
an unbound `sv-ai-workflow-builder` no longer shows the demo's seven steps
under an empty title; and prompt-library cards show the category's name
("Coding") instead of its id ("coding").

**Breaking:**

- **Helpers take the labels.** Exported helpers that return English take the
  package's labels as a new argument — pass the exported `SV_<PACKAGE>_LABELS`
  (or a component's injected labels). Among them: `svKbdKey`, `svKbdChord`,
  `evaluatePassword`, `svColorName`, `svDiffLines` (labels before `options`),
  `svDiffSummary`, `svValueDiffSummary`, `svToolCallFailureInfo`,
  `svQrScannability`, `svOutputPlan`, `svSankeyNotice`, `svSplitFactors`,
  `svHistogramMarkers`, `svAuditBoxPlotStats`, `svFloatLabel`,
  `svStreamNotice`, `svToChatMessage`, `svMarkdownLossLabel`, `svImportQuery`,
  `svDescribeQuery`, `operatorLabel`, `validateTask` / `validateProjectState`
  (gantt), `svClassifierFields`, `svClassifierGaps`, `svUnreadableLanguageLabel`,
  `svTaskActionNoopMessage`, `svChunkFlagLabel`, `svAnomalyLabel`,
  `svNoiseFloorLabel`, `svShape`, `svFormatSpanMs`, `resolveBarValues`, and the label helpers of the AI packages
  (activity log, artifact panel, citation sources, embedding map, eval
  scorecard, guardrail panel, insight cards, model selector, privacy
  inspector, prompt library, RAG knowledge base, reasoning trace, token
  dashboard, voice assistant, workflow builder, writing assistant). Where a
  required labels argument follows a formerly optional one, that one lost its
  default. Helpers whose callers sit outside an injection context take the
  labels optionally (`toSvDataError`, `svRestoreState`, `svRestoreParams`,
  `svPauseNotice`, `svGapNotice`, the `@styloviz/data` sources, the
  tour / stepper / splitter / gantt restore helpers, the ai-chat-transport
  decoders and readers, `svPasteListSummary`, `svPasteSummary`,
  `svFormatExpectedWait`, `svScaleLabel`, the forms-pro schema validators
  `svFieldErrors` / `svSchemaErrors` / `svSchemaProblems` /
  `svConditionCycles`, and `svCheckAttachment(s)`, `svUnknownAgent`,
  `svResolveAgent`, `svScanSize`, `svScanSample(s)`).
- **English constants stay, built from labels.** `SV_KBD_KEYS`,
  `SV_TOOL_CALL_FAILURES`, `SV_CONFIRM_DIALOG_LABELS`, `SV_FILE_UPLOAD_LABELS`,
  `SV_FILE_UPLOAD_PRO_LABELS`, `SV_BIN_RULE_LABELS`, `SV_QUARTILE_METHOD_LABELS`,
  `SV_RECURRENCE_LABELS`, `SV_MODEL_LIFECYCLES`, `SV_EXPORT_METADATA_POLICY`,
  `SV_ASPECT_PRESETS`, `DEFAULT_SWATCHES`,
  `DEFAULT_ADDRESS_SCHEMAS`, `BLOCK_FORMATS`, `PASSWORD_STRENGTH_LABELS` … keep
  their names and shapes as the English instance of a new `sv…(labels)`
  function, which builds the same table in any language.
- **`sv-ai-chat`:** the `demoUserName` / `demoUserPlan` labels are gone. The
  full-page sidebar's account footer comes from a new `account` input
  (`ChatAccount { name; plan? }`, default `null` — no footer).
- `@styloviz/kbd` and `@styloviz-pro/ai-chat-transport` now peer-depend on
  `@styloviz/core`. A package reads another package's labels
  only through that package's helper (`injectSvKbdLabels()`,
  `injectSvFileUploadLabels()`, `injectSvColorNamer()`). Key caps' words
  (`Ctrl`, `Esc`, `PgUp`…) are kbd labels too.

### Changed — Visible text is translatable too

The labels registry now covers what a sighted user reads, not only accessible
names: template text, `placeholder` / `title` / `alt`, and every English
`input()` default — `nextLabel`, `emptyMessage`, `placeholder`, … now default
to the package's label (`input(this.labels.next)`), so `provideSvLabels()`
changes the default and an explicit input still wins. English renders as
before, except numbers in labels get locale grouping and a few plurals were
fixed ("1 item", "1 task", "1 tool call"). **Breaking (helpers):**
`svPurityLabel`, `svExpiryNote`, `svToolCallRetryWarning`,
`svRecommendationReason` take the labels as a new last argument; `SV_IMAGE_CROPPER_LABELS`,
`SV_EMPTY_STATE_LABELS`, `SV_SIDEBAR_NAV_LABELS` and `SV_ANCHOR_LABELS` moved into
their package's `*.labels.ts` and are re-exported from the old paths. `sv-image-cropper`,
`sv-empty-state`, `sv-sidebar-nav` and `sv-anchor` keep their `labels` input as
a per-instance override over the registry.

### Changed — catalogue: one name per thing

The catalogue now counts **families**. A variant keeps its own docs page, so you
can still find it by name, but it no longer counts as a separate component, and
its demos live in its family's gallery section. Old `/components?c=<id>` links
still open the family's section. Nothing changes in code unless a line below
names a selector.

- **Context Menu is a variant of Dropdown Menu**. It was always
  `sv-dropdown-menu` with `triggerMode="contextmenu"` (or `openAt()` /
  `openAtElement()`). Its demos are now part of the Dropdown Menu gallery, and
  `?c=context-menu` opens that section. No selector or API changed.
- **Password Strength is filed under Forms & Inputs**. It used to be
  under Data Display, where it is still cross-listed.
- **Five charts are now variants of their families.** These are
  catalogue changes only: each one keeps its selector, its API and its docs
  page. Its demos and API tables now sit in the family's gallery section, and
  the old `?c=` id opens that section.
  - **Multiple Axis** (`sv-multi-axis-chart`) → Line Chart. Merging the
    API into `sv-line-chart-pro [axes]` is planned for 2.1.
  - **Date-Time Category** (`sv-datetime-category-chart`) → Line Chart.
    Merging the API into a time x-axis on the line chart is planned for 2.1.
  - **Bubble** (`sv-bubble-chart`) → Scatter Plot.
  - **Radial Bar** (`sv-radial-bar-chart`) → Gauge.
  - **Polar Area** (`sv-polar-chart`) → Radar.
- **Progress Ring is the `circular` variant of Progress Bar**, and
  **Chip Group is the `group` variant of Chip**. `sv-progress-ring` and
  `sv-chip-group` keep their selectors and APIs. `?c=progress-ring` now opens
  Progress Bar and `?c=chip-group` opens Chip.
- **"Compare with" on lookalike pairs**. Nine pairs stay separate
  families because they do different jobs. Each docs page now has a "Compare
  with" section that links to the other page and says how the two differ:
  - Like / Rating
  - Jump Menu / Anchor
  - Expand / Accordion
  - Search Bar / Autocomplete
  - Empty State / Result
  - Thumbnail Card / Product Card
  - QR Code / Barcode (1D)
  - Reasoning Trace / AI Agent Activity Log
  - Agent Task Queue / AI Workflow Builder
- **Choropleth Map and Pin Map are one Map family**. Pin Map is now
  a variant of the family, and its demos sit in the Map gallery section with the
  regions demos. `?c=pin-map` opens that section. `sv-choropleth-map` and
  `sv-pin-map` keep their selectors and APIs for now: merging them into one
  `sv-map` (regions, pins or both) is planned for 2.1.
- **Sidebar Nav is part of the App Shell family**. The family covers
  Sidebar (shell) · Sidebar Nav (tree): `sv-sidebar` is the collapsible
  container and `sv-sidebar-nav` (+ `sv-sidebar-nav-pro`) the navigation tree
  inside it. Sidebar Nav is now a variant of App Shell. Its docs page stays
  under Navigation, its demos are in the App Shell gallery, and
  `?c=sidebar-nav` opens that section. No selector or API changed. The dead
  `sv-sidebar` `(toggleCollapse)` output was already removed in 2.0 (see the
  migration table); `sv-sidebar-nav`'s `(toggleCollapse)` is a live output and
  stays.
- **"Other Types" is dissolved**. It held features, not a chart
  type, and each now lives where it is used:
  - Chart export is a guide, `/docs/exporting-a-chart`, and a Line Chart docs
    example. The live demo is in the Bar Chart gallery.
  - The axis-label template and multi-level label charts are Bar Chart blocks
    and are documented on `/docs/bar-chart`.
  - The high-performance chart is the line chart's new `renderer="large-data"`
    mode (see below).
  - `?c=other-charts` opens the Line Chart section, and `/docs/other-charts`
    redirects to `/docs/line-chart`.
- **One pie family**. The donut is now a variant of the pie chart, and
  the pie chart's selectors lose the `default-` prefix (see the breaking
  section below). The Donut docs page stays, as a variant of Pie Chart, and
  `?c=donut-charts` opens the Pie Chart section.
- **"Live Charts" is dissolved**. Live is a feed, not a kind of chart.
  The page `/docs/live-data` (`/docs/live-charts` redirects there) explains
  how each chart takes a feed. Three components that made up their own data
  are removed, and their abilities now live on the charts they imitated (see
  the breaking section below). The rest are documented with their families:
  - `sv-live-stream-chart` and `sv-click-add-point-chart` with Line Chart;
  - `sv-live-update-chart` with Bar Chart.

  `?c=live-charts` opens the Line Chart section.
- **Record Grid is part of the data table**, as `responsive="records"`
  (see the breaking section below). The Record Grid docs page stays, as a
  variant of Data Table, and `?c=record-grid` opens the Data Table section.
- **Names agree, and a gate holds them**. The new `check:naming`
  (in `verify:static`) checks three things:
  - every component selector is `sv-<name>` or `sv-<name>-pro`;
  - a `-pro` selector has its free twin (a Pro-only component keeps the plain
    name);
  - a docs family's id, gallery id and selector name the same thing, and a
    package's directory is its package name.

  The deliberate exceptions are listed, with reasons, in
  `scripts/naming.allow.json`. `@styloviz-pro/image-editor` keeps its name.
  It is an image-editing toolkit: the cropper, the crop preview, and the filter
  and view-transform functions. Its project directory already matches the
  package, the same way family packages such as `@styloviz/display` are named
  for their domain rather than one component.
- **`/migrate/v2` lists every 1.x name 2.0 takes away**: each
  renamed or removed selector and exported class with its replacement,
  whether `ng update` does it, and its docs page, plus the breaks that rename
  no selector. The new `check:migrate` (in `verify:static`) holds the list
  against the 1.0.2 surface, snapshotted in `scripts/selectors-1.x.json`:
  every gone 1.x name has a row, every row names a real 1.x name that is gone,
  every replacement exists, and every `ng update` migration has its row.
- A gallery API Reference now also lists the selectors of the family's
  variants, taken from the catalogue.
- The headline count is now the family count — Track C alone took it from
  169 to 155 (89 free / 66 Pro); `KIT_STATS` carries the release's figure.
  The old 169 counted variant pages (Spotlight Stat Card, Context
  Menu, the five charts, Progress Ring, Chip Group, Pin Map, Sidebar Nav),
  counted Other Types, Donut, Live Charts and Record Grid as components of
  their own, and missed the Like button.

### Changed — Data table: `responsive` replaces `cardOnMobile` and `sv-record-grid` (**breaking**)

What the table does when there is no room to be a table is now one input,
on `sv-data-table` and `sv-data-table-pro`:

- `responsive="none"` (the default): the table, scrolling sideways.
- `responsive="cards"`: the 1.x `cardOnMobile` card list, unchanged, still
  windowed by `cardRowHeight` under `virtualized` on the Pro table.
- `responsive="records"`: the 1.x `sv-record-grid`, now built into the table.
  Below `recordBreakpoint` (768px) the table becomes a list of records. Each
  record is titled by `recordTitleKey` and lists its fields in a real `<dl>`.
  `priority: 'secondary'` columns sit behind a disclosure, and a labelled
  control drives the table's own sort. `recordView="always"` shows the records
  at any width. The server renders the table.

**`ng update` renames `cardOnMobile` for you** with the
`v2-data-table-responsive` migration. It cannot fold an `sv-record-grid` into
the table it wraps (two configured elements become one), so it lists each
file that uses one.

| Removed | **Migrate** |
| --- | --- |
| `[cardOnMobile]="true"` | `responsive="cards"` (done by `ng update`) |
| `<sv-record-grid [columns] [rows] titleKey="…">` wrapping `<ng-template svRecordTable><sv-data-table …></ng-template>` | One element: `<sv-data-table [columns] [rows] responsive="records" recordTitleKey="…">` |
| `<sv-record-grid-pro>` / `svRecordTablePro` | The same on `<sv-data-table-pro>` |
| `mode="auto"` / `"table"` / `"cards"` | `responsive="records"` / `responsive="none"` / `responsive="records" recordView="always"` |
| `breakpoint` | `recordBreakpoint` |
| `[(expandedIds)]` | `[(recordExpandedIds)]` |
| `[(selected)]` (`Set<string>`) | `[(selectedIds)]` (the table's selection) |
| `[(sort)]` (one `SortState`; the host sorted `rows`) | The table's own sort: it sorts client-side, or emits `sortChange` (a `SortState[]`) server-side. Both views share it |
| `rowActions`, `(actionClick)` | `actions`. Each `handler` runs; there is no separate `actionClick` |
| `SvRecordGridComponent`, `SvRecordGridProComponent`, `SvRecordTableDirective`, `SvRecordTableProDirective`, `RecordGridMode` | `SvDataTableComponent` / `SvDataTableProComponent`, with `DataTableResponsive` and `DataTableRecordView` |

The records view pages with the table: it shows the page the table is on, so
the table's paging bounds it.

### Removed — Live spline, live stock and live sort charts: use the chart they imitated (**breaking**, Pro)

`sv-live-spline-chart`, `sv-live-stock-chart` and `sv-live-sort-chart` are
gone. Each one generated its own data, so each was a demo of another
chart rather than a chart of its own. What each could do that the real chart
could not is now an input on that chart:

| Removed | **Migrate** |
| --- | --- |
| `<sv-live-spline-chart [series]="…" [options]="{ windowSize }">` | `<sv-line-chart-pro [live]="true" [liveWindow]="windowSize" [categories]="times" [series]="series">`, with `chartType="spline"` for the curve. The chart follows the newest `liveWindow` readings as you append them. It turns the draw-on animation off, and a brush zoom wins until `resetZoom()`. Your app supplies the data: append from your socket, or from a `createLiveTicker` if you generate it (see `/docs/live-data`) |
| `<sv-live-stock-chart [data]="candles" [options]="{ windowSize }">` | `<sv-candlestick-chart [sessions]="sessions" [liveWindow]="windowSize" [showVolume]="true">`. Each `OhlcCandle` (`time` in epoch ms) becomes an `SvCandle` with a `label` you format, because the chart never parses a date. `connection`, `reconnectable` and `(reconnect)` are on the candlestick now; `symbol` becomes `title` |
| `<sv-live-stock-chart>` with no `data` (its self-driving demo) | No equivalent: a chart that invents prices is gone. Feed it, as the gallery demo does |
| `<sv-live-sort-chart>` | `<sv-bar-chart-pro [categories]="…" [datasets]="…" sort="descending">` (or `ascending`). The bars slide to their sorted places when the values change. The data table, the Tab order and `(barSelect)` keep your input order. Animate the values from your own feed |
| `SvLiveSplineChartComponent`, `LiveSplinePoint`, `LiveSplineSeries`, `LiveSplineChartOptions` | `SvLineChartProComponent`, `LineChartSeries` |
| `SvLiveStockChartComponent`, `OhlcCandle`, `LiveStockChartOptions` | `SvCandlestickChartComponent`, `SvCandle` |
| `SvLiveSortChartComponent`, `SortBarItem`, `SortDirection`, `LiveSortChartOptions` | `SvBarChartProComponent`, `BarChartSort` |
| `SortDirection` from the `@styloviz/pro` bundle (the live-sort chart's `'ascending' \| 'descending' \| 'random'`) | It now names the data table's sort direction, since the chart's is gone. For a chart's order, use `BarChartSort`. `TableSortDirection` is unchanged |

There is no `ng update` migration for these. None of them is a rename: each
needs data the removed chart used to invent, so the change is yours to make.
The labels only these charts used are gone from `SV_CHARTS_PRO_LABELS` and its
packs: `noCandlesToPlot`, `liveSortTitle`, `pauseAuto`, `autoSort`,
`liveSplineTitle`, `volumeShort`, `bullish`, `bearish`, `liveSortChartName`,
`liveStockChartName`, and `liveSortItemAlpha` … `liveSortItemTheta`.

### Changed — Pie chart: `sv-pie-chart`, and the donut is `variant="donut"` (**breaking**)

The pie chart is now `sv-pie-chart` (free) and `sv-pie-chart-pro` (Pro).
`sv-donut-chart` was a pie with the middle cut out, so it is now
`sv-pie-chart-pro variant="donut"`. **`ng update` does all of this
for you** with the `v2-pie-family` migration, in templates (`.html` and
inline) and TypeScript. It also adds `[size]="220"` to a migrated donut that set
no size, to keep the 1.x donut's size.

| Removed | **Migrate** |
| --- | --- |
| `<sv-default-pie-chart>`, `SvDefaultPieChartComponent` | `<sv-pie-chart>`, `SvPieChartComponent` |
| `<sv-default-pie-chart-pro>`, `SvDefaultPieChartProComponent` | `<sv-pie-chart-pro>`, `SvPieChartProComponent` |
| `<sv-donut-chart>`, `SvDonutChartComponent` | `<sv-pie-chart-pro variant="donut">`, `SvPieChartProComponent` |
| `DefaultPieChartOptions`, `DonutChartOptions` | `PieChartOptions`. Its `thickness`, `centerLabel` and `centerSubLabel` (Pro) apply to the donut |
| `DonutSlice` | `PieSlice` (the same fields, plus an optional `description`) |

What changes for a donut after the migration:
- It uses the pie family's palette: the first slice is indigo, where the 1.x
  donut's was blue.
- Its ring is 10px inside the box (it was 8px), and a hovered slice moves out
  by `explodeOffset` (10px by default; it was 6px).
- It shows the hovered slice in the hole, as before, and never also in a
  floating tooltip.

`sv-gradient-donut-chart` is unchanged.

The keyboard model the donut had now applies to both pie charts. A slice is a
tab stop, with `role="button"`, only when the legend is hidden. While the
legend is shown its buttons are the keyboard path, so each datum is in the tab
order once, not twice. A focused slice also highlights like a hovered one.

### Removed — Performance chart: use the line chart's large-data renderer (**breaking**)

`sv-performance-chart` (`@styloviz/charts`) and `sv-performance-chart-pro`
(`@styloviz-pro/charts`) are gone. "High performance" was a way of drawing a
line, not a kind of chart, so it is now a mode of the line chart:
`renderer="large-data"` on `sv-line-chart` and `sv-line-chart-pro`.
- For each horizontal unit of the plot it keeps the lowest and highest
  reading, plus the readings beside a gap, so every peak and trough is still
  drawn. The old chart sampled points at a fixed step and could miss a spike.
- Markers, data labels and per-point colours are off, and the x-axis labels
  are thinned.
- A note under the plot, and above the screen-reader table, says how many
  points were drawn. Hovering reads the exact value under the cursor.
- With `zoomable`, the Pro chart recomputes the outline for the visible
  window.

`SvPerformanceChartComponent`, `SvPerformanceChartProComponent` and their
labels (`performanceChart`, `performanceTitle`, `pointsBadge`,
`performanceNote`, `performanceFootnote`) are no longer exported. The new label
is `largeDataNote`. `svDecimateIndices()` is exported from `@styloviz/core`.

| Removed | **Migrate** |
| --- | --- |
| `<sv-performance-chart [data]="values" />` | `<sv-line-chart renderer="large-data" [categories]="labels" [series]="[{ label: 'Series', data: values }]" />`. The line chart needs one category per reading, such as timestamps or `'#1'…'#n'` |
| `<sv-performance-chart-pro …>` | `<sv-line-chart-pro renderer="large-data" …>`, the same way |
| `options.showArea` | `fill: true` on the series |
| `options.showGrid`, `options.animationDuration` | `options.showGrid`, `options.animationDuration` (unchanged names on `LineChartOptions`) |
| `options.pointCount` (synthetic benchmark) | no equivalent. Bind your own series |
| `title`, `height`, `loading`, `error`, `emptyMessage`, `filtered`, `(retry)` | the same inputs and output on the line chart |

### Added — A landing page and a walkthrough for every template

- **One landing page per template** at `/angular-templates/<id>`, all 23,
  prerendered and in the sitemap: what each page of the template does, with
  its real route, the kit components it is built from (pinned to the
  template's imports by a spec), an estimate of building it yourself, and an
  FAQ. Free templates say MIT; Pro ones say so.
- **A 90-second walkthrough video for every template**, free ones included.
- **A spec for every page** of the HRMS, LMS, POS, real-estate and chat
  templates (29 pages), which found and fixed: HRMS selects that opened on
  the first option instead of the stored value (timesheet person, directory
  department / site / manager, payroll correction); an LMS assignment with no
  questions that could never be handed in (it now takes a submission note);
  the POS shift count that stayed stale after a reload, and a register page
  with no heading; the chat search's Clear filters button, which did nothing.
- **The CRUD, mail and files templates' `baseUrl` now connects them.** It was
  declared and never read. Empty, the demo data is served through the same
  path; set, the store loads with one GET and saves each decision as one
  `POST {baseUrl}/changes`, applied at once and put back with a message if the
  server refuses it.
- **AI Ops Playground** sends to `POST {baseUrl}/playground/messages` once a
  `baseUrl` is set (it was always simulated). **Real estate:** Undo after
  deleting a saved search or cancelling a viewing now reaches the server, not
  only the screen. **Calendar** offers the day view its README promised.
- Template READMEs and CUSTOMIZING guides corrected where they described
  code that did not exist (a full-page CRUD form, "slot" pages in AI Ops, a
  running balance on POS movements, three estate endpoints of eight).

### Added — `sv-scheduler`: drag to move and resize, keyboard moves, 24 px bookings (Pro)

Three gaps found building the bookings template are closed in
`@styloviz-pro/scheduler`.
- **Every booking is a 24 px target.** A 15-minute booking on the 48 px-an-hour
  grid used to be 12 px, under WCAG 2.5.8. Each booking's box is now at least
  24 px along time, and the lanes are laid out on those boxes, so two short
  back-to-back bookings sit side by side instead of one covering the other. The
  clash ring still comes from the real times. Day columns widen to keep each
  lane at least 24 px, and all-day chips above them are 24 px tall. The
  resource-day slots are at least 24 px too (they were 20 px at
  `slotMinutes` under 25).
- **The tab stop is never under a booking.** Time under a booking is no longer a
  slot: it is drawn but is not a control. The roving tab stop lands on the
  first free slot (or the free slot nearest the one last used), the arrow keys
  step over bookings, and across resources they land on the nearest free slot.
  When every slot is booked, the bookings are the tab stops. A drag-to-book now
  follows the pointer by position, so it can still run across a booking (a
  double booking under `'warn'`).
- **Drag to move and resize.** With `editable`, a booking drags to another time
  and resource, and to another day in the week and month timelines. Its end
  edge drags to resize it in the single-day views. Both snap to `slotMinutes`.
  On touch it lifts on a long press, so a finger that moves first still
  scrolls. The drop target is drawn as you go: dashed, and red with a reason
  when it would be refused.
- **Keyboard moves**, in `sv-kanban-board`'s vocabulary. Space picks a booking
  up. The arrows along time move it a slot (a day in the week and month
  timelines), and the arrows across move it to the next resource. Shift with an
  arrow changes its end. Space or Enter drops it, Escape cancels, and Tab away
  cancels. Each step is said in a live region.
- **One judge.** Every drop, keyboard move, dialog Save and `requestEventChange`
  goes through `svCheckEventEdit`, the dialog's own check (read-only, end
  before start, blocked time, the overlap rule). The new `canMoveEvent` then
  lets it through or refuses it (`true` / `false` / a reason). A refusal is said
  in the status line and the live region and is emitted as the new
  `eventMoveRefused` (`{ event, edit, source, reason, message }`) instead of
  `eventChange`.
- **Same output.** A move is emitted through the existing `eventChange`.
  `SvEventChange` gains an optional `source: 'dialog' | 'drag' | 'keyboard' |
  'api'`, so a host that applies dialog edits with `svApplyEventChange` gets
  drag for free. A recurring booking moves one occurrence, the dialog's
  default, and the status line says so.
- **New API.** `eventDrag` (default `true`; drag and keyboard moves need
  `editable`) and `canMoveEvent` on `sv-scheduler`, plus the `eventMoveRefused`
  output. `CalendarEvent.readOnly` locks a booking in both views: its dialog
  is read-only, and every move path refuses it. The new exported types are
  `SvEventMoveGuard`, `SvEventMoveRefusal` and `SvEventChangeSource`. Eight new
  `schedulerPro` labels are added in all 12 packs, machine-translated.
- **Bookings template.** The workarounds are gone. The review appointment is
  15 minutes (£18.00 + VAT), the grid opens at the earliest working hour
  (08:00), and appointments drag on the schedule. Each move is checked first by
  the store's own rule as the scheduler's `canMoveEvent`, then saved
  optimistically with a rollback. Appointments that are no longer booked are
  drawn read-only, and Delete is still refused (cancel with a reason).

### Added — AI support site template: a help centre whose assistant cites its sources and hands off to a person (Pro)

Seven routes at `/templates/support` — the help centre, a topic, an article,
the assistant full page, contact, a ticket status page and the team's
insights — over one `SupportStore` provided on the template's root route, with
the assistant in a chat bubble on every page but Ask. In demo mode answers come
only from the bundled help articles: there is no language model and nothing is
sent anywhere; README, landing and screens say so, and the assistant says it is
automated.
- **Retrieval, not a fake model.** Every article section is scored against the
  question with BM25 over folded, stemmed word tokens; the answer is the best
  sections' own words, each cited and linked to its `#section`. Below a score
  and coverage threshold — a word the help centre never uses weighs the most —
  it says it could not find the answer and offers a person. Deterministic, no
  `Math.random()`, pinned for a set of known and unknown questions.
- **One streaming path.** Demo answers play as `@styloviz-pro/ai-chat-transport`
  parts through `svApplyPart` on an injectable scheduler; with `baseUrl` set,
  `POST {baseUrl}/answers` is read as server-sent events through `svSseReader`.
  Only `source` parts that resolve to a real section become citations. The
  answer is announced once, complete, never per chunk.
- **The bubble** lives in the layout, so the conversation survives every route
  change: a launcher inside the safe-area insets, a full-height sheet with the
  page inert behind it on phones, Escape back to the launcher, an unread dot.
  A followed citation scrolls to its section, highlights it and focuses it.
- **Handoff to a person** — from the bubble, a not-found answer, a thumbs-down
  or the contact page — validates name and email field by field and opens a
  ticket in the helpdesk template's shape with the transcript attached, so one
  `POST {baseUrl}/tickets` connects the two. Optimistic: the visitor lands on
  the ticket page at once; a refused save is rolled back there, with Send again.
- **Feedback and insights.** Thumbs up or down per answer with "What was
  missing?", "Was this helpful?" per article, and a team page — labelled as
  such — with questions asked, answer rate, feedback, the top unanswered
  questions and the handoffs, all derived from the conversations.
- Cobalt / iris palette with AA-safe fills; search highlights matches as text;
  every write rolls back on refusal; one spec per page, and a landing page at
  `/angular-templates/support`.

### Added — Blog / agency site template: a publication first, with the agency as its frame (Pro)

Seven routes at `/templates/blog` — home, the post index, an article, a tag, an
author, services and contact — over one `BlogStore` provided on the template's
root route. The writing is the product: the home page leads with the featured
post, and the agency's three services and enquiry form come after it. It has
no case-study pages (the portfolio template's job) and sells nothing but the
agency's time (unlike the launch template). The agency is fictional and the
demo sends nothing anywhere.
- **Every list is derived.** Posts are the one list stored; reading time, tag
  counts, the archive by month, related reading (most shared tags, then the
  same series, then the newer), previous / next and series navigation are
  computed from the posts public on an injectable clock — so a draft, or a post
  scheduled for next week, never appears, not even as a count.
- **Markdown, never HTML.** Post bodies are split at their `##` headings — each
  a table-of-contents entry with its own anchor, focus following the link —
  and rendered by `sv-streaming-markdown`, with fenced code in `sv-code-block`
  scrolling inside itself. A `<script>` or an `onerror` image in a post is
  shown as text; a `javascript:` link is dropped.
- **Filters in the URL.** Search, tag, author, month and page are query
  parameters bound to the index's inputs and validated on the way in, so a
  filtered list can be linked and the back button works; the empty state tells
  "no posts yet" from "no posts match", with Clear filters.
- **Articles** show both dates when they differ, reading time, series, related
  posts, plain share links built through the kit's URL check (no third-party
  scripts) and Copy link, and set the document title and meta description.
- **Two optimistic forms.** A double opt-in newsletter sign-up and a validated
  enquiry (budget bands in integer minor units, consent required), each in the
  store at once and rolled back with the reason if the save is refused.
- Vermilion / ink palette with AA-safe fills and a serif display face; one spec
  per page, and a landing page at `/angular-templates/blog`.

### Fixed — HRMS cover chart and calendar stand-up on some dates

- **HRMS overview:** the four-week cover chart could repeat an axis label
  when holidays pushed twenty working days past a month (from 3 December
  2026 it would have shown "4" twice) — and the label is the chart's track
  key, so the chart failed to render. A day of the month that comes round
  again now names its month (`hrmsCoverLabels`), checked for every start
  day from 2026 to 2028.
- **Calendar:** the demo's weekday stand-up series began on whatever day
  fell two weeks earlier, and a series' first date is always an occurrence —
  so on a Saturday the calendar drew a Saturday stand-up. It now starts on
  that week's Monday.

### Added — Trading desk template: one account, one seeded market, every figure derived (Pro)

Six routes at `/templates/trading` — markets, a trade screen per market,
orders, portfolio, wallet and price alerts — over one `TradingStore` provided
on the template's root route. Prices are a seeded simulation in the browser:
demo data, no real exchange, no custody, not financial advice; README, landing
and screens say so. It packages the admin template's crypto desk as a product.
- **A deterministic market.** One mulberry32 stream per instrument, a day of
  one-minute history walked from the seed, live steps on an injected clock
  that the shell reads only while the tab is visible; `Math.random()` is never
  called. The rail's Pause and +1 min drive the demo.
- **Integer cents and base units.** Notionals round half up to the cent in
  BigInt, fees round up to the cent, typed amounts are parsed as text; the
  rules are pinned in the specs.
- **Trade screen** — `sv-stock-chart` with range presets and SMA, EMA,
  Bollinger, RSI and MACD toggles; a generated order book with depth bars; the
  tape; and an order ticket: buy or sell, market, limit or stop, by quantity or
  total, GTC or IOC, fee and total previewed, balance checked, then confirmed.
- **Holds and fills are derived.** A live buy holds notional + fee, a sell holds
  the coin, so cancelling releases the hold; a resting limit fills at its price
  when the market crosses it, in part when it is bigger than the book; a stop
  triggers and takes the book; a market order's remainder expires.
- **Portfolio by average cost** with fees in cost — unrealised and realised
  P&L, allocation and the account's value at each hour, from the fills.
- **Wallet** — deposits and withdrawals with an address, a network fee and a
  confirmation step, pending to confirmed on the clock; a withdrawal above
  what is available is refused. **Alerts** fire once, with a toast.
- Bullion gold / harbour blue palette with AA-safe fills; gains and losses
  carry a sign and an arrow, never colour alone; prices tick without an
  `aria-live` region. Mock-or-live data switch with per-record rollback, one
  spec per page, and a landing page at `/angular-templates/trading`.

### Added — Invoicing template: one set of books, every figure derived (Pro)

Twelve routes at `/templates/invoicing` — overview, invoices, new invoice,
invoice, quotes, quote, expenses, ledger, recurring, clients, client and a
client portal — over one `InvoicingStore` provided on the template's root
route, so the portal (under its own minimal chrome) and the admin side read the
same records. It is not accounting software certified for any jurisdiction, and
its tax rates are examples; README, landing and screens say so.
- **Integer cents, priced per line.** Quantity × unit price, a discount rounded
  half up on the gross, tax rounded half up on the net; totals are the sums of
  the lines, so the printed lines add up to the printed total.
- **Nothing derivable is stored.** Paid, partially paid and overdue are read off
  the payments and the due date against a clock the specs control; an expense
  is billed while a live invoice re-bills it; a quote expires by its date; a
  schedule's next run is counted from its start.
- **A double-entry ledger derived from the documents** — invoice, payment, void
  and expense entries are computed, never posted by hand; a trial balance over
  the chart of accounts; manual entries refused unless they balance. Specs pin
  that every entry balances and receivable equals the open invoice balances.
- **Invoices** — a line editor (catalogue item or free line), issue with
  gap-free numbering, a mock email, part payments, void with a reason (never
  delete an issued invoice), duplicate, bulk send, print as a white sheet.
- **Quotes** that convert to a linked draft invoice in one write; **expenses**
  with receipts kept in the browser and one-click re-billing to a client's
  draft; **recurring** schedules whose runs on the 31st land on a short month's
  last day, with pause, resume and Run now; **clients** with a running-balance
  statement and a portal link.
- **Client portal** — open and paid invoices, view and print, accept or decline
  a quote, and pay with `sv-credit-card` (no payment is processed; the screen
  says so), which the admin side sees at once.
- Ledger green / ink blue palette with AA-safe fills, mock-or-live data switch,
  one spec per page, and a landing page at `/angular-templates/invoicing`.

### Added — Bookings template: one availability rule for the schedule and the booking page (Pro)

Nine routes at `/templates/bookings` — schedule, book, appointment, waiting
room, clients, client, practitioners, invoices, invoice — over one
`BookingsStore` owned by the layout, for a clinic, a studio or a salon. It stores
no clinical records and makes no compliance claim: an appointment is a service,
a practitioner, a client, a time, a status and the client's own logistics note.
- **One availability rule.** `sv-scheduler` and `sv-slot-picker` are fed the same
  practitioner hours, blocked time (lunch, training, leave) and appointments,
  and every booking, reschedule and move from the schedule is checked by the
  scheduler package's own engine (`svGenerateSlots` / `svCheckSlot`) with the
  buffer, minimum notice and the practice time zone. A booking made on one page
  is on the other at once.
- **"Anyone available" is honest.** The picker offers a time exactly when the
  engine says at least one practitioner is free then, and confirming books the
  least busy practitioner who is free at that moment.
- **A status machine.** Booked → checked in → in progress → done; no-show once
  its time has come; cancel with one of a fixed list of reasons, which frees the
  slot. Appointments are never deleted.
- **Waiting room.** Expected / checked in / with practitioner / done, waits
  counted live from one clock specs control, Call next, running-late flags.
- **Practitioners.** Services, a working-hours editor and blocked time that
  change what the booking page offers at once, with the appointments a new rota
  strands listed rather than cancelled.
- **Invoices in integer pence.** Tax rounded half up per line, totals summed
  from the lines, part and full payments (paid when the balance is exactly
  zero), void with a reason, print.
- Berry / cyan palette with AA-safe fills, mock-or-live data switch, one spec per
  page, and a landing page at `/angular-templates/bookings`.

### Added — CRM template: a sales pipeline that stores no totals (Pro)

Nine routes at `/templates/crm` — pipeline, deal, leads, contacts, contact,
activities, quotes, quote, forecast — over one `CrmStore` owned by the layout,
so the seven sections are seven readings of one book of business. Qualify a lead
and its deal is already on the board; drag a deal into Won and the forecast's
quarter moves with it.
- **The stage is the status.** Won and Lost are stages, not a flag. A drag (or
  Space and the arrow keys) saves optimistically and is rolled back with a
  message when the save fails. A move to Lost asks for one of a fixed list of
  reasons, and the forecast counts them.
- **Nothing a sales lead reads is stored.** Column count, value and weighted
  value, won this quarter, win rate, forecast by close month (committed / best
  case / pipeline) and attainment against quota are derived from the deals on
  every read.
- **Money is integer cents.** Quote lines are priced quantity × unit price, less
  discount, plus tax, each step rounded half up, and the totals are the sums of
  the lines, so the printed lines add up to the printed total. Only a draft is
  editable; Print sends the sheet alone, in light mode.
- **Leads.** Qualifying creates the contact (and the company when it is new) and
  a deal in Qualified as one write. Import goes through `sv-import-wizard`: a
  duplicate address is a real error row with its spreadsheet row number.
- **Deal and contact pages.** An activity timeline of emails, calls, meetings,
  notes and stage changes; log a call, send a Markdown email, add a note.
- **Activities.** Overdue / due today / upcoming / done, or a month, week or
  agenda calendar; complete one, or schedule a follow-up against a deal.
- Orange / emerald palette with AA-safe fills, mock-or-live data switch, one
  spec per page, and a landing page at `/angular-templates/crm`.

### Added — Four preset themes: Material, Fluent, Paper, High contrast (free)

The kit stylesheet (`@styloviz/core/styles/styloviz.css`) now carries four
whole-kit looks beside the default, each one class on `<html>`:
`sv-theme-material` (tonal purple, tinted greys, Roboto, rounder corners),
`sv-theme-fluent` (communication blue, true greys, Segoe UI, small corners),
`sv-theme-paper` (ink blue on cream, warm greys, a book serif) and
`sv-theme-high-contrast` (every family pushed apart, body text above 7:1). They
restate token values only, so no markup changes, and they work in light and
dark mode. Fonts are named, not shipped. `check:contrast` now scores the whole
kit once per preset as well as in the default palette. Guide: `/docs/themes`;
the switcher is also at the top of every component page on styloviz.dev.

### Added — `sv-slot-picker`: book an appointment (Pro)

New in `@styloviz-pro/scheduler`. It shows a strip of days, each with how many
times are free, and the free times of the chosen day. The duration and the
time zone are controls on the picker.
- **It offers only what the scheduler would accept.** Each time goes through
  `svCheckSlot`, with double booking refused. It honours working hours,
  blocked time, a buffer around each booking, minimum notice, `resourceIds`
  and daylight-saving changeovers.
- **The value.** It carries the business's day and wall time and the UTC
  `start` / `end`. `displayTimeZone` changes only how the times read. A time
  that lands on another day there says "+1 day".
- **Async contract.** `loading` / `error` / `retry` work like the rest of the
  kit. While either state is set, no time is offered, because one could
  already be taken.
- **Empty days.** A closed day and a fully booked day are told apart, and the
  picker offers the next free day.
- **Keyboard.** The days are a tablist. The times are a listbox where arrows
  move and Enter picks.
- **Exported helpers.** `svGenerateSlots()` and `svFirstAvailableDate()` are
  exported for the server-side re-check.
- **New peers.** The package now peers `@styloviz/forms` (the duration
  control) and `@styloviz/input-field` (the go-to-date picker).

### Added — checkpoints: rewind a chat to a turn, or an agent run to a step (Pro)

`sv-ai-chat` takes `checkpoints`, and `sv-agent-task-queue` takes `rewindable`.
- **Chat.** A checkpoint (`{ id, messageId, label?, timestamp? }`) is a marker
  after its message with a Restore button. `svChatTurnCheckpoints(messages)`
  puts one after every finished answer. With `branching` on, restoring sets the
  later messages aside rather than deleting them: the next message starts a
  new branch beside them, and the version switcher still reaches the old path.
  With branching off, `messages` is cut back, and Undo puts the tail back until
  the transcript changes. `checkpointRestore` tells the host what went, so it
  can rewind its agent too. `restoreCheckpoint(id)` and `undoRestore()` are
  public.
- **Task queue.** With `rewindable`, a finished step of a stopped task offers
  Rewind when a checkpoint was saved after it (`checkpoint: false` opts a step
  out). It asks inline first, because the later steps will run again, then
  emits `rewind` with the status the reader saw. `svTaskRewindIsStale()`
  catches a request that arrives late, and `svTaskRewind()` gives the host the
  rewound task.

### Fixed — a follow-up after switching versions landed on the other version

With `branching` on, a message the chat appended (a send,
`beginAssistantMessage`, the demo reply) was linked to the last message in the
array rather than the one on screen. So after switching back to an earlier
version of an answer, the follow-up attached under the newer version and did
not show. It now attaches to the message on screen. A regenerate also stayed
hidden when an older version had been picked; it now shows. Messages a host
appends without `parentId` still link in list order.

### Added — `svGridAssist`: ask the data table in plain words (Pro)

`sv-data-table-pro` takes an "Ask the table" bar. Put
`<ng-container svGridAssist />` inside the table and a question such as "won
deals over 50k in EMEA, biggest first, highlight renewals" becomes the filter
builder's own query, a sort and a highlight.
- The answer goes through `[(filterQuery)]`, so the builder opens on exactly
  what was understood and the user can change it there. `sortChange` and the
  new two-way `highlightQuery` carry the rest, so a `serverSide` table hears
  the usual `queryChange`.
- A resolver (`SvGridAssistResolver`) receives the question, the builder's
  fields, the columns and the current view. It never receives a row. The
  default, `svGridAssistHeuristicResolver()`, reads English on the device;
  pass your own to ask a model, and hand `request.signal` to `fetch`.
- Every answer is checked against the fields before use
  (`svGridAssistCheckAnswer`). Unknown columns, operators a type cannot take,
  values outside an enum and unsortable sorts are dropped and listed in
  `(assisted).skipped`.
- One question runs at a time. Asking again, Cancel or Escape aborts the one
  in flight. A failure offers Try again (`(assistError)`), and Undo restores
  the filter, sort and highlight.
- `[examples]` adds one-click questions. `[showQuery]="false"` keeps the
  builder closed.
- `highlightQuery` also works on its own. Matching rows get a tint, a bar on
  the leading edge and a spoken "Highlighted", and a chip clears it.
- 24 new labels in the 12 language packs (machine-made).

### Added — `sv-smart-paste` and `sv-smart-textarea` (Pro forms)

Two AI-ready form controls in `@styloviz-pro/forms`, each with a gallery, a docs
page and machine-made translations in the 12 language packs.
- **`sv-smart-paste`** — a button that fills a form from text on the clipboard
  (an email signature, a ticket, a `Label: value` list). You describe the fields
  (`{ name, label, type, options, required, aliases, description }`); a resolver
  maps the text to values, and the answer is checked and typed against the
  fields before `(filled)` emits `{ values, skipped, missing, text }` — unknown
  keys dropped, numbers, yes/no and dates coerced, select values held to their
  options. Apply it with `model.update(v => ({ ...v, ...e.values }))` (Signal
  Forms) or `form.patchValue(e.values)`. `confirm` previews what will be filled
  and what was left out; Cancel aborts the request's signal; failures show with
  Try again; where the browser will not share the clipboard a labelled paste
  box opens in place. Resolvers: `svSmartPasteHeuristicResolver` (the default —
  runs on the device, nothing is sent) and `svSmartPasteFetchResolver(url)` (your
  own endpoint). `svSmartPasteCoerce` is exported for a server-side check.
- **`sv-smart-textarea`** — a native textarea with inline completion: a grey
  suggestion after the caret, Tab to take it, Ctrl/Cmd+→ for a word, Escape to
  dismiss, Ctrl/Cmd+Space to ask, an Accept button on touch. Requests are
  debounced and aborted as the user types on; a rejection is reported through
  `(completionFailed)` and never shown. A ControlValueAccessor and validator
  (`required`, `maxLength`) with `[formField]` support. Completers:
  `svSmartTextareaPhraseCompleter(phrases)` (on the device) and
  `svSmartTextareaFetchCompleter(url)` (your own endpoint).

### Added — `svWebMcp`: the big widgets as WebMCP tools for a browser agent

Put `svWebMcp="name"` (from `@styloviz/core`) on a data table, scheduler, event
calendar, Gantt chart, kanban board or form builder and the widget registers
typed tools with `navigator.modelContext` (WebMCP, W3C community draft):
`name_describe`, `name_sort`, `name_move_card` and so on. The tools are removed
when the widget is destroyed. Guide with a live table: `/docs/webmcp`.
- **The same path as a click.** A tool calls the method the UI calls, so
  `sortChange`, `queryChange`, `cardMoved`, `eventChange` and `tasksChange` fire,
  and transition rules, WIP limits, booking rules, read-only inputs and
  validation all apply. New public methods for that: `sortBy`, `setSearch` and
  `selectRowIds` (data table); `moveCard`, `moveCards` and `selectCards`
  (kanban); `editTask` and `scrollToDate` (Gantt); `requestBooking`,
  `requestEventChange` and `goToDate` (scheduler and event calendar), with
  `setView` now public; `svCheckEventEdit`, the event dialog's own check.
- **Arguments are untrusted.** Every call is checked against the tool's schema
  before it runs (`svCheckWebMcpArgs`) and a refusal comes back as text. Tools
  that return the host's data return a page of it and are marked
  `untrustedContentHint`.
- **Your own tools:** implement `SvWebMcpToolSource` and provide it as
  `SV_WEBMCP_SOURCE`, or call `svRegisterWebMcpTools`. `svWebMcpInclude` picks
  tools and `svWebMcpReadOnly` exposes only the read-only ones. The directive's
  `call(name, args)` runs a tool exactly as an agent's call does, with or
  without WebMCP in the browser — for a demo, a test or an in-page assistant.
- **Nothing to download until it is used.** Each widget's tool set is an
  `import()`, and the directive loads nothing in a browser without
  `modelContext`.
- Built in-house rather than on Angular 22's `declareExperimentalWebMcpTool`,
  because the packages still support Angular 21. Inert on the server and where
  the browser has no `modelContext`.
- `sv-form-builder` renders a schema and does not edit one, so its tools fill
  and submit the form (`set_field`, `submit`, `get_payload`); they do not add
  or remove fields.

### Added — Blocks: 54 copy-paste page sections at `/blocks` (45 free, 9 Pro)

Sixteen category pages — navigation bars, heroes, logo clouds, features, stats,
testimonials, pricing, FAQ, calls to action, footers, content and docs, store
sections, sign-in, settings panels, empty states and dashboard sections — cut
from the Launch, Docs site, Store, Auth, Account and Admin templates.
- **One block, one file.** Each block is a standalone, OnPush component with its
  template inline, importing only `@angular/*` and `@styloviz/*` packages and
  registering its own icons, so the file the page renders is the file Copy hands
  over. It works on its own in your app: `/blocks` is deliberately left out of
  the site's all-icons registration to prove it.
- **Blocks emit, your app acts.** Sign-up, contact, newsletter, settings and
  checkout blocks validate and emit (`signUp`, `send`, `subscribe`, `save`,
  `placeOrder`…). The app blocks take `pending` and `error` for the request in
  flight, and links are plain `href` inputs.
- **Marketing blocks are free; app blocks are Pro** — except the sign-in and
  account settings blocks, which are free like the Auth and Account templates
  they come from. A Pro block shows its live preview to everyone, and its code
  and Copy button once a license is active.
- Every category page is prerendered with its blocks and Copy buttons, and is
  listed in the sitemap. The header gains a **Blocks** link.
- **`@styloviz/mcp`** gains `list_blocks` and `get_block`, and `search` returns
  matching blocks. A free block comes with its whole file; a Pro block's source
  is not in the package, only the page where a license unlocks it.

### Added — Gantt: resource levelling, rollups, S-curve, progress line, minute-to-decade zoom and PNG export; Kanban: workflow rules, multi-select, quick edit, card preview and saved views (Pro)

**Gantt (`@styloviz-pro/gantt`)**
- **Resource load and levelling.** `sv-gantt-resource-histogram` draws each
  person's load per day, week or month against capacity. Over-capacity bars are
  red and hatched, and a hidden table carries the figures.
  `svGanttLevelResources` moves tasks later, never earlier, in working days,
  until nobody is booked past capacity. It pushes successors, leaves manual
  tasks and constrained milestones alone, and reports each move with its reason
  plus anything left unresolved. `svGanttResourceLoad` returns the numbers.
- **Rollups.** `svGanttRollup` gives each summary task its dates, its planned
  dates from baselines, working-day-weighted progress, and leaf and done counts.
- **S-curve.** `sv-gantt-s-curve` (and `svGanttSCurve`) plots cumulative planned
  work against work earned up to a data date.
- **Progress line.** `progressLineDate` draws the progress line through every
  task, bending back where a task is behind and forward where it is ahead.
  `svGanttProgressLine` gives each task's point and its variance.
- **Zoom from quarter-hours to decades.** `GanttChartScale` adds `minute`
  (15-minute columns), `hour`, `year` and `decade`. A task given a time now
  draws at that time; a plan written in dates draws as before. Zoom to fit picks
  the finest scale whose columns fit the view (it used to jump to `week`).
- **PNG and PDF export.** `exportPng()` (new) and `exportPdf()` are in both
  Export menus. The scrolled-toolbar copy of that menu also gains Excel, which
  it lacked. `svElementToPng` / `svElementToPngBlob` are new in
  `@styloviz-pro/export`, for any HTML view.
- **Fixed: element export on Tailwind 4 pages.** `svElementToPdf` (and the new
  `svElementToPng`) threw "unsupported color function" on any real kit view,
  because html2canvas cannot read the `oklch()` / `color-mix()` colours Tailwind 4
  emits; the Gantt's PDF export had never worked. Both exporters now resolve
  those colours to `rgba()` on html2canvas's clone, with transitions off, and
  clone only the element's own path instead of the whole page. On the gallery
  page that cut an export from 18–30 s to about a second.
  `svHtml2CanvasOptions` / `svFlattenColors` are exported for hosts that call
  html2canvas themselves.

**Kanban (`@styloviz-pro/kanban`)**
- **Workflow rules.** `transitionRules` sets which column may follow which
  (`allow`, `deny`, `*`, `backward: false`) and what a card needs before it may
  enter a column (`svKanbanRequires`). The rules apply on every move path, and
  `moveRefused` now carries `reason` and `missing`.
  `svKanbanCheckTransition`, `svKanbanTransitionsToCanMove` and
  `svKanbanAllowedTargets` are exported.
- **Multi-select.** `multiSelect` with a two-way `selectedCardIds`:
  Ctrl/⌘+click or Ctrl/⌘+Space toggles a card and Shift extends the selection,
  shown as `aria-pressed`. Dragging a selected card moves the whole selection as
  one `cardsMoved` with one `rollback()`, refused as a whole if any card may not
  go or a strict limit has no room.
- **Quick edit and card preview.** `sv-kanban-quick-edit` is a draft editor for
  a card (title, description, priority, due date, assignees) that emits the
  patch. `svKanbanCardPreview` shows one body-portaled preview beside a hovered
  or focused card, referenced by `aria-describedby`.
- **Saved search and sort.** `sv-kanban-view-bar` with `svKanbanApplyView`
  searches every word, ignoring case and accents, and sorts stably. The view is
  remembered under a `storageKey` through `svKanbanViewStorage`, and the saved
  form is versioned and validated.
- The card-text helpers moved to `kanban.format.ts`. The component's
  `formatDue`, `fmtVal` and similar methods are unchanged.

### Added — Rich text editor: find & replace, track changes and comments, revision compare, slash commands, checklist, outline, emoji, Word import and a collaboration adapter in `@styloviz-pro/rich-editor` (Pro)

Everything is opt-in. An editor that asks for none of it renders and emits as
before, except that the full toolbar now holds 35 tools (Checklist and Emoji are
new).

- **Find & replace.** `sv-rte-find-replace [editor]="ed"` claims Ctrl/⌘+F inside
  that editor. A match can span formatting but never two paragraphs, and mention
  chips are skipped. Matches are painted with the CSS Custom Highlight API, so
  opening Find never changes the document. Replace all is one undo step. Match
  case, whole word, Enter / Shift+Enter, and Escape all work.
- **Track changes.** The `svRteSuggest` directive records typing, paste, drop
  and deletion as `<ins>` / `<del>` tagged with the author and time
  (`data-sv-sugg`, `data-sv-author`, `data-sv-author-id`, `data-sv-time`). It
  listens on `beforeinput`, so autocorrect and mobile keyboards are tracked too.
  Use `suggestions()`, `accept` / `reject` / `acceptAll` / `rejectAll` and
  `resolved`. Deleting your own suggestion really deletes it. Formatting and
  new paragraphs are not tracked.
- **Comments.** `sv-rte-comments` anchors a thread to the selected passage with
  `<mark data-sv-comment>`. `threads` is a two-way model, with `threadCreate`,
  `replyAdd` and `threadResolve` outputs, loading, error with retry, and an
  empty state. A thread whose passage was deleted stays and says so.
- **Revision compare.** `svDiffHtml(before, after)` aligns the two documents
  block by block, then diffs each changed block word by word into `<ins>` /
  `<del>`, with word counts. `svDiffWords` does the same for plain text.
- **Slash commands.** `[slashCommands]="true"` adds a `/` menu with headings,
  lists, checklist, quote, code block, table and divider; you can also pass
  your own list. Every pick is emitted as `slashCommand`. It opens only at a
  word boundary, so `and/or` and URLs never trigger it.
- **Checklist.** A toolbar tool and a slash command that use the Markdown
  task-list markup, so a checklist round-trips through Markdown mode. A click
  or Ctrl/⌘+Enter ticks an item. The state is the `checked` attribute.
- **Outline.** `sv-rte-outline [editor]="ed"` lists the headings live, marks
  the current one with `aria-current`, and scrolls to the heading you choose.
  It writes no ids into the document. `svRteOutline()` returns the same list.
- **Emoji.** An `emoji` toolbar tool opens a body-portaled picker with search
  and a one-tab-stop grid.
- **Word import.** `svDocxToHtml(file)` reads a `.docx` in the browser with no
  dependency, using its own zip reader on `DecompressionStream`. It maps
  headings, inline formatting, lists from `numbering.xml`, safe links, and
  tables with merged cells. `lost` reports images, footnotes, Word comments,
  text boxes, equations, tracked changes and fields it could not carry over.
  Zip bombs and DOCTYPEs are refused, with an `SvDocxError` reason.
- **Collaboration adapter.** `svRteCollab` connects an editor to any
  `SvEditorCollabAdapter` (connect, send, receive, presence, disconnect). It
  applies remote HTML without moving the caret (`applyRemoteHtml`), never
  echoes a change back, and sends edits made while offline on reconnect.
  `svCreateMemoryCollabHub()` is the in-memory fake peer for tests and demos,
  and `svTextSplice` is what a CRDT adapter applies. The kit ships no
  transport; the gallery shows a Yjs adapter as code.
- **For siblings of your own:** the editor's `surface()`, `commitEdit()`,
  `setFindHandler()` and `applyRemoteHtml()`.

**Also changed:**
- `svSanitizeEditorHtml` (`@styloviz/core`) keeps the suggestion and comment
  `data-sv-*` attributes and `aria-label` on a checklist checkbox.

### Added — Charts: a data-table toggle for every chart, synchronised groups, sunburst, relationship graph, error bars, lollipop and dumbbell

- **"Show data table" on any chart.** Every chart already gave screen readers
  its data as a hidden table. `provideSvChartA11y({ dataTable: 'toggle' })`
  (app-wide) or the `svChartDataTable` attribute (one chart) puts the same
  table on screen behind a button under the plot. The table lives in
  `sv-chart-frame`, which now takes the chart's `SvDataSummary` as `[summary]`.
  All 65 chart frames in the kit pass one, including 32 charts that had no data
  table before (gauge, funnel, pyramid, bubble, multi-axis, stacked, range, live,
  trend and strip lines, and more). The axis-label-template and date-time
  category charts take an `ariaLabel` override in both tiers.
- **Synchronised charts.** `svChartSync="ops"` (from `@styloviz/core`) on
  several charts shares the hovered category and the zoom window. Categories are
  matched by label, so charts covering different ranges still line up. Line and
  bar charts take part in both tiers. `injectSvChartSync()` lets your own chart
  join a group.
- **`sv-sunburst-chart` (Pro).** The treemap's radial sibling, on the same
  `TreemapNode` data. It zooms by ring, with the zoom held in a two-way
  `zoomPath`, and is fully operable from the keyboard.
- **`sv-relationship-graph` (Pro).** A network of nodes and links, with
  `layout: 'force' | 'chord'`. Both layouts are built in-house and give the
  same picture every time for the same data. Hovering or focusing a node
  highlights its neighbours, and the whole graph is one tab stop with arrow-key
  movement between nodes.
- **Error bars, lollipop and dumbbell (Pro).** `errors` on a
  `sv-bar-chart-pro` dataset takes a ± or `{ minus, plus }`. The range appears in
  the bar's name, tooltip and table cell as well as in the drawing.
  `barStyle="lollipop"` draws a stem and a dot. `rangeStyle="dumbbell"` on the
  range bar and range column charts draws two dots joined by a line.

**Also fixed:**
- The drill-down column chart's axis labels and grid were tracked by value, so
  drilling in rebuilt them with a runtime warning.
- The Pro trend line chart tracked its trend paths by index.

### Added — Data table: batch editing with undo, a set filter, a filter builder, a status bar and print in `@styloviz-pro/data-table` (Pro)

`sv-data-table-pro` gains the second half of a spreadsheet. Every part is
opt-in: a table that asks for none of it renders and emits exactly as before.

- **Batch editing.** With `batchEdit`, a typed edit, a paste or a fill becomes
  a draft that the table shows and flags (a corner mark, and "unsaved" for a
  screen reader) instead of an `editComplete` or a `rangeEdit`. Undo and Redo
  sit on a batch bar and answer Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) inside
  the table; each step is a whole edit, paste or fill. `unsavedChange` reports
  the count, for a leave-page guard.
- **Save, on the optimistic contract.** Save emits one `batchSave` with the
  `changes`, a `requestKey` and `rollback()` (`createOptimisticEdit`). The
  saved values stay on screen until the host binds rows that carry them.
  `rollback()` puts a failed batch back into the draft, so nothing typed is
  lost, and keeps any cell edited again since; a rollback from an older save is
  refused. `[saving]` locks Save, Discard, Undo and Redo; `[saveError]` shows on
  the bar.
- **Set filter.** `filterType: 'set'` is Excel's checkbox filter in the filter
  row: every value of the column, a search, Select all and (Blanks), in a
  body-portaled panel. It is a two-way `setFilters` with a chip per column, and
  is saved in the layout state as an optional `setFilters` (no schema bump).
- **Filter builder.** `filterBuilder` puts `@styloviz-pro/query-builder` over
  the columns (`queryType` per column) for nested AND / OR queries. The query is
  the builder's own `SvQueryExpression` in a two-way `filterQuery`, so
  `svSerializeQuery` and `svParseQuery` store and restore it. Client-side the
  table evaluates `svQueryToPredicate`'s result; `svRowMatchesPredicate` is
  exported for a host's own use.
- **Status bar.** `statusBar` shows the row count, or Count, Sum, Average, Min
  and Max for a selected block — read from row values and drafts, never from
  formatted text (`svSummarize`).
- **Print.** `printable` adds a Print button. While the page prints, from the
  button or Ctrl/⌘+P, the table renders every filtered row (not the page or a
  virtualized window) without its controls, repeats the header on each sheet
  and keeps rows whole.

**Also fixed:** both data tables printed as the screen draws them — the scroll
box clipped wide and long tables on paper and the sticky header floated over
rows. Both now print without their controls and without clipping; the free
table prints its current page.

**Also fixed:** in both data tables, a column with `filterType: 'none'` left an
empty header cell in the filter row, which screen readers announce as an
unnamed column header. Filter-row cells hold controls, not headings, so they
are now `<td>` cells.

New peer dependency: `@styloviz-pro/query-builder`. 35 new labels in 12
languages.

### Added — Data table: cell ranges, clipboard, fill, Find, bands, merged cells and a cell menu in `@styloviz-pro/data-table` (Pro)

`sv-data-table-pro` gains the first half of a spreadsheet. Every part is opt-in:
a table that asks for none of it renders exactly as before.

- **Cell ranges.** With `cellSelection`, a block of cells follows the cell
  cursor. Shift+arrows, Shift+click or a mouse drag grow it; Ctrl+A selects
  every cell, Shift+Space a row and Ctrl+Space a column. The block is a two-way
  `cellRange`, keyed by row key and column key. The table becomes a
  `role="grid"`, every cell says `aria-selected`, and each new size is announced.
- **Clipboard.** Ctrl/⌘+C copies the block as tab-separated text that Excel,
  Sheets and Numbers read, and as an HTML table for a document. Ctrl/⌘+V pastes
  a block back. One value fills the whole selection, and a block that fits a
  whole number of times repeats. The keystroke passes through a hidden field
  for one moment, because clipboard events on a non-editable cell are not
  delivered reliably (Safari). No clipboard permission is asked for.
- **Fill.** The handle on the block's corner continues it: two or more numbers
  in equal steps become a series, and anything else repeats. Ctrl+D / Ctrl+R
  copy the first row or column across the block. The cell menu's Fill series
  continues the leading values into the empty cells, so the drag has keyboard
  and single-pointer twins (WCAG 2.5.7).
- **The table still never writes `rows`.** A paste or a fill emits one
  `rangeEdit`: `{ source, changes, rejected }`. `changes` has
  `editComplete`'s shape, one entry per cell that really changes, each
  validated by its column's `validate`. Read-only columns and refused values go
  to `rejected` and are announced.
- **Find.** `findable` adds Find, from the toolbar or with Ctrl/⌘+F inside the
  table. It marks every matching cell and says "3 of 12". Enter and Shift+Enter
  walk the matches across the filtered set, turning the page, opening a
  collapsed group or scrolling a virtualized window to reach each one. Unlike
  `searchable`, it hides no rows.
- **Column bands.** `columnBands` adds multi-level headers, and bands can
  nest. A band whose columns are reordered apart is drawn over each run it
  still owns, rather than stretched over a column it does not.
- **Merged cells.** `mergeRepeated` on a column folds a run of equal values
  into one cell. `colSpan(row)` runs a row's cell across the columns after it.
  For the cell cursor, a merged cell is one stop. Neither is applied while
  `virtualized` or `groupBy` is set.
- **Row numbers.** `rowNumbers` adds a numbering column that counts across
  pages.
- **A cell context menu.** `contextMenu` adds a menu on right-click, Shift+F10
  or the menu key: Copy, Copy with headers, the fills, Export selection as CSV,
  pin the column to the start or end, and Hide. Hide appears only with
  `showColumnToggle`, so a hidden column can be shown again. The menu is the
  shared `sv-dropdown-menu`, named for what it acts on ("Actions for 3 rows by
  2 columns"). Pins are a two-way `columnPins` model, saved in the layout state
  as an optional `columnPins`, so older saved layouts still restore with no
  schema bump. A pinned column moves to its edge, and several pinned columns
  now sit side by side instead of on top of each other.

Also fixed in `sv-data-table-pro`:

- The row-action and export menus were in-place `absolute` panels, so the
  table's own scroller clipped the row menu on the last rows. They are now the
  body-portaled `sv-dropdown-menu`. A `check:ui` rule existed for this case but
  had passed the file only because the column drag ghost called `appendChild`.
- Pinned columns hold the inline start and end edges (`start-0` / `end-0`), so
  they pin correctly in a right-to-left table.

`@styloviz-pro/data-table` now has `@styloviz-pro/overlays` as a peer
dependency. The pure helpers `svToTsv`, `svParseTsv`, `svAutoFill` and
`svPasteShape` are exported.

### Added — Scheduler: recurrence, resources, time zones and `.ics` in `@styloviz-pro/scheduler` (Pro)

`sv-event-calendar` now expands recurring events itself. Send a series once,
with an RFC 5545 `rrule` (`FREQ=WEEKLY;BYDAY=MO,WE,FR`) and `exdates`, and it
draws every occurrence in the range on screen. A moved or changed occurrence is
an ordinary event with `seriesId` and `originalDate`, drawn where it now is and
named "Moved from …". With `eventDialog` an event opens a details dialog that
says the rule in words; with `editable` it changes the date and times of this
event, this and following, or all events, and deletes the same way. The
calendar emits the request; `svApplyEventChange` / `svApplyEventRemoval` write
the rows, and you persist what changed. Give the calendar a `timeZone` and every
event that carries its own `timeZone` is converted into it and says where it
came from; with none, nothing is converted, as before. `views` adds a day view
and a year view, and the switcher's names are now translated.

`sv-scheduler` is new in the same package: rooms, people or equipment against
time, as a column per resource for a day or as timelines for a day, a week or a
month, with groups that collapse. Bookings sit in lanes, so a double booking is
never hidden. Working hours are shaded and blocked time is hatched. Drag, tap or
press Enter on free time to book it. The rules answer first: blocked time
is refused by name, and `overlapRule` warns about or prevents double bookings.

The arithmetic is public and needs no Angular: `svParseRRule` / `svExpandRRule`
/ `svDescribeRRule`, `svParseIcs` / `svToIcs` (warnings carry a line number and
a `code`; export writes a VTIMEZONE), `svConvertWallTime` and friends, and
`svCheckSlot`. The calendar template stores its stand-up as a series, edits an
occurrence in scope and exports `.ics`.

### Added — A2UI renderer: `@styloviz-pro/a2ui` (Pro)

`sv-a2ui-renderer` draws the interfaces an AI agent describes in A2UI v0.9 —
forms, cards, lists, tabs, dialogs — with Styloviz components, so an agent's
answer can be a booking form instead of six questions in prose. Feed it the
agent's messages as an array, or push a JSON Lines stream into a store from
`createSvA2uiStore()`; it fills the interface in as messages arrive. Inputs
bound to the agent's data model are two-way, so a pressed button's `(action)`
carries what is on screen, ready to send back to the agent. The whole A2UI
basic catalog is supported; `SV_A2UI_STYLOVIZ_CATALOG` adds Stat, Alert, Badge,
Progress and Rating, and you can register catalogs of your own with
`provideSvA2ui()`. Nothing the agent sends ever runs: a component outside the
registered catalogs is drawn as a notice, links and images pass the kit's URL
check, text goes through the kit's Markdown renderer, and a malformed message is
reported through `(issue)` rather than breaking the page. The package ships
`catalogs/styloviz.catalog.json`, the schema to give the agent.

### Added — Stock chart: `sv-stock-chart` in `@styloviz-pro/charts` (Pro)

`sv-stock-chart` is a candlestick chart for long price histories. A
navigator under the plot holds the whole history in miniature: drag its window
to pan, drag a handle to widen or narrow it, or press anywhere on the strip to
jump there; from the keyboard the window and both handles are sliders, and Zoom
in / Zoom out / Pan left / Pan right buttons do the same with a single tap.
`rangePresets` adds buttons such as 1M, 3M and 1Y, and `range` is two-way, so a
host can save the view and restore it. Over the candles you can draw SMA, EMA and
Bollinger bands, and under the volume pane an RSI or MACD pane. Indicators are
worked out over the whole history and only then cut to the view, so zooming
never changes a value; where a line has not started yet the table cell is blank
and the note under the chart says where it begins. Every session in view is in
the table with its prices and each indicator's value.

The same arithmetic is public: `svSma`, `svEma`, `svBollinger`, `svRsi` and
`svMacd` from `@styloviz/data` (they live in `@styloviz/core`) return an array the
length of their input with `null` through each warm-up. The admin template's
crypto desk now draws its prices with `sv-stock-chart`.

### Added — Cookie consent: `@styloviz/cookie-consent` (free)

`sv-cookie-consent` is a GDPR / ePrivacy cookie banner: a bottom banner, a compact
corner card or a modal dialog up front. "Reject all" carries exactly the same
styling as "Accept all", no optional category is pre-ticked, and "Customise" opens
per-category native switches (strictly necessary is always on) in a native
`<dialog>` that returns focus where it came from. Every choice emits a consent
record — the categories, an ISO timestamp and your policy `version` — for you to
store; hand it back with `[record]` (or `[(consent)]`) and a returning visitor is
not asked again, while a newer `version` re-asks and says the policy changed. It
stores nothing itself unless you opt in with `storageKey`, and every string is a
label with all 12 language packs. The launch and docs-site templates now use it,
with a "Cookie settings" link in their footers.

### Added — Onboarding checklist: `sv-onboarding-checklist` in `@styloviz/overlays` (free)

`sv-onboarding-checklist` is the "Get set up" card for a new account or
workspace: a progress ring and "3 of 5 done", a native checkbox per step, and a
link or button for each step's action. Optional steps carry a badge, are left
out of the count and the ring, and the checklist says so. The steps — and
whether each is done — stay yours: ticking a box emits `(stepToggle)` and the
tick appears once you hand the step back done, so the checklist never shows
progress your server did not record. `(completed)` fires once, on the change to
every required step done — not for a list that arrives already complete. It
comes as a bordered `card` or an `inline` list, can be dismissed (`[(open)]`)
and collapsed (`[(collapsed)]`), takes `loading`, `error` with `(retry)` and an
empty state like every data component, drops unsafe step links, and every
string is a label with all 12 language packs. The admin template's SaaS
dashboard now opens on a "Get set up" card, and the launch template shows a
"Get your workspace ready" checklist once a trial starts.

### Added — In-app survey: `sv-survey` in `@styloviz/forms` (free)

`sv-survey` asks your users how you are doing without sending them anywhere
else. Pick the kind: Net Promoter Score ("How likely are you to recommend us…",
0–10 with "Not likely" / "Very likely" at the ends), CSAT (1–5 stars, each
named by its level and written out once chosen), or one question of your own
with options or a free-text answer. After a score, an optional follow-up asks
why — and for NPS the prompt can differ for detractors, passives and
promoters. Sending shows a thank-you, with an optional "Book a call"-style link
or button, and moves focus to it. Every scale is native radio inputs in a
fieldset, so the keyboard works the way it does everywhere else. It comes as a
`card`, `inline`, or a `floating` panel that slides into a bottom corner like a
toast (not a dialog — the page stays usable), and can be dismissible.
`(submitted)` hands you `{ kind, score, band, choice, comment }`; the survey
stores nothing, so where the answer goes is up to you. Every string is a label
with all 12 language packs.

### Added — Pricing table: `sv-pricing-table` in `@styloviz/commerce` (free)

`sv-pricing-table` is the plans section of a pricing page or an upgrade
screen. Give each plan one monthly price and the table one annual discount:
the monthly / annual toggle (two native radios) then shows the annual price per
month, the invoice actually charged ("$1,428 billed once a year"), the cash
saved, and a "Save at least N%" taken from the plan that saves least — so it
stays true when a price changes. A plan can set its own annual price, quote
instead of price ("Contact sales"), or be free. The recommended plan gets a
"Most popular" badge in text, not just a coloured border. Show the plans as
cards, stacked on a phone, or as a comparison table with a caption, row and
column headers, feature groups and "Included" / "Not included" read out for
every check and dash. Prices are formatted for any currency and locale; a
plan's call to action is a link when it has a safe `href`, otherwise a button,
and `(planSelect)` hands you the plan and the billing period. The arithmetic is
exported (`svAnnualMonthly`, `svAnnualTotal`, `svAnnualSaving`,
`svAnnualSavingPercent`) for your checkout. Every string is a label with all 12
language packs. The launch template's pricing page now uses it.

### Added — Cron builder: `sv-cron-builder` in `@styloviz/forms` (free)

`sv-cron-builder` lets your users set up a recurring job without knowing cron.
Pick how often on a segmented control — every N minutes, hourly at a minute,
daily at a time, weekly on chosen days, monthly on chosen days of the month —
or switch to Custom and type any five-field expression, with lists, ranges,
steps and month or weekday names (`0 9 * * MON-FRI`). Underneath, it says in
words when the job runs ("Every weekday at 09:00", "On the 1st and 15th of
every month at 06:30") and lists the next runs in the time zone you pass, with
daylight-saving changes handled. Switching mode keeps the time and days you
picked, and an expression the visual modes cannot show opens in Custom. An
invalid expression gets a message that names the field and the problem, and is
never written to your form: the value is always the normalised expression
(`0 9 * * 1-5`), so equal schedules compare equal. It works with
`[(value)]`, `[(ngModel)]` and `[formControl]`, and the control is invalid
while the expression on screen is. When both day fields are set, cron runs on
either one — the description says so rather than hiding it. The parser and
helpers are exported (`svParseCron`, `svFormatCron`, `svDescribeCron`,
`svNextCronRuns`) for your jobs table or server-side summary. Every string is a
label with all 12 language packs.

### Added — Import wizard: `sv-import-wizard` in `@styloviz-pro/forms` (Pro)

`sv-import-wizard` lets your users bring a spreadsheet into your app in four
steps. They drop a CSV (or paste one); it is read in the browser in slices
with a progress bar, so a 10,000-row file never freezes the page, and commas,
semicolons or tabs, quoted values, Windows line endings and Excel's byte-order
mark all just work. Each of your fields gets a column picker, already matched
where the header names agree ("E-mail" fills Email, aliases cover the rest);
a required field left unmatched stops Next and says which. The review step
types and checks every row — text, number, ISO date, email, a fixed list of
values, plus any rule of your own that can look at the rest of the row — and
shows "9,997 valid · 3 with errors", a grid of the first rows with each bad cell
marked by an icon and its message, a filter for the bad rows and an error
summary that jumps to each one. Skip them or go back and fix the mapping. The
save is yours: `[commitAction]` returns a promise, or `(importRequest)` hands you
the typed rows, the rejected ones by row number, an `AbortSignal` and
`resolve` / `reject`; the wizard shows progress, Cancel, a failure with Try
again, a summary, and the rows that failed as a downloadable CSV. The pipeline
(`svParseCsv`, `svImportTable`, `svAutoMapColumns`, `svValidateImport`,
`svImportErrorsCsv`) is exported so your server can run the same checks. Every
string is a label with all 12 language packs. `@styloviz-pro/forms` now also
lists `@styloviz/stepper` and `@styloviz/file-upload` as peers.

### Added — Markdown editor: `sv-markdown-editor` in `@styloviz-pro/rich-editor` (Pro)

`sv-markdown-editor` is a Markdown source editor for docs pages, release notes,
comments and canned replies. The text area is a real `<textarea>`, so undo,
spellcheck, dictation, IME input and phone keyboards work as everywhere else.
The toolbar — heading, bold, italic, strikethrough, code, link, quote,
bulleted, numbered and task lists, code block and table — wraps the selection
and unwraps it again, and every edit is one step you can take back with
Ctrl+Z; Ctrl/Cmd+B, I and K do the same from the keyboard. Enter continues a
list (an empty item ends it), Tab and Shift+Tab nest a list item and otherwise
move focus as usual, and Escape, then Tab, always leaves the editor. Write,
Preview and Split views share the same text area, so switching never loses
your undo history; in Split the two sides scroll together, the divider can be
dragged, and on a phone the preview stacks under the source. The preview is
`sv-streaming-markdown`, the kit's safe renderer, so nothing typed can become
markup and unsafe links render as text. Paste an address over selected text
to make it a link; paste part of a web page and it arrives as Markdown (with
anything Markdown cannot carry reported); code copied from an editor pastes
as text. It works with `[(value)]`, reactive forms, `ngModel` and Signal Forms
(`required` and `maxlength` are reported as errors), shows a word and
character count, has read-only and disabled states, emits `submitted` on
Ctrl/Cmd+Enter, and `insertText()` drops a snippet in at the caret. Printing
shows the rendered document. The edit functions (`svMarkdownFormat`,
`svMarkdownIndent`, `svMarkdownContinueList`, `svMarkdownLink`) are exported
for a toolbar of your own, and every string is a label in all 12 language
packs. The docs-site template's "What was missing?" feedback box and the help
desk's reply composer now use it, and the help desk's canned replies can be
edited in it (split view, saved for every agent) and inserted at the caret;
agent replies in the thread render as Markdown. `@styloviz-pro/rich-editor`
now lists `@styloviz-pro/layout` as a peer (for the splitter), and
`sv-splitter` gains `soloPanel`, which shows one panel at full size while the
other stays mounted.

### Added — Tree view: org-chart layout (free and Pro)

`sv-tree-view` and `sv-tree-view-pro` take `layout="org"` and draw your
hierarchy as a real org chart: each node a box, each parent centred over its
children with even spacing between siblings, joined by right-angled connector
lines. No new component and no new data shape — the free box shows the
label, a `role` line and a `department` chip (both new, optional `TreeNode`
fields with the same names Pro already had); with Pro's `variant="org-chart"`
the box adds the avatar, presence dot and report count. It is the same tree
underneath: one tab stop, and the arrow keys mean what they mean in any tree
(↓ and ↑ walk the boxes, → opens a box or steps into it, ← closes it or goes
up to the manager), so nothing new to learn and nothing different for screen
readers. Collapsing a box folds its whole team away and the box says how many
people are under it. A chart wider than the screen scrolls sideways inside
its own labelled area instead of the page, mirrors in right-to-left
languages and follows dark mode; when printed, the scroll area lets go so the
chart is not cut to one screenful. `layout` defaults to `'list'`,
so existing trees are unchanged; on Pro, `tree-table` and `draggable` stay
lists. The HRMS template's org chart page now uses it.

### Added — Permission matrix: `sv-permission-matrix` in `@styloviz-pro/display` (Pro)

`sv-permission-matrix` is the roles & permissions screen of an admin console:
roles across the top, capabilities down the side, and every cell Allow, Deny
or Inherit. A role can extend another (Editor extends Viewer), and a grant on
a group of capabilities covers everything inside it, so an Inherit cell shows
the value it ends up with and where it came from — dashed, with "via Viewer"
or "via Billing" under it, and said in full to screen readers ("Inherited from
Viewer."). Capabilities can be grouped in a tree; a group row shows All, None
or "2 of 3", and Space on it allows or denies everything inside — using the
same tri-state code as the checkbox tree, so it never touches a locked cell.
Lock a role, a capability or a single cell with a reason, or make the whole
matrix read-only. It is a proper keyboard grid: one tab stop, arrow keys,
Home / End, Ctrl+Home / Ctrl+End, Space or Enter to cycle a cell, A / D / I to
set it. The header row and first column stay put while the grid scrolls; row
and column bulk actions, a search and a "Changed only" filter sit above it.
Edits are a draft: changed cells are marked, a summary lists each change with
Revert, and Save hands your code the changes and the resulting grants — you
persist them and pass the saved grants back, which clears the draft (a refused
save keeps it, with your error shown). Loading, error with Try again, and the
two empty states are built in; every string is a label in all 12 language
packs; the rules are exported (`svResolvePermission`,
`svPermissionGroupStates`, `svPermissionChanges`, …) so a server can enforce
the same ones. The admin template's Permissions page now uses it, and records
each saved change in its change history. No new dependency.

### Added — Audit log: `sv-audit-log` in `@styloviz-pro/display` (Pro)

`sv-audit-log` shows who changed what, when, and from what to what. Give it
your audit events — an actor, an action, the record it touched and the fields
that changed — and it lists them newest first on an interactive
`sv-timeline`, each with its action in words ("Updated", "Permissions
changed", "Signed in · Failed"). The open event shows its facts (when, who,
the resource, request context such as the IP address) as `sv-descriptions`,
its short field changes as a before → after table, and each long, multi-line
or structured value — payment terms, a JSON settings object, line items — as
an `sv-diff-viewer` line diff. A field marked `sensitive` is listed as changed
and its values are never shown or exported. The raw record sits in a collapsed
`sv-json-viewer`, with an optional redactor. Filter by actor, action, resource
or changed field with `sv-select-dropdown`; `[(filters)]` and
`[(selectedId)]` are two-way bindable, so a link can reopen the same event,
and `serverSide` hands the filtering (and, with `hasMore` / `loadMore`, the
paging) to your API. Export CSV or JSON downloads the events currently listed,
built in the browser with no request: one CSV row per field change, the
spreadsheet formula guard, secrets written `[redacted]`. Loading, error with
Try again, and the two empty states ("No activity yet", "No matching events"
with Clear filters) are built in. Every string is a label in all 12 language
packs, and the filtering and export helpers are exported
(`svAuditFilterEntries`, `svAuditEntriesToCsv`, `svAuditEntriesToJson`, …).
The admin template's Permissions page now keeps its change history in one, and
records each saved toggle as a field-level change. `@styloviz-pro/display` now
also lists `@styloviz/display`, `@styloviz/timeline`, `@styloviz/code-block`
and `@styloviz/select-dropdown` as peers.

### Added — Status page: `sv-status-page` in `@styloviz/display` (free)

`sv-status-page` is the public status page for your product, or the "System
status" screen of an admin console. Give it your components, incidents and
maintenance windows. The banner at the top says where things stand in words
and with an icon, not just a colour ("All systems operational", "Partial
system outage"); leave `status` unset and it is worked out for you from the
worst component and any open incident, so a critical incident is never shown
under a green banner. Each component shows its state and a 90-day bar, one
cell per day with a tooltip, and a line such as "99.98% uptime over 90 days"
that is rounded down so it never overstates — or your monitoring's own figure
if you pass it. Open incidents come first, worst impact first, each with its
status, impact, the components it affects and its updates newest first on an
`sv-timeline`; resolved ones move into "Past incidents", grouped by the day
they began. Scheduled maintenance is listed with its window, and a window in
progress turns the banner to "Maintenance in progress". Dates and times are
formatted for your locale and time zone, with "Last updated" shown. Loading,
error with Try again, and empty states are built in, and `live` makes the
banner announce changes to screen readers when the page refreshes itself. The
arithmetic is exported (`svOverallStatus`, `svUptimeSummary`,
`svStatusFromUptime`, `svWorstStatus`, `svFormatUptime`) so an e-mail digest
can quote the same figures. Every string is a label with all 12 language
packs. `@styloviz/display` now also lists `@styloviz/timeline` as a peer.

### Added — Voice: transcript, audio device select, voice-note player (free)

Three free voice pieces in `@styloviz/display`, beside the media player.
`sv-transcript` shows what was said in a recording or a live call: who spoke
(each name once per turn), when (a timestamp you can press to play the
recording from there — link any `sv-media-player` with `[player]`), and the
words, with interim text — still being recognised — drawn muted and kept apart
from final text. The line being played is highlighted and kept in view; search
highlights and counts the matches and steps through them (or shows only the
matching lines); Copy and the downloads give plain text (`[0:04] Jordan Lee: …`)
or a WebVTT captions file with one voice per speaker. In `live` mode each new
final line is read out politely to screen readers — interim text never is —
and the list follows the latest line until you scroll up. Loading, error, empty
and no-results states are built in, and `svTranscriptToText` /
`svTranscriptToVtt` export without the component. `sv-audio-device-select`
picks a microphone and, where the browser can route sound, a speaker. It never
opens the microphone by itself: the browser's prompt appears only when you
press **Allow microphone access** or **Test microphone**. A blocked microphone
says how to allow it again with a **Check again** button, an `http:` page or a
browser without device access is told so in words, devices plugged in or
removed are picked up at once, and a chosen device that disappears falls back
to the system default and says so. The test shows a live input level. Provide
`SV_AUDIO_DEVICES` to stand in for the browser in tests or demos. For voice
notes, `sv-media-player` gains `layout="compact"` — one row with play, a seek
bar, the length and the speed for an audio clip — and `sinkId`, which plays the
sound through a chosen speaker where the browser supports it (with
`sinkError` when it cannot). The help desk template shows a ticket's recorded
call this way. Every string is a label in all 12 language packs;
`@styloviz/icons` gains `mic` and `mic-off`, and `@styloviz/display` now also
lists `@styloviz/select-dropdown` as a peer.

### Added — Kanban: `doneColumnIds` for finished columns (Pro)

`sv-kanban-board` takes `[doneColumnIds]`, the columns whose cards are finished
— Done, Won, Lost. A due date there is history rather than a deadline: the card
is never marked overdue, shows no due chip, and the board's tabular summary
leaves it out of its overdue count. Before, every host had to strip `dueDate`
off its closed columns itself, or a won deal read "12d overdue" in red. The CRM
and Projects templates now bind it instead.

### Added — Dock: `sv-dock` in `@styloviz/layout` (free)

`sv-dock` is a macOS-style launcher bar on any edge of its container — bottom,
top, left or right. The item under the pointer and its neighbours grow, and the
rest slide apart to make room; it is done with transforms alone, so nothing
re-lays out under the pointer and no item ever gets smaller than its resting
40, 48 or 56 px. The swell follows the keyboard too, never starts on a touch
screen, and is off entirely for someone who prefers reduced motion;
`[magnification]="false"` turns it off and `magnificationScale` (1 to 2) sets
how far it grows. The dock is one toolbar you Tab into once: the arrow keys
along it move between items — in the order you see them in a right-to-left
page — Home and End go to the ends, and Enter or Space opens one. Each item is
a real link (a `route` through your link adapter, or an `href`, optionally in a
new tab) or a button, named by its label, with the label shown on hover and on
focus. Bind `[activeRoute]` and the page you are on is marked current; items
take a badge, can be disabled (still found, never opened), and an address that
is not allowed (`javascript:` and the like) is never rendered. `(itemSelect)`
says which item and whether the pointer or the keyboard opened it. In a
container too small for the row, the items shrink (never below 32 px) and the
swell pauses, and if even that does not fit the dock scrolls, so no control is
ever cut off. It replaces
PrimeNG's `p-dock`, which `/migrate` and the `migrate-primeng` schematic now
map to it. Its two strings are labels in all 12 language packs.

### Added — Media player: `sv-media-player` in `@styloviz/display` (free)

`sv-media-player` puts the kit's controls around a native `<video>` or
`<audio>`: play and pause, a seek bar that reads the time aloud ("1:02 of
3:00"), volume and mute, playback speed, captions and subtitles from WebVTT
files, and full screen and picture in picture where the browser offers them.
Give it one item for a single clip or several for a playlist — with previous /
next, the item playing marked, and the next one starting when one ends. The
controls are one toolbar you Tab into once and move through with the arrow
keys, and shortcuts work anywhere in the player (Space or K, the arrows, M, F,
C, `<` and `>`). It never starts with sound: `autoplay` plays muted, and not at
all for someone who prefers reduced motion. Each item can resume at a
`startTime`, and the player tells you what happened — `played`, `paused`,
`finished`, `timeUpdate` (at most once a second), `seekComplete` with where the
viewer jumped from and to, `trackChange` and `mediaError` — so you can save
progress or count views. A file that will not play says why in words, with a
Try again button; an address that is not allowed (`javascript:` and the like)
is never requested. Loading, error and empty states for the playlist are built
in, `kind="audio"` shows artwork and the current caption as text, and every
string is a label in all 12 language packs. For demos and tests,
`svDemoVideo`, `svDemoAudio` and `svDemoCaptions` make a video of any length, a
short chime and a captions file in the browser, with nothing to download. The
LMS template's lesson videos now play in it. `@styloviz/icons` gains six
glyphs: `volume-2`, `volume-x`, `skip-back`, `skip-forward`, `captions` and
`picture-in-picture`.

### Added — Mobile set: bottom navigation, action sheet, pull to refresh, swipe actions (free)

Four pieces for phone layouts, all free.

`sv-bottom-nav` (in `@styloviz/sidebar-nav`) is the phone app bar: three to five
destinations with an icon and a label, real links with `aria-current="page"` on
the page you are on — not tabs — 48 px targets, count badges and activity dots,
padded clear of the home indicator. It takes the same `MenuItem` array as
`sv-sidebar-nav` and the same `[activeRoute]="router.url"`, so a phone bar and a
desktop sidebar fed one list always agree on where you are; `hideFrom="md"`
hides it where the sidebar takes over. It can be fixed to the screen (reserving
its own height so the end of the page is never behind it), sticky inside a
scroller, or static.

`sv-action-sheet` (in `@styloviz/overlays`) is the bottom sheet of choices for
the thing you just tapped — Share, Copy link, Delete — with a separate Cancel.
The choices are a menu you can drive with the arrow keys, Home / End or a
letter; a destructive choice is drawn in the danger colour and announced as
destructive, and a disabled one stays in the list so people learn it exists.
A choice, Cancel, Escape, a tap on the dimmed page and a swipe down all close
it — each can be turned off — `(closed)` says which, and focus always goes back
to whatever opened it. It slides up and down, and simply appears and goes for
someone who prefers reduced motion.

`sv-pull-to-refresh` (in `@styloviz/layout`) is a scrolling region that
refreshes when pulled down from the top on a touch screen. Every other touch is
an ordinary scroll the browser keeps; bind `[refreshing]` to your request and
the spinner holds until it finishes, with "Refreshing…" and "Updated" announced.
Because a pull is touch-only, the region carries a Refresh button for the
keyboard and screen readers (shown on focus by default, or always). The
gesture is also available on its own as the `svPullToRefresh` directive, for
your own indicator.

`sv-list-view` (free and Pro) gains swipe actions on rows: `swipeStartActions`
and `swipeEndActions` sit behind each row's edges and are revealed by swiping
it sideways; a long swipe runs the edge action outright (turn that off with
`[fullSwipe]="false"`), right-to-left pages mirror it, and vertical scrolling is
never affected. Every row also gets an Actions (⋯) button that opens the same
actions without a swipe, for a mouse, a keyboard or a screen reader.
`(swipeAction)` tells you which action ran on which row, and how. Lists without
swipe actions render exactly as before.

Every new string is a label in all 12 language packs. The mail template's phone
layout now has a bottom folder bar with unread counts, pull to refresh on the
message list and an action sheet behind the open conversation's ⋯.
`@styloviz/icons` gains `archive` and `flag`; `@styloviz/core` exports the
swipe thresholds both list views use (`svSwipeRelease`, `svSwipeClamp`,
`svSwipeLogical`, `svSwipeTrayWidth`).

### Added — Code group: terminal, file tree, diff viewer, stack trace

Four developer components, all free, all in `@styloviz/code-block` beside the
code block.

- **`sv-terminal`** is now a log viewer as well as a shell. Bind `[lines]` to
  your build, deploy or agent output and append as it arrives; the colours the
  tools print (SGR 30–37, 90–97 and bold) show as colours, other escape codes
  are dropped, and nothing in a line is ever rendered as markup. It follows
  new output only while you are at the bottom: scroll up to read an error and
  it stops, with a "jump to latest" button that counts what arrived. Copy
  takes the whole log as plain text, `maxLines` keeps the newest lines, and
  `[interactive]="false"` removes the prompt. A new `info` line kind is for
  notes you add yourself. Existing terminals keep working unchanged; they now
  show a copy button, which `[copyable]="false"` turns off. Ctrl+L or `clear`
  no longer brings the intro back on the next command. The developer
  portfolio template's terminal now colours the project names `ls` prints.
- **`sv-file-tree`** shows a project's files and folders with an icon picked
  from each name (folders, TypeScript, images, archives, spreadsheets, SQL,
  lockfiles, `package.json`, Dockerfiles), folders first in natural order,
  git-style badges, selection and a `fileOpen` event. It is `sv-tree-view`
  underneath, so keyboard support and the loading, error and empty states are
  the tree's own. The Files template's folder rail now uses it.
  `sv-tree-view` (free and Pro) gains an `iconTemplate` input for drawing your
  own icon before each label.
- **`sv-diff-viewer`** compares two texts, or reads a `git diff` patch:
  unified or side by side, both line numbers, a `+` or `−` on every changed
  line and "Added" / "Removed" for screen readers, long unchanged stretches
  folded behind "Show N unchanged lines", and the changed words highlighted.
  Windows and Unix line endings count as the same, a missing final newline is
  shown, and a diff too large to compare says so instead of freezing the page.
  `svLineDiff()` is exported.
- **`sv-stack-trace`** turns an `Error` or a logged stack trace from Chrome,
  Node, Firefox or Safari into the error's name and message and one row per
  frame with file, line and column. Frames from `node_modules`, Node itself
  and bundler runtimes fold behind "Show N library frames"; frames can be
  clickable (`frameClick`) to open them in your editor. `svParseStackTrace()`
  is exported.

Every string is a label in all 12 language packs. `@styloviz/code-block` now
lists `@styloviz/tree-view` as a peer.

### Added — Transfer: drag between the lists

Rows of `sv-transfer` can be dragged to the other list. Dragging a ticked row
carries every ticked row with it; dragging an unticked one carries just that row.
A drop is exactly the move the arrow buttons make — the same `transferChange`,
`saving` lock and `rollback()` — and the checkboxes and arrow buttons remain the
keyboard and single-tap way. `[draggable]="false"` turns it off. The splitter,
context menu, menubar, transfer and tree-select galleries each gain a real-world
and a states example, including nested collapsible panes and a lazy tree.

### Added — Loading, error and real-world examples for ten more families

Bubble, multiple-axis, date-time, polar, waterfall and funnel charts, the record
grid, affix, progress ring and form error summary each gain an example of their
loading, error and empty states (with a working Try again) and one of a real job:
a product portfolio, a P&L bridge, a sign-up funnel, a wind rose, a sticky table
of contents, a storage quota card, a checkout that focuses its error summary.

### Added — Pagination: jump to page and "load more"

`[jumpToPage]="true"` adds a "Go to page" field beside the page buttons; a number
past either end goes to the first or last page. `variant="load-more"` is a single
"Load more" button with a "Showing 40 of 95" count: your app appends each page to
what is shown, focus stays on the button between pages, and the button goes once
there is nothing more. Both are labelled in all 12 language packs. The gallery
gains phone-width, jump, load-more, page-size and server-driven examples.

### Added — Autocomplete: custom option rows

An `svAutocompleteOption` template replaces what each option row shows — an
avatar and an email, a price, a status — and is given the option, whether the row
is active or selected, and the typed query. The row itself stays the
component's, so `aria-activedescendant`, the highlight and the click work exactly
as before. The gallery gains async search with `svSuggestController`, recent and
suggested groups, rich rows, and multi-select chips (with `sv-tag-input`).

### Added — Carousel: thumbnails, vertical, and several slides per view

`indicator="thumbnails"` draws a strip of slide previews under the carousel.
`orientation="vertical"` moves slides up and down, with the arrows above and
below, the dots down the edge, and ↑ / ↓ and vertical swipes. `slidesPerView`
shows a row of cards that steps one slide at a time and stops with the last in
view; each card keeps `slideMinWidth` (220px by default), measured from the
carousel itself, so a narrow container or a phone shows fewer. The gallery gains
hero, autoplay, thumbnail, card-row and vertical examples.

### Added — Tabs: scroll arrows and icon-only tabs

A `scrollable` tab strip that overflows now draws previous and next arrows at its
ends, each shown only while there are tabs hidden that way, and keeps the
selected tab scrolled into view (the strip scrolls, never the page). The arrows
are for the pointer — the arrow keys already move along the strip — so they sit
outside the tablist and out of the tab order; `[scrollButtons]="false"` turns
them off. `TabItem.iconOnly` draws a tab's icon alone while its label stays the
accessible name and the hover title. The tabs gallery gains vertical, icon-only,
count-badge, URL-synced and lazy-panel examples.

A lazy tab panel that was shown without being clicked — the first tab, shown
by default, or one your code selected — is now kept when you switch away, as
`lazyRetention="retain"` promises; it used to be destroyed, losing what was
typed in it, and rebuilt on the way back.

### Added — Data table: rows and cells from the keyboard

`(rowClick)`, `(cellClick)` and inline editing were mouse-only on the table
layout. In both tables the body is now one tab stop: ↑/↓, Home/End and
PageUp/PageDown walk the rows, and Enter or Space activates one. → steps into
the row's cells, where Enter or Space emits `cellClick` and F2 opens an
`editable` cell's editor; Enter or Escape in the editor puts the cursor back on
its cell. Keys from a control inside a row keep their own meaning.

### Added — One switch for the kit's console output: `provideSvDiagnostics`

Every warning and error the kit writes now goes through `svWarn` / `svError` in
`@styloviz/core`, prefixed `[styloviz]`. `provideSvDiagnostics({ silent: true })`
silences all of it; `provideSvDiagnostics({ handler })` sends each one to your
error tracker instead of the console. The icon package's "glyph not registered"
warning obeys the same setting. The rich text editor's export and print failures,
already shown in the editor, are reported the same way.

### Added — Translatable accessible names: `provideSvLabels`

Every fixed accessible name in the library — 312 `aria-label` literals plus
43 fixed names hiding in ternaries and fallbacks — is now a label you can
replace. Each package owns its English defaults (`SV_<PACKAGE>_LABELS`, type
`Sv<Package>Labels`, exported) and registers a namespace, so overrides are
type-checked against exactly the packages you have installed:

```ts
providers: [
  provideSvLabels({
    dataTable: { selectRow: 'Zeile auswählen', nextPage: 'Nächste Seite' },
    richEditorPro: { bold: 'Fett', italic: 'Kursiv' },
  }),
]
```

Namespaces are the package's base name, plus `Pro` for a Pro package
(`dataTable` / `dataTablePro`). Partial at both levels; several calls layer in
order. Nothing changes until you provide one — the defaults are the old
English, byte for byte. A component's own `ariaLabel`-style input still wins
for that instance. Names composed from data are templates too
: a label may carry named slots and ICU plurals, filled by the
`svLabel` pipe / `svFormatLabel()` in the kit's locale —

```ts
provideSvLabels({
  tagInput: { removeTag: '{name} entfernen' },
  breadcrumb: { hidePages: '{count, plural, one {# Seite ausblenden} other {# Seiten ausblenden}}' },
})
```

so word order and plural forms are the translation's, not the code's.
Counts in names now get locale grouping ("1,234"), and three English plurals
were fixed on the way ("1 more tag", "1 task", "1 active day"). `check:ui`
fails on any fixed or concatenated English accessible name.

### Changed — One locale for the whole kit: `SV_LOCALE` (**breaking**)

The kit used to decide the language for you: 58 `'en-US'` literals (gantt and
scheduler headers, date pickers, every count in the AI widgets, the commerce
`locale` defaults), and 20 calls with no locale at all — which is the
*browser's* locale, so "1,234" and "1.234" could sit on one page. Every
display format now reads one value:

```ts
// app.config.ts — optional: SV_LOCALE already defaults to Angular's LOCALE_ID
providers: [provideSvLocale('de-DE')]   // from '@styloviz/core'
```

A component's own `locale` input still wins for that instance. **Added:**
`SV_LOCALE`, `provideSvLocale()` (validates and canonicalises the tag),
`svLocale()`, `svFormatCount()`, `svMonthLabels()` and `SV_MACHINE_LOCALE`
(the fixed format time-zone code parses `Intl` output in) in `@styloviz/core`,
and a `locale` input on the components that formatted without one —
`sv-agent-approval`, `sv-ai-model-selector`, `sv-ai-token-dashboard`,
`sv-ai-writing-assistant`, `sv-artifact-panel`, `sv-autocomplete`,
`sv-code-block`, `sv-comment`, `sv-dnd-list`, `sv-embedding-map`,
`sv-event-calendar`, `sv-funnel-chart`, `sv-gantt-chart`, `sv-heatmap-calendar`,
`sv-heatmap-chart`, `sv-kanban-board`, `sv-pivot-table`,
`sv-prompt-template-library`, `sv-pyramid-chart`, `sv-query-builder`,
`sv-rag-knowledge-base`, `sv-rating`, `sv-scale-notice`, `sv-stat-card`
(+ `-pro`), `sv-tree-view-pro`, `sv-treemap-chart`.

| Changed | **Migrate** |
| --- | --- |
| `sv-date-picker`, `sv-date-picker-pro`, `sv-date-range-picker`: no `locale` meant a Monday-first grid with English headings | it now means the kit's locale — an `en-US` app gets a Sunday-first grid with "Sun…Sat"; pass `locale=""` to keep the pre-2.0 grid. `monthNames` is now a signal |
| `locale` defaulted to `'en-US'` on `sv-price`, `sv-cart-line-item`, `sv-thumbnail-card`, `sv-product-card`, `sv-property-card`, `sv-gift-card`, `sv-order-summary`, `sv-number-ticker` | the default is the kit's locale; pass `locale="en-US"` where an app with another `LOCALE_ID` must keep US formatting |
| `sv-datetime-category-chart` defaulted to `LOCALE_ID` | defaults to `SV_LOCALE` (the same value unless `provideSvLocale()` is used) |
| Counts and dates that followed the **browser's** locale (rating, autocomplete, stat card, kanban, tree view, comment, heatmap chart, agent approval, RAG, token dashboard, pivot table) | they follow the kit's locale |
| `sv-query-builder` preview: "after 1 Jun 2026" | the date is in the locale: "after Jun 1, 2026" (`en-US`), "1. Juni 2026" (`de-DE`); the sentence stays English |
| Exported helpers without a locale: `svScaleLabel(window, noun)` (core), `formatPivotValue(value, format)`, `svCurrencySymbol(currency)`, `svFormatSpend(amount, symbol = '$')`, `svFormatDelta(delta, unit = '')` (prompt-template-library), `svChunkFlagLabel(flag, limits?)`, `svFormatTokens`, `svDeletionParts`, `svDeletionLabel`, `svPointRowLabel`, `svClusterNavLabel`, `svKeyboardReachLabel`, `svRendererNotice`, `svProseDiffNotice`, `svApproximateDiffNotice`, `svDescribeQuery(expr, fields)`, `svFormatTickerNumber` / `svFormatTickerDisplay` (options optional) | each takes the locale as a required last argument (`svFormatTicker*`: `{ …, locale }`, type `SvTickerLocaleFormatOptions`); defaulted arguments before it are now required — pass `undefined` for the old default |
| `SV_WEEKDAY_NAMES` (scheduler): English weekday names | removed — use `svWeekdayLabels(locale, firstDay)` or `Intl.DateTimeFormat(locale, { weekday: 'long' })` |

`check:ui` → `locale-literal` keeps it this way: no `'en-US'` outside core's
`SV_MACHINE_LOCALE`, no `toLocale*()` or `Intl` formatter without a locale, no
`'default'` locale, no pipe in a library template without its locale argument,
and no hard-coded English weekday or month-name arrays.

### Changed — App shell: `sv-dashboard-shell`, `sv-sidebar`, `sv-topbar` and `sv-footer` are slot-based (**breaking**)

Until 2.0 these four were the Styloviz site's own chrome: the topbar carried
Styloviz docs, templates and pricing links and a "Get Pro" button, the footer
printed "© styloviz", and the shell rendered all of that plus a router outlet and
six toast hosts with no inputs. They are now a generic app shell. The shell owns
`collapsed` and `mobileOpen` (both models) and shares them with a projected
sidebar and topbar through `SV_SHELL_CONTEXT`, so the usual shell binds nothing:

```html
<sv-dashboard-shell>
  <sv-sidebar svShellSidebar>
    <a svSidebarBrand routerLink="/">Acme</a>
    <sv-sidebar-nav [menuGroups]="nav" [activeRoute]="url()" />
  </sv-sidebar>
  <sv-topbar svShellTopbar><sv-avatar topbar-actions name="Ada" /></sv-topbar>
  <router-outlet />
  <sv-footer svShellFooter>© 2026 Acme <span svFooterEnd>v3.1</span></sv-footer>
</sv-dashboard-shell>
<sv-toast-host position="top-right" />
```

| Removed | **Migrate** |
| --- | --- |
| `<sv-dashboard-shell />` rendering topbar, sidebar, footer, outlet and toasts | project them: `[svShellSidebar]`, `[svShellTopbar]`, the default slot (your `<router-outlet />`), `[svShellFooter]`; add the `<sv-toast-host>` positions you use. `@styloviz/layout` no longer depends on `@styloviz/toast` |
| `SvDashboardShellComponent.sidebarCollapsed` / `mobileSidebarOpen` / `toggleSidebar()` / `toggleMobileSidebar()` / `closeMobileSidebar()` / `currentUser` | `[(collapsed)]`, `[(mobileOpen)]`, `toggleCollapsed()`, `toggleMobile()`, `closeMobile()`; no user |
| `sv-sidebar [menuGroups]` (routed menu with `?c=` sub-navigation) | put `<sv-sidebar-nav>` (or any navigation) in the default slot; `sv-sidebar` no longer imports `@angular/router` |
| `sv-sidebar` logo, `docsUrl`, `githubUrl`, `npmUrl`, `communityUrl`, `version`, `showFooterLinks` | `[svSidebarBrand]` and `[svSidebarFooter]` slots; `label` names the landmark (was a fixed "Main navigation") |
| `sv-topbar` `overviewUrl`, `docsUrl`, `templatesUrl`, `showTemplates`, `communityUrl`, `pricingUrl`, `licenseUrl`, `showGithub`, `showNpm`, `showLicense`, `showGetPro`, `githubUrl`, `npmUrl`, its overflow menu, and the `ResourceLink` type | project links and menus into `[topbar-start]` / `[topbar-search]` / `[topbar-actions]`; new `showSidebarToggle`, `showThemeToggle` and five label inputs |
| `sv-footer`'s "© *year* styloviz · Angular 21 & Tailwind CSS 4" and `currentYear` | project your own: default slot (start), `[svFooterEnd]` (end) |

`sv-page-header` is not part of this break: its 1.x API stays, and it gains
optional slots and actions under *Added — Navigation build set* (the ADR
amendment is in `docs/navigation-catalog-adr.md`).

### Removed — Popout: use the Popover preset (**breaking**, Pro)

`sv-popout` was a configuration of Popover, not a second family (ADR
anchored surfaces, D1), and it is gone: `SvPopoutComponent`, `PopoutPosition`
and `PopoutAlign` are no longer exported. `sv-popover` gained
`padding` (`'none' | 'sm' | 'md'`, default `'md'`), and `SV_POPOUT_PRESET` now
includes `padding: 'none'`, so the panel lands on the same pixel and your
content owns the whole panel, exactly as with Popout.

| Removed | **Migrate** |
| --- | --- |
| `<sv-popout position="…" align="…" [width]="n">` | `<sv-popover trigger="click" [interactive]="true" [autoFocus]="true" padding="none" position="…" align="…" [minWidth]="n" [maxWidth]="n">`, or bind `SV_POPOUT_PRESET` |
| `<button svPopoutTrigger>` | `<button slot="trigger">` |
| `<div svPopoutContent>` | the default content slot (no attribute) |
| `[open]` / `(openChange)` | `[(open)]` (a model) |
| `closeOnEscape` | `closeOnEsc` |
| `PopoutPosition`, `PopoutAlign` | `PopoverPosition` (`'top' \| 'bottom' \| 'left' \| 'right'`), `PopoverAlign` |

### Changed — Tooltip: the bubble is portalled by default (**breaking**)

`sv-tooltip` and `sv-tooltip-pro` now render the bubble in a `<body>` portal
unless told otherwise, so a tooltip inside a table cell, a card or a scroll
area is no longer clipped by an `overflow: hidden` ancestor, and it flips and
clamps at the viewport edge. **Opt-back:** `[portal]="false"` keeps the bubble
inside the trigger wrapper — for a host that styled it by its position in the
DOM. A `[portal]="true"` you already pass is now redundant and harmless.

### Changed — Form builder: control ids are scoped to the form (**breaking**, Pro)

Control ids were `sv-fb-<path>`, so two forms built from one schema on one page
rendered duplicate ids, and a label's `for` pointed at the first form's control.
They are now `sv-fb-<n>-<path>` (for example `sv-fb-3-company-legalName`), with
`<n>` unique per form. **Migrate:** select a control by its `name` or a
`data-sv-*` hook, not by a literal id.

### Removed — Stepper: `verticalRowPaddingClass()` (**breaking**)

The deprecated method is gone from `sv-stepper` and `sv-stepper-pro`. The
vertical row's indent now comes from the rail offsets, and nothing read it.

### Removed — Select dropdown: the 1.x search, async, windowing and bulk inputs (**breaking**)

`sv-select-dropdown` and `sv-select-dropdown-pro` are configured only through
their feature children and `[source]`, the shape added in 1.0.
Unbound settings keep the old defaults.

| Removed | **Migrate** |
| --- | --- |
| `[searchable]` | `<ng-container svSelectSearch />` inside the select |
| `searchPlaceholder`, `noResultsText`, `loadingText`, `minChars`, `debounceMs`, `serverSide`, `(searchChange)` | the same names on `svSelectSearch` |
| `virtualThreshold`, `optionHeight`, `virtualViewportHeight` (Pro) | the same names on `<ng-container svSelectVirtual />` |
| `showSelectAll`, `selectAllLabel` (Pro) | `<ng-container svSelectBulk />` (`selectAllLabel` on it) |
| `loadOptions`, `SvSelectOptionSource` | `[source]="svSelectSource({ search })"` from `@styloviz/core` — the same `(term, signal)` function |
| `error`, `hasMore`, `loadingMore`, `stale`, `(retry)`, `(loadMore)` | a `source`: it owns the error and its retry, paging (`pageSize`) and the stale state |

`loading` stays — re-documented as the host's switch for the trigger while it
resolves the selected value.

### Removed — Deprecated members across the kit (**breaking**)

Every member that 1.x kept only so old code would compile is gone. Each one
either did nothing or had a documented replacement.

| Package | Removed | **Migrate** |
| --- | --- | --- |
| `@styloviz/core` | `StylovizConfig.licenseKey` | delete it — nothing read it; Pro is licensed at install time |
| `@styloviz/core` | `StyloVizConfig`, `provideStylviz()` (misspellings) | `StylovizConfig`, `provideStyloviz()` |
| `@styloviz/product-tour` | `variant` input, `TourVariant` | delete it — the free tour is `modal` only; variants are `sv-product-tour-pro [variant]` |
| `@styloviz/stat-card` | `variant` input, `StatCardData.variant`, `StatCardVariant`, `(cardClick)` | delete them — the free card has one look and is not clickable; use `sv-stat-card-pro [variant]` / `[clickable]` + `(cardClick)` |
| `@styloviz/layout` | `sv-sidebar` `(toggleCollapse)` | it never fired — drive `[collapsed]` from the shell (`sv-topbar` `(toggleSidebar)`) |
| `@styloviz-pro/gantt` | `isLoading` input, `showLoading` | `[loading]` |
| `@styloviz/data-table`, `@styloviz-pro/data-table` | `compact` input | `density="compact"` |
| `@styloviz/data-table`, `@styloviz-pro/data-table` | `(serverPageChange)`, `ServerPageEvent` | `(queryChange)` (an `SvDataQuery`), with `serverRequestId()` read in the handler for `acceptsResponse(id)` |
| `@styloviz-pro/input-field` | date-range picker `weekDays` | `weekDayLabels()` (follows `locale` / `weekStart`) |
| `@styloviz/alert-banner` | public `ngOnInit()` | nothing — re-create the banner (`@if`) to show it again |
| `@styloviz/overlays` | `sv-result` public `ngAfterViewInit()` | nothing — the arrival focus runs from an effect |
| `@styloviz-pro/ai-writing-assistant` | `editorText`, `toneApplied` | `text`, `toneFeedback()` |
| `@styloviz-pro/rich-editor` | `showColorTools`, `ICONS`, `RteToolbarGroup`, `RteToolbarItem` | `[hiddenTools]="['fontColor', 'backgroundColor']"`; the toolbar is configured with `toolbar` / `hiddenTools` and `SV_RTE_TOOL_GROUPS` |
| `@styloviz/file-upload` | `zoneClasses`, `iconSize`, `labelClass`, `hintClass`, `isDragOver`, `onDragOver/Leave/Drop`, `onZoneKeydown` | delete them — the free uploader is a button; the drop zone is `@styloviz-pro/file-upload` |

### Fixed — Funnel percentages, bubble axes, record-grid states, chart types

A funnel's stage percentage was its share of the SUM of every stage — a number
that means nothing when each stage is a subset of the one before. It is now the
stage as a percentage of the top stage ("40% of the top stage"), and the tooltip
adds the step from the stage above; `FunnelSliceEvent` gains `stepPct`, and the
"Value" / "% of the top stage" text is translated in all 12 language packs. A
bubble chart with a negative value — a product line that is shrinking — drew it
outside the plot; the axis now reaches below zero. A bubble with no usable x or y
is left out and a size that cannot be drawn gets the minimum radius, each said
under the plot. The data table's records and mobile-card views now announce their
loading skeleton and tell "no data" from "no matches", with Clear filters, as the
table view does. And 34 types that a public input or output uses — chart event
payloads and options among them — are now exported, so you can name what you
bind; a new check keeps it that way.

### Fixed — API descriptions are written to you

The API tables on /docs and in every package README publish each input's and
output's own JSDoc, which was written for the next maintainer: 154 descriptions
had an ALL-CAPS sentence for the lesson a bug taught, 49 told the history of a
fix to a version you never had, and 5 named the kit's own test gates. Every
published copy now goes through one tone pass — shouting in sentence case
(acronyms and names keep their capitals, code is never touched), history
sentences dropped, gate names reworded at the source — across 3,742
descriptions and 65 READMEs. The source JSDoc keeps its notes. A spec fails on
any published description or README row that still shouts, narrates history or
names a repo gate.

### Fixed — Hover, focus, pressed and selected states read at AA

`check:contrast` now scores every state arm — `hover:`, `focus:`, `active:`,
`group-hover:`, `peer-*:`, `aria-selected:` / `aria-current:` and
`data-[state=…]:` fills and inks, each in light and dark — against the ink the
element shows in that state, and a hover that changes only the ink against the
surface it inherits. Text below 4.5:1 under a state is fixed across the kit:
the button's `link` variant now has a dark hover ink in every colour (it turned
near-black on a dark page when hovered), and hover or selected fills in the AI
chat, AI panels, artifact panel, data tables, transfer, JSON viewer, number
input, guardrail panel, notification center, product tour, event calendar,
speed dial and widget grid.

### Fixed — Text over images, gradients and glass reads at AA

`check:contrast` now composites every translucent ink (`text-white/60`) and
every text dimmed by its own `opacity-*` onto the surface it sits on, and the
uses it cannot place (text over a photo or a runtime fill) are each measured
by hand and reasoned in a ledger. That found text below 4.5:1 in shipped
components, now fixed: the alert banner's and product tour's gradients end on
700 stops; the badge's dismiss glyph; stronger scrims under the captions of the
thumbnail card, image gallery, mega menu and spinner overlay; the widget grid's
glass labels; and the Sankey chart's value labels, which now pick a readable ink
for each node's fill (the gradient variant included). The carousel's and
product tour's chips are dark glass (`bg-black/20`) so white text reads on a
light slide.

### Fixed — File upload: a disabled field refuses a pick from its file input

A `change` fired at the hidden `<input type="file">` — by script, or queued
before a form control disabled the field — still added files while the field
was disabled. Both tiers now refuse it, as the drop zone always did.

### Changed — Behaviour you may notice after upgrading

Nothing here removes or renames an API, but these defaults now behave
differently:

- **Sidebar nav:** a section with sub-pages opens on its own toggle
  (`aria-expanded`, `aria-controls`), not only when its route is active. The
  parent of the current sub-page is `aria-current="true"`, so only one row is
  `"page"`.
- **Signature pad:** `penColor` now defaults to `''`, which follows the
  theme. The old `#111827` default was invisible on the pad's own dark-mode
  background. Exports keep the dark document ink unless `penColor` is set, so
  `toDataUrl()` and `toSvgString()` output is unchanged. A one-point tap is
  now discarded: it drew nothing, yet it rode along in the value and the
  attestation hash.
- **File upload, both tiers:** with `multiple` off, a new file replaces the
  queued one (`fileRemoved` fires for the old file). Files past `maxFiles`
  are reported through `intakeSkipped` with `reason: 'max-files'`.
- **File upload (Pro):** `preventDropOnDocument` defaults to `true`, so a
  file dropped just outside the zone no longer replaces the page.
- **Tooltip:** `maxWidth` now wraps the text; before, it did nothing under
  `whitespace-nowrap`. `[maxWidth]="null"` keeps the single-line bubble.
- **Anchor:** the active item is shown by a marker that slides along the
  rail, not by each item's own border. The final section can now become
  active.
- **Confirm dialog (Pro):** the glyph is tinted to the variant, the panel
  fades and scales in and out (instant under reduced motion), and the
  default `iconStyle` is `ring`. `iconStyle="tile"` is the old look.
- **Scroll area:** in `variant="auto"` the thumb also shows for about
  800 ms after each scroll, so touch users see it. The edge fade ends in the
  host's surface colour rather than white or gray-900.

### Changed — New peer dependencies

Install these alongside the packages that now need them:

| Package | New peers |
| --- | --- |
| `@styloviz/avatar`, `@styloviz/badge`, `@styloviz/kbd`, `@styloviz/password-strength`, `@styloviz/streaming-markdown` | `@styloviz/core` |
| `@styloviz/overlays` | `@styloviz/kbd` |
| `@styloviz/layout` | `@styloviz/kbd`, `@styloviz/overlays` |
| `@styloviz/scroll-area`, `@styloviz/anchor` | `@styloviz/icons` |
| `@styloviz/sidebar-nav` | `@styloviz/overlays`, `@styloviz/scroll-area` |
| `@styloviz/empty-state` | `@styloviz/avatar`, `@styloviz/kbd` |
| `@styloviz/phone-input` | `@angular/forms` |
| `@styloviz-pro/ai-chat` | `@styloviz/ai` |
| `@styloviz-pro/ai-chat-transport`, `@styloviz-pro/avatar` | `@styloviz/core` |
| `@styloviz-pro/split-button` | `@styloviz/core`, `@styloviz/icons` |
| `@styloviz-pro/overlays` | `@styloviz/overlays` |
| `@styloviz-pro/image-editor` | `@styloviz-pro/icons`, `@styloviz/core` |
| `@styloviz-pro/layout` | `@styloviz/anchor`, `@styloviz/scroll-area`, `@styloviz/sidebar-nav` |
| `@styloviz-pro/command-palette` | `@styloviz/avatar`, `@styloviz/empty-state` |

### Added — Tooltip: rich content, 12 placements, groups and `sv-tooltip-pro`

`sv-tooltip` gains:

- **Rich content:** a `title` with `kbd` keys, an icon and a status dot, or
  any content through `ng-template[svTooltipContent]`. Text alone renders as
  before.
- **Placement:** all 12 `SvPlacement` placements, RTL-aware.
- **Groups:** `svTooltipGroup` and `provideSvTooltipGroup`. The first
  tooltip waits for its delay, siblings show at once, and only one is
  visible.
- **Variants:** `inverted`, `glass` and `value`.
- **Control:** a controlled `[(open)]`; an element or viewport-point
  `anchor`; touch `tap` / `hold` / `off`; `fade` / `scale` / `shift`
  animations; and an `arrow` toggle.

The grouping primitives `SV_TOOLTIP_GROUP` and `createSvTooltipGroup` ship in
`@styloviz/core`.

**New in Pro:** `sv-tooltip-pro` (`@styloviz-pro/overlays`) passes every free
input through, so it is a drop-in upgrade. It adds:

- an `interactive` bubble with `hideDelay` that you can hover onto and Tab
  into; Escape returns focus;
- `followCursor`.

### Added — Stepper: `card`, `progress-bar` and `xs`; Pro timeline, circular and summaries

Both tiers gain:

- the `card` variant: a box per step, stacked on a phone;
- the `progress-bar` variant: the current step's label over a segmented
  bar with 24 px targets, worded by `progressLabel`;
- the `xs` size.

Pro also adds:

- the `timeline` variant, with `<ng-template svStepPanel>` content under
  each step (`SvStepPanelDirective`, whose `next()` and `previous()` respect
  the step gates);
- the `circular` variant: a progress ring with `n/total` and the next step's
  name;
- `StepperItem.summary`, shown on completed steps with an `Edit` affordance
  (`summaryEditLabel`).

### Added — Form builder: sections, density, two columns (Pro)

Groups now wrap their fields in a real `<fieldset>`; before, assistive tech
announced a group with no members. New inputs:

- `density`: `compact` or `comfortable`;
- `columns`: `1` or `2`, a container query, with a per-field `span: 1 | 2`.

The schema check reports an `invalid-span` problem. Later top-level sections
and nested groups are ruled off, and the actions sit on their own row.

### Added — Confirm dialog: icon styles, layouts and safer confirmations (Pro)

- **Appearance:** `iconStyle` (`ring`, `tile`, `plain`), `align`, an
  `inset` footer, a `blur` / `dim` / `none` backdrop, a stacked button
  layout, and `mobileSheet`, which docks the dialog to the bottom on a phone.
- **Content:** a `[svConfirmIllustration]` slot, and `consequences[]`, read
  out as part of the description.
- **Making the user slow down:**
  - `acknowledgeLabel`: a checkbox that must be ticked;
  - `confirmDelayMs`: a countdown;
  - `confirmHoldMs`: hold to confirm, by pointer, Space or Enter;
  - `reasonLabel` / `reasonRequired` / `[(reason)]`, with
    `confirmedWithReason`;
  - an announced, mono type-to-confirm field.
- **Errors:** an `[error]` input for a host-driven save.
- **Labels:** every string, through `SV_CONFIRM_DIALOG_LABELS`.

A click outside the panel cancels again; a full-height shell had been
swallowing it.

### Added — Command palette: pages, actions, preview, scopes and more (Pro)

- **Navigation:** nested pages (`CommandAction.children`, `[(pages)]`) with
  breadcrumbs and Backspace / Escape to step back.
- **Actions:** a per-command actions menu (`CommandAction.actions`) on the
  open key or →.
- **Preview:** a split `layout` with a preview pane.
- **Scopes:** prefix chips (`scopeChange`).
- **AI fallback:** `config.aiFallback` adds an "Ask AI" row (`aiAsk`).
- **Lists:** `[(pinnedCommandIds)]` and `suggestedCommandIds`.
- **Looks:** the `glass` and `minimal` variants and a `spotlight` placement.
- **Shortcuts:** key sequences such as `g d`.
- **Rows:** rotating `placeholderHints`, avatars and thumbnails, and sticky
  group headers.
- **States:** a loading skeleton and an empty state.
- **Scale:** a windowed list past `config.virtualizeAbove` rows.

`@styloviz/core` gains `svParseShortcutSequence` and
`svShortcutSequenceTokens`, and chord support in the shortcut registry.

A command that is also in Recent now has one id and one highlight per row.
Hover follows real pointer motion, and a vetoed backdrop click keeps focus
in the search box.

### Added — Mega menu: tabs, cascade, icon grid, search and presets (Pro)

- **Layouts:** per item, vertical `tabs`, `layout: 'cascade'` and
  `layout: 'icon-grid'`; on the menu, `width="full"` with 4- and 5-column
  sets.
- **Featured content:** `featuredCards` with `featuredLayout`, promo /
  stats / testimonial cards, and link thumbnails.
- **Panels:** a footer strip, searchable panels, an `activeHref` trail,
  `panelTone`, and a recent column.
- **Hover intent:** `corridor` / `delay` / `none`, with an `intentChange`
  output.
- **Mobile:** `mobileLayout="stacked-pages"`.
- **Keyboard:** full navigation, PageUp / PageDown between regions.
- **Presets and labels:** `MEGA_MENU_*` presets and
  `SV_MEGA_MENU_LABELS`.

`@styloviz/core` gains `svSafeCorridorTriangle` and a `slop` option on
`svInSafeCorridor`.

### Added — Empty state: variants, illustrations, checklist and search echo

- **Variants:** `dashed`, which makes the card itself the action, `ghost`
  and `glow`.
- **Illustrations:** four themed illustrations, with `illustration="auto"`
  picking by reason, and `[svIllustration]` / `[svMedia]` slots.
- **Onboarding:** a `steps[]` checklist (`stepClick`).
- **Search echo:** "No results for «x»", with `suggestions[]` and Clear
  search.
- **Errors and access:** `errorDetails` and `requestAccessLabel`.
- **Layout and extras:** `xs` and `xl` sizes, `align="start"`, an avatar
  stack, and a keyboard `shortcut`.
- **Labels:** `SV_EMPTY_STATE_LABELS`.

### Added — Sidebar nav: a full accessible rework, and `sv-sidebar-nav-pro`

`sv-sidebar-nav` gains:

- **Expansion:** `[(expandedIds)]`, `expandMode`, `[(collapsedGroups)]`,
  and collapsible groups and dividers.
- **Items:** a third level; item `id`, `dot`, `shortcut` and `external`.
- **Rows:** `badgeVariant`, `activeStyle`, `density`, `labels`, user and
  top slots, and the `svSidebarNavItemEnd` row-end template.
- **Keyboard:** Up / Down / Home / End and type-ahead.
- **Rail:** labels with a kit tooltip.
- **Drawer:** a scroll-area list with edge fades, a `push` drawer, and
  swipe to close / edge swipe to open.

**New in Pro:** `sv-sidebar-nav-pro` (`@styloviz-pro/layout`) adds search,
pins, `tone` (including `dual`), glass over media, a resizable width, a
workspace slot and portalled rail flyouts.

### Added — Anchor: nesting, numbering, progress and the Pro bar and outline

`sv-anchor` gains:

- nested and collapsible items, numbering and appearances;
- a reading-progress indicator and `activationOffset`;
- arrow keys and `hashSync`, plus `ariaLabel` (default "On this page");
- the exports `svFlattenAnchorItems` and `SV_ANCHOR_LABELS`.

**New in Pro** (`@styloviz-pro/layout`):

- `sv-anchor-bar`, a sticky underline bar with loading, error and empty
  states;
- `sv-anchor-outline`, generated from the page's headings
  (`svHeadingOutline`).

**Fixed:** `createScrollSpy` skips a section whose element has not rendered
yet, instead of throwing from `IntersectionObserver.observe(null)`. The section
is tracked as soon as your `sections` signal hands in its element.

### Added — Scroll area: two axes, snap, styles and a scroll API

- **Axes:** `orientation="both"` with a corner, and a sticky
  `[svScrollAreaHeader]` slot.
- **Snapping:** `snap` (`snapChange`).
- **Sizing:** `contentHeight`, and `fill` for a flex column.
- **Styles:** `scrollbars="inset"`, `thumbStyle`, `size`, `fadeStyle` /
  `fadeColor`, `variant="hover"` with `hideDelay`, and a `progress` bar.
- **Back to top:** a `backToTop` button.
- **Scroll API:** `scrollTo`, `scrollBy`, `scrollToStart`, `scrollToEnd`
  and `scrollIntoView`, which move the area and never the page.
- **Events:** `reachedEnd` / `reachedStart`.

### Added — File upload: edit forms, form rules and a real uploader (both tiers)

Both tiers gain:

- **Existing files:** `initialFiles` shows a record's existing
  attachments; they are never re-sent.
- **Text:** `labels` over `SV_FILE_UPLOAD_LABELS`.
- **Checks:** a sync or async `validator`.
- **Form rules:** `required`, `minFiles`, `maxTotalSizeMb` and
  `minSizeMb`.
- **Duplicates:** a `duplicates` policy.
- **Actions:** an `actions` row, with `retryFailed()`.
- **Uploading:** `svHttpUploader`, for XHR progress and pre-signed PUT
  uploads, which sends `ctx.meta` as multipart fields.
- **Demos:** a deterministic `demoFailureRate`.

On the free tier, `size` now scales the trigger.

**New in Pro:**

- **Listing:** a `grid` list with reordering, row preview and download.
- **Progress:** transfer stats.
- **Resuming:** `pausable` uploads with a `resumeStore`.
- **Dropping and removing:** `dropOnPage`, and a `beforeRemove` veto.
- **Templates:** row, empty and header template slots.
- **Metadata:** per-file `metadataFields`.
- **Sources:** URL and camera.
- **Previews:** video and PDF.
- **Drag checks:** a verdict during the drag, and `minImageSize` /
  `maxImageSize`.

### Added — Image cropper: zoom, turn, straighten, filters, round crops and a toolbar (Pro)

All of it is opt-in:

- **Transform:** `zoomable` with `[(zoom)]`, `[(rotation)]`,
  `[(flipX)]` / `[(flipY)]`, and `[(straighten)]` from −45° to 45°.
- **Adjustments:** `[(filters)]` for brightness, contrast and saturation.
- **Interaction:** `dragMode`.
- **Shape and output:** `shape="round"`, `outputSize`, `minOutput`,
  `initialCrop` and `showGrid`.
- **Aspect:** `aspect` as a model, with `aspectPresets`.
- **History:** undo / redo, and `resetView()`.
- **Toolbar:** a `toolbar` of controls.
- **Preview:** a live `sv-crop-preview`.
- **Loading:** `crossOrigin`.

The eight handles are now one roving tab stop. The mask leaves a real
undimmed hole, touch drags no longer cancel part-way, and the crop is
re-measured after a reflow.

### Added — Rich text editor: every toolbar tool is a switch (Pro)

`toolbar` takes a preset (`full`, `basic`, `minimal`, `comment` or `none`)
or an explicit list of `SvRteToolId`s. `hiddenTools` accepts any of the 33
tool ids, and there are `visibleTools`, `show(id)` and `showGroup(g)`. The
groups and presets are exported as `SV_RTE_TOOL_GROUPS` and
`SV_RTE_TOOLBAR_PRESETS`.

### Added — Jump menu: scroll to the section, follow a scroll-spy, Go mode

- **Scrolling:** `scrollTarget` and `scrollOffset` scroll to the chosen
  section, and a `jumped` output reports it.
- **Scroll-spy:** `activeId` lets a scroll-spy drive the select.
- **Go mode:** `goButton` / `goLabel` choose first and go on Go or Enter.
- **RTL:** supported.

### Added — Signature pad: `redo()` and `readonly`

- **History:** `redo()` / `canRedo` put back what `undo()` removed.
- **Read-only:** `readonly` shows a stored signature at full opacity, with
  no drawing.
- **Stored strokes:** strokes may carry their own `color` and `width`. They
  sit outside the `sv-signature-v1` hash, so old records still verify.
- **Restoring:** a pad restored while hidden re-fits when it appears.

### Added — Phone input: works in Angular forms

- **Forms:** `sv-phone-input` is a `ControlValueAccessor` (`[(ngModel)]`,
  `[formControl]`).
- **Forwarded inputs:** `hint`, `placeholder`, `required`, `name` and
  `variant` reach the number field.
- **Input mask:** `sv-input-mask` gains `placeholder`, `required`, `name`
  and `ariaLabel`.

### Fixed — Phone input: one label, a portalled country list, a single seam

- **Label:** the field label sits above the row, and the country button is
  named with the label and the country.
- **Country list:** it is portalled to `<body>`, so cards no longer clip
  it; it lines up in RTL.
- **Seam:** the seam between picker and field is drawn once, with logical
  borders.
- **One country:** when only one country is allowed, the picker becomes a
  static flag and dial code.

### Fixed — Smaller fixes across the kit

- **Autocomplete:** the "Showing N of M" row is inside the listbox and
  sticks to its bottom. The highlighted option scrolls into view. A mobile
  keyboard resize no longer closes the panel.
- **Field labels:** autocomplete, time picker, color picker, input mask and
  the Gantt, rich editor, query builder, address form and jump menu
  dialogs share the kit's 6 px label gap and dark-mode label colour.
- **Scroll area:** a horizontal strip now shrinks inside a grid or flex
  parent; it used to grow to its content width and never scroll.
- **Stepper (both tiers):** the state glyph is sized in px and centred.
  The vertical rail now runs under the indicators; it sat 40–64 px to their
  left.
- **Notification center (both tiers):** the search box has its own gap and
  separator when no tabs follow it.
- **Avatar (both tiers):** the fallback glyph and the Pro verified check
  scale with the avatar; they were 11 px at every size.
- **Drawer (Pro):** initial focus survives the first frames of the
  slide-in; it was landing on `<body>`.
- **Gantt (Pro):** the load-chart tooltip is no longer clipped by its
  scroll strip.
- **Sidebar and dashboard shell:** they transition only `width`,
  `translate`, `visibility` and `margin-inline-start`, not every property, and respect reduced
  motion. Collapsing no longer re-lays out the whole page per frame with
  the glass filter.

### Fixed — Scrolling no longer flashes flat panels over the content

Scrolling the component gallery — and the admin, dev and marketing pages —
could flash a flat rectangle in a card's own colour over its content. Every
demo card and dashboard card was a `backdrop-filter` surface inside the scroller,
and two 64 px `filter: blur()` glows sat behind it; the GPU re-applies both on
every scroll frame, and when it fell behind it painted a card with only its
tint. Glass now stays only where something really moves behind it — sticky
bars, overlays, controls over images — and everything else keeps its
translucent colour without the filter. Measured on the gallery's data-tables
page: composited layers 95 → 15, backdrop-filter layers 35 → 6, p95 scroll
frame 116 → 50 ms (software raster).

In the shipped packages: `sv-list-view`, `sv-page-header`, `sv-footer`,
`sv-spotlight-stat-card`, the `sv-widget-grid` glass layout, `sv-gift-card`,
the date-picker header and `sv-gantt-chart`'s tag popover no longer use
`backdrop-filter`; each keeps the stacking context the filter used to create
(`isolate`), so nothing layered inside them moves. `sv-list-view`'s `soft`
variant now lays its tint over the base surface instead of replacing it:
without the frost, the 25–40 % tint alone let most of whatever sits behind
the list show through its rows. Same colour on a plain background.

### Fixed — Skeleton shimmer: one sheen per bone, and it respects reduced motion

Every `sv-skeleton-loader` bone ran two counter-moving shimmers: the kit
stylesheet's global `.skeleton-wave` rule also animated the bone behind the
component's own sheen. Both shimmers repainted every bone on every frame. Each
is now a compositor-only `transform` animation with the same speed, width and
phase as before, and the global shimmer — which ignored
`prefers-reduced-motion` — now stops for readers who asked for less motion.

### Added — `.sv-glow` and `.sv-glow-rect`

A soft ambient glow with the look of `blur-3xl` on a coloured shape, drawn as a
mask instead of a GPU filter. Replace the blur utility and keep the shape's own
`bg-*`: `blur-3xl` → `sv-glow`, `blur-2xl` → `sv-glow sv-glow-2xl`,
`blur-[120px]` → `sv-glow [--sv-glow-blur:120px]`; rectangles and long, thin
shapes use `sv-glow-rect`. Within 1–9/255 of the real blur on every shape the
kit uses. Ships in `@styloviz/core/styles/styloviz.css`; browsers without CSS
math functions keep the original filter.

### Added — `svPauseOffscreen` (`@styloviz/core`)

A directive that pauses every CSS animation inside its host while the host is
out of view, and resumes them a little before it returns — for pages that
render many spinners, live dots or shimmers at once.

---
### Added — the chat chrome as components

`sv-ai-chat` is now built from five parts you can use on their own.

- **`@styloviz/ai`** — a new free package for AI chat building blocks:
  - **`sv-suggestions`**: starter prompts or follow-ups, as a list, a grid or
    chips. It takes `loading` / `error` / `retry` for prompts fetched from an API.
  - **`sv-message-actions`**: the row under a message. Copy confirms only after
    the clipboard write lands, and names the copy shortcut when it cannot. It
    also has thumbs up / down (`[(feedback)]`) and regenerate.
- **`@styloviz-pro/ai-chat`** now also exports:
  - **`sv-prompt-input`**: the composer. It has attachments under
    `svCheckAttachments` (a refused file stays visible with its reason), `/`
    commands, a model picker portalled to `<body>`, a mic toggle and a tools
    slot.
  - **`sv-thread-list`**: a searchable conversation history grouped by recency,
    with rename, pin and two-press delete.
  - **`sv-selection-toolbar`**: actions over selected text, with a keyboard path
    for read-only text.
- New `sv-ai-chat` inputs: `slashCommands`, `attachable`, `attachmentLimits`,
  `voice`, `listening`, `sessionActions` and `selectionActions`. New outputs:
  `promptSubmit`, `filesPicked`, `slashCommand`, `micToggle`, `sessionSearch`,
  `sessionRename`, `sessionPin`, `sessionDelete` and `selectionAction`. All are
  off or empty by default.
- `thumbs-down` joins the free icon set.

### Changed — `sv-ai-chat`

- **The model picker moved from the header into the composer's toolbar**, in the
  copilot and full-page layouts. The header still shows the model's name, and
  `[(selectedModel)]` / `modelChange` work as before. The menu is now portalled
  to `<body>`: the old panel sat inside the chat and an `overflow: hidden`
  ancestor clipped it.
- **The full-page history search works.** The box was bound to nothing. It now
  filters `sessions` by title and preview, and emits `sessionSearch` (debounced)
  for server search.
- **Enter that commits an IME composition no longer sends.** Japanese, Chinese
  and Korean input used to post half a word.
- While a reply streams, the composer stays editable, so you can draft the next
  question. Send turns into stop, and Enter does nothing.
- A message with attachments and no text can now be sent.

### Removed — `sv-ai-chat` internals · migration

These were public class members but not inputs or outputs. They are gone because
the parts that used them moved into the new components:

- `copiedId` and `copyFailedId`: the copied / failed state now lives in
  `sv-message-actions`. **Migrate:** use the `Promise<boolean>` that
  `copyMessage(id, text)` now returns (it used to return `Promise<void>`), and
  keep listening to `(copyFailed)`.
- `isModelOpen` and `toggleModelPicker()`: the picker belongs to `sv-prompt-input`.
  **Migrate:** use `selectModel(model)` or `[(selectedModel)]`.
- `setInput()`, `handleKeydown()` and `speedLabel()`. **Migrate:** set
  `inputText` and call `sendMessage()`.

### Added — Navigation build set

All additive and on today's behaviour by default unless noted under *Changed*.

- **Left / Right follow the reading direction.** Under `dir="rtl"` —
  read from the host with core `svIsRtl`, so a `dir="rtl"` ancestor counts — `sv-tabs`
  (horizontal), `sv-stepper` / `sv-stepper-pro` (horizontal, with `enableHotkeys`) and
  `sv-mega-menu` (the bar and every panel region: columns, tab list, icon grid, footer)
  mirror ArrowLeft / ArrowRight, so the arrow always points where focus goes. The mega
  menu's top-level bar now takes Left / Right (wrapping) and Home / End between its
  items, closing an open panel when focus moves on. New exports
  `svMegaMenuBarMove()` and `svMegaMenuLogicalKey()`; `svMegaMenuMove()` takes an
  optional trailing `rtl` argument. Full right-to-left support for the rest of
  the kit comes in a later release.
- **Nested-navigation specs.** A tabset in a tabset, an accordion in an
  accordion (both tiers), an anchor rail inside its own scroll container beside a page
  rail, and a breadcrumb menu in a dark RTL host: arrow keys stay in their level, ids are
  unique, the portal carries `dark`, `dir` and `lang`.
- **Back / Forward and no-JavaScript e2e.** `e2e/navigation-history.spec.ts`
  drives the real `svQueryParamNavLocation` with `page.goBack()` / `goForward()` over
  Tabs, Pagination, Stepper and Accordion `urlKey` state; `e2e/navigation-no-js.spec.ts`
  follows Anchor, Breadcrumb and Mega Menu links with `javaScriptEnabled: false`
  (`npm run e2e:navigation`). The guide `/docs/choosing-a-navigation-pattern` gains the
  two demos they drive: a live URL-state demo (deferred) and a server-rendered
  "Without JavaScript" section, proved by a `renderApplication` spec.
- **Print and find-in-page.** `sv-accordion` / `sv-accordion-pro` reveal
  every enabled panel on `beforeprint` through the reveal registry (rendered
  synchronously, height transition off under `print:`) and withdraw it on `afterprint`;
  the reader's `openIds`, the URL and `itemToggled` are untouched. New input
  `expandOnPrint` (`true`) and methods `expandAll()` (multi mode; a warned no-op in
  single) and `collapseAll()` (also collapses a live search reveal, rescuing focus).
  `sv-tabs` marks inactive MOUNTED panels `hidden="until-found"` where the browser
  supports it, and a `beforematch` selects that tab; new input `findInPage` (`true`).
  Never-visited lazy panels and `lazyRetention="destroy"` panels are not in the DOM —
  the documented omission — and print prints the active panel only.
- **A refused step is spoken.** `sv-stepper` / `sv-stepper-pro` announce
  every `stepBlocked` through `SvLiveAnnouncer`: "Cannot go to {step}. {reason}", with
  the built-in reason (disabled, validation; Pro: linear, guard) or the host's own
  `deny('…')` text. New input `announceBlocked` (`true`), public `blockedReasonText()`,
  new labels `stepBlocked`, `blockedDisabled`, `blockedValidation` (+ Pro
  `blockedLinear`, `blockedGuard`) in 12 languages. Showcase "Blocked Step and Error
  Summary": `(stepBlocked)` fills an `sv-form-error-summary` and focus moves to it.
- **Filterable FAQ.** A search field bound to `sv-accordion`'s
  `searchQuery` — showcase demo "Filterable FAQ" and a docs example.
- **Mega Menu, Breadcrumb and Jump Menu on `SV_NAV_TELEMETRY`.** New
  `surfaceId` input on each. Mega menu: a panel (or drawer page) opened is `explore`, a
  link / top-level item / featured card followed is `jump`, Escape is `escape`.
  Breadcrumb: a crumb or sibling page is `jump`, a sibling menu or the collapsed middle
  opened is `explore`, Escape out of the menu is `escape`. Jump menu: each destination
  taken is `jump`. Consent and retention are the sink's, as for Tabs and Pagination.
- **Workspace Switcher — new Pro component `sv-workspace-switcher` in
  `@styloviz-pro/layout`.** The current workspace of a multi-tenant dashboard and a
  body-portalled panel to change it: search across favourites, recents and every
  workspace grouped by organization, a favourite star per row (`[(favoriteIds)]`),
  locked workspaces with their reason (permissions), Create / Manage actions, and the
  async list states (`loading`, `error` + `retry`, no-data with Create, no-results).
  The switch is an explicit state: a pick sets `[(switchingTo)]` and emits
  `switchRequest`; the trigger goes busy (`aria-busy`, `data-sv-switching`) and is
  announced until the host commits by setting `[(currentId)]` ("Now in …") or
  abandons by clearing `switchingTo` ("Could not switch to …"). Exports
  `SvWorkspaceSwitcherComponent`, `svWorkspaceInitials`, `svWorkspaceMatches` and the
  types `WorkspaceSwitcherItem`, `WorkspaceSwitcherTone`, `WorkspaceSwitchRequest`,
  `WorkspaceFavoriteChange`; 21 new `layoutPro` labels in 12 languages. Showcase,
  docs, navigation and kit counts (161 components) updated.
- **Page header coordinates the page's navigation.** `sv-page-header`
  gains slots `[svPageHeaderBack]` and `[svPageHeaderBreadcrumb]` (above the title),
  `[svPageHeaderMeta]` (beside it) and `[svPageHeaderTabs]` (bottom edge), with marker
  directives `SvPageHeaderBackDirective`, `SvPageHeaderBreadcrumbDirective`,
  `SvPageHeaderMetaDirective`, `SvPageHeaderTabsDirective`; with a navigation slot in
  use the header is one `region` landmark named by its title (ADR Decision 2). New
  `actions` (`PageHeaderAction`, the toolbar action shape), `actionsLabel` and
  `actionClick`: the actions render through `sv-toolbar` with `overflow="menu"`, so what
  does not fit folds into the kit's "More actions" menu. Title, subtitle and the
  projected actions slot are unchanged. New `layout` label `pageActions`.

### Changed — Navigation · migration

- **RTL arrow keys.** Under `dir="rtl"`, ArrowLeft now moves to the NEXT
  tab / step / mega-menu column and ArrowRight to the previous one (they did the
  opposite). LTR is unchanged. *Migration:* tests or host key handlers that assumed
  ArrowRight = next inside an RTL page should follow the visual direction.
- **Mega menu bar arrow keys.** Left / Right / Home / End on a top-level item now move
  focus along the bar (they did nothing) and close an open panel when focus leaves its
  item. *Migration:* none for hosts.
- **Tabs: inactive mounted panels.** Where the browser supports
  `hidden="until-found"` (and `findInPage` is on), an inactive mounted panel carries
  that attribute instead of the `hidden` class. Both hide it; only the first is
  searchable. *Migration:* tests or CSS that looked for `.hidden` on an inactive panel
  should accept either, or set `[findInPage]="false"` for the old markup.
- **Accordion print.** Printing now includes every enabled panel.
  *Migration:* set `[expandOnPrint]="false"` for content that must stay off paper.
- **Stepper speaks refusals.** A blocked move is now announced. *Migration:*
  a host that already announces or focuses its own message on `(stepBlocked)` sets
  `[announceBlocked]="false"` so the reader is not told twice.
- **Telemetry.** With `provideSvNavTelemetry()` wired up, Mega Menu,
  Breadcrumb and Jump Menu now send events to the sink. *Migration:* none — without a
  sink nothing is recorded.
- **`check:ui`.** `workspaces` joins the collection-input names the
  data-wiring rules check, and `sv-workspace-switcher` is in
  `scripts/data-wiring.migrated.json`.
- **In-page links carry the page path.** `sv-anchor`'s rail links and
  `sv-dashboard-shell`'s skip link render `href="/current/path#id"` instead of
  `href="#id"`. Under an Angular app's `<base href="/">` a bare fragment resolves to the
  site root, so without JavaScript (a prerendered page before hydration) the link left
  the page; found by `e2e/navigation-no-js.spec.ts`. New core helper `svFragmentHref`.
  With JavaScript nothing changes — the click handlers still scroll or focus in place.
  *Migration:* tests asserting `href="#id"` should expect the page path in front.

### Added — Layout build set

All additive and on today's behaviour by default unless noted under *Changed*.

- **Splitter drags always end.** `sv-splitter`'s separator uses Pointer
  Events with pointer capture — one path for mouse, touch and pen — so a release outside
  the window still reaches it, and a drag also ends on `pointercancel`, lost pointer
  capture and the window losing focus. Only the primary pointer drags (a second finger is
  ignored), and the separator is `touch-action: none`. New outputs `resizeStart` and
  `resizeEnd` (the split % it started from / settled at) bracket every gesture — a drag,
  however it ended, and each keyboard or step-button move — so a host persists on
  `resizeEnd` instead of every `resized`. Double-clicking the separator runs
  `resetLayout()`.
- **RTL for the layout family.** Under `dir="rtl"`: `sv-splitter`'s drag is
  measured from the right edge (core `svPointerFraction`), ArrowLeft/Right move the
  divider the way the arrow points, and the step buttons' arrows and names and the collapse
  chevrons mirror (new public `rtl` signal; `splitAt` stays logical). `sv-toolbar`'s
  Left/Right follow the visual direction (Up/Down/Home/End unchanged) and its menu rows
  align to the inline start. `sv-dashboard-shell` offsets the content with
  `margin-inline-start` and `sv-sidebar` is pinned to the inline start (`start-0`,
  `border-e`, the closed overlay slides off to the right). `sv-divider`'s vertical rule
  draws on the inline-start edge. `sv-watermark` marks carry `dir="auto"`. RTL specs for
  splitter, toolbar, shell, sidebar, divider and watermark.
- **Skip link in the app shell (WCAG 2.4.1).** `sv-dashboard-shell`'s first
  focusable element is a "Skip to main content" link, hidden until focused, that moves
  focus to `<main>` (now `tabindex="-1"` with a generated id). New inputs `skipLink`
  (`true`) and `skipLinkLabel`; new method `focusMain()`; new `layout` label
  `skipToMainContent` (12 languages).
- **Number Ticker: locale grouping and compact notation.** The plain format
  takes grouping and the decimal mark from `locale` through `Intl.NumberFormat`
  (`1.234,5` in de-DE, `12,34,567` in hi-IN; 1e21 prints as digits). New input / option
  `notation: 'standard' | 'compact'` on `sv-number-ticker`, `svFormatTickerNumber`,
  `svFormatTickerDisplay` and the `svTickerNumber` pipe (`1.2M`, `$1.2M`, `1,2 Mio.`); new
  type `SvTickerNotation`. Changing a formatting input re-renders the settled figure in
  place.
- **Toolbar action metadata.** `ToolbarAction.pending` — `aria-busy`, a
  spinner (`motion-safe:animate-spin`) in place of the icon and an inert click, without
  disabling the button — the per-action twin of `busyIds`, which now shows the same
  spinner. `ToolbarAction.shortcut` (an `sv-kbd` chord such as `mod+s`) is exposed as
  `aria-keyshortcuts` and drawn with `sv-kbd` in an `sv-tooltip` and in the overflow-menu
  row. New export `svToolbarAriaShortcut()`; new public `isPending()` and
  `shortcutKeys()`. Showcase demo "Pending Actions and Shortcuts".
- **Nesting and multi-instance specs.** Nested splitters, nested scroll
  areas, nested expands, two (and a late third) affixes on one page, and each family's
  content added after init — `splitter.nesting.spec.ts`, `scroll-area.nesting.spec.ts`,
  `expand.nesting.spec.ts`, `affix.multi.spec.ts`.
- **Layout reflow e2e matrix.** `e2e/layout-reflow-matrix.spec.ts`
  (`npm run e2e:layout`): every Layout & Utilities family, derived from the docs registry,
  at 320 CSS px (1280 px at 400 % zoom) and on a 390 px touch device — no sideways scroll
  in `<main>`, no clipped controls, a PNG per cell — plus affix dock transitions, splitter
  drag, the toolbar overflow menu, scroll-area thumbs and WCAG 2.5.8 target spacing, speed
  dial menus, and a floating speed dial + Scroll to Top stacking clear of each other (new
  opt-in showcase demo "Floating, stacked with Scroll to Top").
- **Expand renders its initial state on the server.** The collapsed
  `display: none` is a template binding, so a prerendered collapsed panel ships hidden and
  hydrates without a flash; proved with a real `renderApplication` render
  (`expand.ssr.spec.ts`).
- **Watermark docs.** "Durable marks are server-side": stamp exports and PDFs
  on the server, keep the client mark as an on-screen deterrent.

### Changed — Layout · migration

- **`sv-splitter` drags with Pointer Events.** The separator listens to `pointerdown`
  (not `mousedown` / `touchstart`) and the public handler methods `onMousedown`,
  `onMouseMove`, `onMouseUp`, `onTouchStart`, `onTouchMove` and `onTouchEnd` are gone
  (replaced by `onPointerDown`). Keyboard and step-button moves now also emit
  `resizeStart` / `resizeEnd`. *Migration:* tests that dispatched `mousedown` /
  `mousemove` / `mouseup` (or `touch*`) on the separator dispatch `pointerdown` /
  `pointermove` / `pointerup`; nothing to change for a host that only binds inputs and
  outputs.
- **`sv-number-ticker`'s plain format follows `locale` (breaking for non-English
  locales).** `separator` now defaults to `null` — the locale's grouping — instead of
  `','`, and the decimal mark is the locale's instead of always `.`; `separator` set
  explicitly overrides only the group separator. Rounding is `Intl`'s (half away from
  zero) rather than `toFixed`'s. Output under the default `en-US` locale is unchanged for
  ordinary values. *Migration:* to keep the 1.x output in another locale, bind
  `locale="en-US"` (and `separator=","` if you relied on it); the same applies to the
  `svTickerNumber` pipe and `svFormatTickerNumber`, whose `separator` option is now
  "the locale's" when omitted.
- **`sv-toolbar` composes `sv-tooltip` and `sv-kbd`.** `@styloviz/layout` adds the peers
  `@styloviz/overlays` and `@styloviz/kbd`. An action with a `shortcut` is wrapped in
  `<sv-tooltip>` and its button loses the native `title`; actions without one are
  unchanged. A busy action (`busyIds`) now shows a spinner in place of its icon.
  *Migration:* install the two peers; selectors that expected the action button as a
  direct child of `[role="toolbar"]` should query `[data-sv-toolbar-index]` instead.
- **`sv-dashboard-shell` renders a skip link and `<main tabindex="-1" id="…">`.** The
  shell's first Tab stop is now "Skip to main content". *Migration:* if the page already
  renders its own skip link, set `[skipLink]="false"`.
- **Logical edges in the layout family.** `sv-dashboard-shell`'s content offset classes
  are `lg:ms-64` / `lg:ms-20` (were `lg:ml-*`), `sv-sidebar` is `start-0 border-e` (was
  `left-0 border-r`), and `sv-divider`'s vertical rule is `border-s` /
  `border-inline-start-*` (was `border-l` / `border-left-*`). Identical in LTR.
  *Migration:* update tests or CSS that targeted the physical class names.
- **`sv-expand` no longer writes its initial `display` in `ngAfterViewInit`** (the class
  no longer implements `AfterViewInit`); the state is the same, rendered from the template.
- **Reflow at 320 px.** Found by the layout reflow matrix
  (`e2e/layout-reflow-matrix.spec.ts`):
  - `sv-sidebar`'s closed overlay is `invisible` below `lg` (`max-lg:invisible`, with
    `visibility` in the transition), not only translated off-canvas — its links were
    still in the tab order and the accessibility tree. Unchanged from `lg` up.
  - `sv-toolbar`'s host is `min-w-0 max-w-full` in every overflow mode (was only in
    `menu`), so in a flex row `overflow="scroll"` scrolls instead of pushing the trailing
    actions out of its container.
  - `sv-site-footer`'s brand + columns grid is `grid-cols-1` (was an implicit `auto`
    track), link labels wrap inside their column (`min-w-0 break-words`), the column
    gap is `gap-x-6` below `sm`, the inset is `px-4` below `sm` (was `px-6`), and the
    hover underline starts at the inline start (`start-0`).
  - `sv-speed-dial` with `direction="left"` / `"right"` lays its actions out vertically
    (`up` or `down`, whichever has more room) when the row fits on neither side of the
    FAB; the list is `w-max`, and the menu carries `data-sv-direction` with the
    direction in force (new `layoutDirection` signal). Wide windows are unchanged.
  - `sv-copy-to-clipboard`'s `block` variant fills the width it is given and never sets
    it: the host is `block grow min-w-0 max-w-full`, and the value line has
    `contain: inline-size` with a `12ch` floor. It used to grow to the full
    value in an auto grid track, an auto table cell or a flex item and push its copy
    button off-screen, while truncating in a card. `inline` and `icon-only` are
    unchanged. Proof: `e2e/copy-to-clipboard-width.spec.ts`.
  - `sv-radar-chart` (both tiers) sizes its SVG box to hold the axis labels. Side
    labels sat at 1.18× the radius and drew past a `0 0 size size` viewBox, visible only
    while a parent left room; a phone-width card cut them off. The rendered box is now
    slightly larger than `size` when labels need it, and the chart scales to fit.
  - `sv-line-chart-pro` labels only the categories in its visible window. A `live` or
    zoomed chart labelled every category, so readings that had scrolled out drew their
    x-axis labels over the y axis and past the chart's left edge.
  *Migration:* none for hosts; tests or CSS that targeted the old classes, or expected a
  closed `sv-sidebar` to stay `visible` below `lg`, need updating.

### Added — Charts build set

All additive and on today's behaviour by default unless noted under *Changed*.

- **Series emphasis on radar and line, both tiers.** The legend of
  `sv-radar-chart(-pro)` and `sv-line-chart(-pro)` is a `role="toolbar"` of `aria-pressed`
  toggle buttons with one tab stop: hover or focus an entry and every other series fades,
  Enter / Space / click hides or shows it (announced through `SvLiveAnnouncer`), and the
  arrow keys, Home and End move between series. A focused radar vertex also puts its polygon
  in front. The last visible series cannot be hidden; a hidden series stays in the summary
  table, the line chart's tooltip drops it, and the value axis keeps its scale.
  - New on all four components: `interactiveLegend` (`true`) and `hiddenSeries`
    (`model<readonly string[]>`, `[]` — two-way bindable, so a host can persist it).
  - New in `@styloviz/core`: `createSeriesEmphasis()` (`SvSeriesEmphasis`,
    `SvSeriesEmphasisOptions`) and `SV_SERIES_DIMMED_OPACITY` — the one emphasis model the
    four charts share; core labels `seriesLegend`, `seriesLegendHint`, `seriesShown`,
    `seriesHidden`, `seriesLastVisible` (12 languages).
- **Heatmap grid.** `sv-heatmap-chart` is an ARIA `role="grid"` with real
  `columnheader` / `rowheader` cells (an unlabelled one is named "Column n" / "Row n") and
  `gridcell` squares, and ONE tab stop with 2-D roving: arrows (skipping holes), Home / End,
  Ctrl+Home / Ctrl+End, Page Up / Page Down (five rows). An off-screen hint
  (`heatmapGridHint`, 12 languages) is attached with `aria-describedby`. The grid is ledgered
  in `check-visual-alternatives` as the chart's `native` non-visual alternative;
  `e2e/chart-keyboard.spec.ts` drives it in a real browser.
- **Invalid scales are disclosed.** `sv-gauge-chart` with `max <= min` or a
  non-finite bound states the bounds in the frame notice and its accessible name (label
  `gaugeInvalidScale`); `sv-radial-bar-chart` says when a chart-wide `max` is not above zero
  (`radialBarInvalidMax`). New public computeds on the gauge: `scaleValid`, `invalidScaleNote`.
- **Reduced motion for every chart entrance.** The kit stylesheet
  (`@styloviz/core/styles/styloviz.css`) and the strip-line, trend-line, gradient-donut and
  click-to-add stylesheets carry a `prefers-reduced-motion: reduce` guard for every keyframe
  class (`bc-*`, `lc-*`, `sl-*`, `tl-*`, `gd-*`, `cap-*`; the command palette's `cp-panel` too).
  The live stream steps instead of gliding, and the live badge / drilldown pulse stills.
  `check:reduced-motion` now scopes `projects/charts` and `projects/charts-free` and gains
  rule (d): every CSS rule that runs a `@keyframes` animation must be named in a
  reduced-motion block in its own file.
- **Mixed-sign dense case.** `/chart-states` draws `sv-negative-stack-chart`
  and `sv-stacked-bar-chart` on a 12 × 4 mixed-sign fixture (`DENSE_MIXED_SIGN_*`) inside the
  bar card, so `e2e/visual-matrix.spec.ts` photographs and measures a stack that crosses zero.
- **Docs.** The gauge's *When to use* points at the Bullet Chart for precise
  comparison; the bar docs and gallery mark the cylindrical and gradient treatments as
  decorative.
- **Licensing copy.** Every free README drops "premium" and states the MIT free
  tier / commercial Pro split under its description (Pro READMEs state their commercial
  license up top too); the license footer links https://styloviz.dev/license. One generator
  change (`scripts/generate-readmes.mjs`), pinned by `scripts/generate-readmes.node.spec.ts`.
- **Gradient donut.** The "of {total}" line under a hovered slice is the
  `gradientDonutOfTotal` label (12 languages) — it was a hard-coded English "of".

### Changed — Charts · migration

- **`sv-heatmap-chart` squares are `role="gridcell"`, not `role="button"`, and only one is
  in the tab order** (the grid is `role="grid"`, no longer `role="group"`). Enter / Space /
  click still emit `cellSelect`; focus still emits `cellHover`. Column headers are drawn for
  the columns the data has — labels past the last column are no longer printed. The
  `heatmapPastCeiling` note no longer claims a keyboard cost. *Migration:* update tests or
  selectors that query the squares by `role="button"` / `[role="group"]` (use `gridcell` /
  `grid`, or `[data-sv-cell="row:col"]`); a host overriding `heatmapPastCeiling` should
  re-read the new English.
- **The radar and line legends are buttons by default.** Clicking an entry now hides that
  series. *Migration:* bind `[interactiveLegend]="false"` for the old static key; tests that
  found the legend text in a `<span>` find it in a `<button>` now.
- **`sv-gauge-chart` draws an empty dial for an unusable scale.** `max <= min` or a
  non-finite bound used to fall back to a span of 1 (or go negative) and draw an arc; it now
  draws no progress, bands, target notch or band status, and says why. *Migration:* none for
  a valid scale; fix the bounds if the notice appears.
- **Chart entrances do not animate under `prefers-reduced-motion: reduce`**, and the live
  stream steps rather than glides. *Migration:* none — re-import
  `@styloviz/core/styles/styloviz.css` (it is regenerated).

### Added — AI build set

All additive and off (or today's behaviour) by default unless noted under *Changed*.

- **Gate:** `check:ai-demo-defaults` (in `verify:static`) reads every `input()` / `model()`
  default in the 24 AI packages with the TypeScript AST and fails a fixture-named default
  (`DEMO_` / `MOCK_` / `SAMPLE_` …) or a record-list default, inline or behind a constant.
  Sample data ships as exported `DEMO_*` constants that demos pass explicitly.
- **New inputs / outputs / models:**
  - `sv-agent-approval`: `reasonRequired` (`never` | `high-risk` | `always`) — a required,
    labelled reason field; the trimmed `reason` rides on `AgentApprovalResult` and
    `AgentApprovalReceipt`.
  - `sv-mcp-tool-registry`: `healthStaleAfter` (`SV_MCP_HEALTH_STALE_MS`, 5 min) and `locale`
    — every status shows its `lastCheckedAt` age, marked stale past the window, and the
    header counts stale servers.
  - `sv-tool-call-card`: `maxDepth` (`SV_TOOL_CALL_MAX_DEPTH`, 4) with "Show N nested calls",
    `maxPaneChars` (`SV_TOOL_CALL_PANE_CHAR_CAP`, 10,000) with Show all + Download,
    `locale`, `depthRevealedIds` / `fullPaneKeys` (models) and `paneDownloaded`.
  - `sv-reasoning-trace`: `maxDepth` (`SV_REASONING_MAX_DEPTH`, 4) with "Show N nested
    steps", and `depthRevealedIds` (model).
  - `sv-embedding-map`: `projection` (`EmbeddingProjection` — method, params, model,
    modelVersion) as a caption and in the plot's `role="img"` name.
  - `sv-ai-writing-assistant`: `textLanguage`, `proseDiffMaxTokens` (`SV_PROSE_DIFF_MAX_TOKENS`).
  - `sv-voice-assistant`: `lowConfidence` (`SV_LOW_CONFIDENCE`, 0.6).
  - `sv-sentiment-analysis-widget`: `aspectMinMentions` (`SV_ASPECT_MIN_MENTIONS`, 5).
  - `sv-artifact-panel`: `diffLineCap` (`SV_DIFF_LINE_CAP`).
- **Chat:** `sv-ai-chat` renders a `filtered` reply (content filter / refusal) with a
  safety-filter notice and the provider's reason, no actions and no resend;
  `filterAssistantMessage()`; `ChatMessage.model` / `modelVersion` in every variant's meta
  line; `beginAssistantMessage(id, { model, modelVersion })`; `svChatProvenance`.
  `@styloviz-pro/ai-chat-transport`: `svIsContentFiltered`, a content-filter case in
  `svStreamNotice`, and `svToChatMessage` takes `model` / `modelVersion`.
- **Prompt library:** a refused copy selects the resolved prompt, shows and announces a
  ⌘C / Ctrl+C hint and names it on the button (grid, list and editor), like `sv-ai-chat`.
- **Citations:** `SourceRef.retrievedAt` renders as a relative age in `<time datetime>`;
  new `SourceRef.access` (`paywalled` | `dead` | `denied`) renders a named state with the URL
  as text instead of a link; the coverage strip says attributed is not verified as supported.
- **Eval scorecard:** the compare verdict names its method in the UI (non-overlapping 95%
  Wilson intervals — a conservative heuristic, not a significance test).
- **Workflow builder:** `svValidateWorkflow` (missing trigger, dangling edges/ports, orphans,
  nodes unreachable from a trigger, branches leading nowhere) rendered as a validation list
  in the canvas variant; the docs, JSDoc and README state the size ceiling (~50 nodes / ~10
  columns, not enforced) and the supported topologies (chains, fan-out, fan-in, loops; no
  nesting).
- **New helpers / demo data:** `DEMO_PAST_RUNS`, `KbPastRun`, `svMcpHealthFreshness`,
  `svMcpHealthAge`, `svTruncatePane`, `svToolCallDescendants`, `svToolCallWithinDepth`,
  `svToolCallPaneFilename`, `svStepWithinDepth`, `svStepDescendants`, `svProjectionMetaLabel`,
  `svProjectionParams`, `DEMO_PROJECTION`, `svReadability`, `svReadabilitySupported`,
  `svReadabilityGrade`, `svPrimaryLanguage`, `svLanguageName`, `SV_READABILITY_LANGUAGES`,
  `svProseDiffCap`, `svLowConfidenceCutoff`, `svAspectMinMentionsFloor`, `svDiffLineCap`,
  `svSourceFreshness`, `svSourceAccess`, `DEMO_SOURCES_RESTRICTED`, `svValidateWorkflow`,
  `DEMO_WORKFLOW_DRAFT`.
- **Tests:** the AT harness gains a real insecure origin (`sv-insecure.test`) and a Pixel 7
  project with the compiled stylesheet; `e2e/ai-chat.at.spec.ts`,
  `e2e/prompt-template-library.at.spec.ts` and `e2e/ai-agent-activity-log.at.spec.ts`.

### Changed — AI · migration

- **`SentimentLabel` adds `'mixed' | 'unknown'`** (`sv-sentiment-analysis-widget`). The
  breakdown, topic bars, aspects and feed render them; unknown mentions are left out of
  means and ranking, `SvAspectRow.neutral` counts only neutral mentions, a neutral item in a
  language the classifier cannot read shows as unknown, and `feedCounts()` has two more keys.
  `aspectMinMentions` was a plain field and is now an input. *Migration:* add the two cases
  to any exhaustive `switch` / `Record<SentimentLabel, …>`; send `unknown` for text you could
  not score; read `aspectFloor()` or bind `[aspectMinMentions]`.
- **`MessageStatus` adds `'filtered'`** (`@styloviz-pro/ai-chat`), and `svToChatMessage`
  returns `filtered`, not `complete`, for a `content_filter` / `refusal` finish.
  *Migration:* add a `'filtered'` branch to any exhaustive `switch` on `ChatMessage.status`.
- **`sv-ai-chat` message hooks are `data-sv-message-state`** (`message-sending` |
  `message-failed` | `message-error` | `message-filtered`); they were `data-sv-state`, which
  collided with the page-level async contract. *Migration:* update e2e or CSS selectors.
- **`sv-rag-knowledge-base` `pastRuns` defaults to `[]`.** It rendered a bundled, invented run
  history ("run-2023-018 … 6 hours ago"), and the run titles now name your
  `pipelineRun.id` instead of a hard-coded "#019". *Migration:* pass your indexer's runs to
  `[pastRuns]`; demos pass the exported `DEMO_PAST_RUNS`.
- **`sv-ai-writing-assistant` scores readability for English only.** A non-English
  `textLanguage` (or `locale`) shows "Readability not available for <language>" instead of an
  English Flesch score; the grade text is the `gradeLevel` label. *Migration:* set
  `textLanguage="en"` when the text is English but the UI locale is not.
- **`sv-tool-call-card`** puts sub-calls more than 4 levels deep behind "Show N nested calls"
  and truncates an argument or result pane past 10,000 characters. *Migration:*
  `[maxDepth]="0"` and / or `[maxPaneChars]="0"` restore the old rendering.
- **`sv-reasoning-trace`** puts sub-thoughts more than 4 levels deep behind "Show N nested
  steps". *Migration:* `[maxDepth]="0"`.
- **`sv-embedding-map`'s plot name and a new caption** say how the map was made, or that it
  is not recorded. *Migration:* bind `[projection]`; tests asserting the exact `aria-label`
  need the extra sentence.
- **`sv-eval-scorecard` verdict wording** no longer says "a real improvement".
  *Migration:* tests or label overrides reading `verdictImprovement` / `verdictRegression`
  need the new English.
- **`sv-ai-workflow-builder`'s canvas** shows a validation section when the loaded graph has
  findings (always with `[editable]`), and `DEMO_FAILED_RUN`'s nodes declare ports.
  *Migration:* none.
- **`sv-ai-agent-activity-log` trace on phones:** below `sm` only the duration column shows;
  self time, tokens and cost stay in the row's accessible name and the step detail.
  *Migration:* none.
- **`sv-prompt-template-library` `copyPrompt()`** resolves `Promise<boolean>` (was `void`).
  *Migration:* none.

### Added — Forms build set

All additive and off (or today's behaviour) by default unless noted under *Changed*.

- **New helpers (`@styloviz/core`):**
  - `svInlineAnchor` (`SvInlineAnchor`, `SvInlineAnchorRequest`) — the inline-axis half of
    `svPositionAnchored` for edge-pinned panels: start-edge alignment that mirrors under
    `dir="rtl"`, with the end edge as the overflow fallback.
  - `createCreateFlow` (`SvCreateFlow`, `SvCreateFlowOptions`, `SvCreateRequest`,
    `SvCreatedEntity`, `SvPendingCreate`) — one "create new" state machine: typed request with
    an idempotency key, `resolve()` / `reject()` that settle once, the pending entity, and
    announcements through `SvLiveAnnouncer`; labels `core.createPending` / `createDone` /
    `createFailed`.
  - `svFoldText`, `svTextMatches` (`SvTextMatchMode`, `SvTextMatchOptions`) — accent- and
    case-folded matching in a locale; `svHighlightSegments(text, query, options?)` takes the
    same options.
  - `svDayPeriods` (`SvDayPeriods`) and `svParseTime(text, { locale })`
    (`SvParseTimeOptions`) — a locale's own AM/PM markers from `Intl`, read back before or
    after the digits.
  - `SvAutosizeDirective` (`textarea[svAutosize]`, `svAutosizeValue`, `svAutosizeMaxRows`) —
    `field-sizing: content` where supported, a measured fallback elsewhere.
- **New inputs / outputs / fields:**
  - `sv-autocomplete`: `creatable`, `awaitCreate`, `(createRequest)`; `match`
    (`'substring' | 'prefix' | (option, query) => boolean`, type `AutocompleteMatch`);
    `groupLabelIds`. Label `forms.createOption`.
  - `sv-select-dropdown-pro`: `creatable`, `awaitCreate`, `(createRequest)` (needs
    `svSelectSearch`); `sheetOnNarrow`. Label `selectDropdownPro.createOption`.
  - `sv-select-dropdown`: `sheetOnNarrow`.
  - `sv-tag-input-pro`: `awaitCreate`, `(createRequest)` on `variant="creatable"`;
    `tagValidator` (+ `TagValidator`), `invalidTags`, `invalidSummary`, an `NG_VALIDATORS`
    validator (`{ invalidTags: { values } }`).
  - `sv-tag-input`: `tagValidator`, `invalidTags`, `invalidSummary`, the same validator.
    Labels `invalidTag` / `invalidTagsSummary` in `tagInput` and `tagInputPro`.
  - `sv-tree-select`: `sheetOnNarrow`. `sv-split-button`: `sheetOnNarrow` (forwarded to its
    dropdown menu).
  - `sv-time-picker`: `locale` (default the kit locale), `minuteStep`. Label
    `forms.timePickerExample`.
  - `sv-input-mask`: `locale`; exported `svDateMaskFormat`, `svTimeMaskSeparator`,
    `InputMaskDateOrder`. Labels `forms.maskDay/Month/Year/Hour/MinuteLetters`.
  - `sv-number-input`: `wheelSteps`.
  - `sv-input-field`, `sv-input-field-pro`: `clearable`, `(cleared)`, `autosize`, `maxRows`.
    Label `inputField.clear`.
  - `sv-inplace-edit`: `autosize`, `maxRows` (with `mode="textarea"`).
  - `sv-search-bar`, `sv-search-bar-pro`: the suggestion count is announced
    (`countAnnouncement`; labels `searchBar.suggestionCount`, `searchBarPro.suggestionCount`).
  - `sv-mention`: `maxLength` (plain-text, mention chips atomic) with a counter and an
    `NG_VALIDATORS` `{ maxlength }` validator. Labels `formsPro.mentionCharCount`,
    `mentionLimitReached`, `mentionNoRoom`.
  - `sv-group`: `ariaLabel`.
- **Docs & gates:** every Forms & Inputs family states, per selector, whether it is a
  ControlValueAccessor or output-driven and why (new docs field `outputDriven`,
  `ResolvedDoc.formIntegration`, a "Forms integration" section and README table,
  `npm run form-contracts:sync` / `check:form-contracts` in `verify:static`); a File Upload
  browser-support matrix (`docs/browser-support/file-upload.md`, in both READMEs; docs field
  `browserSupport`); `check:ui` rule `portal-context-dropped`; `target-size-minimum` sizes a
  glyph bound from a computed class map; eight forced-colours ledger rows; e2e specs
  `e2e/number-input-wheel.spec.ts` and `e2e/rich-editor-browser-legs.spec.ts` (with the Word
  paste fixture `e2e/fixtures/rich-editor/word-paste.html`).

### Changed — Forms · migration

- **A pasted tracking pixel is dropped.** `svCleanPastedHtml` (the rich text editor's paste and
  drop path) now removes an `<img>` declared 1×1 or smaller, so inserting a paste from mail or a
  web page no longer fetches it; it is listed in `droppedElements`. Real images are kept. The
  editor's stored-document profile is unchanged.
- **The form overlays keep the context they were opened in.** Autocomplete, the date and
  date-range pickers, time picker, colour picker, select (both tiers), tag input (both),
  search bar (both), mention, cascader and tree select portal through `createPortalHost`:
  `dir`, `lang` and a locally scoped `.dark` / `data-theme` now reach the panel, and the host
  carries `data-sv-portal="<name>"`. Under `dir="rtl"` a panel wider than its trigger lines up
  on the trigger's right edge (it was the left). `sv-tag-input-pro`'s panels gain the classes
  `sv-tag-input-portal` / `sv-tag-input-overflow-portal`. *Migration:* none.
- **Grouped listboxes expose their groups.** Grouped `sv-autocomplete`, `sv-search-bar-pro`
  (`groupByCategory`) and `sv-tag-input-pro` (`variant="grouped"`) render each section as a
  `role="group"` named by its heading (`aria-labelledby`); the heading is a `<div>` inside a
  presentational `<li>`, no longer a header `<li role="presentation">`. *Migration:* a test or
  stylesheet that targeted the old header `<li>` should target `[role="group"]` and its label.
- **Matching and highlighting fold accents and case** in the locale — `jose` finds and marks
  José — in `sv-autocomplete`, both selects' local search and both search bars' highlight
  (and the highlight in accordion, command palette and tree view, which share
  `svHighlightSegments`). *Migration:* none.
- **`sv-time-picker` speaks the locale's day periods** (`午前`/`午後` first in Japanese,
  `a. m.`/`p. m.` in Spanish) on its buttons, trigger and typed field, where it rendered the
  literals `AM`/`PM`; the typed-entry hint is a label. *Migration:* none for en-US.
- **`sv-input-mask`'s `date` and `time` presets follow the locale** — `DD.MM.YYYY` in German,
  `YYYY/MM/DD` in Japanese — so the masked VALUE is in that order for a non-en-US locale.
  The default `LOCALE_ID` (en-US) is unchanged. The US-only presets say so: `maskSsn` is
  now "SSN (US)" and `maskZip` "ZIP+4 (US)". *Migration:* set `locale="en-US"` on a mask
  whose stored format must stay `MM/DD/YYYY`.
- **`sv-input-mask` no longer reformats during an IME composition**; it formats the committed
  text on `compositionend`. *Migration:* none.
- **A wheel over a focused `sv-number-input` scrolls the page instead of stepping the value**
  (Chromium stepped it silently). *Migration:* `[wheelSteps]="true"` restores it.
- **`sv-tag-input-pro`'s creatable tags** emit `(createRequest)` and show the label they were
  created with (not their slug, not italic). *Migration:* none.
- **`sv-group` is `role="group"` only when named** (`label` or `ariaLabel`); an unnamed group —
  including `sv-split-button`'s wrapper — has no role and no `aria-invalid`, and an unnamed
  group with an error or a collapse warns once in dev. *Migration:* give a group that should
  be announced a `label` or `ariaLabel`.
- **24 px targets (WCAG 2.5.8):** `sv-chip`'s remove button, `sv-toggle-switch` (xs/sm tracks)
  and the select-dropdown clear control carry `sv-target`; `sv-rating` whole stars at `sm` are
  padded to 24 px slots. *Migration:* none.
- **Forced colours (Windows High Contrast):** checkbox, radio group, toggle switch,
  segmented control, slider and rating keep their state visible with system colours; the
  checkbox mark is drawn with `currentColor`. *Migration:* none.

### Added — Overlays & Feedback build set

All additive and off (or today's behaviour) by default unless noted under *Changed*.

- **New helpers (`@styloviz/core`):** `createDelayedVisibility` (show a loader after
  `showAfterMs`, keep it `minVisibleMs`), `ToastService.promise()` with
  `ToastPromiseMessages<T>` (one toast pending → success / error), and the shared
  drag-to-dismiss gesture `svSwipeGesture` / `svSwipeDismisses` / `svIsSwipePointer`
  (`SvSwipeDirection`, `SvSwipeSample`, `SvSwipeGestureOptions`, `SvSwipeDismissRule`).
- **New inputs / outputs / fields:**
  - `sv-modal`, `sv-drawer`, `sv-popover` (and so the Popout preset): `sheetOnNarrow` — the
    kit's bottom-sheet contract (safe area + virtual keyboard) below 640px. Drawer also
    exposes `effectivePosition()`.
  - `sv-dropdown-menu` (and context menus): cascading submenus — `DropdownMenuItem.children`,
    `submenuOpenDelay`, `submenuCloseDelay`, `ownsHorizontalKey()`, `DropdownSubmenuLevel`;
    label `overlaysPro.submenuBack` in all 12 packs.
  - `sv-menubar`: `collapseBelow` (one "Menu" button with the menus as submenus) and
    `collapsed()`; submenu items' `keys` register like any other.
  - `sv-spinner`, `sv-skeleton-loader`: `active`, `showAfterMs`, `minVisibleMs`,
    `(visibleChange)`.
  - `sv-toast-host`: a dev warning when two hosts render one position; `Toast.pending`.
  - `sv-alert-banner`: `persistKey` / `persistVersion` (a remembered dismissal, through
    `svPersistedStore`), `dismiss()`, `SV_ALERT_BANNER_DISMISSAL_KIND`,
    `SvAlertBannerDismissal`.
  - `sv-notification-center` (free and Pro): `NotificationLoadMoreEvent.cursor`
    (`NotificationCursor` — `{ id, timestamp }` of the last notification in hand).
  - `sv-drawer`: `swipeToClose`, `swipeVelocity`.
- **Docs:** a "Choosing a feedback pattern" guide (`/docs/choosing-a-feedback-pattern`),
  reduced-motion, forced-colour and contrast notes on every feedback family, and a fixed
  Toast action example (it called an API that does not exist).

### Changed — Overlays & Feedback · migration

- **`SvLiveAnnouncer` creates its two live regions when it is constructed** (in the browser),
  not on the first `announce()`. The first message of a page used to land in the same task
  that inserted its region, and screen readers did not speak it — the scripted pass
  (`e2e/feedback-announcements.spec.ts`) caught the first toast of a burst going unheard.
  With no `<body>` at construction, the first write waits 100 ms for its new region.
  `reset()` leaves a fresh, empty pair behind for the same reason.
  *Migration:* none; `regionFor()` is no longer `null` before the first message.
- **Reduced motion everywhere in the family.** Under `prefers-reduced-motion: reduce` the
  spinner's ring turns at a third of the speed and its dots / pulse / bars stand still; the
  progress bar's fill, stripes and indeterminate sweep stop; the drawer and alert banner
  appear and leave in place (a dismissed banner is removed at once instead of after
  300 ms); the product tour's beacons stop pulsing. *Migration:* none.
- **`sv-alert-banner` animates `opacity` + `translate` only** (it was `transition-all`) and
  now fades in on entry. *Migration:* none.
- **Non-text contrast (WCAG 1.4.11).** Spinner tracks are the `-100` tints and the warning
  arc and dots are `warning-700`; progress-bar fills are `accent-600`, `warning-700`,
  `info-600` (light) and `gray-400` (dark neutral); stripes darken on a light track and an
  `xs` bar has none; the skeleton's light sheen is stronger. *Migration:* pass
  `customClass` if a brand needs the old tint (it will be below 3:1).
- **Forced colours.** Spinner, progress bar, skeleton bones, tooltip bubbles, the command
  palette panel and the announcement banner gain system-colour fallbacks; the confirm
  dialog's decorative glow is hidden. *Migration:* none.
- **Type-ahead in `sv-dropdown-menu` and `sv-menubar` is accent-, case- and
  width-insensitive per the kit locale** — `e` now reaches "Édition", and Turkish lowers
  `I` to `ı`. *Migration:* none.
- **`sv-menubar` never widens the page** — the bar scrolls sideways inside itself
  (`max-w-full overflow-x-auto`). *Migration:* none.
- **`sv-popover`'s panel scrolls inside the viewport** (`max-h-[calc(100vh-1rem)]`) and
  every non-blocking panel's scroller is `overscroll-contain`. *Migration:* none.
- **`sv-toast-host` keeps `max(1rem, env(safe-area-inset-*))` from each edge** (was `1rem`)
  and lifts a bottom stack above the virtual keyboard. *Migration:* none.
- **`sv-product-tour-pro` scrolls an off-screen target into view, and treats a target with
  no box (`display: none`) as missing** — it is waited for and reported through
  `(targetMissing)` instead of anchoring at (0, 0). *Migration:* none.
- **`sv-result`'s title is capped at `max-w-xl`** and long words wrap. *Migration:* none.
- **`NotificationLoadMoreEvent` has a required `cursor` field** (**breaking** for code that
  CONSTRUCTS the event, e.g. a test double). *Migration:* add `cursor: null` (or the last
  item's `{ id, timestamp }`) where you build one; code that only receives it is unaffected.
- **`sv-alert-banner`'s dismiss button calls `dismiss()`** (which records a dismissal under
  `persistKey`, then closes); `close()` is unchanged. *Migration:* none.
- **`sv-dropdown-menu` item rows are `text-start`** (they were `text-left`), so labels align
  to the reading edge in RTL. *Migration:* none.

### Added — Data Display build set

All additive and off (or today's behaviour) by default unless noted under *Changed*.

- **New components:** `sv-avatar-group` (`@styloviz/avatar`) and `sv-avatar-group-pro`
  (`@styloviz-pro/avatar`) — a stacked group with `max`, a counted "+N" chip named with the
  hidden people, and a group name.
- **New helpers:** `svFormatCompact` (`@styloviz/core`), `svDetectCardBrand`,
  `svCurrencySymbolIsAmbiguous`, `svFormatBytes`, `svQrModuleLayout`, `svLocateQueryNode`,
  `svKbdPlatform`, `svKbdSequence`, `svKbdSpokenSequence`.
- **New inputs / outputs:**
  - `sv-price`: `currencyName` (`auto` — names a shared symbol like "$" or "£" for screen readers).
  - `sv-kanban-board`: `canMove` and `moveRefused`.
  - `sv-query-builder`: one-step **Undo** after removing a rule or non-empty group; engine
    action `insertNode`.
  - `sv-event-calendar`: `maxEventsPerDay` with a named "+N more" button.
  - `sv-filter-panel`: `showColorNames`, `maxVisibleOptions`, `searchableAfter`, `locale`;
    `FilterGroup.currency` / `maxVisible` / `searchable`.
  - `sv-image-cropper`: `strictFormat` and `formatFallback`.
  - `sv-image-gallery`: `GalleryImage.srcset` / `sizes`.
  - `sv-image-compare`: loading / error overlay and `loadError`.
  - `sv-comment`: `collapseReplies`, `timeZone`.
  - `sv-like`: `countNotation`, `locale`.
  - `sv-input-mask`: `inputmode`, `autocomplete`, `inputDir` overrides.
  - `sv-stat-card`, `sv-stat-card-pro`, `sv-spotlight-stat-card`: `trendPolarity`,
    `sparklineDomain`.
  - `sv-heatmap-calendar`: `weekStart`.
  - `sv-thumbnail-card`: `focalPoint`.
  - `sv-kbd`: the `mod` token, `platform` and `sequence`.
  - `ProductAddToCartEvent` gains `price`, `currency`, `minorUnits`, `compareAt`.
- **Docs:** every application-tier Data Display family publishes a recommended and maximum
  dataset size (`datasetSize`), enforced by `check:complexity-tiers`.

### Changed — Data Display · migration

- **`sv-comment` no longer drops replies below `maxDepth`.** They render flattened at the
  last level with a "Replying to <name>" line. *Migration:* none needed; if you relied on
  the subtree disappearing, filter `comments` yourself.
- **`sv-event-calendar` month cells** used to show the first three events and silently
  hide the rest; a "+N more" button now opens the day. *Migration:* set
  `maxEventsPerDay` to change the cap.
- **`sv-file-display` sizes are locale-formatted** (`1.5 kB`, `1,5 ko`, `512 bytes`) instead
  of `1.5 KB`. *Migration:* none; pin a locale with `provideSvLocale()` if a test reads the
  string.
- **Stat cards abbreviate negatives and use the locale's compact notation** (`-2.5M`,
  `2,5 Mio.`) in all three cards; Spotlight now abbreviates numbers too. *Migration:* pass
  a pre-formatted string to keep a custom form.
- **`sv-like` shows a compact count** (`1.2K`) by default; the accessible name keeps the full
  number. *Migration:* `countNotation="standard"` for the grouped full count.
- **`sv-heatmap-calendar` columns start on the locale's week start** (Monday in most of
  Europe) and its active days are one tab stop with arrow-key traversal. *Migration:*
  `[weekStart]="0"` keeps Sunday.
- **`sv-image-compare` and `sv-carousel`** are `touch-pan-y touch-pinch-zoom` (the page
  scrolls and zooms over them); the carousel gains swipe.
- **`sv-price`** speaks "49.99 US dollars" where the symbol is shared. *Migration:*
  `currencyName="never"` for the old reading.
- **`sv-dnd-list`** honours `disabled` on the move buttons, the kanban buttons and the keyboard grab.

### Changed — Capability and comparison pages derive their rows from the catalogue

- **Site:** `/capabilities`, `/compare/angular-material` and `/migrate/primeng`
  no longer hand-list our families. A new `capabilities.json` holds only what
  the catalogue cannot know — the competitor column (PrimeNG, filled from the
  generated PrimeNG map), the spotlight picks and the comparison page's Scope
  picks — keyed by catalogue id. Each `/capabilities` row now names its mapped
  PrimeNG counterpart; a family with no mapping shows none rather than a "—".
  A family added to the catalogue appears on `/capabilities` with no page edit.
- **Gate:** `check:catalog` fails a `capabilities.json` id, category or route
  the catalogue or router no longer has.

### Changed — the figures the site states are checked against the kit

- Every count, price, seat number, refund or trial length and Angular range
  that the site, the package READMEs and `llms.txt` state is now checked on
  every build against the source that derives it, so a page cannot drift from
  the kit it describes.
- **Copy it corrected:** stale component and package counts on the site, in
  the docs and in the listings; the Get Started FAQ and the gallery no longer
  claim zero third-party dependencies, and name the `jspdf` and `html2canvas`
  peers that PDF export needs; the blog states the supported Angular majors
  from the same source as the home page.

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
- **Docs**: `docs/PRO_INSTALL.md` imported a component that does not exist
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

The locale policy (track **T5** in `docs/plans/STYLOVIZ_FORMS_P0_P1_WORKING_TODO.md`) has
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
templates are tracked in `docs/plans/STYLOVIZ_TEMPLATE_ROADMAP.md`. They are shipped
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
