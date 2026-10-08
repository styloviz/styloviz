import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  provideSvNavLocation,
  SvLiveAnnouncer,
  svQueryParamNavLocation,
  type SvDataError,
} from '@styloviz/core';
import { flush, until, untilRendered } from '../../../../src/testing/async';
import { SvPaginationComponent, type SvPageRequest } from './pagination.component';

/**
 * ============================================================================
 *  The pending page load — `NV-04-I5`, `NV-04-M2`
 * ============================================================================
 *
 * ★★★ THESE ARE ONE DEFECT, NOT TWO. The audit recorded "two fast clicks issue
 *     two loads and the slower response can win" (`I5`) and "no request-pending
 *     state" (`M2`) separately, and they have one cause: **nothing in the
 *     component knew a load was in flight.** Without that, nothing could disable
 *     the control and nothing could discard the loser. So there is one mechanism
 *     here — `createAsyncAction` from `docs/async-contract-adr.md` — and both
 *     items are properties of it.
 *
 * ★★ And the ADR had already settled which way this family leans. Reads want
 *    LATEST-WINS (a search box: the user typed past "ab"). Paging wants
 *    FIRST-WINS, and it is not obvious: pressing Next twice looks like a newer
 *    intent. It is not — it is "show me page 3", where page 3 is only reachable
 *    once page 2 is known to exist. Superseding would leave the control saying
 *    page 3 with the request for page 2 still on the wire. `NV-04-M2` says
 *    "disable and announce, rather than accepting a second click", which is
 *    first-wins by another name.
 */

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
  reject(reason: unknown): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const said: string[] = [];
  const failures: SvDataError[] = [];
  const retries: number[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    on: {
      loadFailed: (e: SvDataError) => failures.push(e),
      retryRequested: () => retries.push(1),
    },
  });
  const announcer = TestBed.inject(SvLiveAnnouncer);
  vi.spyOn(announcer, 'announce').mockImplementation((m: string) => {
    said.push(m);
    return true;
  });
  return { fixture, c: fixture.componentInstance, said, failures, retries };
}

const root = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const button = (f: { nativeElement: unknown }, label: string) =>
  root(f).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

// ─── `NV-04-M2` — the host owns the fetch and says so ────────────────────────

describe('SvPaginationComponent — [loading] (NV-04-M2)', () => {
  it('disables every control and marks the nav aria-busy', async () => {
    const { fixture } = await setup({ currentPage: 4, loading: true });

    for (const label of ['First page', 'Previous page', 'Next page', 'Last page', 'Page 3']) {
      expect(button(fixture, label)?.disabled, label).toBe(true);
    }
    expect(root(fixture).querySelector('nav')?.getAttribute('aria-busy')).toBe('true');
    expect(root(fixture).querySelector('select')?.hasAttribute('disabled')).toBe(true);
  });

  /**
   * ★ `[disabled]` is a courtesy, not the mechanism. A programmatic `goTo`, a
   * synthetic click, or a real press landing in the same frame as the disable all
   * reach the handler — and in the old code each one started another load.
   */
  it('refuses a second page request while one is in flight', async () => {
    const seen: number[] = [];
    const { c } = await setup({ currentPage: 4, loading: true });
    c.pageChange.subscribe((p: number) => seen.push(p));

    c.goTo(7);
    c.next();
    c.previous();
    c.first();
    c.last();

    expect(c.currentPage()).toBe(4);
    expect(seen).toEqual([]);
  });

  it('lets the same request through once loading clears', async () => {
    const { fixture, c } = await setup({ currentPage: 4, loading: true });
    c.goTo(7);
    expect(c.currentPage()).toBe(4);

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    c.goTo(7);
    expect(c.currentPage()).toBe(7);
  });

  /**
   * ★★ "Page 7 of 20" is a LIE while the rows are still being fetched — the page
   *    number changed, the content has not. So the pending announcement says what
   *    is true, and the settled one is owed afterwards. Both come from
   *    `SvLiveAnnouncer`; a second live region for one wait is `OF-17-I1`.
   */
  it('announces the wait, then what arrived', async () => {
    const { fixture, c, said } = await setup({ currentPage: 4, loading: false });

    // ⚠️ Focus AFTER the control is enabled, and the ordering is the whole
    //    point: `commit` announces only when `document.activeElement` is inside
    //    the host, and **`.focus()` on a `disabled` button is a silent no-op**.
    //    Focusing while `loading` was still true left focus on `<body>`, so the
    //    component correctly said nothing and the test read as a missing
    //    announcement rather than as a press that never came from inside.
    button(fixture, 'Page 5')!.focus();
    expect(document.activeElement).toBe(button(fixture, 'Page 5'));

    c.goTo(5);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    await until(() => said.length > 0, { label: 'the pending announcement' });
    expect(said[0]).toBe('Loading page 5.');

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    await until(() => said.length > 1, { label: 'the settled announcement' });
    expect(said[1]).toBe('Page 5 of 20.');
  });
});

// ─── `NV-04-I5` — the component owns the fetch ───────────────────────────────

