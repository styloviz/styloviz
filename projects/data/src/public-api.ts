/**
 * @styloviz/data — Public API
 *
 * Opt-in adapters that wire a Styloviz collection component to a backend.
 * **No component in the kit depends on this package.** Components stay
 * headless and speak `SvDataQuery` / `SvPage` / `SvDataError` from
 * `@styloviz/core`; this is the sugar that saves you writing the debounce, the
 * request guard, the abort and the retry policy by hand for every table.
 */

export type {
  SvDataSource,
  SvQueryMapper,
  SvResponseMapper,
  SvDataControllerOptions,
  SvDataFailure,
} from './lib/types';

export { svDataController } from './lib/controller';
export type { SvDataController } from './lib/controller';

// The term → options sibling, for pickers. Same lifecycle, different shape:
// there is no page, no sort and no filter — the whole query is a string.
//
// ⚠️ **It lives in `@styloviz/core` now** (moved 2026-09-14, `FI-23-M3`), and is
// re-exported here so that nothing importing it from this package breaks. The
// move was forced by `sv-select-dropdown` owning its own fetch: a component may
// not depend on this package — see the header above — and the free twin's peers
// are `@styloviz/core` and nothing else. The controller only ever imported from
// core, so the move cost nothing; leaving it here would have meant a second
// copy, which is how the two would have drifted.
export { svSuggestController } from '@styloviz/core';
export type {
  SvSuggestController,
  SvSuggestControllerOptions,
  SvSuggestSource,
} from '@styloviz/core';

export { createArrayDataSource } from './lib/array-source';
export type { SvArraySourceOptions, SvMatcher } from './lib/array-source';

export { createFetchDataSource, defaultResponseMapper } from './lib/fetch-source';
export type { SvFetchSourceOptions } from './lib/fetch-source';

export { createHttpDataSource } from './lib/http-source';
export type { SvHttpSourceOptions } from './lib/http-source';

export { offsetLimitQuery, pageNumberQuery, cursorQuery, applyQuery } from './lib/query-presets';

// Demo/testing decorators — wrap any source to make its slow and failing paths
// reachable without a server.
export { withLatency, withFailure, withFlakiness } from './lib/decorators';
export type { SvFailureOptions } from './lib/decorators';

export { SvDataSourceDirective } from './lib/data-source.directive';
