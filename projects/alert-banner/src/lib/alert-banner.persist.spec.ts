import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { svPersistState } from '@styloviz/core/data';
import { SvBannerStackService } from '@styloviz/core/feedback';
import { SvAlertBannerComponent, SV_ALERT_BANNER_DISMISSAL_KIND } from './alert-banner.component';

/**
 * FL-J3-OF-11 · OF-01-I5 / OF-01-M3 — `persistKey` / `persistVersion`: a
 * dismissal the user made is remembered, "dismissed until version", default
 * off, SSR- and storage-failure-safe.
 */
const KEY = 'test/maintenance-banner';

async function setup(inputs: Record<string, unknown> = {}, platform = 'browser') {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAlertBannerComponent, {
    inputs: { message: 'Maintenance tonight 22:00 UTC', dismissible: true, ...inputs },
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  const strip = () => (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
  return { fixture, c: fixture.componentInstance, strip };
}

const dismissButton = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss alert"]')!;

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); vi.restoreAllMocks(); });

describe('SvAlertBannerComponent — remembered dismissal (FL-J3-OF-11)', () => {
  it('★ remembers nothing by default', async () => {
    const { fixture, c } = await setup();
    dismissButton(fixture.nativeElement).click();
    vi.runAllTimers();
    expect(c.isVisible()).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('★ writes a versioned envelope when the user dismisses, and renders nothing next time', async () => {
    const first = await setup({ persistKey: KEY, persistVersion: 2 });
    dismissButton(first.fixture.nativeElement).click();
    vi.runAllTimers();
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toEqual(svPersistState(SV_ALERT_BANNER_DISMISSAL_KIND, 1, { dismissedVersion: 2 }));

    const again = await setup({ persistKey: KEY, persistVersion: 2 });
    expect(again.c.rememberedDismissed()).toBe(true);
    expect(again.strip()).toBeNull();
    // Said nothing, and took no place in a pinned stack.
    expect(TestBed.inject(SvLiveAnnouncer).history()).toEqual([]);
  });

  it('★ shows again once the host raises persistVersion past the dismissed one', async () => {
    localStorage.setItem(KEY, JSON.stringify(svPersistState(SV_ALERT_BANNER_DISMISSAL_KIND, 1, { dismissedVersion: 2 })));
    const { strip, c } = await setup({ persistKey: KEY, persistVersion: 3 });
    expect(c.rememberedDismissed()).toBe(false);
    expect(strip()).not.toBeNull();
  });

  it('reappears when the version is raised while it is mounted', async () => {
    localStorage.setItem(KEY, JSON.stringify(svPersistState(SV_ALERT_BANNER_DISMISSAL_KIND, 1, { dismissedVersion: 1 })));
    const { fixture, strip } = await setup({ persistKey: KEY, persistVersion: 1 });
    expect(strip()).toBeNull();
    fixture.componentRef.setInput('persistVersion', 2);
    fixture.detectChanges();
    expect(strip()).not.toBeNull();
  });

  it('does not remember an auto-dismiss — the user decided nothing', async () => {
    const { c } = await setup({ persistKey: KEY, autoDismissMs: 5000, variant: 'success' });
    vi.advanceTimersByTime(60_000);
    expect(c.isVisible()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('a remembered pinned banner takes no slot in the stack', async () => {
    localStorage.setItem(KEY, JSON.stringify(svPersistState(SV_ALERT_BANNER_DISMISSAL_KIND, 1, { dismissedVersion: 1 })));
    const register = vi.spyOn(TestBed.inject(SvBannerStackService), 'register');
    await setup({ persistKey: KEY, position: 'top-fixed' });
    expect(register).not.toHaveBeenCalled();
  });

  it('still closes when storage throws (quota, privacy mode)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const { fixture, c } = await setup({ persistKey: KEY });
    dismissButton(fixture.nativeElement).click();
    vi.runAllTimers();
    expect(c.isVisible()).toBe(false);
  });

  it('a malformed stored value is refused with a dev warning and the banner shows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(KEY, JSON.stringify(svPersistState('sv-something/else', 1, { x: 1 })));
    const { strip } = await setup({ persistKey: KEY });
    expect(strip()).not.toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('renders on the server, where there is no storage to read', async () => {
    const { strip } = await setup({ persistKey: KEY }, 'server');
    expect(strip()).not.toBeNull();
  });
});
