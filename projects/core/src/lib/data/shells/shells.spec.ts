import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvEmptyShellComponent } from './empty-shell.component';
import { SvErrorShellComponent } from './error-shell.component';
import { SvSkeletonShellComponent } from './skeleton-shell.component';
import { SvConnectionStatusComponent } from './connection-status.component';

/** Resets TestBed so a single test can render more than once. */
async function setup<T>(component: Type<T>, inputs: ComponentInput<T> = {}) {
  TestBed.resetTestingModule();
  return render(component, { inputs });
}

describe('SvSkeletonShellComponent', () => {
  it('announces itself as busy', async () => {
    await setup(SvSkeletonShellComponent);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe('Loading');
  });

  // ★ The dark bones used to be a `:where(.dark) .sv-bone` rule, which emulated
  //   encapsulation scoped to a `.dark` INSIDE the component — so a dark app
  //   drew light bones. The theme now rides on host classes the kit's own
  //   `dark:` variant resolves.
  it('carries its bone colours for both themes on the host', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toContain('[--sv-bone-fill:var(--color-gray-200)]');
    expect(host.className).toContain('dark:[--sv-bone-fill:var(--color-gray-700)]');
  });

  it('clamps a nonsense row count instead of rendering thousands of bones', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent, { rows: 5000 });
    expect(fixture.nativeElement.querySelectorAll('.sv-bone').length).toBeLessThanOrEqual(120);
  });

  it('renders at least one bone for a row count of zero', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent, { rows: 0 });
    expect(fixture.nativeElement.querySelectorAll('.sv-bone').length).toBeGreaterThan(0);
  });

  it('falls back to the default row count for a value that is not a number', async () => {
    // `rows` is frequently bound to something computed — `pageSize - loaded`,
    // `total / perPage` — and those produce NaN and Infinity the first time
    // through, before any data has arrived. `Array.from({length: NaN})` is
    // empty and `{length: Infinity}` throws, so neither may reach it.
    const nan = await setup(SvSkeletonShellComponent, { rows: Number.NaN });
    expect(nan.fixture.nativeElement.querySelectorAll('.sv-bone').length).toBeGreaterThan(0);

    const inf = await setup(SvSkeletonShellComponent, { rows: Number.POSITIVE_INFINITY });
    const bones = (inf.fixture.nativeElement as HTMLElement).querySelectorAll('.sv-bone').length;
    expect(bones).toBeGreaterThan(0);
    expect(bones).toBeLessThanOrEqual(120);
  });

  it('falls back to the default column count for a non-numeric column count', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent, {
      variant: 'table',
      rows: 2,
      columns: Number.NaN,
    });
    expect(fixture.nativeElement.querySelectorAll('.sv-bone').length).toBeGreaterThan(0);
  });

  it('keeps bone widths stable across renders — a resizing skeleton reads as a glitch', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent, { variant: 'text', rows: 4 });
    const widths = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.sv-bone')].map(
        (b) => b.style.width,
      );
    const first = widths();
    fixture.detectChanges();
    expect(widths()).toEqual(first);
  });
});

describe('SvErrorShellComponent', () => {
  it('renders nothing when there is no error', async () => {
    const { fixture } = await setup(SvErrorShellComponent);
    expect(fixture.nativeElement.textContent?.trim()).toBe('');
  });

  it('announces the failure through role="alert"', async () => {
    await setup(SvErrorShellComponent, { error: { message: 'Could not load orders.' } });
    expect(screen.getByRole('alert').textContent).toContain('Could not load orders.');
  });

  it('accepts a bare string', async () => {
    await setup(SvErrorShellComponent, { error: 'Offline' });
    expect(screen.getByRole('alert').textContent).toContain('Offline');
  });

  it('emits retry when the button is pressed', async () => {
    const { fixture } = await setup(SvErrorShellComponent, { error: { message: 'x' } });
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retried).toBe(1);
  });

  /** Offering "Try again" for a 404 is a dead end dressed up as a recovery. */
  it('hides retry for an error the server said will not succeed', async () => {
    await setup(SvErrorShellComponent, { error: { message: 'Not found', status: 404, retryable: false } });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides retry when the host disables it', async () => {
    await setup(SvErrorShellComponent, { error: { message: 'x' }, retryable: false });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the status code when there is one', async () => {
    await setup(SvErrorShellComponent, { error: { message: 'Boom', status: 503 } });
    expect(screen.getByRole('alert').textContent).toContain('503');
  });

  it('still announces an error object that carries no message', async () => {
    // `toSvDataError` can hand back `{ status: 500, retryable: true }` when the
    // server sent an empty body. The shell must render the alert (and the code)
    // rather than print `undefined` at the user.
    await setup(SvErrorShellComponent, { error: { status: 500, retryable: true } as never });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain('undefined');
    expect(alert.textContent).toContain('500');
  });

  it('moves focus to retry on demand', async () => {
    const { fixture } = await setup(SvErrorShellComponent, { error: { message: 'x' } });
    fixture.componentInstance.focusRetry();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }));
  });
});

