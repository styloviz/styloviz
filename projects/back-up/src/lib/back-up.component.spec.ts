import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SV_LINK_ADAPTER,
  SV_NAV_TELEMETRY,
  svResetWarnOnce,
  type SvLinkAdapter,
  type SvLinkTarget,
  type SvNavEvent,
  type SvNavTelemetry,
} from '@styloviz/core';
import { SvBackUpComponent, type BackUpNavigation } from './back-up.component';

/**
 * ============================================================================
 *  `N-4` — Back / Up
 * ============================================================================
 *
 * ★★★ THE TEST THAT IS THE COMPONENT: a back control with nothing behind it
 *     goes UP rather than doing nothing. `history.back()` on a single-entry
 *     session is silent — no error, no navigation, no feedback — so the defect
 *     it prevents is a visible control that does not respond, which reads as a
 *     broken app rather than as a boundary.
 *
 * ⚠️ `history.length` CANNOT BE SET, in jsdom or in a browser. It is derived
 *    from the session and read-only on both. Every test that needs a particular
 *    stack depth therefore redefines the property on the `history` INSTANCE for
 *    the duration of the test and puts it back — which is also the only honest
 *    way to say "this is the environment, not the component".
 */

// ─── Environment doubles ─────────────────────────────────────────────────────

/** Pretend the session has `n` entries. Returns the restore. */
function withHistoryLength(n: number): () => void {
  const original = Object.getOwnPropertyDescriptor(History.prototype, 'length');
  Object.defineProperty(history, 'length', { value: n, configurable: true });
  return () => {
    delete (history as unknown as Record<string, unknown>)['length'];
    if (original) Object.defineProperty(History.prototype, 'length', original);
  };
}

/** Pretend the page was linked from `referrer`. Returns the restore. */
function withReferrer(referrer: string): () => void {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, 'referrer');
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
  return () => {
    delete (document as unknown as Record<string, unknown>)['referrer'];
    if (original) Object.defineProperty(Document.prototype, 'referrer', original);
  };
}

/** A link adapter that records rather than navigates, like a consumer's router. */
function recordingAdapter() {
  const went: SvLinkTarget[] = [];
  const adapter: SvLinkAdapter = {
    kind: 'spec',
    href: (target) => (typeof target === 'string' ? target : target.join('/')),
    navigate: (target) => {
      went.push(target);
      return true;
    },
  };
  return { went, adapter };
}

function recordingTelemetry(retention = '30d') {
  const seen: SvNavEvent[] = [];
  const sink: SvNavTelemetry = {
    kind: 'spec',
    retention,
    consent: () => true,
    record: (e) => seen.push(e),
  };
  return { seen, sink };
}

