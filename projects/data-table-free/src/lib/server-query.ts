import { signal } from '@angular/core';
import { createQuery, patchQuery, type SvDataQuery, type SvSort } from '@styloviz/core/data';
import type { SortState } from './data-table.component';

// ─── Server-side ────────────────────────────────────────────────────────────
//
// ## The ordering guarantee
//
// In `serverSide` mode this table renders `rows` verbatim — it never re-sorts,
// re-filters or re-pages what the server sent, because the server already did.
// That makes response order the host's problem: sort by name, then by date,
// and if the slower name request lands second the table shows name-sorted rows
// under a date-sorted header. Nothing in the host's code looks wrong, which is
// why this needs an explicit mechanism rather than care.
//
// Every `queryChange` gets a monotonic id, `serverRequestId()`, and
// `acceptsResponse(id)` is false once a newer one has gone out. Two lines in
// the host's handler are the whole contract:
//
// ```ts
// onQuery(query: SvDataQuery): void {
//   const id = this.table().serverRequestId();
//   this.api.fetch(query).subscribe(page => {
//     if (!this.table().acceptsResponse(id)) return;
//     this.rows.set(page.items);
//   });
// }
// ```

/** The monotonic request id behind `serverRequestId()` / `acceptsResponse()`. */
export class ServerRequestLedger {
  private readonly latest = signal(0);

  /** Id of the request most recently asked for. */
  readonly id = this.latest.asReadonly();

  /** Mint the id of a new request; every earlier one stops being accepted. */
  next(): void {
    this.latest.update((id) => id + 1);
  }

  /** Whether a response to `requestId` is still the one worth applying. */
  accepts(requestId: number): boolean {
    return requestId === this.latest();
  }
}

/** Everything the table's state asks the server for. */
export interface ServerQueryState {
  readonly page: number;
  readonly pageSize: number;
  readonly sorts: readonly SortState[];
  readonly filters: Readonly<Record<string, string>>;
  readonly search: string;
}

/** The table's state in the kit's shared `SvDataQuery` shape. */
export function buildServerQuery(state: ServerQueryState): SvDataQuery {
  const sorts = state.sorts.filter(s => !!s.direction);
  return patchQuery(createQuery(), {
    page:     state.page,
    pageSize: state.pageSize,
    // `SortState.direction` is nullable; `SvSort` is not — an unsorted
    // column is one absent from the array, so every consumer does not have
    // to filter it out first. The nulls are already dropped above.
    sorts:    sorts.map(s => ({ key: s.key, direction: s.direction }) as SvSort),
    filters:  state.filters,
    search:   state.search,
  });
}
