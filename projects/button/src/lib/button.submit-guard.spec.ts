import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvButtonComponent } from './button.component';

/**
 * `FI-02-I3` and `FI-02-M3` — the two halves of "loading is presentational".
 *
 * The double-submit that creates a duplicate order is not one that `loading`
 * can stop: the second click lands in the frame before the host's `loading`
 * write has been rendered, so `isDisabled()` is still false when it arrives.
 * And the busy state, once it does arrive, was announced by an `sr-only` span
 * that `aria-label` made unreachable in the one configuration it targeted.
 */

@Component({
  standalone: true,
  imports: [SvButtonComponent],
  template: `
    <sv-button
      [label]="label()"
      [ariaLabel]="ariaLabel()"
      [iconPosition]="iconPosition()"
      [loading]="loading()"
      [loadingLabel]="loadingLabel()"
      [announceLoading]="announceLoading()"
      [preventDoubleSubmit]="preventDoubleSubmit()"
      [doubleSubmitWindowMs]="windowMs()"
      (clicked)="onClick()"
    />
  `,
})
class HostComponent {
  readonly label = signal('Pay');
  readonly ariaLabel = signal('');
  readonly iconPosition = signal<'leading' | 'trailing' | 'only' | 'none'>('none');
  readonly loading = signal(false);
  readonly loadingLabel = signal('');
  readonly announceLoading = signal(true);
  readonly preventDoubleSubmit = signal(false);
  readonly windowMs = signal(400);
  clicks = 0;
  onClick(): void { this.clicks++; }
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    button: () => el.querySelector('button')!,
    liveRegion: () => el.querySelector<HTMLElement>('[role="status"]')!,
    tick: () => fixture.detectChanges(),
  };
}

/** A click that reports whether anything called preventDefault on it. */
function click(target: HTMLElement): MouseEvent {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

// ─── FI-02-I3 ────────────────────────────────────────────────────────────────

describe('SvButtonComponent — double-submit prevention (FI-02-I3)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { vi.useRealTimers(); });

  it('is off by default, because a stepper is a button too', () => {
    // "+1", "next slide", "add row" — the guard would be a bug on all of them.
    const { host, button, tick } = setup();
    tick();

    click(button());
    click(button());

    expect(host.clicks).toBe(2);
  });

  it('ignores a second click inside the window, without needing `loading` to have rendered', () => {
    // This is the whole point: nothing has been re-rendered between the two
    // clicks, exactly as in the frame where a real double-click lands.
    const { host, button, tick } = setup();
    host.preventDoubleSubmit.set(true);
    tick();

    click(button());
    click(button());
    click(button());

    expect(host.clicks).toBe(1);
  });

  it('cancels the suppressed event, so a native submit does not go through either', () => {
    // `clicked` is not the only way a button acts: `type="submit"` submits the
    // form whether or not anyone is listening, and link mode navigates.
    const { host, button, tick } = setup();
    host.preventDoubleSubmit.set(true);
    tick();

    click(button());
    const second = click(button());

    expect(second.defaultPrevented).toBe(true);
  });

  it('lets the next real activation through once the window has passed', () => {
    const { host, button, tick } = setup();
    host.preventDoubleSubmit.set(true);
    tick();

    click(button());
    vi.setSystemTime(401);
    click(button());

    expect(host.clicks).toBe(2);
  });

  /**
   * A user who clicked, saw nothing happen and clicked again must not be
   * ignored a second time — so the window runs from the click that did
   * something, not from the last one that was thrown away.
   */
  it('does not let a burst of clicks extend the window indefinitely', () => {
    const { host, button, tick } = setup();
    host.preventDoubleSubmit.set(true);
    tick();

    click(button());              // t=0, accepted
    vi.setSystemTime(200); click(button()); // ignored
    vi.setSystemTime(390); click(button()); // ignored
    vi.setSystemTime(410); click(button()); // 410ms since the accepted one

    expect(host.clicks).toBe(2);
  });

  it('treats a zero window as no window, without having to unset the flag', () => {
    const { host, button, tick } = setup();
    host.preventDoubleSubmit.set(true);
    host.windowMs.set(0);
    tick();

    click(button());
    click(button());

    expect(host.clicks).toBe(2);
  });

  it('still suppresses everything while loading, guard or no guard', () => {
    // The two are complements: the window covers the frame before `loading`
    // renders, `loading` covers the rest of the request.
    const { host, button, tick } = setup();
    host.loading.set(true);
    tick();

    click(button());

    expect(host.clicks).toBe(0);
  });
});

// ─── FI-02-M3 ────────────────────────────────────────────────────────────────

describe('SvButtonComponent — the loading announcement (FI-02-M3)', () => {
  it('keeps a live region on the page while idle, holding nothing', () => {
    // Added-when-busy regions are frequently not announced at all: the reader
    // has no prior content to diff against.
    const { liveRegion } = setup();

    expect(liveRegion()).not.toBeNull();
    expect(liveRegion().textContent?.trim()).toBe('');
  });

  it('announces the busy state for a labelled button', () => {
    const { host, liveRegion, tick } = setup();
    host.loading.set(true);
    tick();

    expect(liveRegion().textContent?.trim()).toBe('Loading');
  });

  /**
   * The configuration the old `sr-only` span was written for, and the one it
   * never worked in: `aria-label` replaces element contents when the name is
   * computed, so the span inside the button was never announced.
   */
  it('announces for an icon-only button, which aria-label used to silence', () => {
    const { host, el, liveRegion, tick } = setup();
    host.iconPosition.set('only');
    host.ariaLabel.set('Pay now');
    host.label.set('');
    host.loading.set(true);
    tick();

    expect(el.querySelector('button')!.getAttribute('aria-label')).toBe('Pay now');
    expect(liveRegion().textContent?.trim()).toBe('Loading');
  });

  it('prefers the host’s own wording when there is any', () => {
    const { host, liveRegion, tick } = setup();
    host.loading.set(true);
    host.loadingLabel.set('Charging your card');
    tick();

    expect(liveRegion().textContent?.trim()).toBe('Charging your card');
  });

  it('empties the region again when the work finishes', () => {
    const { host, liveRegion, tick } = setup();
    host.loading.set(true);
    tick();
    host.loading.set(false);
    tick();

    expect(liveRegion().textContent?.trim()).toBe('');
  });

  it('stays quiet for a page that announces the work itself', () => {
    const { host, liveRegion, tick } = setup();
    host.announceLoading.set(false);
    host.loading.set(true);
    tick();

    expect(liveRegion().textContent?.trim()).toBe('');
  });

  it('does not put the word "Loading" inside the name of a button that has one', () => {
    const { host, el, tick } = setup();
    host.loading.set(true);
    tick();

    expect(el.querySelector('button')!.textContent).not.toContain('Loading');
  });

  /**
   * WCAG 2.5.3. While `loadingLabel` is on screen the visible text is
   * "Saving…", and a name of "Save" means a speech-input user saying what they
   * see does not match the control.
   */
  it('keeps the accessible name matching the visible text while loading', () => {
    const { host, el, tick } = setup();
    host.label.set('Save');
    host.loadingLabel.set('Saving…');
    host.loading.set(true);
    tick();

    const button = el.querySelector('button')!;
    expect(button.textContent).toContain('Saving…');
    expect(button.getAttribute('aria-label')).toBe('Saving…');
  });
});