describe('SvPaginationComponent — [pageAction] (NV-04-I5)', () => {
  /**
   * ★★★ THE REGRESSION TEST FOR THE ORIGINAL FINDING. Two fast presses of Next
   *     used to send two requests. The old code emitted `pageChange(2)` and
   *     `pageChange(3)`, so a host fetching on `(pageChange)` had both on the
   *     wire — and if page 2's response was the slower one, it landed last and
   *     the user read page 2's rows under a control saying page 3.
   */
  it('issues ONE load for two fast presses, and keeps the page it actually asked for', async () => {
    const asked: number[] = [];
    const gate = deferred();
    const { c } = await setup({
      pageAction: (r: SvPageRequest) => {
        asked.push(r.page);
        return gate.promise;
      },
    });

    c.next();
    c.next();
    c.next();

    expect(asked).toEqual([2]);
    expect(c.currentPage()).toBe(2);
    expect(c.busy()).toBe(true);

    gate.resolve();
    await until(() => !c.busy(), { label: 'the load to settle' });

    c.next();
    expect(asked).toEqual([2, 3]);
    expect(c.currentPage()).toBe(3);
  });

  it('carries the page, size, direction and an AbortSignal', async () => {
    const seen: SvPageRequest[] = [];
    const { c } = await setup({
      currentPage: 4,
      pageAction: (r: SvPageRequest) => {
        seen.push(r);
      },
    });

    c.next();
    await flush();
    expect(seen).toHaveLength(1);
    expect(seen[0].page).toBe(5);
    expect(seen[0].pageSize).toBe(10);
    expect(seen[0].direction).toBe('next');
    expect(seen[0].cursor).toBeNull();
    expect(seen[0].request.signal.aborted).toBe(false);
  });

  it('aborts the in-flight signal when the component is destroyed', async () => {
    const seen: SvPageRequest[] = [];
    const gate = deferred();
    const { fixture, c } = await setup({
      pageAction: (r: SvPageRequest) => {
        seen.push(r);
        return gate.promise;
      },
    });

    c.next();
    expect(seen[0].request.signal.aborted).toBe(false);
    fixture.destroy();
    expect(seen[0].request.signal.aborted).toBe(true);
  });

  it('reports a rejection through loadFailed and renders it with a retry', async () => {
    const gate = deferred();
    const { fixture, c, failures } = await setup({
      retryLabel: 'Try again',
      pageAction: () => gate.promise,
    });

    c.next();
    gate.reject(new Error('Gateway timeout'));

    await untilRendered(fixture, () => c.activeError() !== null, {
      label: 'the failed load to surface',
    });

    expect(failures).toHaveLength(1);
    expect(c.activeError()?.message).toContain('Gateway timeout');

    const alert = root(fixture).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Gateway timeout');
    expect(alert?.querySelector('button')?.textContent?.trim()).toBe('Try again');
  });

  it('re-runs the same load on retry', async () => {
    let calls = 0;
    const { fixture, c } = await setup({
      retryLabel: 'Try again',
      pageAction: () => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('flaky'));
        return Promise.resolve();
      },
    });

    c.next();
    await untilRendered(fixture, () => c.activeError() !== null, { label: 'the first failure' });

    root(fixture).querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await until(() => calls === 2, { label: 'the retry' });
    await untilRendered(fixture, () => c.activeError() === null, { label: 'the error to clear' });

    expect(c.currentPage()).toBe(2);
  });
});

// ─── Moves the component makes on its own also get loaded ────────────────────

describe('SvPaginationComponent — [pageAction] for non-press page moves (NV-04-I5 / M2)', () => {
  /**
   * ★ `dispatch()` used to run only from `commit()`, i.e. from a press. A clamp
   * after the total shrank, or a page the URL named, moved `currentPage` and
   * emitted `pageChange` — which serves a host that fetches itself — but a host
   * that handed the load over through `pageAction` never loaded the new page.
   */
  it('loads the clamped page when the total shrinks under the current one', async () => {
    const asked: number[] = [];
    const { fixture, c } = await setup({
      currentPage: 7,
      pageAction: (r: SvPageRequest) => {
        asked.push(r.page);
      },
    });
    expect(asked).toEqual([]);

    fixture.componentRef.setInput('totalItems', 20);
    fixture.detectChanges();

    expect(c.currentPage()).toBe(2);
    expect(asked).toEqual([2]);
  });

  it('loads the page a URL names', async () => {
    window.history.replaceState(null, '', '/list?page=4');
    TestBed.resetTestingModule();
    const seen: SvPageRequest[] = [];
    const { fixture } = await render(SvPaginationComponent, {
      inputs: {
        totalItems: 200,
        urlKey: 'page',
        pageAction: (r: SvPageRequest) => {
          seen.push(r);
        },
      },
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    window.history.replaceState(null, '', '/');

    expect(fixture.componentInstance.currentPage()).toBe(4);
    expect(seen.map((r) => [r.page, r.direction])).toEqual([[4, 'jump']]);
  });
});

// ─── The error/retry surface without `pageAction` ────────────────────────────

describe('SvPaginationComponent — [error] from the host', () => {
  const failure: SvDataError = { message: 'Could not reach the server.', retryable: true };

  it('renders nothing extra when there is no error', async () => {
    const { fixture } = await setup({});
    expect(root(fixture).querySelector('[role="alert"]')).toBeNull();
  });

  /**
   * ★ The affordance is an INPUT — `docs/async-contract-adr.md`. An output cannot
   * be asked whether anyone is listening, and a Try-again that does nothing is
   * worse than none: the user presses it and then distrusts the whole screen.
   */
  it('shows the message but no retry button until retryLabel names one', async () => {
    const { fixture } = await setup({ error: failure });
    expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Could not reach the server.',
    );
    expect(root(fixture).querySelector('[role="alert"] button')).toBeNull();
  });

  /** ★ `canRetry` is not "there is an error": a 403 fails identically next time. */
  it('hides the retry for an error that is not retryable', async () => {
    const { fixture } = await setup({
      retryLabel: 'Try again',
      error: { message: 'Forbidden.', status: 403, retryable: false } satisfies SvDataError,
    });
    expect(root(fixture).querySelector('[role="alert"] button')).toBeNull();
  });

  it('emits retryRequested when the host owns the load', async () => {
    const { fixture, retries } = await setup({ retryLabel: 'Try again', error: failure });
    root(fixture).querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    expect(retries).toHaveLength(1);
  });
});