describe('SvEmptyShellComponent', () => {
  /**
   * The distinction the whole component exists for: telling a customer with
   * 4,000 orders that they have none, because they mistyped a search term,
   * reads as a bug.
   */
  it('separates "none yet" from "none matching these filters"', async () => {
    const noData = await setup(SvEmptyShellComponent, { reason: 'no-data' });
    expect(noData.fixture.nativeElement.textContent).toContain('Nothing here yet');
    expect(noData.fixture.nativeElement.textContent).not.toContain('filters');

    const noResults = await setup(SvEmptyShellComponent, { reason: 'no-results' });
    expect(noResults.fixture.nativeElement.textContent).toContain('No matching results');
  });

  /**
   * `OF-07-I1` / `OF-07-M1` — the other two causes, which this shell could not
   * state at all until the vocabulary was unified with `sv-empty-state`'s.
   *
   * ★★★ "NOTHING HERE YET" UNDER A PERMISSION FAILURE IS A LIE THAT COSTS
   *     SOMEONE A DAY. The user goes looking for data that is not missing, or
   *     files a bug about an empty report that is working exactly as
   *     configured. Same for a failed load: an empty table says the answer is
   *     "none" when the truth is "we do not know".
   */
  it('★ says "no access" rather than "nothing here yet"', async () => {
    const noAccess = await setup(SvEmptyShellComponent, { reason: 'no-access' });
    const text = noAccess.fixture.nativeElement.textContent as string;
    expect(text).toContain('You do not have access');
    expect(text).not.toContain('Nothing here yet');
    expect(text).not.toContain('filters');
  });

  it('★ says a load failed rather than reporting it as empty', async () => {
    const failed = await setup(SvEmptyShellComponent, { reason: 'error' });
    const text = failed.fixture.nativeElement.textContent as string;
    expect(text).toContain('Could not load this');
    expect(text).not.toContain('Nothing here yet');
  });

  it('★ exposes the cause on the host, for all four', async () => {
    // Data components render this shell, and a test that cannot tell the
    // causes apart cannot catch the regression that conflates them.
    for (const reason of ['no-data', 'no-results', 'no-access', 'error'] as const) {
      const r = await setup(SvEmptyShellComponent, { reason });
      const host = r.fixture.nativeElement as HTMLElement;
      expect(host.getAttribute('data-sv-empty-reason')).toBe(reason);
      expect(host.getAttribute('data-sv-state')).toBe('empty');
    }
  });

  it('offers "Clear filters" only for the filtered case', async () => {
    await setup(SvEmptyShellComponent, { reason: 'no-results' });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();

    await setup(SvEmptyShellComponent, { reason: 'no-data' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  /**
   * ★★ AND NOT FOR THE OTHER TWO EITHER. "Clear filters" under `no-access`
   *    clears filters that are not what is hiding the data — the user tries it
   *    twice before reading the sentence above it — and a retry under `error`
   *    belongs to whoever owns the request.
   */
  it('★ offers no default action for no-access or error', async () => {
    for (const reason of ['no-access', 'error'] as const) {
      await setup(SvEmptyShellComponent, { reason });
      expect(screen.queryByRole('button')).toBeNull();
    }

    // The host can still add one.
    await setup(SvEmptyShellComponent, { reason: 'error', actionLabel: 'Try again' });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows an action for the empty case only when the host supplies a label', async () => {
    await setup(SvEmptyShellComponent, { reason: 'no-data', actionLabel: 'Create order' });
    expect(screen.getByRole('button', { name: 'Create order' })).toBeTruthy();
  });

  it('lets the host override every string', async () => {
    const { fixture } = await setup(SvEmptyShellComponent, {
      reason: 'no-results',
      title: 'No invoices',
      message: 'Nothing between those dates.',
    });
    expect(fixture.nativeElement.textContent).toContain('No invoices');
    expect(fixture.nativeElement.textContent).toContain('Nothing between those dates.');
  });

  it('emits action when the button is pressed', async () => {
    const { fixture } = await setup(SvEmptyShellComponent, { reason: 'no-results' });
    let fired = 0;
    fixture.componentInstance.action.subscribe(() => fired++);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(fired).toBe(1);
  });
});

describe('SvConnectionStatusComponent', () => {
  const render_ = async (inputs: ComponentInput<SvConnectionStatusComponent> = {}) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvConnectionStatusComponent, { inputs });
    return fixture.nativeElement as HTMLElement;
  };

  it('renders nothing while idle — a badge on every page load is noise', async () => {
    expect((await render_()).querySelector('[data-sv-connection]')).toBeNull();
  });

  it('renders nothing while connecting — the skeleton already covers that', async () => {
    expect((await render_({ state: 'connecting' })).querySelector('[data-sv-connection]')).toBeNull();
  });

  it('shows a quiet dot when the feed is healthy, and does not announce it', async () => {
    const badge = (await render_({ state: 'open' })).querySelector('[data-sv-connection]')!;
    expect(badge.textContent).toContain('Live');
    // Announcing every successful connect would interrupt a screen-reader user
    // for news that nothing is wrong.
    expect(badge.getAttribute('aria-live')).toBeNull();
    expect(badge.getAttribute('role')).toBeNull();
  });

  it('announces a dropped feed politely', async () => {
    const badge = (await render_({ state: 'reconnecting' })).querySelector('[data-sv-connection]')!;
    expect(badge.textContent).toContain('Reconnecting');
    expect(badge.getAttribute('aria-live')).toBe('polite');
    expect(badge.getAttribute('role')).toBe('status');
  });

  it('announces a closed feed, so what is on screen reads as final', async () => {
    const badge = (await render_({ state: 'closed' })).querySelector('[data-sv-connection]')!;
    expect(badge.textContent).toContain('Disconnected');
    expect(badge.getAttribute('aria-live')).toBe('polite');
  });

  it('takes a custom label', async () => {
    const badge = (await render_({ state: 'open', label: 'Streaming' })).querySelector('[data-sv-connection]')!;
    expect(badge.textContent).toContain('Streaming');
  });

  it('hides the reconnect button by default — most hosts retry themselves', async () => {
    expect((await render_({ state: 'closed' })).querySelector('[data-sv-reconnect]')).toBeNull();
  });

  it('never offers a reconnect while the feed is open', async () => {
    const el = await render_({ state: 'open', reconnectable: true });
    expect(el.querySelector('[data-sv-reconnect]')).toBeNull();
  });

  it('emits the reconnect request', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvConnectionStatusComponent, {
      inputs: { state: 'closed', reconnectable: true },
    });
    const seen: number[] = [];
    fixture.componentInstance.reconnect.subscribe(() => seen.push(1));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-sv-reconnect]')!
      .click();
    expect(seen).toHaveLength(1);
  });
});

