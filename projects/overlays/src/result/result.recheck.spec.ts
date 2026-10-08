import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvDataError } from '@styloviz/core';
import { SvResultComponent } from './result.component';

/**
 * `OF-16-I1` / `OF-16-M2` / `OF-16-I2` / `OF-16-M1` / `OF-16-I3` / `OF-16-M5`
 * — re-verification of the gaps the first pass left.
 */

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const err = (over: Partial<SvDataError> = {}): SvDataError => ({
  message: 'Could not load the report.',
  retryable: true,
  ...over,
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvResultComponent, {
    inputs: { status: 'error', title: 'Could not load the report', ...inputs },
  });
  const host = view.fixture.nativeElement as HTMLElement;
  return {
    ...view,
    c: view.fixture.componentInstance,
    host,
    retryBtn: () => host.querySelector('[data-sv-retry]') as HTMLButtonElement,
    reference: () => host.querySelector('[data-sv-reference] code')?.textContent?.trim() ?? null,
    settle: async () => {
      await Promise.resolve(); await Promise.resolve();
      view.fixture.detectChanges();
    },
  };
}

describe('sv-result — the reference follows the latest failure (OF-16-I1, OF-16-M2)', () => {
  it('★ shows the FAILED RETRY\'s correlation id, not the original request\'s', async () => {
    const work = deferred();
    const v = await setup({
      error: err({ reference: 'req-original', status: 500 }),
      retryLabel: 'Try again',
      retryAction: () => work.promise,
      showDetails: true,
    });
    expect(v.reference()).toBe('req-original');

    v.retryBtn().click();
    work.reject(err({ reference: 'req-retry', status: 503 }));
    await v.settle();

    expect(v.reference()).toBe('req-retry');
    // …and the technical block describes the same request.
    expect(v.c.detailRows()).toEqual([{ label: 'Status', value: '503' }]);
  });

  it('keeps the original reference when the retry failure carries none', async () => {
    const work = deferred();
    const v = await setup({
      error: err({ reference: 'req-original' }),
      retryLabel: 'Try again',
      retryAction: () => work.promise,
    });
    v.retryBtn().click();
    work.reject(new Error('offline'));
    await v.settle();
    expect(v.reference()).toBe('req-original');
  });

  it('shows a reference from a retry failure even with no [error] bound', async () => {
    const work = deferred();
    const v = await setup({ retryLabel: 'Try again', retryAction: () => work.promise });
    expect(v.reference()).toBeNull();
    v.retryBtn().click();
    work.reject(err({ reference: 'req-late' }));
    await v.settle();
    expect(v.reference()).toBe('req-late');
  });
});

describe('sv-result — [retryPending] for a host-owned retry (OF-16-I2, OF-16-M1)', () => {
  it('★ gives the emit-only retry a pending state and refuses a second press', async () => {
    const v = await setup({ retryLabel: 'Try again', retryPending: true });
    let presses = 0;
    v.c.retry.subscribe(() => presses++);

    const btn = v.retryBtn();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.textContent).toContain('Retrying…');
    expect(btn.querySelector('sv-spinner-arc')).not.toBeNull();

    // A disabled button cannot be clicked; call the handler directly too.
    btn.click();
    await v.c.requestRetry();
    expect(presses).toBe(0);
  });

  it('is pressable again once the host clears it', async () => {
    const v = await setup({ retryLabel: 'Try again', retryPending: true });
    let presses = 0;
    v.c.retry.subscribe(() => presses++);
    v.fixture.componentRef.setInput('retryPending', false);
    v.fixture.detectChanges();
    expect(v.retryBtn().disabled).toBe(false);
    expect(v.retryBtn().getAttribute('aria-busy')).toBeNull();
    v.retryBtn().click();
    expect(presses).toBe(1);
  });
});

@Component({
  standalone: true,
  imports: [SvResultComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<sv-result status="error" [title]="title()" [focusHeading]="true" />`,
})
class LateTitleHost {
  readonly title = signal('');
}

describe('sv-result — focusHeading in the cases the one-shot hook missed (OF-16-I3, OF-16-M5)', () => {
  it('★ focuses the page itself when there is no title, instead of doing nothing', async () => {
    const v = await setup({ title: '', focusHeading: true });
    await v.fixture.whenStable();
    const root = v.host.querySelector('[role="alert"]') as HTMLElement;
    expect(root.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(root);
  });

  it('gives the root no tabindex when a heading exists or the option is off', async () => {
    const withTitle = await setup({ focusHeading: true });
    expect((withTitle.host.querySelector('[role="alert"]') as HTMLElement).hasAttribute('tabindex')).toBe(false);
    const off = await setup({ title: '' });
    expect((off.host.querySelector('[role="alert"]') as HTMLElement).hasAttribute('tabindex')).toBe(false);
  });

  it('★ still moves focus when the page arrives before its title does', async () => {
    TestBed.resetTestingModule();
    const view = await render(LateTitleHost);
    await view.fixture.whenStable();
    // Arrived with no title: the page root takes focus, so arrival is announced.
    const root = document.querySelector('sv-result [role="alert"]') as HTMLElement;
    expect(document.activeElement).toBe(root);

    // ★★ The title lands while the root holds focus. Focus must move to the
    //    heading — not fall to <body> when the root loses its tabindex.
    view.fixture.componentInstance.title.set('Could not load the report');
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    view.fixture.detectChanges();
    const heading = document.querySelector('sv-result h2') as HTMLElement;
    expect(heading).not.toBeNull();
    expect(document.activeElement).toBe(heading);
    expect(root.hasAttribute('tabindex')).toBe(false);
  });

  it('does not pull focus back to the heading if the user already moved on', async () => {
    TestBed.resetTestingModule();
    const view = await render(LateTitleHost);
    await view.fixture.whenStable();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    view.fixture.componentInstance.title.set('Late title');
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    view.fixture.detectChanges();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('focuses the heading when it is there from the start', async () => {
    const v = await setup({ focusHeading: true });
    await v.fixture.whenStable();
    expect(document.activeElement).toBe(v.host.querySelector('h2'));
  });
});

describe('sv-result — public API compatibility', () => {
  it('still exposes ngAfterViewInit (deprecated), and calling it is safe and idempotent', async () => {
    const v = await setup({ focusHeading: true });
    await v.fixture.whenStable();
    expect(typeof v.c.ngAfterViewInit).toBe('function');
    const heading = v.host.querySelector('h2') as HTMLElement;
    expect(document.activeElement).toBe(heading);

    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    // Already done: a manual call does not steal focus a second time.
    v.c.ngAfterViewInit();
    await v.fixture.whenStable();
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('ngAfterViewInit focuses the heading when the arrival focus is still owed', async () => {
    TestBed.resetTestingModule();
    const view = await render(SvResultComponent, {
      inputs: { status: 'error', title: 'Boom', focusHeading: false },
    });
    const c = view.fixture.componentInstance;
    view.fixture.componentRef.setInput('focusHeading', true);
    c.ngAfterViewInit();
    await view.fixture.whenStable();
    view.fixture.detectChanges();
    expect(document.activeElement).toBe((view.fixture.nativeElement as HTMLElement).querySelector('h2'));
  });
});