async function setup(inputs: Partial<ComponentInput<SvBackUpComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { went, adapter } = recordingAdapter();
  const { seen, sink } = recordingTelemetry();
  const navigated: BackUpNavigation[] = [];

  const { fixture } = await render(SvBackUpComponent, {
    inputs: inputs as ComponentInput<SvBackUpComponent>,
    providers: [
      { provide: SV_LINK_ADAPTER, useValue: adapter },
      { provide: SV_NAV_TELEMETRY, useValue: sink },
    ],
  });
  fixture.componentInstance.navigated.subscribe((e) => navigated.push(e));
  return { fixture, c: fixture.componentInstance, went, seen, navigated };
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const button = (f: { nativeElement: unknown }) => el(f).querySelector('button');
const anchor = (f: { nativeElement: unknown }) => el(f).querySelector('a');

// ─── The element follows the promise ─────────────────────────────────────────

describe('SvBackUpComponent — which element each mode renders', () => {
  /**
   * ★★ NOT A STYLE CHOICE. `up` has a destination, so it is an anchor —
   *    middle-clickable, ⌘-clickable, "copy link address", visible in the
   *    status bar. `back` has none; "wherever you came from" is not an address,
   *    and a link would advertise "open in new tab" for something the browser
   *    cannot open in a new tab.
   */
  it('renders up as a real anchor with a real href', async () => {
    const f = await setup({ mode: 'up', up: '/orders', upLabel: 'Orders' });
    expect(anchor(f.fixture)?.getAttribute('href')).toBe('/orders');
    expect(button(f.fixture)).toBeNull();
  });

  it('renders back as a button, never an anchor', async () => {
    const f = await setup({ mode: 'back', up: '/orders' });
    expect(button(f.fixture)).toBeTruthy();
    expect(anchor(f.fixture)).toBeNull();
  });

  it('joins an array target into one path', async () => {
    const f = await setup({ mode: 'up', up: ['/orders', '8814'] });
    expect(anchor(f.fixture)?.getAttribute('href')).toBe('/orders/8814');
  });

  /**
   * ⚠️ `[attr.href]`, not `[href]`. A property binding assigns `a.href = null`,
   *    the DOM coerces it to `''` and the attribute reflects back — resolving to
   *    the CURRENT url, so an up control with no target silently links to the
   *    page it is already on.
   */
  it('omits the href entirely when there is no up target', async () => {
    const f = await setup({ mode: 'up', up: null });
    expect(anchor(f.fixture)?.hasAttribute('href')).toBe(false);
  });
});

// ─── History safety — the item's own requirement ─────────────────────────────

describe('SvBackUpComponent — history safety (N-4)', () => {
  let restore: () => void = () => undefined;
  afterEach(() => restore());

  it('goes back when there is something behind it', async () => {
    restore = withHistoryLength(4);
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });

    button(f.fixture)!.click();

    expect(back).toHaveBeenCalledTimes(1);
    expect(f.went).toEqual([]);
    expect(f.navigated).toEqual([{ action: 'back', reason: 'requested', target: null }]);
    back.mockRestore();
  });

  /**
   * ★★★ THE DEFECT THIS COMPONENT EXISTS TO PREVENT. A deep-linked page — from
   *     an email, a chat, a bookmark — has one history entry. `history.back()`
   *     there does nothing at all, silently, so the user presses a visible
   *     control and the page sits still.
   */
  it('goes UP instead of dead-ending on a single-entry session', async () => {
    restore = withHistoryLength(1);
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });

    button(f.fixture)!.click();

    expect(back).not.toHaveBeenCalled();
    expect(f.went).toEqual(['/orders']);
    expect(f.navigated).toEqual([{ action: 'up', reason: 'fallback', target: '/orders' }]);
    back.mockRestore();
  });

  /**
   * ★ `reason` is the whole point of the output. From outside, a fallback and a
   *   working back button are indistinguishable — a page appeared either way.
   */
  it('reports the fallback as a fallback, not as a back', async () => {
    restore = withHistoryLength(1);
    const f = await setup({ mode: 'back', up: '/orders' });
    button(f.fixture)!.click();
    expect(f.navigated[0].reason).toBe('fallback');
    expect(f.navigated[0].action).toBe('up');
  });

  /**
   * ⚠️ The one case the component cannot rescue, so it says so loudly instead
   *    of failing silently — which would be the exact dead end, with the
   *    component's name on it.
   */
  it('warns rather than doing nothing when there is no history AND no up target', async () => {
    restore = withHistoryLength(1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ mode: 'back', up: null });

    button(f.fixture)!.click();

    expect(f.went).toEqual([]);
    expect(f.navigated).toEqual([]);
    // ⚠️ Every call, not the first. The telemetry sink's own retention warning
    //    fires when the recorder is built, which is before this one.
    const said = warn.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(said.some((m: string) => m.includes('dead end'))).toBe(true);
    warn.mockRestore();
  });
});

// ─── stayInSite ──────────────────────────────────────────────────────────────

