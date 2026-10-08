# @styloviz/pagination

> Smart page-window with ellipsis, a page-size selector, 3 variants and 3 sizes.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/pagination
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
import { SvPaginationComponent } from '@styloviz/pagination';

@Component({
  standalone: true,
  imports: [SvPaginationComponent],
  template: `
    <sv-pagination [totalItems]="240" [pageSize]="20" [currentPage]="page" (pageChange)="page = $event" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `totalItems` | `number \| null` | `0` | Total number of items across all pages, or `null` when the backend cannot report one. `null` hides the numbered pages and the count summary — see `mode`. |
| `mode` | `SvPaginationMode` | `'offset'` | `'offset'` for `?page=`-style APIs (numbered pages, needs a total), `'cursor'` for keyset APIs (Previous/Next and an ordinal, needs neither). |
| `nextCursor` | `string \| null` | `null` | `mode="cursor"` only: the cursor the server returned for the page *after* the one on screen. `null` means this is the last page, so Next disables. |
| `hasMore` | `boolean \| null` | `null` | Override "is there a page after this one?" — for an offset API that reports no total but does know whether more rows exist (`LIMIT n + 1`). `null` lets the component infer it from the total, or from `nextCursor` in cursor mode. |
| `loading` | `boolean` | `false` | True while the host is loading a page. Every control disables, the nav is `aria-busy`, and a second press is refused rather than queued. Bind this when the host owns the fetch; bind `pageAction` instead and the component tracks it for you. |
| `error` | `SvDataError \| null` | `null` | A failed page load, normalized — `docs/async-contract-adr.md`. Rendered as a `role="alert"` beside the controls. Unnecessary when `pageAction` is bound. |
| `retryLabel` | `string \| null` | `null` | Label for the Try-again button. Non-null is what RENDERS it: an output cannot be asked whether anyone is listening, and a retry button that does nothing is worse than none. |
| `pageAction` | `((request: SvPageRequest) => unknown) \| null` | `null` | Hand the component the page load itself. It then owns the sequencing: a second press while one is in flight is refused (not queued, not superseded), and a response that arrives after a cancel is discarded. Pass `request.signal` to your transport. |
| `pageSizeChangePolicy` | `SvPageSizePolicy` | `'preserve-first-item'` | Where the user lands when the page size changes. |
| `pageSize` | `number (two-way)` | `10` | Number of items per page. Use `[(pageSize)]` for two-way binding. |
| `currentPage` | `number (two-way)` | `1` | 1-based current page index. Use `[(currentPage)]` for two-way binding. |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | Options shown in the page-size `<select>`. Empty array hides the selector entirely. |
| `urlKey` | `string \| null` | `null` | Put the page number in the URL under this key, so a page can be shared, refreshed and reached with the back button. Needs `provideSvNavLocation()` at the app root; give a second paginator on the same page a different key. |
| `surfaceId` | `string \| null` | `null` | Names this paginator in the shared navigation-analytics stream, when a page has more than one. Ignored unless `provideSvNavTelemetry()` is wired up. |
| `variant` | `PaginationVariant` | `'default'` | Visual variant. |
| `size` | `PaginationSize` | `'md'` | Control size. |
| `showSummary` | `boolean` | `true` | Show total-item count summary (e.g. "Showing 1–10 of 234"). |
| `ariaLabel` | `string` | `'Pagination'` | Accessible label for the navigation landmark. |
| `customClass` | `string` | `''` | Additional CSS classes on the root wrapper. |
| `scrollToTop` | `boolean` | `false` | Scroll back to the top of the results after a page change. Leave it off when the paginator is inside a card or a scroll container of its own. |
| `scrollTarget` | `HTMLElement \| null` | `null` | With `scrollToTop`, the element to bring into view — usually the top of the results list. `null` scrolls the paginator itself into view. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `pageChange` | `number` | Emitted when the user navigates to a different page. |
| `unresolved` | `SvUnresolvedValue<number>` | Emitted when `currentPage` names a page that does not exist. Carries what was asked for, what is shown instead, why, and whether `currentPage` was corrected. |
| `cursorChange` | `string \| null` | `mode="cursor"` only: the cursor of the page now on screen (`null` for the first page). Fetch with this; hand the response's next cursor back through `[nextCursor]`. |
| `retryRequested` | `void` | The Try-again button was pressed and no `pageAction` is bound, so the host owns the retry. Only fires when `retryLabel` is set. |
| `loadFailed` | `SvDataError` | A `pageAction` rejected. Already normalized; also readable as `activeError()`. |
| `pageSizeChange` | `number` | Emits the new `pageSize` whenever it changes — the output half of `[(pageSize)]`. |
| `currentPageChange` | `number` | Emits the new `currentPage` whenever it changes — the output half of `[(currentPage)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/pagination

## License

MIT
