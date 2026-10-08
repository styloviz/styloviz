import {
  Directive,
  DestroyRef,
  PendingTasks,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { SvDataError, SvDataQuery } from '@styloviz/core';
import { svDataController, type SvDataController } from './controller';
import type { SvDataControllerOptions, SvDataSource } from './types';

/**
 * The template-side form of {@link svDataController}.
 *
 * Put it on any collection component, export it, and bind the component's own
 * inputs from it. It deliberately does **not** reach into the host and write
 * its inputs: that would need a shared token on all 195 components, and a
 * silent write is far harder to debug than a visible binding. What you gain
 * over `svDataController` is that nothing has to be declared in the class.
 *
 * The source is bound through the selector itself — `source` is aliased to
 * `svDataSource`, so there is one attribute, not two.
 *
 * ```html
 * <sv-data-table
 *   [svDataSource]="ordersSource" #src="svDataSource" [debounceMs]="300"
 *   [serverSide]="true"
 *   [rows]="src.items()"     [loading]="src.loading()"
 *   [error]="src.error()"    [totalCount]="src.total()"
 *   (queryChange)="src.setQuery($event)" (retry)="src.reload()" />
 * ```
 *
 * Swapping `source` rebuilds the controller and refetches — a new endpoint is
 * a new dataset, and keeping the old rows on screen under it would show one
 * tenant's data labelled as another's.
 */
@Directive({
  selector: '[svDataSource]',
  standalone: true,
  exportAs: 'svDataSource',
})
export class SvDataSourceDirective<T> {
  private readonly destroyRef = inject(DestroyRef);
  /**
   * ★★ Captured here, like `destroyRef`, because the controller is built inside
   *    an `effect()` — which is not an injection context, so the defaults in
   *    `svDataController` cannot resolve it themselves.
   */
  private readonly pendingTasks = inject(PendingTasks);

  /** The endpoint adapter. Required. */
  readonly source = input.required<SvDataSource<T>>({ alias: 'svDataSource' });

  /** See `SvDataControllerOptions.debounceMs`. @default 300 */
  readonly debounceMs = input<number>(300);
  /** See `SvDataControllerOptions.retries`. @default 2 */
  readonly retries = input<number>(2);
  /** See `SvDataControllerOptions.retryDelayMs`. @default 400 */
  readonly retryDelayMs = input<number>(400);
  /** See `SvDataControllerOptions.keepPreviousData`. @default true */
  readonly keepPreviousData = input<boolean>(true);
  /** See `SvDataControllerOptions.immediate`. @default true */
  readonly immediate = input<boolean>(true);
  /** Seed the first query — a default page size, a preset filter. */
  readonly initialQuery = input<Partial<SvDataQuery> | undefined>(undefined);

  /**
   * A signal, not a plain field: the bindings below are computeds that read it,
   * and a plain assignment would leave them stuck on their initial values —
   * the whole directive would render an empty list forever.
   */
  private readonly controller = signal<SvDataController<T> | null>(null);

  constructor() {
    effect(() => {
      const source = this.source();
      untracked(() => {
        this.controller()?.cancel();
        const options: SvDataControllerOptions & {
          initialQuery?: Partial<SvDataQuery>;
          destroyRef: DestroyRef;
          pendingTasks: PendingTasks;
        } = {
          debounceMs: this.debounceMs(),
          retries: this.retries(),
          retryDelayMs: this.retryDelayMs(),
          keepPreviousData: this.keepPreviousData(),
          immediate: this.immediate(),
          initialQuery: this.initialQuery(),
          destroyRef: this.destroyRef,
          pendingTasks: this.pendingTasks,
        };
        this.controller.set(svDataController<T>(source, options));
      });
    });
  }

  private get ctrl(): SvDataController<T> {
    const c = this.controller();
    if (!c) throw new Error('[styloviz] svDataSource used before its source was set.');
    return c;
  }

  // ── Bindable state ────────────────────────────────────────────────────────
  readonly items = computed<readonly T[]>(() => this.controller()?.items() ?? []);
  readonly loading = computed<boolean>(() => this.controller()?.loading() ?? false);
  readonly error = computed<SvDataError | null>(() => this.controller()?.error() ?? null);
  readonly total = computed<number | null>(() => this.controller()?.total() ?? null);
  readonly cursor = computed<string | null>(() => this.controller()?.cursor() ?? null);
  readonly filtered = computed<boolean>(() => this.controller()?.filtered() ?? false);
  readonly hasMore = computed<boolean>(() => this.controller()?.hasMore() ?? false);
  readonly query = computed<SvDataQuery | null>(() => this.controller()?.query() ?? null);

  // ── Actions ───────────────────────────────────────────────────────────────
  setQuery(query: SvDataQuery): void { this.ctrl.setQuery(query); }
  patch(patch: Partial<SvDataQuery>): void { this.ctrl.patch(patch); }
  search(term: string): void { this.ctrl.search(term); }
  goToPage(page: number): void { this.ctrl.goToPage(page); }
  sortBy(key: string, multi = false): void { this.ctrl.sortBy(key, multi); }
  filter(field: string, value: string): void { this.ctrl.filter(field, value); }
  clearFilters(): void { this.ctrl.clearFilters(); }
  reload(): void { this.ctrl.reload(); }
}
