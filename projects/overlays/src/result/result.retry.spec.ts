import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvResultComponent } from './result.component';

/**
 * ============================================================================
 *  `sv-result` — the retry (`OF-16-I2`, `OF-16-M1`)
 * ============================================================================
 *
 * ★★★ THE RETRY WAS ALWAYS SOMEONE ELSE'S BUTTON, WHICH IS WHY IT HAD NO
 *     STATE. Actions on a result page are slotted content, so every "Try
 *     again" in the kit was a host `<button (click)="reload()">` — pressable
 *     repeatedly, with no feedback, firing the failed request again and
 *     again. The page reported an outcome and then had nothing to say about
 *     the attempt to fix it.
 */

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const retryBtn = (host: HTMLElement) => host.querySelector('[data-sv-retry]') as HTMLButtonElement | null;
const errorText = (host: HTMLElement) =>
  (host.querySelector('[data-sv-retry-error]') as HTMLElement | null)?.textContent?.trim() ?? null;

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvResultComponent, {
    inputs: { status: 'error', title: 'Could not load the report', ...inputs },
  });
  return {
    ...view,
    c: view.fixture.componentInstance,
    host: view.fixture.nativeElement as HTMLElement,
    settle: async () => {
      await Promise.resolve(); await Promise.resolve();
      view.fixture.detectChanges();
    },
  };
}

describe('sv-result — no retry unless asked for', () => {
  it('renders no button by default', async () => {
    const v = await setup();
    expect(retryBtn(v.host)).toBeNull();
  });

  it('emits (retry) and owns nothing when no action was supplied', async () => {
    // ★ The host keeps the pending state in this shape, which is the right
    //   answer when the retry is a route change rather than a request.
    const v = await setup({ retryLabel: 'Try again' });
    let pressed = 0;
    v.c.retry.subscribe(() => pressed++);

    retryBtn(v.host)!.click();
    retryBtn(v.host)!.click();

    expect(pressed).toBe(2);
    expect(v.c.retrying()).toBe(false);
  });
});

describe('sv-result — [retryAction]: the press that can fail', () => {
  it('shows a pending label and disables itself while the work runs', async () => {
    const work = deferred();
    const v = await setup({ retryLabel: 'Try again', retryAction: () => work.promise });

    retryBtn(v.host)!.click();
    v.fixture.detectChanges();

    expect(v.c.retrying()).toBe(true);
    expect(retryBtn(v.host)!.disabled).toBe(true);
    expect(retryBtn(v.host)!.getAttribute('aria-busy')).toBe('true');
    expect(retryBtn(v.host)!.textContent).toContain('Retrying…');

    work.resolve();
    await v.settle();

    expect(v.c.retrying()).toBe(false);
    expect(retryBtn(v.host)!.textContent).toContain('Try again');
  });

  it('★ refuses a second press — this is the whole item', async () => {
    const work = deferred();
    let calls = 0;
    const v = await setup({
      retryLabel: 'Try again',
      retryAction: () => { calls++; return work.promise; },
    });

    const btn = retryBtn(v.host)!;
    btn.click();
    btn.click();
    btn.click();

    expect(calls).toBe(1);
    work.resolve();
    await v.settle();
  });

  it('emits (retry) once per accepted press, not per click', async () => {
    const work = deferred();
    const v = await setup({ retryLabel: 'Try again', retryAction: () => work.promise });
    let pressed = 0;
    v.c.retry.subscribe(() => pressed++);

    retryBtn(v.host)!.click();
    retryBtn(v.host)!.click();

    expect(pressed).toBe(1);
    work.resolve();
    await v.settle();
  });

  it('renders a failure under the button and reports it', async () => {
    const work = deferred();
    const v = await setup({ retryLabel: 'Try again', retryAction: () => work.promise });
    let failed = 0;
    v.c.retryFailed.subscribe(() => failed++);

    retryBtn(v.host)!.click();
    work.reject({ status: 503, message: 'Still unavailable.' });
    await v.settle();

    expect(errorText(v.host)).toBe('Still unavailable.');
    expect(failed).toBe(1);
    // …and the button is pressable again: the point of a retry is that it can
    // be retried.
    expect(retryBtn(v.host)!.disabled).toBe(false);
  });

  it('clears the previous failure when the next attempt starts', async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    const v = await setup({
      retryLabel: 'Try again',
      retryAction: () => { calls++; return calls === 1 ? first.promise : second.promise; },
    });

    retryBtn(v.host)!.click();
    first.reject(new Error('nope'));
    await v.settle();
    expect(errorText(v.host)).toBe('nope');

    retryBtn(v.host)!.click();
    v.fixture.detectChanges();
    // An error beside a spinner says the thing that is happening has already
    // failed.
    expect(errorText(v.host)).toBeNull();

    second.resolve();
    await v.settle();
    expect(errorText(v.host)).toBeNull();
  });
});
