import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvScrollAreaComponent } from './scroll-area.component';

/**
 * `sv-scroll-area`, through the component.
 *
 * The thumb arithmetic has its own spec in `scroll-area.geometry.spec.ts`. This
 * file is about what reaches the DOM, and about the one decision the component
 * makes that a custom scrollbar usually gets wrong: whether the element it draws
 * over is genuinely scrolling.
 */

async function area(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvScrollAreaComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/**
 * jsdom reports every layout box as zero, so the dimensions a real browser would
 * measure are stubbed here. That is the honest way to test measurement code
 * without a browser: the component still reads them off the element.
 */
function size(f: { nativeElement: HTMLElement }, viewport: number, content: number, top = 0) {
  const port = q(f, '[data-sv-port]') as HTMLElement;
  Object.defineProperty(port, 'clientHeight', { value: viewport, configurable: true });
  Object.defineProperty(port, 'scrollHeight', { value: content, configurable: true });
  Object.defineProperty(port, 'scrollTop', { value: top, writable: true, configurable: true });
  return port;
}

// ── The container really scrolls ────────────────────────────────────────────

describe('SvScrollAreaComponent — the container', () => {
  /**
   * ★★★ THE ELEMENT GENUINELY SCROLLS. Custom scrollbars built on a transform
   * inside an `overflow: hidden` box lose Page Up/Down, Home/End, arrow keys,
   * spacebar, momentum, `scrollIntoView`, find-in-page and every screen
   * reader's virtual cursor.
   */
  it('scrolls natively rather than transforming inside a clipped box', async () => {
    const f = await area();
    const port = q(f, '[data-sv-port]') as HTMLElement;

    expect(port.className).toContain('overflow-y-auto');
    expect(port.className).not.toContain('overflow-hidden');
    expect(port.style.transform).toBe('');
  });

  it('hides the native chrome without hiding the overflow', async () => {
    const f = await area();
    expect((q(f, '[data-sv-port]') as HTMLElement).className).toContain('[scrollbar-width:none]');
  });

  /**
   * ★★ A SCROLLABLE REGION MUST BE KEYBOARD-REACHABLE. Browsers only do that
   * automatically when it contains something focusable, and a list of plain text
   * does not. (Only while it scrolls — `LU-06-I2`, see `scroll-area.lu06.spec.ts`.)
   */
  it('is reachable by keyboard once it scrolls, and named as a region', async () => {
    const f = await area({ ariaLabel: 'Release notes' });
    const port = size(f, 400, 800);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(port.getAttribute('tabindex')).toBe('0');
    expect(port.getAttribute('role')).toBe('region');
    expect(port.getAttribute('aria-label')).toBe('Release notes');
  });

  it('omits an empty label rather than announcing a nameless region', async () => {
    const f = await area();
    expect((q(f, '[data-sv-port]') as HTMLElement).getAttribute('aria-label')).toBeNull();
  });

  it('honours the height it was given', async () => {
    const f = await area({ maxHeight: '20rem' });
    expect((q(f, '[data-sv-port]') as HTMLElement).style.maxHeight).toBe('20rem');
  });
});

// ── The thumb ───────────────────────────────────────────────────────────────

describe('SvScrollAreaComponent — the thumb', () => {
  it('draws nothing until there is something to scroll', async () => {
    const f = await area();
    size(f, 400, 300);
    (q(f, '[data-sv-port]') as HTMLElement).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-thumb]')).toBeNull();
  });

  it('draws a proportional thumb once the content overflows', async () => {
    const f = await area();
    const port = size(f, 400, 800);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const thumb = q(f, '[data-sv-thumb]') as HTMLElement;
    expect(thumb.style.height).toBe('200px');
    expect(thumb.style.top).toBe('0px');
  });

  /**
   * ★★★ THE MINIMUM-SIZE CORRECTION. A clamped thumb travels `viewport − size`,
   * not `viewport`; the naive offset runs it off the end of its own track.
   */
  it('keeps a clamped thumb inside its track at the bottom of a long document', async () => {
    const f = await area({ minThumb: 24 });
    const port = size(f, 400, 40000, 39600);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const thumb = q(f, '[data-sv-thumb]') as HTMLElement;
    expect(thumb.getAttribute('data-sv-clamped')).toBe('true');
    expect(parseFloat(thumb.style.top) + parseFloat(thumb.style.height)).toBeCloseTo(400, 3);
  });

  it('marks a thumb that was not clamped', async () => {
    const f = await area();
    size(f, 400, 800).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect((q(f, '[data-sv-thumb]') as HTMLElement).getAttribute('data-sv-clamped')).toBe('false');
  });

  it('never draws the thumb in the hidden variant', async () => {
    const f = await area({ variant: 'hidden' });
    size(f, 400, 4000).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(q(f, '[data-sv-thumb]')).toBeNull();
  });

  it('keeps the thumb permanently visible in the always variant', async () => {
    const f = await area({ variant: 'always' });
    size(f, 400, 4000).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect((q(f, '[data-sv-track]') as HTMLElement).className).toContain('opacity-100');
  });

  it('reveals the thumb on hover in the auto variant rather than always showing it', async () => {
    const f = await area({ variant: 'auto' });
    size(f, 400, 4000).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    const track = q(f, '[data-sv-track]') as HTMLElement;
    expect(track.className).toContain('opacity-0');
    expect(track.className).toContain('hover:opacity-100');
  });
});

