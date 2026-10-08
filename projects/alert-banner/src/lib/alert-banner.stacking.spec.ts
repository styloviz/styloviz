import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvAlertBannerComponent } from './alert-banner.component';

/**
 * `X-12` / `OF-01-I1` / `OF-01-I7` / `OF-01-M1` / `OF-01-M2`.
 *
 * ★★★ THE DEFECT: two `top-fixed` banners got byte-identical `fixed top-0
 *     left-0 right-0 z-50`, so one was painted underneath the other and simply
 *     never seen. The shape is the ordinary one — a shell renders a maintenance
 *     notice, a route renders a trial-expiry notice, neither knows about the
 *     other — which is why the coordination is a root service rather than a
 *     container component.
 *
 * ★★ jsdom has no layout: `offsetHeight` is 0 for everything. Heights are
 * stubbed on the element wherever a test is about offsets, and the assertions
 * are against those numbers.
 */

/**
 * ★ ONE render, TWO banners, in one template. Two `render()` calls in a single
 *   test cannot work — the second tries to configure a TestBed the first has
 *   already instantiated — and two banners is the entire subject here. It is
 *   also the real shape: two components that know nothing about each other,
 *   coordinated only through the root service.
 */
async function twoBanners(a: string, b: string) {
  TestBed.resetTestingModule();
  // ★★ BOTH inside a conditional block, even though only one is ever removed.
  //    A static element is instantiated with the host view and a conditional
  //    block's content during the first change-detection pass — so mixing the
  //    two reverses which banner reaches the stack FIRST, and "first" is the
  //    thing every test here is about.
  // ★ A SIGNAL, not a plain property. Removing a banner is what half these
  //   tests do, and a plain field does not mark the wrapper dirty — the `@if`
  //   never re-evaluates, and dev mode's verify pass then reports the change it
  //   was never shown (NG0100) instead of the banner going away.
  const keepFirst = signal(true);
  const view = await render(
    `@if (keepFirst()) { <sv-alert-banner ${a}></sv-alert-banner> }` +
      `@if (keepSecond()) { <sv-alert-banner ${b}></sv-alert-banner> }`,
    {
      imports: [SvAlertBannerComponent],
      componentProperties: { keepFirst, keepSecond: signal(true) },
    },
  );
  const hosts = view.fixture.debugElement.children.filter(
    (c) => c.componentInstance instanceof SvAlertBannerComponent,
  );
  return {
    view,
    fixture: view.fixture,
    firstNode: hosts[0],
    secondNode: hosts[1],
    a: hosts[0].componentInstance as SvAlertBannerComponent,
    b: hosts[1].componentInstance as SvAlertBannerComponent,
    /** `whenStable()` rather than `detectChanges()`: the removal is a signal
     *  write, so the work is a normal change-detection pass to wait for. */
    dropFirst: async () => {
      keepFirst.set(false);
      await view.fixture.whenStable();
    },
  };
}

/**
 * ★★ Stubs the STRIP, not the host. The host of a `top-fixed` /
 *    `bottom-fixed` banner is 0 px tall in a real browser (its only child is
 *    `position: fixed`, out of flow), and this helper stubbing the host is how
 *    the specs stayed green while every real pinned banner reported 0.
 */
function stub(node: { nativeElement: HTMLElement }, height: number) {
  const target = node.nativeElement.querySelector<HTMLElement>('[role="status"]');
  if (!target) throw new Error('no strip to stub — the banner renders nothing');
  Object.defineProperty(target, 'offsetHeight', {
    configurable: true,
    get: () => height,
  });
}

/** The strip inside a banner host, or null when the banner renders nothing. */
function strip(node: { nativeElement: HTMLElement }): HTMLElement | null {
  return node.nativeElement.querySelector('div');
}

beforeEach(() => svResetWarnOnce());

