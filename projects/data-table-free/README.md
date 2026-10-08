# @styloviz/data-table

> Sortable, paginated table with row selection, badge cells and a loading skeleton — plus premium toolbar, column filters, inline editing, expandable rows and bulk actions.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/data-table
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
import { SvDataTableComponent } from '@styloviz/data-table';

@Component({
  standalone: true,
  imports: [SvDataTableComponent],
  template: `
    <sv-data-table [rows]="rows" rowKey="id" [selectable]="true" [paginated]="true" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `TableColumn<T>[]` | `[]` | Column definitions (key, header, alignment, optional cell template). |
| `rows` | `readonly T[]` | `[]` | The rows to render. `readonly` on purpose: the table never mutates this array, and anything that hands it one — a signal, a `computed`, `svDataController.items` — is handing over a value it still owns. A mutable `T[]` here rejected every one of those at the template boundary while promising a write the table does not perform. |
| `rowKey` | `SvItemKey<T>` | `'id'` | What identifies a row: a property name, or a function for composite keys. Widened from `string` because a row identified by two fields — an order line keyed on `orderId` + `lineNo`, a matrix cell on `row` + `col` — had no way to say so, and the fallback silently keyed it on the whole row's JSON. See the identity contract on `resolveItemKey` in `@styloviz/core`. |
| `selectable` | `boolean` | `false` | Enable row selection. |
| `selectMode` | `SelectMode` | `'multi'` | 'multi' = checkboxes, 'single' = radio buttons. |
| `selectedIds` | `Set<string \| number> (two-way)` | `new Set()` | Selected row ids (two-way). |
| `expandedRowIds` | `Set<string \| number> (two-way)` | `new Set()` | Which rows have their detail panel open (two-way). A `model` rather than internal state because it is the same kind of fact as `selectedIds`: a host restoring a table after a route change, or opening the row a deep link names, has to be able to write it — and one that persists layout has to be able to see it change. Held in a plain signal it was neither settable nor observable from outside. |
| `actions` | `TableRowAction<T>[]` | `[]` | Per-row action buttons. |
| `bulkActions` | `BulkAction[]` | `[]` | Bulk actions applied to selected rows. |
| `loading` | `boolean` | `false` | Show a loading state. |
| `loadingStyle` | `LoadingStyle` | `'skeleton'` | 'skeleton' rows or full-table 'overlay' spinner. |
| `skeletonRows` | `number` | `5` | Number of skeleton rows while loading. |
| `paginated` | `boolean` | `true` | Enable client-side pagination. |
| `pageSize` | `number (two-way)` | `10` | Rows per page (two-way). |
| `pageSizeOptions` | `number[]` | `[10, 25, 50]` | Page-size options offered in the toolbar. |
| `serverSide` | `boolean` | `false` | Server-side mode: disables client filtering/sorting/paging. |
| `totalCount` | `number \| null` | `null` | Total row count when in server-side mode. |
| `variant` | `TableVariant` | `'default'` | Table style variant. |
| `density` | `TableDensity` | `'comfortable'` | Row density: comfortable, compact, etc. |
| `compact` | `boolean` | `false` | Deprecated shorthand for compact density. |
| `maxHeight` | `string \| null` | `null` | Max body height (CSS length) before the table scrolls. |
| `showScrollHint` | `boolean` | `true` | Show a hint when the table is horizontally scrollable. |
| `rowClassFn` | `((row: T) => string) \| null` | `null` | Callback returning extra Tailwind classes for a given row. |
| `showToolbar` | `boolean \| undefined` | `undefined` | Show the toolbar strip. Left unset it DERIVES from whether the toolbar has anything to put in it — binding `tableTitle` or `[searchable]` used to render nothing at all unless you also remembered this flag, which is a silent no-op: the API accepted your input and ignored it. Set it explicitly to force the strip on (an empty bar as a spacer) or off (a title used only as the accessible name). Every existing call site passes it, so nothing changes for them. |
| `tableTitle` | `string` | `''` | Title shown in the toolbar. |
| `searchable` | `boolean` | `false` | Show a search box in the toolbar. |
| `showColumnToggle` | `boolean` | `false` | Show the column visibility toggle. |
| `exportable` | `boolean` | `false` | Show an export (CSV) control. |
| `showDensityToggle` | `boolean` | `false` | Show the density toggle. |
| `columnFilters` | `boolean` | `false` | Enable per-column filters. |
| `multiSort` | `boolean` | `false` | Allow sorting by multiple columns. |
| `expandable` | `boolean` | `false` | Enable expandable rows. |
| `expandRender` | `((row: T) => string) \| null` | `null` | Renderer for the expanded row detail. |
| `showFooter` | `boolean` | `false` | Show a table footer row. |
| `cardOnMobile` | `boolean` | `false` | Render rows as cards on small screens. |
| `emptyMessage` | `string` | `'No data to display.'` | Message shown when there are no rows. |
| `customClass` | `string` | `''` | Extra CSS classes for the root element. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. Rendered in place of the rows, above the toolbar so the user can still change the filter that caused it. |
| `hiddenColumnKeys` | `Set<string> (two-way)` | `new Set()` | Which columns the user has hidden (two-way). A `model` rather than internal state so a saved table layout can be restored by binding it — the free tier had no other way in at all, and the Pro tier could only reach it through a whole-state snapshot. Declared here with the rest of the internal view state because that is where the column toggle lives; it is nonetheless part of the public API. |
| `revealedColumnKeys` | `ReadonlySet<string> (two-way)` | `new Set()` | Columns declared `hidden: true` that the user has since shown from the Columns menu. `hidden` is documented as "initially hidden — the user can show it from the column-toggle panel", but the table used to filter `!col.hidden` unconditionally: the column could never come back, and its checkbox (bound to `hiddenColumnKeys` alone) sat TICKED for a column that was not on screen. Two-way, like `hiddenColumnKeys`: together the two ARE the column-visibility view, and a host that persists one without the other restores a table whose revealed columns have vanished again (`check:collection-identity`). |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `sortChange` | `SortState[]` | Emitted with the new sort state when sorting changes. |
| `selectionChange` | `Set<string \| number>` | Emitted with the set of selected row ids. |
| `rowClick` | `T` | Emitted with the clicked row. |
| `cellClick` | `CellClickEvent<T>` | Emitted with the clicked cell context. |
| `editComplete` | `EditCompleteEvent<T>` | Emitted when an inline cell edit completes (Pro). |
| `retry` | `void` | The host should re-run the failed load. |
| `queryChange` | `SvDataQuery` | Everything the user is asking to see, in the kit's shared shape. This is the output to wire in `serverSide` mode: one handler regardless of whether they paged, sorted, filtered or searched, and the same `SvDataQuery` every other component in the kit emits — so `@styloviz/data` and a hand-rolled fetch both take it without a translation layer. |
| `serverPageChange` | `ServerPageEvent` | Emitted in `serverSide` mode with the page, page size, sorts, column filters, search text and request id whenever the user changes any of them. |
| `rowExpand` | `T` | Emitted with the row when the user expands or collapses its detail panel. |
| `bulkActionClick` | `{ action: BulkAction; selectedIds: Set<string \| number> }` | Emitted with the bulk action and the selected row ids. |
| `selectedIdsChange` | `Set<string \| number>` | Emits the new `selectedIds` whenever it changes — the output half of `[(selectedIds)]`. |
| `expandedRowIdsChange` | `Set<string \| number>` | Emits the new `expandedRowIds` whenever it changes — the output half of `[(expandedRowIds)]`. |
| `pageSizeChange` | `number` | Emits the new `pageSize` whenever it changes — the output half of `[(pageSize)]`. |
| `hiddenColumnKeysChange` | `Set<string>` | Emits the new `hiddenColumnKeys` whenever it changes — the output half of `[(hiddenColumnKeys)]`. |
| `revealedColumnKeysChange` | `ReadonlySet<string>` | Emits the new `revealedColumnKeys` whenever it changes — the output half of `[(revealedColumnKeys)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/data-table

## License

MIT
