import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvSpinnerComponent } from './spinner.component';

/**
 * FL-J3-OF-06 · OF-18-I3 / OF-18-M2 — `showAfterMs` / `minVisibleMs` on the
 * spinner. Defaults keep today's behaviour: shown at once, gone with the host.
 */
@Component({
  standalone: true,
  imports: [SvSpinnerComponent],
  template: `<sv-spinner label="Fetching orders" [active]="loading()" [showAfterMs]="after()" [minVisibleMs]="min()"
                         (visibleChange)="changes.push($event)" />`,
})
class Host {
  readonly loading = signal(true);
  readonly after = signal(200);
  readonly min = signal(400);
  readonly changes: boolean[] = [];
}

async function setup(init: { loading?: boolean; after?: number; min?: number } = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host, {
    componentProperties: {
      loading: signal(init.loading ?? true),
      after: signal(init.after ?? 200),
      min: signal(init.min ?? 400),
    },
  });
  const status = () => (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
  const tick = (ms: number) => { vi.advanceTimersByTime(ms); fixture.detectChanges(); };
  return { fixture, host: fixture.componentInstance, status, tick };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SvSpinnerComponent — delayed show / minimum duration (FL-J3-OF-06)', () => {
  it('renders at once with the defaults', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSpinnerComponent);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });

  it('[active]="false" with no delays renders nothing', async () => {
    const { status } = await setup({ loading: false, after: 0, min: 0 });
    expect(status()).toBeNull();
  });

  it('★ renders nothing — and says nothing — for a wait shorter than showAfterMs', async () => {
    const { status, tick, host, fixture } = await setup();
    tick(150);
    expect(status()).toBeNull();
    host.loading.set(false);
    fixture.detectChanges();
    tick(1000);
    expect(status()).toBeNull();
    expect(TestBed.inject(SvLiveAnnouncer).history()).toEqual([]);
    expect(host.changes).toEqual([]);
  });

  it('appears after showAfterMs, announces then, and reports it', async () => {
    const { status, tick, host } = await setup();
    tick(200);
    expect(status()).not.toBeNull();
    expect(TestBed.inject(SvLiveAnnouncer).history().map((a) => a.message)).toEqual(['Fetching orders']);
    expect(host.changes).toEqual([true]);
  });

  it('★ stays for minVisibleMs after the wait ends, then reports leaving', async () => {
    const { status, tick, host, fixture } = await setup();
    tick(200);
    host.loading.set(false);
    fixture.detectChanges();
    tick(399);
    expect(status()).not.toBeNull();
    tick(1);
    expect(status()).toBeNull();
    expect(host.changes).toEqual([true, false]);
  });

  it('takes the overlay stack only once it is on screen', async () => {
    TestBed.resetTestingModule();
    await render(SvSpinnerComponent, { inputs: { overlay: true, showAfterMs: 300 } });
    expect(document.querySelector('[data-sv-spinner-overlay]')).toBeNull();
    vi.advanceTimersByTime(300);
    TestBed.tick();
    expect(document.querySelector('[data-sv-spinner-overlay]')).not.toBeNull();
    document.querySelectorAll('[data-sv-spinner-overlay]').forEach((n) => n.parentElement?.remove());
    document.body.style.overflow = '';
  });
});
