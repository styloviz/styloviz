import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { SvPullToRefreshComponent } from './pull-to-refresh.component';

/**
 * FL-F8 — pull to refresh: a pull from the top refreshes, anything else is a
 * scroll the browser keeps; a real button is the keyboard and screen-reader
 * path; the state is announced.
 *
 * Touches are plain events carrying a `touches` list — the directive reads
 * nothing else, and jsdom has no `Touch` constructor.
 */
function touch(type: string, target: EventTarget, x: number, y: number, ended = false): void {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 1, clientX: x, clientY: y };
  Object.defineProperty(e, 'touches', { value: ended ? [] : [point] });
  Object.defineProperty(e, 'changedTouches', { value: [point] });
  target.dispatchEvent(e);
}

/** Drag from y=100 down by `dy`, in steps, then let go. */
function pull(target: EventTarget, dy: number, dx = 0): void {
  touch('touchstart', target, 100, 100);
  for (let i = 1; i <= 5; i++) touch('touchmove', target, 100 + (dx * i) / 5, 100 + (dy * i) / 5);
  touch('touchend', target, 100 + dx, 100 + dy, true);
}

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  let refreshes = 0;
  const view = await render(SvPullToRefreshComponent, {
    inputs: inputs as never,
  });
  view.fixture.componentInstance.refresh.subscribe(() => refreshes++);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  const host = view.fixture.nativeElement as HTMLElement;
  const scroller = host.querySelector<HTMLElement>('[role="region"]')!;
  return { ...view, host, scroller, refreshes: () => refreshes };
}

const status = (host: HTMLElement) => host.querySelector('[role="status"]')?.textContent?.trim();

describe('SvPullToRefreshComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('★ a pull from the top past the threshold refreshes', async () => {
    const { scroller, refreshes, fixture } = await setup();
    // 0.5 resistance × 200px of finger = 100px of travel, past the 72px threshold.
    pull(scroller, 200);
    fixture.detectChanges();
    expect(refreshes()).toBe(1);
    expect(scroller.getAttribute('data-sv-pull-state')).toBe('refreshing');
    expect(scroller.getAttribute('aria-busy')).toBe('true');
  });

  it('★ a short pull springs back and does nothing', async () => {
    const { scroller, refreshes, fixture } = await setup();
    pull(scroller, 100);
    fixture.detectChanges();
    expect(refreshes()).toBe(0);
    expect(scroller.getAttribute('data-sv-pull-state')).toBe('idle');
  });

  it('★ never pulls when the region is scrolled down — that touch is a scroll', async () => {
    const { scroller, refreshes } = await setup();
    Object.defineProperty(scroller, 'scrollTop', { value: 120, configurable: true });
    pull(scroller, 300);
    expect(refreshes()).toBe(0);
  });

  it('★ an upward or sideways first movement is left to the browser for the whole touch', async () => {
    const { scroller, refreshes } = await setup();
    pull(scroller, -200);
    expect(refreshes()).toBe(0);
    pull(scroller, 160, 300);
    expect(refreshes()).toBe(0);
  });

  it('a cancelled touch never refreshes, however far it got', async () => {
    const { scroller, refreshes } = await setup();
    touch('touchstart', scroller, 100, 100);
    touch('touchmove', scroller, 100, 200);
    touch('touchmove', scroller, 100, 400);
    touch('touchcancel', scroller, 100, 400, true);
    expect(refreshes()).toBe(0);
  });

  it('the indicator follows the pull with transform and opacity only, and arms at the threshold', async () => {
    const { scroller, host, fixture } = await setup();
    const indicator = host.querySelector<HTMLElement>('[data-sv-pull-indicator]')!;
    touch('touchstart', scroller, 100, 100);
    touch('touchmove', scroller, 100, 110);
    touch('touchmove', scroller, 100, 160);
    fixture.detectChanges();
    expect(scroller.getAttribute('data-sv-pull-state')).toBe('pulling');
    expect(indicator.style.transform).toBe('translate3d(0, -14px, 0)');
    expect(Number(indicator.style.opacity)).toBeGreaterThan(0);
    touch('touchmove', scroller, 100, 260);
    fixture.detectChanges();
    expect(scroller.getAttribute('data-sv-pull-state')).toBe('armed');
    expect(indicator.className).toContain('transition-none');
    touch('touchend', scroller, 100, 260, true);
  });

  it('a higher resistance arms with less finger travel', async () => {
    const { scroller, refreshes } = await setup({ resistance: 1, threshold: 60 });
    pull(scroller, 80);
    expect(refreshes()).toBe(1);
  });

  it('★ holds while the host is refreshing, then announces "Updated"', async () => {
    const { scroller, host, fixture, refreshes } = await setup();
    pull(scroller, 200);
    fixture.componentRef.setInput('refreshing', true);
    fixture.detectChanges();
    await until(() => status(host) === 'Refreshing…', { label: 'the refresh was announced' });
    expect(host.querySelector('[data-sv-pull-spinner]')).toBeTruthy();
    // No second refresh while one is running.
    pull(scroller, 200);
    expect(refreshes()).toBe(1);
    fixture.componentRef.setInput('refreshing', false);
    fixture.detectChanges();
    await until(() => status(host) === 'Updated', { label: 'the end was announced' });
    expect(scroller.getAttribute('data-sv-pull-state')).toBe('idle');
  });

  it('★ settles by itself when the host never sets refreshing', async () => {
    const { scroller, fixture } = await setup();
    pull(scroller, 200);
    await until(() => {
      fixture.detectChanges();
      return scroller.getAttribute('data-sv-pull-state') === 'idle';
    }, { label: 'the hand-off timed out and settled' });
  });

  it('★ the Refresh button refreshes without a pull — the keyboard and AT path', async () => {
    const { host, refreshes, fixture } = await setup();
    const button = host.querySelector<HTMLButtonElement>('[data-sv-pull-button]')!;
    expect(button.textContent?.trim()).toBe('Refresh');
    expect(button.className).toContain('sr-only');
    expect(button.className).toContain('focus:not-sr-only');
    button.click();
    expect(refreshes()).toBe(1);
    fixture.componentRef.setInput('refreshing', true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    expect(refreshes()).toBe(1);
  });

  it('refreshButton="always" shows it; "none" leaves it to the host', async () => {
    const shown = await setup({ refreshButton: 'always' });
    expect(shown.host.querySelector('[data-sv-pull-button]')?.className).not.toContain('sr-only');
    const hidden = await setup({ refreshButton: 'none' });
    expect(hidden.host.querySelector('[data-sv-pull-button]')).toBeNull();
  });

  it('disabled turns off the pull and the button', async () => {
    const { scroller, host, refreshes } = await setup({ disabled: true });
    pull(scroller, 300);
    host.querySelector<HTMLButtonElement>('[data-sv-pull-button]')!.click();
    expect(refreshes()).toBe(0);
  });

  it('★ is a named, focusable scrolling region that contains overscroll', async () => {
    const { scroller } = await setup({ ariaLabel: 'Inbox' });
    expect(scroller.getAttribute('aria-label')).toBe('Inbox');
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.className).toContain('overscroll-y-contain');
    expect(scroller.className).toContain('overflow-y-auto');
  });

  it('★ trigger() refreshes from host code too', async () => {
    const { fixture, refreshes } = await setup();
    fixture.componentInstance.trigger();
    expect(refreshes()).toBe(1);
  });
});