describe('SvBackUpComponent — the fallback with no adapter wired up', () => {
  let restore: () => void = () => undefined;
  afterEach(() => {
    restore();
    window.history.replaceState(null, '', window.location.pathname);
  });

  /**
   * ★★ The fallback is a `<button>`, so there is no anchor for the browser to
   *    follow when the adapter declines. Under the default `svHrefLinkAdapter`
   *    `navigate` returns `false`, and the fallback that exists to prevent a
   *    dead end was one — while `navigated` reported a move up. A same-document
   *    hash target is used because jsdom performs those for real.
   */
  it('loads the up href itself when the default adapter declines', async () => {
    restore = withHistoryLength(1);
    window.history.replaceState(null, '', window.location.pathname);
    TestBed.resetTestingModule();
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = `${window.location.pathname}#up-fallback`;
    const { fixture } = await render(SvBackUpComponent, {
      inputs: { mode: 'back', up: target } as ComponentInput<SvBackUpComponent>,
    });
    const navigated: BackUpNavigation[] = [];
    fixture.componentInstance.navigated.subscribe((e) => navigated.push(e));

    button(fixture)!.click();

    expect(window.location.hash).toBe('#up-fallback');
    expect(navigated).toEqual([{ action: 'up', reason: 'fallback', target }]);
    warn.mockRestore();
  });

  it('leaves location alone when the adapter took the navigation', async () => {
    restore = withHistoryLength(1);
    window.history.replaceState(null, '', window.location.pathname);
    const f = await setup({ mode: 'back', up: '#never-assigned' });

    button(f.fixture)!.click();

    expect(f.went).toEqual(['#never-assigned']);
    expect(window.location.hash).toBe('');
  });
});

