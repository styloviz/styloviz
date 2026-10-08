import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTooltipComponent } from './tooltip.component';

/**
 * `X-16` / `OF-20-I5` — "tooltips are unavailable on touch".
 *
 * ★★★ AND THE REASON IT IS WORSE THAN UNAVAILABLE: mobile browsers synthesise
 *     `mouseenter` on tap, so a hover tooltip HALF-works. The tap meant to
 *     activate the trigger shows the tooltip over the control the user just
 *     pressed, and with no `mouseleave` coming it stays there. Something that
 *     plainly did nothing would at least be obvious.
 *
 * ★★ `matchMedia` is stubbed rather than inferred, and the QUERY is asserted
 *    in `coarse-pointer.spec.ts` — a stubbed MQL answers whatever it was told
 *    for any query at all, so a value assertion here cannot see which question
 *    was asked.
 */

interface FakeMql {
  matches: boolean;
  readonly listeners: ((e: MediaQueryListEvent) => void)[];
  addEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
  removeEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
}

function fakeMql(matches: boolean): FakeMql {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  return {
    matches,
    listeners,
    addEventListener(_t, cb) { listeners.push(cb); },
    removeEventListener(_t, cb) {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

/** `hover: none` = a finger. */
function stubPointer(noHover: boolean): FakeMql {
  const mql = fakeMql(noHover);
  vi.stubGlobal('matchMedia', () => mql as unknown as MediaQueryList);
  return mql;
}

async function setup(attrs = '') {
  TestBed.resetTestingModule();
  const view = await render(
    `<sv-tooltip text="Delete this row" ${attrs}><button type="button">Delete</button></sv-tooltip>`,
    { imports: [SvTooltipComponent] },
  );
  const el = view.fixture.nativeElement as HTMLElement;
  return {
    ...view,
    tip: view.fixture.debugElement.children[0].componentInstance as SvTooltipComponent,
    wrap: el.querySelector('div') as HTMLElement,
    button: el.querySelector('button') as HTMLButtonElement,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SvTooltipComponent — on a pointer that can hover', () => {
  it('keeps the hover trigger', async () => {
    stubPointer(false);
    const { tip } = await setup();
    expect(tip.effectiveTrigger()).toBe('hover');
  });

  it('shows on mouseenter and hides on mouseleave', async () => {
    stubPointer(false);
    const { tip, wrap } = await setup();
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    expect(tip.visible()).toBe(true);
    wrap.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    expect(tip.visible()).toBe(false);
  });
});

describe('SvTooltipComponent — on a pointer that cannot hover', () => {
  it('★ downgrades a hover trigger to tap-to-toggle', async () => {
    stubPointer(true);
    const { tip } = await setup();
    expect(tip.effectiveTrigger()).toBe('click');
  });

  it('shows on tap and hides on a second tap', async () => {
    stubPointer(true);
    const { tip, button, fixture } = await setup();
    button.click();
    fixture.detectChanges();
    expect(tip.visible()).toBe(true);

    button.click();
    fixture.detectChanges();
    expect(tip.visible()).toBe(false);
  });

  it('★ does not show on the synthesised mouseenter', async () => {
    // This is the half-working behaviour: the tap that activates the trigger
    // would otherwise also raise the tooltip over the control just pressed.
    stubPointer(true);
    const { tip, wrap } = await setup();
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    expect(tip.visible()).toBe(false);
  });

  it('★ dismisses on a press anywhere else — there is no mouseleave on a finger', async () => {
    stubPointer(true);
    const { tip, button, fixture } = await setup();
    button.click();
    fixture.detectChanges();
    expect(tip.visible()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(tip.visible()).toBe(false);
  });

  it('does not dismiss on a press inside its own wrapper', async () => {
    stubPointer(true);
    const { tip, button, fixture } = await setup();
    button.click();
    fixture.detectChanges();

    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(tip.visible()).toBe(true);
  });

  it('★ skips the show delay, which is a hover affordance', async () => {
    // `delay` exists so a pointer crossing the screen does not trail tooltips
    // behind it. A tap is deliberate, and holding still for 300ms after
    // pressing something reads as the tap not having landed.
    vi.useFakeTimers();
    stubPointer(true);
    const { tip, button, fixture } = await setup('[delay]="300"');
    button.click();
    fixture.detectChanges();
    expect(tip.visible()).toBe(true);
  });

  it('still honours the delay when hovering is available', async () => {
    vi.useFakeTimers();
    stubPointer(false);
    const { tip, wrap } = await setup('[delay]="300"');
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    expect(tip.visible()).toBe(false);
    vi.advanceTimersByTime(300);
    expect(tip.visible()).toBe(true);
  });

  it('★ leaves an explicit focus trigger alone', async () => {
    // Focus is already a real path on touch — a tapped button takes focus —
    // and downgrading it would take the tooltip away from a keyboard user on a
    // touchscreen laptop.
    stubPointer(true);
    const { tip } = await setup('trigger="focus"');
    expect(tip.effectiveTrigger()).toBe('focus');
  });

  it('leaves an explicit click trigger alone', async () => {
    stubPointer(true);
    const { tip } = await setup('trigger="click"');
    expect(tip.effectiveTrigger()).toBe('click');
  });
});

describe('SvTooltipComponent — a pointer that changes mid-session', () => {
  it('★ follows the change, because a convertible laptop folds', async () => {
    const mql = stubPointer(false);
    const { tip } = await setup();
    expect(tip.effectiveTrigger()).toBe('hover');

    mql.matches = true;
    mql.listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    expect(tip.effectiveTrigger()).toBe('click');
  });

  it('stops listening when it is destroyed', async () => {
    const mql = stubPointer(false);
    const { fixture } = await setup();
    expect(mql.listeners).toHaveLength(1);
    fixture.destroy();
    // ★ Otherwise a tooltip on a route the user left keeps a live media-query
    //   listener for the life of the page.
    expect(mql.listeners).toHaveLength(0);
  });
});
