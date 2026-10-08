import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import {
  provideSvNavLocation,
  svHashNavLocation,
  svNoopNavLocation,
} from '@styloviz/core';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  Hash synchronisation — `NV-02-I3`, `NV-02-M2`
 * ============================================================================
 *
 * This family starts somewhere different from the other four. `T0` confirmed
 * there is **no history pollution to fix**: the links are real `href="#id"`
 * anchors and `scroll-spy.ts` never writes `history`, `location` or `hash`. So
 * the browser already answers refresh, sharing and no-JavaScript by itself, and
 * the seam is an opt-in for the one thing a plain anchor cannot do — reflecting
 * the *scrolled* position back into the URL.
 *
 * Which is precisely why the write mode is the whole design. `NV-02-I3` is the
 * defect this family is named for, and the answer is not a default: scrolling
 * always replaces, and only a click may push.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed: HTMLElement[] = [];

  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: HTMLElement): void {
    this.observed.push(el);
  }

  disconnect(): void { /* intentionally empty — nothing is torn down in the double */ }
  unobserve(): void { /* intentionally empty */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  fire(el: HTMLElement, isIntersecting: boolean): void {
    this.callback(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
  { id: 'api', label: 'API reference' },
];

function mountSections(ids: readonly string[]): void {
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
}

function at(url: string): void {
  window.history.replaceState(null, '', url);
}

describe('SvAnchorComponent — the hash', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
    at('/guide');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      /* intentionally empty — jsdom cannot scroll; the spy records the call */
    });
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function setup(
    inputs: Record<string, unknown> = {},
    addressable = true,
  ) {
    TestBed.resetTestingModule();
    mountSections(['intro', 'usage', 'api']);
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: ITEMS, ...inputs },
      providers: [
        provideSvNavLocation(
          addressable ? svHashNavLocation('section') : svNoopNavLocation(),
        ),
      ],
    });
    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    return fixture;
  }

  /**
   * Scroll `id` into view and everything else out of it. Firing only the arrival
   * is not enough — the spy resolves ties in document order, so leaving an
   * earlier section intersecting keeps it active and the test would assert
   * against a page that never moved.
   */
  const scrollTo = async (
    fixture: Awaited<ReturnType<typeof setup>>,
    id: string,
  ) => {
    const io = FakeIntersectionObserver.instances[0];
    for (const item of ITEMS) {
      io.fire(document.getElementById(item.id)!, item.id === id);
    }
    await untilRendered(fixture, () => true);
  };

  describe('opting in', () => {
    it('touches no URL without a urlKey', async () => {
      const fixture = await setup();
      await scrollTo(fixture, 'usage');
      expect(window.location.hash).toBe('');
    });

    it('touches no URL without a provided location', async () => {
      const fixture = await setup({ urlKey: 'section' }, false);
      await scrollTo(fixture, 'usage');
      expect(window.location.hash).toBe('');
    });

    it('reflects the section being read once both halves are in place', async () => {
      const fixture = await setup({ urlKey: 'section' });
      await scrollTo(fixture, 'usage');
      expect(window.location.hash).toBe('#usage');
    });
  });

  describe('the write mode', () => {
    /**
     * ★ `NV-02-I3`'s lesson, enforced rather than defaulted. A scrollspy that
     * pushed an entry per section would fill the back stack until back stopped
     * being a way out of the page — so scrolling replaces, and `urlWriteMode`
     * cannot change it.
     */
    it('never pushes for a scroll, even with urlWriteMode="push"', async () => {
      const fixture = await setup({ urlKey: 'section', urlWriteMode: 'push' });
      const before = window.history.length;

      await scrollTo(fixture, 'intro');
      await scrollTo(fixture, 'usage');
      await scrollTo(fixture, 'api');

      expect(window.location.hash).toBe('#api');
      expect(window.history.length).toBe(before);
    });

    /**
     * ★ The other half of the same decision. A click is a gesture, not a drift:
     * the reader chose to go somewhere, and back meaning "where I was reading" is
     * reasonable. One key, two honest answers — which is why `SvNavParam.set`
     * grew a per-call mode.
     */
    it('pushes for a click when asked to', async () => {
      const fixture = await setup({ urlKey: 'section', urlWriteMode: 'push' });
      const before = window.history.length;

      fireEvent.click(screen.getByText('API reference'));
      await untilRendered(fixture, () => window.location.hash === '#api');

      expect(window.history.length).toBe(before + 1);
    });

    it('replaces for a click by default', async () => {
      const fixture = await setup({ urlKey: 'section' });
      const before = window.history.length;

      fireEvent.click(screen.getByText('API reference'));
      await untilRendered(fixture, () => window.location.hash === '#api');

      expect(window.history.length).toBe(before);
    });

    /**
     * The scroll that follows a click settles on the same section, so the
     * reflection effect must decline to write it again — otherwise one gesture
     * leaves two entries and back goes nowhere.
     */
    it('does not write twice when a click is followed by its own scroll', async () => {
      const fixture = await setup({ urlKey: 'section', urlWriteMode: 'push' });
      const before = window.history.length;

      fireEvent.click(screen.getByText('Usage'));
      await untilRendered(fixture, () => window.location.hash === '#usage');
      await scrollTo(fixture, 'usage');

      expect(window.history.length).toBe(before + 1);
    });
  });

  describe('the hash to the component', () => {
    /**
     * ★ The browser already scrolls to a real `#id` on load, so this path exists
     * for the case the browser gets WRONG: `offset`. A page with a sticky header
     * lands the section underneath it, and `jumpTo` is the only code that knows
     * how tall the header is — which is also why the template's links
     * `preventDefault()`.
     */
    it('jumps to a deep-linked section with the offset applied', async () => {
      at('/guide#api');
      mountSections(['intro', 'usage', 'api']);
      // jsdom reports every rect as 0, so the section is given a position —
      // otherwise the offset subtracts into `Math.max(0, …)` and the assertion
      // would pass whether or not `offset` was read at all.
      vi.spyOn(document.getElementById('api')!, 'getBoundingClientRect')
        .mockReturnValue({ top: 500 } as DOMRect);

      TestBed.resetTestingModule();
      const { fixture } = await render(SvAnchorComponent, {
        inputs: { items: ITEMS, urlKey: 'section', offset: 80 },
        providers: [provideSvNavLocation(svHashNavLocation('section'))],
      });
      await untilRendered(
        fixture,
        () =>
          (window.scrollTo as unknown as { mock: { calls: unknown[] } }).mock.calls.length > 0,
      );

      const [arg] = (window.scrollTo as unknown as { mock: { calls: [ScrollToOptions][] } })
        .mock.calls[0];
      expect(arg.top).toBe(420);
      expect(window.location.hash).toBe('#api');
    });

    /**
     * ★ `NV-02-M2`. A deep link to a section that is not there on the first pass
     * — an `@defer` block, a route's data still arriving — used to be given up on
     * for good: the target was recorded as handled before the check, and the
     * resolved sections were read untracked, so their arrival woke nothing.
     */
    it('jumps to a deep-linked section that renders after first paint', async () => {
      at('/guide#api');
      mountSections(['intro', 'usage']);

      TestBed.resetTestingModule();
      const { fixture } = await render(SvAnchorComponent, {
        inputs: { items: ITEMS, urlKey: 'section' },
        providers: [provideSvNavLocation(svHashNavLocation('section'))],
      });
      expect(window.scrollTo).not.toHaveBeenCalled();

      mountSections(['api']);
      await untilRendered(
        fixture,
        () =>
          (window.scrollTo as unknown as { mock: { calls: unknown[] } }).mock.calls.length > 0,
        { label: 'the late section to be jumped to' },
      );

      // …and the link was not overwritten with the first section while it waited.
      expect(window.location.hash).toBe('#api');
    });

    it('follows the back button to another section', async () => {
      const fixture = await setup({ urlKey: 'section' });
      await scrollTo(fixture, 'usage');
      expect(window.location.hash).toBe('#usage');

      at('/guide#intro');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await untilRendered(fixture, () => true);

      expect(window.scrollTo).toHaveBeenCalled();
    });

    /**
     * ★ The loop this component has to avoid: it writes the hash on scroll and
     * jumps on read, so its own echo must be distinguishable from somebody else's
     * change. A scroll that produced three writes must produce no jumps at all.
     */
    it('does not jump in response to its own writes', async () => {
      const fixture = await setup({ urlKey: 'section' });
      (window.scrollTo as unknown as { mockClear(): void }).mockClear();

      await scrollTo(fixture, 'intro');
      await scrollTo(fixture, 'usage');
      await scrollTo(fixture, 'api');

      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });
});