describe('SvBackUpComponent — stayInSite', () => {
  let restoreHistory: () => void = () => undefined;
  let restoreReferrer: () => void = () => undefined;
  afterEach(() => {
    restoreHistory();
    restoreReferrer();
  });

  /**
   * ★★ `history.length > 1` proves only that SOMETHING is behind us — a search
   *    engine counts. Default-off, because "back" meaning the browser's back,
   *    including off the site, is what the word has always meant.
   */
  it('goes back to another site by default, because that is what back means', async () => {
    restoreHistory = withHistoryLength(3);
    restoreReferrer = withReferrer('https://search.example/?q=orders');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    const f = await setup({ mode: 'back', up: '/orders' });
    button(f.fixture)!.click();

    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('refuses a foreign referrer once stayInSite is on, and goes up', async () => {
    restoreHistory = withHistoryLength(3);
    restoreReferrer = withReferrer('https://search.example/?q=orders');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    const f = await setup({ mode: 'back', up: '/orders', stayInSite: true });
    button(f.fixture)!.click();

    expect(back).not.toHaveBeenCalled();
    expect(f.went).toEqual(['/orders']);
    expect(f.navigated[0].reason).toBe('fallback');
    back.mockRestore();
  });

  it('accepts a same-origin referrer', async () => {
    restoreHistory = withHistoryLength(3);
    restoreReferrer = withReferrer(`${location.origin}/orders`);
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    const f = await setup({ mode: 'back', up: '/orders', stayInSite: true });
    button(f.fixture)!.click();

    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  /** ★ A referrer that will not parse is a referrer the component cannot vouch for. */
  it('treats an unparseable referrer as foreign', async () => {
    restoreHistory = withHistoryLength(3);
    restoreReferrer = withReferrer('not a url');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    const f = await setup({ mode: 'back', up: '/orders', stayInSite: true });
    button(f.fixture)!.click();

    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  /**
   * ★ An empty session beats everything, including a same-origin referrer:
   *   there is genuinely nowhere to go.
   */
  it('still falls back on a single-entry session however friendly the referrer', async () => {
    restoreHistory = withHistoryLength(1);
    restoreReferrer = withReferrer(`${location.origin}/orders`);
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    const f = await setup({ mode: 'back', up: '/orders', stayInSite: true });
    button(f.fixture)!.click();

    expect(back).not.toHaveBeenCalled();
    expect(f.went).toEqual(['/orders']);
    back.mockRestore();
  });
});

// ─── The up path ─────────────────────────────────────────────────────────────

describe('SvBackUpComponent — going up', () => {
  it('lets the adapter navigate and cancels the browser, exactly once', async () => {
    const f = await setup({ mode: 'up', up: '/orders', upLabel: 'Orders' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    anchor(f.fixture)!.dispatchEvent(event);

    expect(f.went).toEqual(['/orders']);
    expect(event.defaultPrevented).toBe(true);
    expect(f.navigated).toEqual([{ action: 'up', reason: 'requested', target: '/orders' }]);
  });

  /**
   * ★★ A ⌘-click means "open this somewhere else", and the only correct answer
   *    is to let the browser do it. Intercepting one turns a new tab into a
   *    navigation in the current one — the failure `NV-07-I12` named.
   */
  /**
   * ⚠️ A `#` target, not a path. This is the one test that deliberately lets the
   *    browser follow the anchor, and jsdom implements no navigation except a
   *    hash change — a path target makes it log `Not implemented: navigation`,
   *    which reads like a failure in a passing run.
   */
  it('never intercepts a modified click', async () => {
    const f = await setup({ mode: 'up', up: '#orders' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });

    anchor(f.fixture)!.dispatchEvent(event);

    expect(f.went).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    expect(f.navigated).toEqual([]);
  });

  it('does nothing at all when disabled', async () => {
    const f = await setup({ mode: 'up', up: '/orders', disabled: true });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    anchor(f.fixture)!.dispatchEvent(event);

    expect(f.went).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
    expect(anchor(f.fixture)?.getAttribute('aria-disabled')).toBe('true');
  });
});

// ─── Label and presentation ──────────────────────────────────────────────────

describe('SvBackUpComponent — what it says', () => {
  it('names the destination, because "Back" alone says nothing', async () => {
    const back = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });
    const up = await setup({ mode: 'up', up: '/orders', upLabel: 'Orders' });
    expect(el(back.fixture).textContent).toContain('Back to Orders');
    expect(el(up.fixture).textContent).toContain('Up to Orders');
  });

  it('falls back to the bare verb with no upLabel', async () => {
    const f = await setup({ mode: 'back', up: '/orders' });
    expect(el(f.fixture).textContent?.trim()).toBe('Back');
  });

  it('lets the host write the whole label', async () => {
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders', label: 'Cancel' });
    expect(el(f.fixture).textContent?.trim()).toBe('Cancel');
  });

  /** ★ Different glyphs, so a toolbar holding both is not ambiguous at a glance. */
  it('points left for back and up for up', async () => {
    const back = await setup({ mode: 'back', up: '/x' });
    const up = await setup({ mode: 'up', up: '/x' });
    expect(el(back.fixture).querySelector('sv-icon')?.getAttribute('ng-reflect-name') ?? back.c['iconName']()).toBe('arrow-left');
    expect(up.c['iconName']()).toBe('arrow-up');
  });

  it('keeps an accessible name when only the icon is shown', async () => {
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders', iconOnly: true });
    expect(el(f.fixture).textContent?.trim()).toBe('');
    expect(button(f.fixture)?.getAttribute('aria-label')).toBe('Back to Orders');
  });

  it('does not duplicate the name when the text is visible', async () => {
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });
    expect(button(f.fixture)?.hasAttribute('aria-label')).toBe(false);
  });
});

// ─── The shared navigation stream (`X-15`) ───────────────────────────────────

describe('SvBackUpComponent — X-15', () => {
  let restore: () => void = () => undefined;
  afterEach(() => restore());

  it('records a real back as `retreat`', async () => {
    restore = withHistoryLength(4);
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });

    button(f.fixture)!.click();

    expect(f.seen.map((e) => e.intent)).toEqual(['retreat']);
    expect(f.seen[0].surface).toBe('back-up');
    back.mockRestore();
  });

  /**
   * ★★★ THE REQUIREMENT T12 NAMES. A fallback still produces a page view, so
   *     conventional analytics cannot tell "our back button works" from "our
   *     back button silently sends people somewhere else". Here they are two
   *     different intents, and the fallback carries its reason.
   */
  it('records a fallback as `jump`, with the reason', async () => {
    restore = withHistoryLength(1);
    const f = await setup({ mode: 'back', up: '/orders', upLabel: 'Orders' });

    button(f.fixture)!.click();

    expect(f.seen).toEqual([
      expect.objectContaining({ intent: 'jump', reason: 'history-empty', key: '/orders' }),
    ]);
  });

  it('records a requested up with no reason', async () => {
    const f = await setup({ mode: 'up', up: '/orders', upLabel: 'Orders', surfaceId: 'crumb' });
    anchor(f.fixture)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(f.seen[0]).toMatchObject({
      surface: 'back-up',
      surfaceId: 'crumb',
      intent: 'jump',
      key: '/orders',
      reason: null,
    });
  });
});
