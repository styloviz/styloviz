import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  SV_AUTOFILL_END,
  SV_AUTOFILL_START,
  SvAutofillDirective,
} from './autofill.directive';

/**
 * `FI-27-I2` — the fill that fires no event.
 *
 * Chrome's page-load autofill sets the element's `value` and marks it
 * `:autofill`, and the `input` event arrives on the user's first interaction —
 * or never. Everything driven by a signal fed from `(input)` is therefore
 * stale at exactly the moment the field is full.
 *
 * jsdom implements neither `:autofill` nor CSS animations, so these specs drive
 * the event the browser would fire. The end-to-end proof that a real Chromium
 * fires it is in `e2e/autofill-floating-label.spec.ts`.
 */

@Component({
  standalone: true,
  imports: [SvAutofillDirective],
  template: `<input #el svAutofill (autofillChange)="seen.push($event)" />`,
})
class HostComponent {
  readonly seen: boolean[] = [];
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const debug = fixture.debugElement.query(By.directive(SvAutofillDirective));
  return {
    fixture,
    host: fixture.componentInstance,
    dir: debug.injector.get(SvAutofillDirective),
    input: debug.nativeElement as HTMLInputElement,
    tick: () => fixture.detectChanges(),
  };
}

/** The `animationstart` a browser fires when a control enters or leaves `:autofill`. */
function animation(el: HTMLElement, name: string): void {
  const ev = new Event('animationstart', { bubbles: true });
  Object.defineProperty(ev, 'animationName', { value: name });
  el.dispatchEvent(ev);
}

describe('SvAutofillDirective', () => {
  it('reports nothing until the browser says otherwise', () => {
    const { dir } = setup();
    expect(dir.autofilled()).toBe(false);
  });

  it('reports a fill from the animation the browser restarts', () => {
    const { dir, input, tick } = setup();

    animation(input, SV_AUTOFILL_START);
    tick();

    expect(dir.autofilled()).toBe(true);
  });

  it('reports the control leaving the filled state', () => {
    const { dir, input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    animation(input, SV_AUTOFILL_END);
    tick();

    expect(dir.autofilled()).toBe(false);
  });

  /**
   * The element carries other animations — a focus ring, a shake on error, the
   * kit's own popout keyframes. Reacting to any `animationstart` would make the
   * field claim to be autofilled because something moved.
   */
  it('ignores an animation that is not one of its own', () => {
    const { dir, input, tick } = setup();

    animation(input, 'sv-popout-in-below');
    animation(input, 'spin');
    tick();

    expect(dir.autofilled()).toBe(false);
  });

  /**
   * Browsers differ on whether editing an autofilled field clears `:autofill`,
   * so the user's own keystroke ends it regardless. A label left floating
   * because of a fill the user has since replaced is reporting something that
   * stopped being true.
   */
  it('stops claiming a fill once the user types', () => {
    const { dir, input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }));
    tick();

    expect(dir.autofilled()).toBe(false);
  });

  /**
   * ★★ Chrome 153 follows the fill's `animationstart` with a trusted `input`
   * that is a plain `Event` (`scripts/probes/autofill-real-chrome.mjs`). That is
   * the browser reporting its own fill, not the user editing it.
   */
  it('keeps the fill when the browser reports it with a plain input event', () => {
    const { dir, input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    expect(dir.autofilled()).toBe(true);
  });

  it('announces each change once, and only on a change', () => {
    const { host, input, tick } = setup();

    animation(input, SV_AUTOFILL_START);
    animation(input, SV_AUTOFILL_START);
    tick();
    animation(input, SV_AUTOFILL_END);
    tick();

    expect(host.seen).toEqual([true, false]);
  });

  /**
   * The notification channel has to exist before there is anything to notify
   * about — and exactly once, however many fields are on the page.
   */
  it('installs its keyframes once per document', () => {
    setup();
    setup();
    setup();

    const sheets = Array.from(document.head.querySelectorAll('style')).filter((s) =>
      s.textContent?.includes(SV_AUTOFILL_START),
    );
    expect(sheets.length).toBe(1);
  });

  it('declares keyframes that animate nothing', () => {
    // They are a notification channel wearing an animation's clothes. If they
    // moved anything, every autofilled field in the kit would twitch — and
    // `prefers-reduced-motion` would have a claim on this.
    setup();
    const sheet = Array.from(document.head.querySelectorAll('style')).find((s) =>
      s.textContent?.includes(SV_AUTOFILL_START),
    )!;

    expect(sheet.textContent).toContain(`@keyframes ${SV_AUTOFILL_START} { from {} to {} }`);
    expect(sheet.textContent).toContain(`@keyframes ${SV_AUTOFILL_END} { from {} to {} }`);
  });

  it('binds the keyframes to the legacy selector every engine still answers to', () => {
    setup();
    const sheet = Array.from(document.head.querySelectorAll('style')).find((s) =>
      s.textContent?.includes(SV_AUTOFILL_START),
    )!;

    expect(sheet.textContent).toContain('[svAutofill]:-webkit-autofill');
    expect(sheet.textContent).toContain('[svAutofill]:not(:-webkit-autofill)');
  });

  /**
   * ⚠️ Measured against real Chromium, not reasoned about: an earlier draft
   * matched `input, textarea, select`, and `input:not(:-webkit-autofill)` at
   * specificity (0,1,1) beat a consumer's own `.my-spinner` at (0,1,0) — so the
   * kit silently overwrote `animation-name` on every text input in the host
   * application, kit-owned or not. See `scripts/probes/autofill-mechanism.mjs`.
   */
  it('does not reach any control that did not opt in', () => {
    setup();
    const sheet = Array.from(document.head.querySelectorAll('style')).find((s) =>
      s.textContent?.includes(SV_AUTOFILL_START),
    )!;
    const rules = sheet.textContent!.split('}').filter((r) => r.includes('animation-name'));

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toContain('[svAutofill]');
  });

  it('leaves the opt-in attribute in the DOM, which is what the stylesheet keys on', () => {
    const { input } = setup();
    expect(input.hasAttribute('svAutofill')).toBe(true);
  });
});

/**
 * Recorded because the directive was written with one, and it was the whole
 * bug: jsdom answers `true` to `matches(':autofill')` for EVERY input — a
 * pseudo-class it parses but does not implement — so every text field in the
 * kit reported itself autofilled under test. There is no probe now, because
 * there never needed to be one: the stylesheet is installed by the directive's
 * own constructor, and a CSS animation starts when its declaration starts to
 * apply, so an already-filled element animates after the listener is attached.
 */
describe('SvAutofillDirective — no readback probe', () => {
  it('does not ask the element whether it is autofilled', () => {
    const spy = vi.spyOn(Element.prototype, 'matches');
    setup();

    const asked = spy.mock.calls.filter(([sel]) => String(sel).includes('autofill'));
    expect(asked).toEqual([]);
    spy.mockRestore();
  });
});
