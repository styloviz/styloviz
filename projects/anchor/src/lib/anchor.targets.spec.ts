import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce, type SvUnresolvedValue } from '@styloviz/core';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  Targets this page does not have exactly one of — `NV-02-I2`, `NV-02-M3`
 * ============================================================================
 *
 * The source item: *"duplicate or missing target IDs fail silently — the rail
 * renders, the link does nothing, nothing reports it."* Every symptom points at
 * the scrollspy; the cause is a typo three files away in the page's markup.
 *
 * ★ **Duplicates are the worse half, and the audit named only the missing one.**
 * `getElementById` returns the FIRST match, so a page with two `id="usage"`
 * elements gets a rail that works — it scrolls somewhere, it highlights
 * something — and is wrong. A silent failure is at least visibly broken; a silent
 * wrong answer is not.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(): void { /* intentionally empty */ }
  disconnect(): void { /* intentionally empty */ }
  unobserve(): void { /* intentionally empty */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

function mountSection(id: string): void {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
}

describe('SvAnchorComponent — unresolved targets', () => {
  let originalIO: typeof IntersectionObserver | undefined;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
    svResetWarnOnce();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /**
   * Let the app settle and render again. A missing section is only reported by
   * the pass AFTER the one that first missed it, which runs once the app is
   * stable — see `noteUnresolved`.
   */
  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await untilRendered(fixture, () => true);
    await TestBed.inject(ApplicationRef).whenStable();
    await untilRendered(fixture, () => true);
  }

  async function mount(items: readonly AnchorItem[] = ITEMS) {
    TestBed.resetTestingModule();
    const seen: SvUnresolvedValue<string>[] = [];
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items },
      on: { unresolved: (e: SvUnresolvedValue<string>) => seen.push(e) },
    });
    return { fixture, seen };
  }

  async function setup(items: readonly AnchorItem[] = ITEMS) {
    const mounted = await mount(items);
    await settle(mounted.fixture);
    return mounted;
  }

  it('says nothing when every item resolves', async () => {
    mountSection('intro');
    mountSection('usage');
    const { seen } = await setup();

    expect(seen).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  describe('a target that is not there', () => {
    /**
     * ★ `NV-02-M3`. A section that has not rendered YET is the ordinary case on
     * first paint — a route that just navigated, an `@defer` block still loading
     * — so the first pass that misses it must not report it.
     */
    it('says nothing about a section that renders after first paint', async () => {
      mountSection('intro');
      const { fixture, seen } = await mount();
      await untilRendered(fixture, () => true);
      expect(seen).toEqual([]);

      mountSection('usage');
      await settle(fixture);

      expect(seen).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('reports it to the host', async () => {
      mountSection('intro');
      const { seen } = await setup();

      expect(seen).toEqual([
        { requested: 'usage', rendered: null, reason: 'unknown', corrected: false },
      ]);
    });

    /** The console is for whoever is building the page, which is where it gets fixed. */
    it('names the id in a dev warning', async () => {
      mountSection('intro');
      await setup();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('id="usage"'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('no such element'));
    });

    /**
     * ★ A click on a dead entry is the most direct evidence there is, and it is
     * the case the resolve pass cannot cover: the section resolved fine at mount
     * and was removed afterwards, so `items` never changed and nothing re-ran.
     */
    it('reports a section that disappeared after it resolved', async () => {
      mountSection('intro');
      mountSection('usage');
      const { fixture, seen } = await setup();
      expect(seen).toEqual([]);

      document.getElementById('usage')!.remove();
      fixture.componentInstance.jumpTo('usage');

      expect(seen.at(-1)).toMatchObject({ requested: 'usage', reason: 'unknown' });
    });

    /**
     * An id is forgotten once it resolves, so a section that goes missing a
     * second time is news and is reported a second time.
     */
    it('reports a section again when it disappears after having come back', async () => {
      mountSection('intro');
      const { fixture, seen } = await setup();
      expect(seen).toHaveLength(1);

      mountSection('usage');
      fixture.componentRef.setInput('items', [...ITEMS]);
      await settle(fixture);
      expect(seen).toHaveLength(1);

      document.getElementById('usage')!.remove();
      fixture.componentRef.setInput('items', [...ITEMS]);
      await settle(fixture);

      expect(seen).toHaveLength(2);
      expect(seen[1]).toMatchObject({ requested: 'usage', reason: 'unknown' });
    });
  });

  describe('a target the page has two of', () => {
    /**
     * ★ The half the audit did not name, and the worse one. The rail WORKS — it
     * scrolls, it highlights — and points at whichever element came first.
     */
    it('reports it as blocked, and keeps tracking the first one', async () => {
      mountSection('intro');
      mountSection('usage');
      mountSection('usage');

      const { seen } = await setup();

      expect(seen).toEqual([
        { requested: 'usage', rendered: 'usage', reason: 'blocked', corrected: false },
      ]);
    });

    it('says in the warning that the link points at the wrong section', async () => {
      mountSection('usage');
      mountSection('usage');
      await setup([{ id: 'usage', label: 'Usage' }]);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('2 elements'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('wrong section'));
    });
  });

  /**
   * This runs inside `afterRenderEffect`, so anything noisier would fire on every
   * scroll — which is how a warning becomes something people turn off.
   */
  it('reports each id once, however many render passes follow', async () => {
    mountSection('intro');
    const { fixture, seen } = await setup();

    fixture.detectChanges();
    fixture.detectChanges();
    await untilRendered(fixture, () => true);

    expect(seen).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ Not `CSS.escape`: it is undefined in jsdom and on the server, so it throws
   * inside the resolve effect and takes the whole rail down. It is also the wrong
   * tool — it escapes identifiers, and this is a quoted attribute value.
   */
  it('handles an id containing a quote without throwing', async () => {
    const weird = 'a"b';
    const el = document.createElement('div');
    el.id = weird;
    document.body.appendChild(el);

    const { seen } = await setup([{ id: weird, label: 'Odd' }]);
    expect(seen).toEqual([]);
  });
});