// ── Edge fades ──────────────────────────────────────────────────────────────

describe('SvScrollAreaComponent — the edge fades', () => {
  /**
   * ★★ ONCE THE NATIVE CHROME IS HIDDEN AND THE THUMB ONLY APPEARS ON HOVER, a
   * list that scrolls looks exactly like a list that does not.
   */
  it('fades only the far edge at the top', async () => {
    const f = await area();
    size(f, 400, 1000, 0).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-fade-start]')).toBeNull();
    expect(q(f, '[data-sv-fade-end]')).toBeTruthy();
  });

  it('fades both in the middle', async () => {
    const f = await area();
    size(f, 400, 1000, 300).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-fade-start]')).toBeTruthy();
    expect(q(f, '[data-sv-fade-end]')).toBeTruthy();
  });

  it('fades only the near edge at the bottom', async () => {
    const f = await area();
    size(f, 400, 1000, 600).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-fade-start]')).toBeTruthy();
    expect(q(f, '[data-sv-fade-end]')).toBeNull();
  });

  it('fades nothing when everything fits', async () => {
    const f = await area();
    size(f, 400, 300).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-fade-start]')).toBeNull();
    expect(q(f, '[data-sv-fade-end]')).toBeNull();
  });

  it('can be turned off without turning off the thumb', async () => {
    const f = await area({ edgeFade: false });
    size(f, 400, 1000, 300).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(q(f, '[data-sv-fade-start]')).toBeNull();
    expect(q(f, '[data-sv-thumb]')).toBeTruthy();
  });
});

// ── Behaviour ───────────────────────────────────────────────────────────────

describe('SvScrollAreaComponent — behaviour', () => {
  it('emits the scroll position', async () => {
    TestBed.resetTestingModule();
    const seen: number[] = [];
    const { fixture } = await render(SvScrollAreaComponent, {
      on: { scrolled: (n: number) => seen.push(n) },
    });
    fixture.detectChanges();

    const port = size(fixture, 400, 1000, 250);
    port.dispatchEvent(new Event('scroll'));
    expect(seen).toEqual([250]);
  });

  /**
   * ★★★ PRESSING THE TRACK PAGES, IT DOES NOT JUMP. Every native scrollbar on
   * every platform moves by one viewport; jumping the thumb to the pointer
   * throws away the reader's place in a way they cannot undo.
   */
  it('pages by one viewport when the track is pressed below the thumb', async () => {
    const f = await area({ variant: 'always' });
    const port = size(f, 400, 2000, 0);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const track = q(f, '[data-sv-track]') as HTMLElement;
    track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 400, right: 8, width: 8, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    track.dispatchEvent(new MouseEvent('pointerdown', { clientY: 350 }));
    f.detectChanges();

    expect(port.scrollTop).toBe(400);
  });

  it('pages backwards when the track is pressed above the thumb', async () => {
    const f = await area({ variant: 'always' });
    const port = size(f, 400, 2000, 800);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const track = q(f, '[data-sv-track]') as HTMLElement;
    track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 400, right: 8, width: 8, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    track.dispatchEvent(new MouseEvent('pointerdown', { clientY: 2 }));
    f.detectChanges();

    expect(port.scrollTop).toBe(400);
  });

  it('does nothing when the click lands on the thumb itself', async () => {
    const f = await area({ variant: 'always' });
    const port = size(f, 400, 2000, 0);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const track = q(f, '[data-sv-track]') as HTMLElement;
    track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 400, right: 8, width: 8, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    track.dispatchEvent(new MouseEvent('pointerdown', { clientY: 10 }));
    f.detectChanges();

    expect(port.scrollTop).toBe(0);
  });

  it('never pages past either end', async () => {
    const f = await area({ variant: 'always' });
    const port = size(f, 400, 600, 190);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const track = q(f, '[data-sv-track]') as HTMLElement;
    track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 400, right: 8, width: 8, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    track.dispatchEvent(new MouseEvent('pointerdown', { clientY: 399 }));
    f.detectChanges();

    expect(port.scrollTop).toBe(200);
  });
});

// ── The read-out ────────────────────────────────────────────────────────────

describe('SvScrollAreaComponent — the read-out', () => {
  /**
   * ★★ A HIDDEN SCROLLBAR REMOVES THE ONLY VISUAL CUE THAT A REGION SCROLLS, and
   * a screen-reader user never had that cue in the first place.
   */
  it('describes where the reader is, for assistive tech', async () => {
    const f = await area();
    size(f, 400, 800, 200).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(text(q(f, '[data-sv-readout]'))).toBe('Scrolled 50%; 50% of the content is visible.');
  });

  it('says there is nothing to scroll rather than reporting zero per cent', async () => {
    const f = await area();
    size(f, 400, 300).dispatchEvent(new Event('scroll'));
    f.detectChanges();

    expect(text(q(f, '[data-sv-readout]'))).toBe('Everything fits; nothing to scroll.');
  });

  it('wires the read-out to the region it describes', async () => {
    const f = await area();
    const described = (q(f, '[data-sv-port]') as HTMLElement).getAttribute('aria-describedby');
    expect(described).toBe((q(f, '[data-sv-readout]') as HTMLElement).id);
  });
});