/**
 * The three state hooks the whole async-contract harness reads.
 *
 * These attributes are not decoration — `src/testing/async-contract.ts` finds
 * every component's loading, error and empty states through them, so a shell
 * that silently stops emitting one would turn ~100 contract specs into tests
 * that assert nothing while still passing. Pin them here, at the source.
 */
describe('shell state hooks', () => {
  it('marks the skeleton as the loading state', async () => {
    const { fixture } = await setup(SvSkeletonShellComponent);
    expect(fixture.nativeElement.getAttribute('data-sv-state')).toBe('loading');
  });

  it('marks the empty shell, and publishes which empty it is', async () => {
    const noData = await setup(SvEmptyShellComponent);
    expect(noData.fixture.nativeElement.getAttribute('data-sv-state')).toBe('empty');
    expect(noData.fixture.nativeElement.getAttribute('data-sv-empty-reason')).toBe('no-data');

    const noResults = await setup(SvEmptyShellComponent, { reason: 'no-results' });
    expect(noResults.fixture.nativeElement.getAttribute('data-sv-empty-reason')).toBe('no-results');
  });

  it('marks the error shell only while there is an error', async () => {
    const quiet = await setup(SvErrorShellComponent);
    expect(quiet.fixture.nativeElement.getAttribute('data-sv-state')).toBeNull();

    const failed = await setup(SvErrorShellComponent, { error: 'Request failed' });
    expect(failed.fixture.nativeElement.getAttribute('data-sv-state')).toBe('error');
  });

  it('publishes retryability, so "a 404 gets no Try again" is assertable', async () => {
    const soft = await setup(SvErrorShellComponent, { error: 'Timed out' });
    expect(soft.fixture.nativeElement.getAttribute('data-sv-retryable')).toBe('true');

    const notFound = await setup(SvErrorShellComponent, {
      error: { message: 'Not found', status: 404, retryable: false },
    });
    expect(notFound.fixture.nativeElement.getAttribute('data-sv-retryable')).toBe('false');
  });
});
