import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAffixComponent } from './affix.component';
import type { AffixMode } from './affix.position';

/**
 * `sv-affix`, through the component.
 *
 * The positioning arithmetic has its own spec in `affix.position.spec.ts`. This
 * file is about what reaches the DOM, and above all about the placeholder —
 * because a placeholder that is present in the class and absent from the
 * template fixes nothing at all.
 */

async function affix(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAffixComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const rect = (top: number, height: number): DOMRect => ({
  top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}),
});

/**
 * jsdom reports every box as zero, so the numbers a browser would measure are
 * stubbed here — and stubbed the way a browser actually behaves.
 *
 * ★★★ `getBoundingClientRect().top` IS VIEWPORT-RELATIVE AND MOVES WITH THE
 * SCROLL. A stub that returns a constant models a page that does not scroll,
 * which makes every affix assertion pass or fail for the wrong reason. The first
 * version of this helper did exactly that; the component was right and ten tests
 * were wrong. So the holder's rect tracks the scroll, and the SLOT's rect is
 * pinned once the element is — which is the trap `measure()` has to avoid.
 */
function place(
  f: { nativeElement: HTMLElement; componentInstance: { measure(y: number): void } },
  anchorTop: number,
  height: number,
  container?: { el: HTMLElement; docBottom: number },
) {
  const slot = q(f, '[data-sv-slot]') as HTMLElement;
  const holder = q(f, '[data-sv-placeholder]') as HTMLElement;
  let y = 0;
  let pinnedTop: number | null = null;

  holder.getBoundingClientRect = () => rect(anchorTop - y, height);
  slot.getBoundingClientRect = () => rect(pinnedTop ?? anchorTop - y, height);
  // ★ The container's rect is viewport-relative too. Stubbing it as a constant
  //   models a container that scrolls with the page, which nothing does.
  if (container) {
    container.el.getBoundingClientRect = () => rect(container.docBottom - y - 1000, 1000);
  }

  /** Move the stubbed layout, without telling the component. */
  const setScroll = (to: number, pinnedAt: number | null = null) => {
    y = to;
    pinnedTop = pinnedAt;
  };
  const scrollTo = (to: number, pinnedAt: number | null = null) => {
    setScroll(to, pinnedAt);
    f.componentInstance.measure(to);
  };
  return { slot, holder, scrollTo, setScroll };
}

/** A container whose bottom sits at `docBottom` in document space. */
function containerAt(docBottom: number) {
  return { el: document.createElement('div'), docBottom };
}

// ── The placeholder ─────────────────────────────────────────────────────────

describe('SvAffixComponent — the placeholder', () => {
  /**
   * ★★★ THE PLACEHOLDER IS THE COMPONENT. Without it, going fixed removes the
   * element from flow, everything below jumps up by its height, the page height
   * changes, `scrollY` changes, and the element can unpin — which puts the
   * height back and re-pins it.
   */
  it('reserves no space while the element is in flow', async () => {
    const f = await affix();
    const { scrollTo } = place(f, 200, 120);
    scrollTo(0);
    f.detectChanges();

    const holder = q(f, '[data-sv-placeholder]') as HTMLElement;
    expect(holder.getAttribute('data-sv-affix')).toBe('static');
    expect(holder.style.height).toBe('');
  });

  it('reserves exactly the measured height the moment it pins', async () => {
    const f = await affix();
    const { scrollTo } = place(f, 200, 120);
    scrollTo(500);
    f.detectChanges();

    const holder = q(f, '[data-sv-placeholder]') as HTMLElement;
    expect(holder.getAttribute('data-sv-affix')).toBe('fixed');
    expect(holder.style.height).toBe('120px');
  });

  it('keeps reserving it when the element docks at the container bottom', async () => {
    const container = containerAt(1000);
    const f = await affix({ container: container.el });
    const { scrollTo } = place(f, 200, 120, container);
    scrollTo(900);
    f.detectChanges();

    const holder = q(f, '[data-sv-placeholder]') as HTMLElement;
    expect(holder.getAttribute('data-sv-affix')).toBe('docked');
    expect(holder.style.height).toBe('120px');
  });
});

// ── The pinned element ──────────────────────────────────────────────────────

