/**
 * ============================================================================
 *  The async-contract harness
 * ============================================================================
 *
 * The home page sells this line, verbatim:
 *
 *   "Every data component wires to your real backend out of the box:
 *    loading, error, retry and empty states included."
 *
 * `check:ui` R9–R12 prove the *shape* of that promise — that `loading`, `error`
 * and `retry` are declared and that no input defaults to a fixture. A shape
 * check cannot prove the promise is kept. Two components shipped a `retry`
 * output that nothing could ever emit (`sv-toolbar` rendered its error shell
 * with `[retryable]="false"`, `sv-sparkline` drew a static dash) and both
 * passed every gate: compliance-shaped and useless to a host that bound
 * `(retry)="reload()"`.
 *
 * This is the behavioural half. It renders each state and asserts what a buyer
 * would see, through the `data-sv-state` hooks the shells in `@styloviz/core`
 * publish on their own host elements. One call per component, so the contract
 * costs a registry line instead of a bespoke spec — which is why only 15 of the
 * 106 components that make the promise had one before it existed.
 *
 * ```ts
 * describeAsyncContract({
 *   component: SvBarChartComponent,
 *   collection: 'datasets',
 *   rows: [{ label: 'Revenue', data: [1, 2, 3] }],
 *   inputs: { categories: ['a', 'b', 'c'] },
 *   loadedSelector: 'svg',
 * });
 * ```
 *
 * What it deliberately does NOT do: open a portalled panel. `mention`,
 * `cascader` and the search bars render their states into `document.body`
 * behind an interaction, and a harness that guessed at the trigger would be a
 * harness that silently asserted nothing. Those keep hand-written specs.
 */
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';

/** The states a data component owes its host. */
export type SvContractState =
  | 'loading'
  | 'error'
  | 'retry'
  | 'notRetryable'
  | 'empty'
  | 'twoEmpties'
  | 'loaded';

/** Minimal shape of an Angular `output()` — avoids importing `OutputEmitterRef`. */
interface EmitterLike {
  subscribe(next: () => void): unknown;
}

export interface SvAsyncContract<T> {
  /** The component under test. */
  readonly component: Type<T>;

  /** Suite name. Defaults to the component's class name. */
  readonly name?: string;

  /** Name of the server-owned data input, e.g. `'items'`, `'datasets'`. */
  readonly collection: string;

  /** A populated value for `collection` — enough rows to render normally. */
  readonly rows: readonly unknown[] | number;

  /**
   * The value of `collection` that means "nothing arrived yet".
   *
   * Defaults to `[]`, which is right for every list-shaped component. A
   * component whose data is a SCALAR has no empty array to hand it —
   * `sv-gauge-chart` shows a single reading — so it accepts `null` for the
   * absent case and names it here.
   * @default []
   */
  readonly empty?: unknown;

  /** Any other inputs the component needs before it will render at all. */
  readonly inputs?: Readonly<Record<string, unknown>>;

  /** Loading input name. @default 'loading' */
  readonly loadingInput?: string;

  /** Error input name. @default 'error' */
  readonly errorInput?: string;

  /** Retry output name. @default 'retry' */
  readonly retryOutput?: string;

  /**
   * Input that says a filter is active, so the empty state can distinguish
   * "no orders" from "no orders matching these filters". Omit when the
   * component has no filtering of its own.
   * @default 'filtered'
   */
  readonly filteredInput?: string;

  /**
   * A selector that appears only once real data is rendered — `'svg'` for a
   * chart, `'tbody tr'` for a table. Without it the `loaded` assertion can only
   * check that no state shell is showing, which a component rendering nothing
   * at all would also pass.
   */
  readonly loadedSelector?: string;

  /** Providers the component needs. */
  readonly providers?: readonly unknown[];

  /**
   * States that genuinely do not apply, each with the reason. A bare skip list
   * rots; the reason is what makes the next person re-ask the question.
   */
  readonly skip?: Partial<Record<SvContractState, string>>;
}

const el = (fixtureEl: HTMLElement, state: string): HTMLElement | null =>
  fixtureEl.querySelector<HTMLElement>(`[data-sv-state="${state}"]`);

/**
 * Registers one `describe` block asserting the full contract for a component.
 *
 * Every render resets the TestBed, so a single `it()` may render more than once
 * without the second render silently reusing the first component instance.
 */