describe('SvAlertBannerComponent — pinned stacking', () => {
  it('stacks a second top-fixed banner below the first', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="maintenance tonight"',
      'position="top-fixed" message="trial expires friday"',
    );
    expect(t.a.stackOffset()).toBe(0);
    // Nothing has reported a height yet, so they overlap — honestly, rather
    // than by a guessed number.
    expect(t.b.stackOffset()).toBe(0);

    stub(t.firstNode, 44);
    t.a.ngAfterViewInit();
    t.fixture.detectChanges();
    expect(t.b.stackOffset()).toBe(44);
  });

  it('binds the offset to `top` for a top-pinned banner', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="one"',
      'position="top-fixed" message="two"',
    );
    stub(t.firstNode, 44);
    t.a.ngAfterViewInit();
    t.fixture.detectChanges();

    expect(strip(t.secondNode)?.style.top).toBe('44px');
    expect(strip(t.secondNode)?.style.bottom).toBe('');
  });

  it('★ binds `bottom`, not `top`, for a bottom-pinned banner', async () => {
    // Offsetting a bottom-fixed banner by `top` would send it to the other
    // side of the viewport.
    const t = await twoBanners(
      'position="bottom-fixed" message="one"',
      'position="bottom-fixed" message="two"',
    );
    stub(t.firstNode, 30);
    t.a.ngAfterViewInit();
    t.fixture.detectChanges();

    expect(strip(t.secondNode)?.style.bottom).toBe('30px');
    expect(strip(t.secondNode)?.style.top).toBe('');
  });

  it('leaves an inline banner out of the stack entirely', async () => {
    const t = await twoBanners(
      'position="inline" message="one"',
      'position="top-fixed" message="two"',
    );
    stub(t.firstNode, 44);
    t.a.ngAfterViewInit();
    t.fixture.detectChanges();
    // An inline banner is in the document flow and cannot overlap anything;
    // giving it a slot would push the fixed one down for no reason.
    expect(t.b.stackOffset()).toBe(0);
  });

  it('gives the edge to the higher priority', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="low" [priority]="0"',
      'position="top-fixed" message="high" [priority]="10"',
    );
    stub(t.secondNode, 50);
    t.b.ngAfterViewInit();
    t.fixture.detectChanges();
    expect(t.b.stackOffset()).toBe(0);
    expect(t.a.stackOffset()).toBe(50);
  });

  it('closes the gap when the banner above is destroyed', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="one"',
      'position="top-fixed" message="two"',
    );
    stub(t.firstNode, 44);
    t.a.ngAfterViewInit();
    t.fixture.detectChanges();
    expect(t.b.stackOffset()).toBe(44);

    await t.dropFirst();
    expect(t.b.stackOffset()).toBe(0);
  });
});

describe('SvAlertBannerComponent — duplicate suppression', () => {
  it('renders nothing for an identical pinned banner', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="Your trial expires on Friday"',
      'position="top-fixed" message="Your trial expires on Friday"',
    );
    expect(t.a.suppressed()).toBe(false);
    expect(t.b.suppressed()).toBe(true);
    expect(strip(t.secondNode)).toBeNull();
  });

  it('keeps two DIFFERENT banners, stacked', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="maintenance tonight"',
      'position="top-fixed" message="trial expires friday"',
    );
    expect(t.a.suppressed()).toBe(false);
    expect(t.b.suppressed()).toBe(false);
  });

  it('suppresses on an explicit key even when the wording differs', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="Read-only until 21:00" dedupeKey="maintenance"',
      'position="top-fixed" message="Maintenance in progress" dedupeKey="maintenance"',
    );
    expect(t.b.suppressed()).toBe(true);
  });

  it('dedupeKey null never suppresses, even for identical text', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="same" [dedupeKey]="null"',
      'position="top-fixed" message="same" [dedupeKey]="null"',
    );
    expect(t.b.suppressed()).toBe(false);
  });

  it('★ never suppresses an inline banner, however identical', async () => {
    // Two identical inline banners in two parts of a page are two pieces of
    // form feedback about two different fields as often as they are a mistake,
    // and neither one hides the other.
    const t = await twoBanners('position="inline" message="same"', 'position="inline" message="same"');
    expect(t.b.suppressed()).toBe(false);
    expect(strip(t.secondNode)).not.toBeNull();
  });

  it('un-suppresses the duplicate when the original is destroyed', async () => {
    const t = await twoBanners(
      'position="top-fixed" message="same"',
      'position="top-fixed" message="same"',
    );
    expect(t.b.suppressed()).toBe(true);
    await t.dropFirst();
    expect(t.b.suppressed()).toBe(false);
    expect(strip(t.secondNode)).not.toBeNull();
  });
});

describe('SvAlertBannerComponent — auto-dismiss refusal (OF-01-I7)', () => {
  async function one(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAlertBannerComponent, { inputs });
    return fixture;
  }

  it('★ refuses to auto-dismiss a danger banner', async () => {
    const f = await one({ variant: 'danger', message: 'Payment failed', autoDismissMs: 1500 });
    expect(f.componentInstance.autoDismissRefused()).toBe(true);
    expect(f.componentInstance.effectiveAutoDismissMs()).toBe(0);
  });

  it('★ refuses to auto-dismiss a banner with actions', async () => {
    const f = await one({
      message: 'A new version is available',
      actions: [{ id: 'reload', label: 'Reload' }],
      autoDismissMs: 1500,
    });
    expect(f.componentInstance.autoDismissRefused()).toBe(true);
    expect(f.componentInstance.effectiveAutoDismissMs()).toBe(0);
  });

  it('never starts the countdown it refused', async () => {
    vi.useFakeTimers();
    try {
      const f = await one({ variant: 'danger', message: 'Payment failed', autoDismissMs: 1500 });
      vi.advanceTimersByTime(10_000);
      f.detectChanges();
      expect(f.componentInstance.isVisible()).toBe(true);
      expect(f.componentInstance.isClosing()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours the countdown for everything else', async () => {
    const f = await one({ variant: 'success', message: 'Saved', autoDismissMs: 4000 });
    expect(f.componentInstance.autoDismissRefused()).toBe(false);
    expect(f.componentInstance.effectiveAutoDismissMs()).toBe(4000);
  });

  it('is not "refused" when there was no countdown to refuse', async () => {
    const f = await one({ variant: 'danger', message: 'Payment failed' });
    expect(f.componentInstance.autoDismissRefused()).toBe(false);
  });
});