describe('SvAffixComponent — the pinned element', () => {
  it('is left alone in flow, with no positioning at all', async () => {
    const f = await affix();
    const { scrollTo } = place(f, 200, 120);
    scrollTo(0);
    f.detectChanges();

    const slot = q(f, '[data-sv-slot]') as HTMLElement;
    expect(slot.className).not.toContain('fixed');
    expect(slot.className).not.toContain('absolute');
    expect(slot.style.top).toBe('');
  });

  it('goes fixed at the offset once pinned', async () => {
    const f = await affix({ offsetTop: 16 });
    const { scrollTo } = place(f, 200, 120);
    scrollTo(500);
    f.detectChanges();

    const slot = q(f, '[data-sv-slot]') as HTMLElement;
    expect(slot.className).toContain('fixed');
    expect(slot.style.top).toBe('16px');
  });

  /**
   * ★★★ WITHOUT A BOUNDARY, A PINNED SIDEBAR FLOATS OVER THE FOOTER — and, being
   * fixed, over whatever the reader scrolled down to look at.
   */
  it('switches from fixed to absolute at the container boundary', async () => {
    const container = containerAt(1000);
    const f = await affix({ container: container.el });
    const { scrollTo } = place(f, 200, 120, container);

    scrollTo(400);
    f.detectChanges();
    expect((q(f, '[data-sv-slot]') as HTMLElement).className).toContain('fixed');

    scrollTo(900);
    f.detectChanges();
    const slot = q(f, '[data-sv-slot]') as HTMLElement;
    expect(slot.className).toContain('absolute');
    expect(slot.className).not.toContain('fixed');
  });

  it('marks that the boundary is what stopped it, not the scroll', async () => {
    const container = containerAt(1000);
    const f = await affix({ container: container.el });
    const { scrollTo } = place(f, 200, 120, container);
    scrollTo(900);
    f.detectChanges();

    expect((q(f, '[data-sv-placeholder]') as HTMLElement).getAttribute('data-sv-at-boundary'))
      .toBe('true');
  });

  it('pins indefinitely with no container', async () => {
    const f = await affix();
    const { scrollTo } = place(f, 200, 120);
    scrollTo(99999);
    f.detectChanges();
    expect((q(f, '[data-sv-slot]') as HTMLElement).className).toContain('fixed');
  });
});

// ── Disabled ────────────────────────────────────────────────────────────────

describe('SvAffixComponent — disabled', () => {
  /**
   * ★★ THE ESCAPE HATCH HAS TO REACH THE PLACEHOLDER TOO. Disabling the pinning
   * but leaving the reserved height behind is a mysterious gap at a breakpoint,
   * which is the commonest way this control breaks on phones.
   */
  it('never pins, and reserves nothing, when disabled', async () => {
    const f = await affix({ disabled: true });
    const { scrollTo } = place(f, 200, 120);
    scrollTo(5000);
    f.detectChanges();

    const holder = q(f, '[data-sv-placeholder]') as HTMLElement;
    expect(holder.getAttribute('data-sv-affix')).toBe('static');
    expect(holder.style.height).toBe('');
    expect((q(f, '[data-sv-slot]') as HTMLElement).className).not.toContain('fixed');
  });
});

// ── Measurement ─────────────────────────────────────────────────────────────

describe('SvAffixComponent — measurement', () => {
  /**
   * ★★★ THE ANCHOR IS MEASURED FROM THE PLACEHOLDER, NOT FROM THE ELEMENT. Once
   * pinned, the element's own rect reports the viewport position it was moved
   * to, so re-measuring from it yields the threshold that keeps it pinned — a
   * one-way latch that never unpins on the way back up.
   */
  it('unpins on the way back up, rather than latching', async () => {
    const f = await affix({ offsetTop: 0 });
    const { scrollTo } = place(f, 200, 120);

    // Pinned at the viewport top: the SLOT's own rect now reports 0, which is
    // the trap. The placeholder is still where it always was.
    scrollTo(500, 0);
    f.detectChanges();
    expect((q(f, '[data-sv-placeholder]') as HTMLElement).getAttribute('data-sv-affix')).toBe('fixed');

    scrollTo(100, 0);
    f.detectChanges();
    expect((q(f, '[data-sv-placeholder]') as HTMLElement).getAttribute('data-sv-affix')).toBe('static');
  });

  it('emits only when the mode actually changes', async () => {
    TestBed.resetTestingModule();
    const modes: AffixMode[] = [];
    const { fixture } = await render(SvAffixComponent, {
      on: { affixChange: (m: AffixMode) => modes.push(m) },
    });
    fixture.detectChanges();
    const { scrollTo } = place(fixture, 200, 120);

    scrollTo(0);
    scrollTo(50);
    scrollTo(500);
    scrollTo(600);
    scrollTo(0);

    expect(modes).toEqual(['fixed', 'static']);
  });

  it('reads the scroll position off the event target rather than a global', async () => {
    const f = await affix();
    const { setScroll } = place(f, 200, 120);

    // A scroll event whose document view is at 500.
    const event = new Event('scroll');
    Object.defineProperty(event, 'target', {
      value: { defaultView: { scrollY: 500 } },
      configurable: true,
    });
    setScroll(500);
    f.componentInstance.onWindowScroll(event);
    f.detectChanges();

    expect((q(f, '[data-sv-placeholder]') as HTMLElement).getAttribute('data-sv-affix')).toBe('fixed');
  });

  it('treats a scroll event with no view as the top of the page', async () => {
    const f = await affix();
    place(f, 200, 120);
    f.componentInstance.onWindowScroll(new Event('scroll'));
    f.detectChanges();
    expect((q(f, '[data-sv-placeholder]') as HTMLElement).getAttribute('data-sv-affix')).toBe('static');
  });
});

// ── The read-out ────────────────────────────────────────────────────────────

describe('SvAffixComponent — the read-out', () => {
  it('describes each mode for assistive tech', async () => {
    const f = await affix({ offsetTop: 16 });
    const { scrollTo } = place(f, 200, 120);

    scrollTo(0);
    f.detectChanges();
    expect(text(q(f, '[data-sv-state-label]'))).toBe('In flow.');

    scrollTo(500);
    f.detectChanges();
    expect(text(q(f, '[data-sv-state-label]'))).toContain('Pinned 16px');
  });
});
