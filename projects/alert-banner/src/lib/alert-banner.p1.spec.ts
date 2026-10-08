import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer, svResetWarnOnce } from '@styloviz/core';
import { SvAlertBannerComponent, SV_ALERT_READING_MS_PER_CHAR } from './alert-banner.component';

/**
 * Re-verification of the Alert Banner P1 items against the rendered component
 * (`OF-01-I1`/`M1`, `OF-01-I3`, `OF-01-I4`, `OF-01-I7`).
 */

type Node = { nativeElement: HTMLElement };

function stubHeight(el: HTMLElement, height: number): void {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => height });
}

const stripOf = (n: Node) => n.nativeElement.querySelector<HTMLElement>('[role="status"]');

async function pair(a: string, b: string, showSecond = true) {
  TestBed.resetTestingModule();
  const keepSecond = signal(showSecond);
  const view = await render(
    `@if (true) { <sv-alert-banner ${a}></sv-alert-banner> }` +
      `@if (keepSecond()) { <sv-alert-banner ${b}></sv-alert-banner> }`,
    { imports: [SvAlertBannerComponent], componentProperties: { keepSecond } },
  );
  const hosts = () =>
    view.fixture.debugElement.children.filter(
      (c) => c.componentInstance instanceof SvAlertBannerComponent,
    );
  return { view, fixture: view.fixture, hosts, keepSecond };
}

beforeEach(() => svResetWarnOnce());

describe('SvAlertBannerComponent — stacking measures what is painted (OF-01-I1 / OF-01-M1)', () => {
  it('★ offsets by the fixed strip height, though the host itself is 0 px tall', async () => {
    const t = await pair('position="top-fixed" message="one"', 'position="top-fixed" message="two"');
    const [first, second] = t.hosts();
    // What a real browser reports: the host collapses around its fixed child.
    stubHeight(first.nativeElement, 0);
    stubHeight(stripOf(first)!, 48);
    (first.componentInstance as SvAlertBannerComponent).ngAfterViewInit();
    t.fixture.detectChanges();

    expect((second.componentInstance as SvAlertBannerComponent).stackOffset()).toBe(48);
    expect(stripOf(second)!.style.top).toBe('48px');
  });
});

describe('SvAlertBannerComponent — a suppressed duplicate is silent (OF-01-I4)', () => {
  it('★ a later identical pinned banner renders nothing and announces nothing', async () => {
    const t = await pair(
      'position="top-fixed" message="Scheduled maintenance tonight"',
      'position="top-fixed" message="Scheduled maintenance tonight"',
      false,
    );
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const spy = vi.spyOn(announcer, 'announce');

    t.keepSecond.set(true);
    await t.fixture.whenStable();

    const second = t.hosts()[1];
    expect((second.componentInstance as SvAlertBannerComponent).suppressed()).toBe(true);
    expect(stripOf(second)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    announcer.reset();
  });

  it('a different banner arriving later is still announced', async () => {
    const t = await pair('position="top-fixed" message="one"', 'position="top-fixed" message="two"', false);
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const spy = vi.spyOn(announcer, 'announce');
    t.keepSecond.set(true);
    await t.fixture.whenStable();
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['two']);
    spy.mockRestore();
    announcer.reset();
  });
});

describe('SvAlertBannerComponent — timed dismissal rules (OF-01-I7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('★ refuses a countdown when projected content holds a link', async () => {
    TestBed.resetTestingModule();
    const view = await render(
      `<sv-alert-banner [autoDismissMs]="1000" message="Card expired">` +
        `<a href="/billing">Update card</a></sv-alert-banner>`,
      { imports: [SvAlertBannerComponent] },
    );
    const banner = view.fixture.debugElement.children[0].componentInstance as SvAlertBannerComponent;
    expect(banner.autoDismissRefused()).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(banner.isClosing()).toBe(false);
  });

  it('its own dismiss button does not count as projected content', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAlertBannerComponent, {
      inputs: { autoDismissMs: 1000, message: 'Saved', dismissible: true },
    });
    expect(fixture.componentInstance.autoDismissRefused()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(fixture.componentInstance.isClosing()).toBe(true);
  });

  it('★ never dismisses faster than the text can be read', async () => {
    const message = 'x'.repeat(100);
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAlertBannerComponent, {
      inputs: { autoDismissMs: 1000, message },
    });
    const floor = 100 * SV_ALERT_READING_MS_PER_CHAR;
    expect(fixture.componentInstance.effectiveAutoDismissMs()).toBe(floor);
    vi.advanceTimersByTime(floor - 1);
    expect(fixture.componentInstance.isClosing()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.isClosing()).toBe(true);
  });

  it('★ stays paused when the pointer leaves but focus is still inside', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAlertBannerComponent, {
      inputs: { autoDismissMs: 5_000, message: 'Saved' },
    });
    const root = stripOf(fixture.debugElement)!;
    root.dispatchEvent(new MouseEvent('mouseenter'));
    root.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    root.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(60_000);
    expect(fixture.componentInstance.isClosing()).toBe(false);

    root.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(5_000);
    expect(fixture.componentInstance.isClosing()).toBe(true);
  });
});

describe('SvAlertBannerComponent — focus on removal, every template branch (OF-01-I3)', () => {
  const settle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  for (const style of ['soft', 'announcement'] as const) {
    it(`clicking the real dismiss button (${style}) leaves focus in the page, not on <body>`, async () => {
      TestBed.resetTestingModule();
      const view = await render(
        `<div><button type="button" id="before-${style}">Before</button>` +
          `<sv-alert-banner alertStyle="${style}" message="Heads up" /></div>`,
        { imports: [SvAlertBannerComponent] },
      );
      const close = view.fixture.nativeElement.querySelector(
        'sv-alert-banner button[data-sv-alert-control][aria-label^="Dismiss"]',
      ) as HTMLButtonElement;
      close.focus();
      close.click();
      view.fixture.detectChanges();
      await settle(360);
      view.fixture.detectChanges();
      await settle(20);

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement?.id).toBe(`before-${style}`);
    });
  }
});
