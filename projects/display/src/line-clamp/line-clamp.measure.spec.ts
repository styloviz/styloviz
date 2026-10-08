import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLineClampComponent } from './line-clamp.component';
import { until } from '../../../../src/testing/async';

/**
 * The *measurement* half of the component — the part the sibling spec
 * deliberately drives by hand because jsdom has no layout.
 *
 * ★ jsdom (26) does not implement `ResizeObserver` at all, so the guard in
 * `ngOnInit` short-circuits and the observer path is unreachable as shipped.
 * A minimal fake is installed here so the real `checkOverflow` arithmetic can
 * be exercised on demand, and one test asserts the *absence* of the observer
 * is survivable — that is the SSR path, and it must not throw.
 *
 * Heights are stubbed explicitly (jsdom reports 0 for every box), and only the
 * two the component actually reads.
 */

type ROCallback = () => void;
class FakeResizeObserver {
  static live: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly cb: ROCallback) {
    FakeResizeObserver.live.push(this);
  }
  observe(target: Element): void { this.observed.push(target); }
  unobserve(): void { /* not exercised */ }
  disconnect(): void { this.observed.length = 0; }
  fire(): void { this.cb(); }
}

const g = globalThis as unknown as { ResizeObserver?: unknown };
const installFakeRO = (): void => {
  FakeResizeObserver.live = [];
  g.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
};
const removeFakeRO = (): void => {
  delete g.ResizeObserver;
};

async function setup(attrs = '') {
  TestBed.resetTestingModule();
  const view = await render(`<sv-line-clamp ${attrs}>Some text</sv-line-clamp>`, {
    imports: [SvLineClampComponent],
  });
  const clamp = view.fixture.debugElement.children[0]
    .componentInstance as SvLineClampComponent;
  return { ...view, clamp };
}

/** Stub only the two heights `checkOverflow` reads. */
function stubHeights(el: HTMLElement, full: number, clamped: number): void {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => full });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clamped });
}

describe('SvLineClampComponent — overflow measurement', () => {
  beforeEach(installFakeRO);
  afterEach(removeFakeRO);

  it('concludes the text is clamped when it is taller than the clamp allows', async () => {
    const v = await setup('[lines]="2"');
    const content = v.clamp.contentRef()!.nativeElement;
    stubHeights(content, 120, 40);

    expect(FakeResizeObserver.live).toHaveLength(1);
    expect(FakeResizeObserver.live[0].observed).toEqual([content]);

    FakeResizeObserver.live[0].fire();
    await until(() => v.clamp.isClamped(), { label: 'the clamp to be detected' });
    v.fixture.detectChanges();
    expect(v.fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  /**
   * The 2px tolerance exists so sub-pixel line heights do not put a "Show more"
   * on text that is not actually cut. A 2px difference must NOT count.
   */
  it('ignores a difference inside the tolerance', async () => {
    const v = await setup();
    stubHeights(v.clamp.contentRef()!.nativeElement, 42, 40);

    FakeResizeObserver.live[0].fire();
    await new Promise((r) => setTimeout(r, 0));
    expect(v.clamp.isClamped()).toBe(false);
    expect(v.fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('takes the flag back down when the text stops overflowing', async () => {
    const v = await setup();
    const content = v.clamp.contentRef()!.nativeElement;
    stubHeights(content, 120, 40);
    FakeResizeObserver.live[0].fire();
    await until(() => v.clamp.isClamped());

    stubHeights(content, 40, 40);
    FakeResizeObserver.live[0].fire();
    await until(() => !v.clamp.isClamped(), { label: 'the clamp to be released' });
  });

  /**
   * `checkOverflow` writes through `zone.run` only when the verdict CHANGED —
   * re-measuring an unchanged layout must not schedule anything.
   */
  it('leaves the flag alone when the verdict has not changed', async () => {
    const v = await setup();
    const content = v.clamp.contentRef()!.nativeElement;
    stubHeights(content, 120, 40);
    FakeResizeObserver.live[0].fire();
    await until(() => v.clamp.isClamped());

    const spy = vi.spyOn(v.clamp.isClamped, 'set');
    FakeResizeObserver.live[0].fire();
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('restores the inline styles it borrowed for measuring', async () => {
    const v = await setup('[lines]="4"');
    const content = v.clamp.contentRef()!.nativeElement;
    stubHeights(content, 120, 40);
    const before = content.style.cssText;

    FakeResizeObserver.live[0].fire();
    await until(() => v.clamp.isClamped());
    expect(content.style.cssText).toBe(before);
  });

  it('disconnects the observer when the component goes away', async () => {
    const v = await setup();
    const ro = FakeResizeObserver.live[0];
    expect(ro.observed).toHaveLength(1);
    v.fixture.destroy();
    expect(ro.observed).toHaveLength(0);
  });

});

/**
 * The SSR path. `ResizeObserver` is genuinely absent in this environment, so
 * this asserts the guard rather than a stub.
 */
describe('SvLineClampComponent — without a ResizeObserver', () => {
  it('mounts and still measures on its deferred check', async () => {
    expect(typeof g.ResizeObserver).toBe('undefined');
    const v = await setup();
    stubHeights(v.clamp.contentRef()!.nativeElement, 120, 40);
    // The `setTimeout(0)` in ngOnInit is the only measurement left.
    await until(() => v.clamp.isClamped(), { label: 'the deferred measurement' });
  });
});
