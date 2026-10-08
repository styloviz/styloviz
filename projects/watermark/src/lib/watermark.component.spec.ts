import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvWatermarkComponent } from './watermark.component';

/**
 * `sv-watermark`, through the component.
 *
 * The tiling arithmetic has its own spec in `watermark.tile.spec.ts`. This file
 * is about what reaches the DOM — and above all about the two ways this control
 * ships broken: an overlay that eats every click underneath it, and a mark that
 * a screen reader reads out forty times.
 */

async function mark(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvWatermarkComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const all = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll(sel));
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/**
 * jsdom reports every layout box as zero, so the box the marks tile across is
 * stubbed here — and until it is, the component has nothing to tile, which is
 * itself the first-render state a real browser passes through.
 */
function sized(
  f: { nativeElement: HTMLElement; componentInstance: { measure(): void } },
  width: number,
  height: number,
) {
  const box = q(f, '[data-sv-watermark]') as HTMLElement;
  box.getBoundingClientRect = () =>
    ({
      width, height, top: 0, left: 0, right: width, bottom: height,
      x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
  f.componentInstance.measure();
  return box;
}

// ── The overlay ─────────────────────────────────────────────────────────────

describe('SvWatermarkComponent — the overlay', () => {
  /**
   * ★★★ `pointer-events: none` OR THE MARK EATS EVERY CLICK UNDER IT. An overlay
   * stretched across the content is, by default, a transparent sheet intercepting
   * every pointer event — which turns the whole watermarked region into a dead
   * zone. It is the single commonest way this control ships broken, and the
   * symptom (buttons that do nothing) never looks like a watermark bug.
   */
  it('lets every click through to the content underneath', async () => {
    const f = await mark();
    expect((q(f, '[data-sv-overlay]') as HTMLElement).className).toContain('pointer-events-none');
  });

  /**
   * ★★★ AND THE SAME PROBLEM ON THE OTHER SIDE. A screen reader reading
   * "Confidential" forty times is not accessibility; it is the document made
   * unusable for exactly the people who have no way around it.
   */
  it('hides the repeated marks from assistive tech and announces them once', async () => {
    const f = await mark({ text: 'Confidential', angle: 30 });
    sized(f, 600, 400);
    f.detectChanges();

    expect((q(f, '[data-sv-overlay]') as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect(all(f, '[data-sv-mark]').length).toBeGreaterThan(1);

    const label = q(f, '[data-sv-label]') as HTMLElement;
    expect(label.className).toContain('sr-only');
    expect(text(label)).toContain('Confidential');
    expect(text(label)).toContain('marks');
  });

  it('projects the content it is marking', async () => {
    const f = await mark();
    expect(q(f, '[data-sv-watermark]')).not.toBeNull();
    expect((q(f, '[data-sv-overlay]') as HTMLElement).className).toContain('absolute');
  });

  it('carries the configured opacity, not a hard-coded one', async () => {
    const f = await mark({ opacity: 0.13 });
    expect((q(f, '[data-sv-overlay]') as HTMLElement).style.opacity).toBe('0.13');
  });

  /**
   * ★★ THE MARKS ARE NOT SELECTABLE. A watermark that lands in the clipboard
   * every time somebody copies a paragraph makes the document worse to use
   * without making it any harder to leak.
   */
  it('stays out of the text selection', async () => {
    const f = await mark();
    expect((q(f, '[data-sv-overlay]') as HTMLElement).className).toContain('select-none');
  });

  it('clips the marks to the box rather than bleeding past it', async () => {
    const f = await mark();
    expect((q(f, '[data-sv-overlay]') as HTMLElement).className).toContain('overflow-hidden');
  });
});

// ── Tiling ──────────────────────────────────────────────────────────────────

describe('SvWatermarkComponent — tiling', () => {
  it('draws nothing until the box has been measured', async () => {
    const f = await mark();
    expect(all(f, '[data-sv-mark]').length).toBe(0);
  });

  it('covers the measured box', async () => {
    const f = await mark({ text: 'Confidential', fontSize: 14, angle: 0, gapX: 80, gapY: 60 });
    sized(f, 800, 600);
    f.detectChanges();
    expect(all(f, '[data-sv-mark]').length).toBeGreaterThan(4);
  });

  /**
   * ★★★ THE TILE IS SIZED FROM THE ROTATED BOX. Computing the repeat from the
   * text's own width and height and then rotating it overlaps vertically and gaps
   * horizontally — a moiré of clipped, colliding text. At 60° the label is far
   * taller than its own line height, so a rotated tiling puts out strictly fewer
   * rows than an unrotated one over the same box.
   */
  it('spaces the rows by the rotated height, not the text height', async () => {
    const flat = await mark({ text: 'Confidential', angle: 0, gapY: 0 });
    sized(flat, 800, 600);
    flat.detectChanges();

    const tilted = await mark({ text: 'Confidential', angle: 60, gapY: 0 });
    sized(tilted, 800, 600);
    tilted.detectChanges();

    const rowsOf = (f: { nativeElement: HTMLElement }) =>
      new Set(all(f, '[data-sv-mark]').map((el) => el.getAttribute('data-sv-row'))).size;

    expect(rowsOf(tilted)).toBeLessThan(rowsOf(flat));
  });

  /**
   * ★★ A SQUARE GRID READS AS COLUMNS, and columns leave clean vertical stripes a
   * screenshot can be cropped to. The odd rows start half a tile to the left.
   */
  it('staggers every other row', async () => {
    const f = await mark({ angle: 0 });
    sized(f, 800, 600);
    f.detectChanges();

    const left = (row: string) =>
      (all(f, `[data-sv-mark][data-sv-row="${row}"]`)[0] as HTMLElement).style.left;
    expect(left('0')).not.toBe(left('1'));
    expect(left('0')).toBe(left('2'));
  });

  it('leaves the grid square when the stagger is turned off', async () => {
    const f = await mark({ angle: 0, stagger: false });
    sized(f, 800, 600);
    f.detectChanges();

    const left = (row: string) =>
      (all(f, `[data-sv-mark][data-sv-row="${row}"]`)[0] as HTMLElement).style.left;
    expect(left('0')).toBe(left('1'));
  });

  it('rotates each mark by the configured angle', async () => {
    const f = await mark({ angle: -30 });
    sized(f, 400, 300);
    f.detectChanges();
    expect((all(f, '[data-sv-mark]')[0] as HTMLElement).style.transform).toContain('rotate(-30deg)');
  });

  it('draws exactly one mark in the single variant, however big the box', async () => {
    const f = await mark({ variant: 'single' });
    sized(f, 2000, 2000);
    f.detectChanges();
    expect(all(f, '[data-sv-mark]').length).toBe(1);
    expect(text(q(f, '[data-sv-label]'))).toContain('1 mark ');
  });
});

// ── Opacity ─────────────────────────────────────────────────────────────────

describe('SvWatermarkComponent — the opacity band', () => {
  /**
   * ★★★ TWO FAILURE MODES PULLING IN OPPOSITE DIRECTIONS, and neither is visible
   * on the developer's monitor: too faint and the mark is gone the moment the
   * screenshot is compressed, too strong and somebody turns the feature off.
   */
  it('names both failure modes, and which one is happening', async () => {
    const faint = await mark({ variant: 'inspect', opacity: 0.01 });
    expect((q(faint, '[data-sv-inspect-opacity]') as HTMLElement)
      .getAttribute('data-sv-opacity-verdict')).toBe('too-faint');
    expect(text(q(faint, '[data-sv-inspect-opacity]'))).toContain('JPEG');

    const strong = await mark({ variant: 'inspect', opacity: 0.6 });
    expect((q(strong, '[data-sv-inspect-opacity]') as HTMLElement)
      .getAttribute('data-sv-opacity-verdict')).toBe('too-strong');
    expect(text(q(strong, '[data-sv-inspect-opacity]'))).toContain('turns the watermark off');

    const ok = await mark({ variant: 'inspect', opacity: 0.1 });
    expect((q(ok, '[data-sv-inspect-opacity]') as HTMLElement)
      .getAttribute('data-sv-opacity-verdict')).toBe('usable');
  });

  /**
   * ★★ THE VERDICT DOES NOT OVERRIDE THE AUTHOR. Refusing to render a mark the
   * component thinks is too faint would break a page over a judgement call about
   * a threshold nobody has measured for the author's content.
   */
  it('still renders the mark it is complaining about', async () => {
    const f = await mark({ opacity: 0.6 });
    sized(f, 400, 300);
    f.detectChanges();
    expect(all(f, '[data-sv-mark]').length).toBeGreaterThan(0);
    expect((q(f, '[data-sv-overlay]') as HTMLElement).style.opacity).toBe('0.6');
  });
});

// ── The signature ───────────────────────────────────────────────────────────

describe('SvWatermarkComponent — tamper detection', () => {
  /**
   * ★★★ A WATERMARK ONE DEVTOOLS KEYSTROKE CAN DELETE IS DECORATION. The
   * signature is what a restored mark is compared against, so an edit in place is
   * caught as well as an outright removal.
   */
  it('accepts an unchanged mark and reports a changed one', async () => {
    const f = await mark({ text: 'Confidential', angle: 30, opacity: 0.1, fontSize: 14 });
    const signature = (q(f, '[data-sv-overlay]') as HTMLElement)
      .getAttribute('data-sv-signature') as string;

    expect(f.componentInstance.checkIntegrity(signature)).toBe(true);
    expect(f.componentInstance.checkIntegrity('["Public",30,0.1,14]')).toBe(false);
  });

  it('emits only when the mark has actually changed', async () => {
    TestBed.resetTestingModule();
    let tampered = 0;
    const { fixture } = await render(SvWatermarkComponent, {
      inputs: { text: 'Confidential', angle: 30, opacity: 0.1, fontSize: 14 },
      on: { tampered: () => (tampered += 1) },
    });
    fixture.detectChanges();
    const signature = (fixture.nativeElement.querySelector('[data-sv-overlay]') as HTMLElement)
      .getAttribute('data-sv-signature') as string;

    fixture.componentInstance.checkIntegrity(signature);
    expect(tampered).toBe(0);

    fixture.componentInstance.checkIntegrity('["Draft",30,0.1,14]');
    expect(tampered).toBe(1);
  });

  /**
   * ★★ THE SIGNATURE IS PUBLISHED ON THE ELEMENT, so a caller can capture it at
   * mount and compare later without reaching into the component instance. It
   * covers the whole configuration, not just the text — a mark whose angle or
   * opacity was edited in place is a tampered mark.
   */
  it('changes when any part of the configuration changes', async () => {
    const sig = async (inputs: Record<string, unknown>) => {
      const f = await mark(inputs);
      return (q(f, '[data-sv-overlay]') as HTMLElement).getAttribute('data-sv-signature');
    };
    const base = await sig({ text: 'Confidential', angle: 30, opacity: 0.1, fontSize: 14 });

    expect(await sig({ text: 'Public', angle: 30, opacity: 0.1, fontSize: 14 })).not.toBe(base);
    expect(await sig({ text: 'Confidential', angle: 45, opacity: 0.1, fontSize: 14 })).not.toBe(base);
    expect(await sig({ text: 'Confidential', angle: 30, opacity: 0.2, fontSize: 14 })).not.toBe(base);
    expect(await sig({ text: 'Confidential', angle: 30, opacity: 0.1, fontSize: 18 })).not.toBe(base);
  });

  /**
   * ★★★ AND IT SAYS, IN THE PRODUCT, THAT IT IS NOT A SECURITY CONTROL. Anything
   * rendered client-side can be removed by somebody with the page source. A
   * component that let a reader believe otherwise would be worse than no
   * watermark, because the belief is what stops them doing something that works.
   */
  it('says out loud that it is not a security control', async () => {
    const f = await mark({ variant: 'inspect' });
    const caveat = text(q(f, '[data-sv-inspect-caveat]'));
    expect(caveat).toContain('not a security control');
    expect(caveat).toContain('crop-and-share');
  });
});

// ── The inspect read-out ────────────────────────────────────────────────────

describe('SvWatermarkComponent — the inspect read-out', () => {
  it('appears only in the inspect variant', async () => {
    expect(q(await mark({ variant: 'tiled' }), '[data-sv-inspect]')).toBeNull();
    expect(q(await mark({ variant: 'inspect' }), '[data-sv-inspect]')).not.toBeNull();
  });

  /**
   * ★★ THE READ-OUT SHOWS BOTH NUMBERS. The whole point of the component is that
   * the tile is not the text box, and a read-out that showed only the result
   * would leave the reader with no way to see the difference it is making.
   */
  it('shows the rotated extent beside the text box it is not', async () => {
    const f = await mark({ variant: 'inspect', text: 'Confidential', angle: 45, fontSize: 14 });
    sized(f, 600, 400);
    f.detectChanges();

    const tile = text(q(f, '[data-sv-inspect-tile]'));
    expect(tile).toContain('rotated extent');
    expect(tile).toContain('text box');
  });

  it('reports the number of marks it actually drew', async () => {
    const f = await mark({ variant: 'inspect', angle: 0 });
    sized(f, 800, 600);
    f.detectChanges();

    const drawn = all(f, '[data-sv-mark]').length;
    expect(Number(text(q(f, '[data-sv-inspect-count]')))).toBe(drawn);
  });

  it('tags the variant on the root', async () => {
    const f = await mark({ variant: 'inspect' });
    expect((q(f, '[data-sv-watermark]') as HTMLElement).getAttribute('data-sv-variant'))
      .toBe('inspect');
  });

  it('gives every instance its own id prefix', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await mark();
    const b = TestBed.createComponent(SvWatermarkComponent);
    b.detectChanges();
    expect(a.componentInstance.wmId('x')).not.toBe(b.componentInstance.wmId('x'));
  });
});
