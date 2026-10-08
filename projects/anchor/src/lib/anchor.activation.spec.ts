import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  The activation strategy, end to end — `NV-02-I1`, `NV-02-M1`
 * ============================================================================
 *
 * `activation-strategy.spec.ts` pins the rules; this pins the wiring — that the
 * component's default really is `'last-passed'`, that the observer is asked for
 * the thresholds the chosen strategy needs, and that the geometry is re-read on
 * every callback rather than cached from the entry that woke it.
 *
 * ⚠️ jsdom reports every rect as zeros, so every section here is given one by
 * hand. The `isIntersecting` flags are fired to match what a real observer would
 * have said about the component's own `-68%` band — they are the trigger, not
 * the answer.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed: HTMLElement[] = [];

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
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

  /** Fire one callback carrying several sections' flags, as a real one does. */
  fire(flags: Readonly<Record<string, boolean>>): void {
    this.callback(
      Object.entries(flags).map(
        ([id, isIntersecting]) =>
          ({ target: document.getElementById(id), isIntersecting }) as unknown as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
  { id: 'api', label: 'API reference' },
];

/** Mutable geometry, so a test can "scroll" between two observer callbacks. */
const geometry = new Map<string, { top: number; height: number }>();

function place(id: string, top: number, height: number): void {
  geometry.set(id, { top, height });
}

function mountSections(): void {
  for (const item of ITEMS) {
    const el = document.createElement('div');
    el.id = item.id;
    el.getBoundingClientRect = () =>
      ({ ...(geometry.get(item.id) ?? { top: 0, height: 0 }) }) as DOMRect;
    document.body.appendChild(el);
  }
}

/**
 * The common docs setup: the rail points at bare `<h2 id>` headings, ~40px each,
 * with the body text between them belonging to no tracked element. The reader is
 * 300px into Usage's body; API's heading is 200px below the activation line —
 * on screen, inside the observed band, and not yet reached.
 */
function headingsMidUsage(): void {
  place('intro', -600, 40);
  place('usage', -300, 40);
  place('api', 200, 40);
}

const current = (): string | null =>
  screen.queryAllByRole('link').find((a) => a.getAttribute('aria-current') === 'true')?.textContent?.trim() ??
  null;

describe('SvAnchorComponent — the activation strategy', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
    geometry.clear();
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  async function setup(inputs: Record<string, unknown> = {}) {
    mountSections();
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS, ...inputs } });
    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    return fixture;
  }

  const observer = (): FakeIntersectionObserver => FakeIntersectionObserver.instances.at(-1)!;

  /**
   * ★★ **The behaviour change, on the scenario that shows it.** The old fixed rule
   * — `threshold: 0` plus "topmost intersecting wins" — had only API's heading to
   * choose from, so the rail said API while the reader was reading Usage. The new
   * default names the heading they actually scrolled past.
   */
  it('activates the last heading passed, by default', async () => {
    headingsMidUsage();
    const fixture = await setup();

    observer().fire({ intro: false, usage: false, api: true });
    await untilRendered(fixture, () => current() !== null);

    expect(current()).toBe('Usage');
  });

  it('still offers the previous answer under `first-visible`', async () => {
    headingsMidUsage();
    const fixture = await setup({ activation: 'first-visible' });

    observer().fire({ intro: false, usage: false, api: true });
    await untilRendered(fixture, () => current() !== null);

    expect(current()).toBe('API reference');
  });

  /**
   * ★ The cause the default exists to fix, isolated: geometry is re-measured on
   * every callback. An `IntersectionObserverEntry`'s rect is frozen at the
   * crossing that produced it, and a heading crosses the activation line without
   * crossing any threshold — so a cached rect would leave the rail on Intro for as
   * long as the reader stayed inside Usage.
   */
  it('re-measures on every callback instead of trusting the entry that woke it', async () => {
    place('intro', -300, 40);
    place('usage', 200, 40);
    place('api', 900, 40);
    const fixture = await setup();

    observer().fire({ intro: false, usage: true, api: false });
    await untilRendered(fixture, () => current() === 'Introduction');

    // The reader scrolls 500px. No section's relationship with the band changed
    // for Usage — the callback below is Intro leaving the band — so the only way
    // to notice Usage's heading crossed the line is to measure again.
    place('intro', -800, 40);
    place('usage', -300, 40);
    place('api', 400, 40);
    observer().fire({ intro: false });
    await untilRendered(fixture, () => current() === 'Usage');

    expect(current()).toBe('Usage');
  });

  /**
   * ★ One offset, not two. The activation line is the sticky-header offset the
   * jump already uses, so moving the header moves the line: with 400px reserved,
   * API's heading at +200 is *above* the line and is what the reader is under.
   */
  it('measures from the activation line the offset defines', async () => {
    headingsMidUsage();
    const fixture = await setup({ offset: 400 });

    observer().fire({ intro: false, usage: false, api: true });
    await untilRendered(fixture, () => current() === 'API reference');

    expect(current()).toBe('API reference');
  });

  /**
   * An edge rule is exact because an edge crossing IS an intersection event; a
   * continuous one has no such moment and has to be sampled. So the thresholds
   * follow the strategy rather than being one fixed number for all four.
   */
  it('asks for a single threshold for an edge strategy', async () => {
    headingsMidUsage();
    await setup();
    expect(observer().options?.threshold).toBe(0);
  });

  it('asks for sampled thresholds for a continuous strategy', async () => {
    headingsMidUsage();
    await setup({ activation: 'most-visible' });
    expect(observer().options?.threshold).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  /**
   * ⚠️ The fail-open path, at component level: no rects at all, which is every
   * server render and every other spec in this package. A strategy that needs
   * pixels must still highlight something rather than leave the rail blank.
   */
  it('falls back to the observer flags when nothing has been laid out', async () => {
    const fixture = await setup({ activation: 'most-visible' });

    observer().fire({ intro: false, usage: true, api: false });
    await untilRendered(fixture, () => current() !== null);

    expect(current()).toBe('Usage');
  });

  /** And a strategy change re-creates the observer, because its options are immutable. */
  it('re-observes when the strategy changes', async () => {
    headingsMidUsage();
    const fixture = await setup();
    const before = FakeIntersectionObserver.instances.length;

    fixture.componentRef.setInput('activation', 'nearest-offset');
    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > before);

    expect(observer().options?.threshold).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(current()).toBe('API reference');
  });
});
