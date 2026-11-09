# @styloviz/accordion

> Default, flush, separated and filled styles, single- or multi-expand, icon placements, badges & subtitles and disabled items. Sizes (sm / md / lg), multi-expand, CSS-grid animation and keyboard navigation are free; the separated card style is in the Pro package.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/accordion
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
import { SvAccordionComponent } from '@styloviz/accordion';

@Component({
  standalone: true,
  imports: [SvAccordionComponent],
  template: `
    <sv-accordion [items]="items" expandMode="single" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `AccordionItem[]` | `[]` | Array of panel definitions. |
| `variant` | `AccordionVariant` | `'default'` | Visual style. |
| `expandMode` | `AccordionExpand` | `'single'` | Whether one or many panels can be open at once. |
| `size` | `AccordionSize` | `'md'` | Padding / font scale. |
| `iconPosition` | `AccordionIconPos` | `'right'` | Which side the chevron appears on. |
| `customIcon` | `string` | `''` | Icon-library NAME used as the expand/collapse indicator instead of the default chevron (e.g. `'plus'`). Leave empty to use the built-in chevron. When only this is set the glyph rotates 180° on open (good for arrows). Was `customIconPath`, which took a raw `<path d="…">`. |
| `customIconOpen` | `string` | `''` | Optional alternate icon-library NAME shown when the panel is **open**. Set this alongside `customIcon` for a true swap (e.g. plus → minus). When set, rotation is disabled — the glyphs switch instead. Was `customIconOpenPath`. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `headingLevel` | `number` | `3` | Heading level of the element wrapped around each panel header — `1`–`6`, so the panels sit correctly in the page outline and can be reached by heading navigation. A value outside `1`–`6` is clamped, with one dev warning. |
| `findInPage` | `boolean` | `true` | Let browser find-in-page (`Ctrl+F`) reach the text inside COLLAPSED panels, by marking them `hidden="until-found"` where the browser supports it. The browser expands the panel it matched and the open state follows. Turn it off for content that is meant to stay hidden until asked for — a quiz answer, a spoiler. Disabled panels are never findable. |
| `expandOnPrint` | `boolean` | `true` | Expand every enabled panel while the page is printed, and restore the reader's own open set afterwards. Turn it off for content that must stay hidden on paper (a quiz answer). |
| `searchQuery` | `string` | `''` | Reveal and highlight the panels whose title, subtitle or body contains this text. The reveal is transient: clearing the query returns every panel to the state the user left it in, and nothing is written to `openIds` or to the URL. Matching is case-insensitive substring. |
| `urlKey` | `string \| null` | `null` | Put the open sections in the URL under this key, so one answer can be linked to and survives a refresh. Needs `provideSvNavLocation()` at the app root; multiple open sections are comma-separated. |
| `openIds` | `Set<string> (two-way)` | `new Set()` | Ids of the currently-open panels (two-way). A `model`, so the open set can be restored as well as observed: `itemToggled` reports one gesture at a time, and `defaultOpen` only ever affects panels this accordion has not seen — so binding this is how a host reopens the sections a user had left open before a route change. A bound value wins over `defaultOpen`. `defaultOpen` is applied to each new `items` array, so sections that arrive from a request can open on arrival — but only to ids this component has not seen before, which is what "default" means: a host that rebuilds its `items` on every change detection cannot reopen a section the user closed, and ids that have gone away are dropped. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `itemToggled` | `AccordionToggleEvent` | Fires whenever a panel is opened or closed. `source` says what did it — `'user'` for a click or key, `'find-in-page'` when the browser revealed the panel itself. A transient reveal (a search query, `reveal()`) does not fire. |
| `unresolved` | `SvUnresolvedValue<readonly string[]>` | Emitted when the open set named sections this accordion cannot show. Carries the set as bound, the set after pruning, and whether `openIds` was written back. |
| `openIdsChange` | `Set<string>` | Emits the new `openIds` whenever it changes — the output half of `[(openIds)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/accordion

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
