# @styloviz/list-view

> Market-ready list patterns: default, checklist, nested tree, virtualized, grouped, template cards, call history and infinite scrolling.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/list-view
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
import { SvListViewComponent } from '@styloviz/list-view';

@Component({
  standalone: true,
  imports: [SvListViewComponent],
  template: `
    <sv-list-view [items]="items" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `ListViewItem[]` | `[]` | Items to render (label, meta, optional children/avatar/actions). |
| `mode` | `ListViewMode` | `'default'` | One preset switch. `checklist`, `template` and `call-history` change what a row shows and compose with everything else. `nested`, `grouped` and `scrolling` are Pro presets and this build ignores them — use `[nested]` / `[grouped]` directly, which work here. `virtualization` windows a flat list, and windowing cannot be combined with `[nested]` or `[grouped]`. The full matrix, and the dev warning that enforces it, is on `_ignoredCombinations`. |
| `variant` | `ListViewVariant` | `'default'` | Visual variant. |
| `density` | `ListViewDensity` | `'comfortable'` | Row density. |
| `selectionMode` | `ListViewSelectionMode` | `'none'` | Selection behaviour: none, single or multiple. |
| `checkable` | `boolean` | `false` | Show checkboxes on rows. |
| `nested` | `boolean` | `false` | Enable nested (tree) rows. |
| `virtualized` | `boolean` | `false` | Virtualize long lists for performance. |
| `grouped` | `boolean` | `false` | Group rows under section headers. |
| `searchable` | `boolean` | `false` | Show a search box to filter items. |
| `stickyGroupHeaders` | `boolean` | `true` | Keep group headers pinned while scrolling. |
| `infiniteScroll` | `boolean` | `false` | Load more items as the user scrolls to the end. |
| `hasMore` | `boolean` | `false` | Whether more items are available to load. |
| `loadingMore` | `boolean` | `false` | Show a loading indicator while fetching more. |
| `viewportHeight` | `number` | `360` | Viewport height (px) for the virtualized list. |
| `itemHeight` | `number` | `68` | Height of a **single-line** row, in pixels — the base every windowed row is measured from. Windowing has to know where row 4,000 starts without rendering rows 0–3,999, so a row's height is computed rather than measured: this base, plus a line for a `subtitle`/`description` and a strip for `tags` on the rows that carry them. See `rowHeightOf`. The estimate is what the row is then sized to, so the scrollbar and the rows agree exactly. |
| `overscan` | `number` | `5` | Extra rows rendered above/below the viewport. |
| `searchPlaceholder` | `string` | `'Search list items'` | Placeholder for the search box. |
| `emptyMessage` | `string` | `'No items match your filters.'` | Message shown when no items match. |
| `customClass` | `string` | `''` | Extra CSS classes for the root. |
| `ariaLabel` | `string` | `'List view'` | Accessible label for the list. |
| `announceActions` | `boolean` | `true` | Announce row actions to screen readers. |
| `showQuickActions` | `boolean` | `false` | Show per-row quick actions on hover/focus. |
| `quickActions` | `ListViewQuickAction[]` | `[]` | Per-row quick actions. |
| `bulkActions` | `ListViewBulkAction[]` | `[]` | Bulk actions for checked rows. |
| `enableBulkHotkeys` | `boolean` | `false` | Enable keyboard hotkeys for bulk actions. |
| `bulkHotkeys` | `Record<string, string>` | `{}` | Map of hotkey → bulk action id. |
| `enableRovingFocus` | `boolean` | `true` | Enable roving-tabindex keyboard navigation. |
| `loading` | `boolean` | `false` | True while the first page is being fetched. Replaces the list with a placeholder. For the *next* page use `loadingMore`, which keeps the rows already on screen. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `serverSide` | `boolean` | `false` | Search on the server instead of in the component. The supplied `items` are rendered as given — filtering them again would hide rows the server deliberately returned, and client-side search can only ever look at the page already downloaded. |
| `debounceMs` | `number` | `300` | Delay before `searched` fires, in milliseconds. `0` emits immediately. |
| `selectedIds` | `Set<string \| number> (two-way)` | `new Set()` | Selected row ids (two-way). |
| `checkedIds` | `Set<string \| number> (two-way)` | `new Set()` | Checked row ids (two-way). |
| `expandedIds` | `Set<string \| number> (two-way)` | `new Set()` | Which nested items are expanded (two-way). A `model` alongside `selectedIds` and `checkedIds` because it is the same kind of fact and the host has the same reasons to reach it: open the branch a deep link names, restore the tree after a route change, persist what the user had open. Held in a private signal it could be neither set nor observed — the one piece of this component's item state that was unreachable. |
| `activeItemId` | `string \| number \| null (two-way)` | `null` | The row the keyboard cursor is on (two-way) — the roving tab stop. Windowed lists made this unavoidable. Roving focus used to walk the RENDERED buttons, and a windowed list renders twenty of five hundred: the cursor stopped dead at the edge of the window instead of the end of the list, and scrolling the focused row out of the window dropped focus to `<body>`. A keyboard cursor over a list that is only partly in the DOM has to be an id, not an element. Two-way because it is the same kind of fact as `selectedIds`: a host can put the cursor on the row a deep link names, and read where the user left it. |
| `scrollOffset` | `number (two-way)` | `0` | Scroll position of the list viewport, in pixels (two-way). Written on every scroll, applied to the viewport whenever it changes from the outside — bind it and the position survives what destroys the component: a route change, a tab switch, a `@defer` block re-entering, an infinite-scroll page arriving. Without it, restoring a list meant restoring its rows and landing the user back at the top of them. |
| `query` | `string (two-way)` | `''` | The search term. Two-way bindable, so it can be restored from a URL and kept in step with a server-side query. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `itemClick` | `ListViewItemClickEvent` | Emitted with the clicked item. |
| `selectionChange` | `Set<string \| number>` | Emitted with the current selection set. |
| `checkChange` | `ListViewCheckChangeEvent` | Emitted when a row's checkbox changes. |
| `loadMore` | `ListViewLoadMoreEvent` | Emitted when more items should be loaded (infinite scroll). |
| `quickActionClick` | `ListViewQuickActionClickEvent` | Emitted when a quick action is clicked. |
| `bulkActionClick` | `ListViewBulkActionClickEvent` | Emitted when a bulk action is triggered. |
| `searched` | `string` | The debounced search term — fetch matching rows. Debounced by `debounceMs` and never emitted twice for the same term. Pair with `serverSide`. Named `searched` rather than `queryChange`, and that is load-bearing: `query` below is a `model()`, which already owns an output of that name and emits it on every keystroke. Declaring it here as well claimed the same binding twice — Angular reports "Output 'queryChange' is bound to both 'query' and 'queryChange'", the component's metadata stops resolving, and every component importing it then fails with "Component imports must be standalone components…". It also made the debounce contract above a lie, since the model's undebounced emission went out under the same name. `sv-search-bar` has the identical shape and solves it the same way: `value = model()` for the two-way text, `searched = output()` for the debounced notification. Enforced by `model-output-collision` in scripts/check-ui-invariants.mjs. |
| `retry` | `void` | The host should re-run the failed load. |
| `selectedIdsChange` | `Set<string \| number>` | Emits the new `selectedIds` whenever it changes — the output half of `[(selectedIds)]`. |
| `checkedIdsChange` | `Set<string \| number>` | Emits the new `checkedIds` whenever it changes — the output half of `[(checkedIds)]`. |
| `expandedIdsChange` | `Set<string \| number>` | Emits the new `expandedIds` whenever it changes — the output half of `[(expandedIds)]`. |
| `activeItemIdChange` | `string \| number \| null` | Emits the new `activeItemId` whenever it changes — the output half of `[(activeItemId)]`. |
| `scrollOffsetChange` | `number` | Emits the new `scrollOffset` whenever it changes — the output half of `[(scrollOffset)]`. |
| `queryChange` | `string` | Emits the new `query` whenever it changes — the output half of `[(query)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/list-view

## License

MIT