export function describeAsyncContract<T>(contract: SvAsyncContract<T>): void {
  const {
    component,
    collection,
    rows,
    empty = [] as unknown[],
    inputs = {},
    loadingInput = 'loading',
    errorInput = 'error',
    retryOutput = 'retry',
    filteredInput = 'filtered',
    loadedSelector,
    providers = [],
    skip = {},
  } = contract;

  const name = contract.name ?? component.name;

  async function mount(extra: Readonly<Record<string, unknown>> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(component, {
      inputs: { ...inputs, [collection]: rows, ...extra } as Record<string, never>,
      providers: [...providers],
    });
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  /** The state a host is in before the first response arrives. */
  const nothingYet = { [collection]: empty };

  describe(`${name} — async contract`, () => {
    const test = (state: SvContractState, title: string, body: () => Promise<void>) => {
      const reason = skip[state];
      if (reason) {
        it.skip(`${title} — SKIPPED: ${reason}`, body);
        return;
      }
      it(title, body);
    };

    test('loading', 'withholds the data and shows a placeholder while loading', async () => {
      const { host } = await mount({ ...nothingYet, [loadingInput]: true });
      expect(el(host, 'loading')).toBeTruthy();
      // A number is a claim: a zeroed plot is indistinguishable from a real
      // flat series, so loading must withhold rather than render an empty one.
      if (loadedSelector) expect(host.querySelector(loadedSelector)).toBeNull();
    });

    test('error', 'shows the failure rather than an empty component', async () => {
      const { host } = await mount({ ...nothingYet, [errorInput]: 'Upstream is down' });
      const error = el(host, 'error');
      expect(error).toBeTruthy();
      expect(error?.textContent).toContain('Upstream is down');
      expect(el(host, 'empty')).toBeNull();
    });

    test('retry', 'emits retry from a button the host can actually reach', async () => {
      const { fixture, host } = await mount({ ...nothingYet, [errorInput]: 'Upstream is down' });
      const emitter = (fixture.componentInstance as unknown as Record<string, EmitterLike>)[
        retryOutput
      ];
      expect(emitter, `${name} declares no ${retryOutput} output`).toBeTruthy();

      let fired = 0;
      emitter.subscribe(() => (fired += 1));

      const button = el(host, 'error')?.querySelector('button') ?? host.querySelector('button');
      expect(button, 'the error state renders no button, so retry can never fire').toBeTruthy();
      button?.click();
      expect(fired).toBe(1);
    });

    test('notRetryable', 'offers no retry it cannot honour', async () => {
      const { host } = await mount({
        ...nothingYet,
        [errorInput]: { message: 'Not found', status: 404, retryable: false },
      });
      const flag = host.querySelector('[data-sv-retryable]');
      expect(flag?.getAttribute('data-sv-retryable')).toBe('false');
    });

    test('empty', 'says it is empty instead of rendering nothing at all', async () => {
      const { host } = await mount(nothingYet);
      expect(el(host, 'empty')).toBeTruthy();
      expect(el(host, 'loading')).toBeNull();
      expect(el(host, 'error')).toBeNull();
    });

    test('twoEmpties', 'tells no-data apart from no-results', async () => {
      const noData = await mount(nothingYet);
      expect(el(noData.host, 'empty')?.getAttribute('data-sv-empty-reason') ??
        noData.host.querySelector('[data-sv-empty-reason]')?.getAttribute('data-sv-empty-reason'))
        .toBe('no-data');

      const filtered = await mount({ ...nothingYet, [filteredInput]: true });
      expect(el(filtered.host, 'empty')?.getAttribute('data-sv-empty-reason') ??
        filtered.host.querySelector('[data-sv-empty-reason]')?.getAttribute('data-sv-empty-reason'))
        .toBe('no-results');
    });

    test('loaded', 'renders the data with no state shell in the way', async () => {
      const { host } = await mount();
      expect(el(host, 'loading')).toBeNull();
      expect(el(host, 'error')).toBeNull();
      expect(el(host, 'empty')).toBeNull();
      if (loadedSelector) expect(host.querySelector(loadedSelector)).toBeTruthy();
    });
  });
}

/** Registers a contract suite for each entry — one line per component. */
export function describeAsyncContracts(contracts: readonly SvAsyncContract<unknown>[]): void {
  for (const contract of contracts) describeAsyncContract(contract);
}
