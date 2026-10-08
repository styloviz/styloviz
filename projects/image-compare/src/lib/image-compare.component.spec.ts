import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageCompareComponent } from './image-compare.component';

/**
 * `sv-image-compare`, through the component.
 *
 * The geometry has its own spec in `image-compare.geometry.spec.ts`. This file is
 * about what reaches the DOM, and above all about the two claims that make this
 * control different from the dozens of others: that it notices when the two
 * images are not comparable, and that it can be operated without a mouse.
 */

const SRC_A = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const SRC_B = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

async function compare(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageCompareComponent, {
    inputs: { beforeSrc: SRC_A, afterSrc: SRC_B, ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/**
 * Report an intrinsic size for one of the images.
 *
 * ★★★ `naturalWidth`/`naturalHeight`, NOT THE LAID-OUT RECT. jsdom never decodes
 * the image, so both are 0 until they are stubbed — and stubbing the rendered
 * size instead would be testing the wrong number entirely: the layout stretches
 * both images to the same box, so their rects agree even when the pictures do
 * not. That is precisely the case this component exists to catch.
 */
function loaded(
  f: { nativeElement: HTMLElement },
  which: 'before' | 'after',
  width: number,
  height: number,
) {
  const img = q(f, `[data-sv-${which}]`) as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  img.dispatchEvent(new Event('load'));
  return img;
}

/** Give the wipe box a real rectangle, since jsdom reports every box as zero. */
function boxAt(f: { nativeElement: HTMLElement }, left: number, width: number) {
  const box = q(f, '[data-sv-box]') as HTMLElement;
  box.getBoundingClientRect = () =>
    ({
      left, width, right: left + width, top: 0, bottom: 100, height: 100,
      x: left, y: 0, toJSON: () => ({}),
    }) as DOMRect;
  return box;
}

function key(f: { nativeElement: HTMLElement }, k: string): KeyboardEvent {
  const handle = q(f, '[data-sv-handle]') as HTMLElement;
  const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
  handle.dispatchEvent(event);
  return event;
}

// ── The mismatch warning ────────────────────────────────────────────────────

describe('SvImageCompareComponent — comparability', () => {
  /**
   * ★★★ TWO IMAGES OF DIFFERENT ASPECT RATIOS CANNOT BE COMPARED BY WIPING. One
   * of them is scaled or cropped to fit, so part of what the reader is shown as
   * "the change" is the reframing. The widget looks exactly right while it
   * happens, which is why the component has to say so out loud.
   */
  it('warns when the two images are different shapes', async () => {
    const f = await compare();
    loaded(f, 'before', 1600, 1200);
    loaded(f, 'after', 1920, 1080);
    f.detectChanges();

    const warning = q(f, '[data-sv-aspect-warning]');
    expect(warning).not.toBeNull();
    expect(text(warning)).toContain('different shapes');
    expect(text(warning)).toContain('not the change');
  });

  it('says nothing when they are the same shape at different resolutions', async () => {
    const f = await compare();
    loaded(f, 'before', 1920, 1080);
    loaded(f, 'after', 1280, 720);
    f.detectChanges();

    expect(q(f, '[data-sv-aspect-warning]')).toBeNull();
  });

  /**
   * ★★ THE WARNING WAITS FOR BOTH IMAGES. A component that judges on the first
   * `load` accuses every pair for the moment between the two events, and a
   * warning that appears and vanishes on every render is one nobody reads.
   */
  it('claims nothing until both images have reported a size', async () => {
    const f = await compare();
    loaded(f, 'before', 1600, 1200);
    f.detectChanges();
    expect(q(f, '[data-sv-aspect-warning]')).toBeNull();

    loaded(f, 'after', 1920, 1080);
    f.detectChanges();
    expect(q(f, '[data-sv-aspect-warning]')).not.toBeNull();
  });

  /**
   * ★★★ THE SIZE COMES FROM THE FILE, NOT FROM THE BOX. Both images are laid out
   * into the same rectangle, so if the check read the rendered rects it would
   * report "identical" in exactly the case the mismatch exists — the failure
   * would be undetectable by construction.
   */
  it('reads the intrinsic size rather than the rendered box', async () => {
    const f = await compare({ variant: 'inspect' });
    // The rendered box is square for both — the layout made it so.
    boxAt(f, 0, 400);
    loaded(f, 'before', 1600, 1200);
    loaded(f, 'after', 1920, 1080);
    f.detectChanges();

    expect(text(q(f, '[data-sv-inspect-before]'))).toContain('1600×1200');
    expect(text(q(f, '[data-sv-inspect-after]'))).toContain('1920×1080');
    expect((q(f, '[data-sv-inspect-difference]') as HTMLElement).getAttribute('data-sv-comparable'))
      .toBe('false');
  });

  it('emits the mismatch once, with the size of it', async () => {
    TestBed.resetTestingModule();
    const seen: number[] = [];
    const { fixture } = await render(SvImageCompareComponent, {
      inputs: { beforeSrc: SRC_A, afterSrc: SRC_B },
      on: { mismatch: (d: number) => seen.push(d) },
    });
    fixture.detectChanges();

    loaded(fixture, 'before', 1600, 1200);
    loaded(fixture, 'after', 1920, 1080);
    // A second load event for the same pair — a re-render, a cache revalidation.
    loaded(fixture, 'after', 1920, 1080);

    expect(seen.length).toBe(1);
    expect(seen[0]).toBeCloseTo(1 - (4 / 3) / (16 / 9), 6);
  });

  it('never emits for a comparable pair', async () => {
    TestBed.resetTestingModule();
    const seen: number[] = [];
    const { fixture } = await render(SvImageCompareComponent, {
      inputs: { beforeSrc: SRC_A, afterSrc: SRC_B },
      on: { mismatch: (d: number) => seen.push(d) },
    });
    fixture.detectChanges();

    loaded(fixture, 'before', 1920, 1080);
    loaded(fixture, 'after', 1920, 1080);
    expect(seen).toEqual([]);
  });

  /**
   * ★★ THE ESCAPE HATCH SUPPRESSES THE MESSAGE, NOT THE MEASUREMENT. A caller who
   * has deliberately letterboxed both images to a common frame is telling the
   * truth; the inspect read-out still shows the real ratios, so the escape hatch
   * cannot be used to hide the numbers from whoever looks next.
   */
  it('honours allowMismatch without falsifying the measurement', async () => {
    const f = await compare({ allowMismatch: true, variant: 'inspect' });
    loaded(f, 'before', 1600, 1200);
    loaded(f, 'after', 1920, 1080);
    f.detectChanges();

    expect(q(f, '[data-sv-aspect-warning]')).toBeNull();
    expect((q(f, '[data-sv-inspect-difference]') as HTMLElement).getAttribute('data-sv-comparable'))
      .toBe('false');
  });
});

// ── The keyboard ────────────────────────────────────────────────────────────

describe('SvImageCompareComponent — the keyboard', () => {
  /**
   * ★★★ THIS CONTROL IS ALMOST NEVER KEYBOARD-OPERABLE, and it is a slider — the
   * one widget with a keyboard contract every screen-reader user already knows.
   */
  it('is a real slider, reachable and announced', async () => {
    const f = await compare();
    const handle = q(f, '[data-sv-handle]') as HTMLElement;

    expect(handle.getAttribute('role')).toBe('slider');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
    expect(handle.getAttribute('aria-valuemax')).toBe('100');
    expect(handle.getAttribute('aria-valuenow')).toBe('50');
  });

  it('nudges with the arrows and jumps with the page keys', async () => {
    const f = await compare({ position: 0.5 });
    key(f, 'ArrowRight');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('51');

    key(f, 'PageDown');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('41');

    key(f, 'Home');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('0');

    key(f, 'End');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('100');
  });

  /**
   * ★★★ TAB MUST STILL LEAVE. A handler that calls `preventDefault()` for every
   * key it receives traps focus on the slider, and a keyboard user who reaches
   * this control can then never get past it — which is worse than the control
   * being unreachable in the first place.
   */
  it('does not swallow the keys it has no business handling', async () => {
    const f = await compare();
    for (const k of ['Tab', 'Escape', 'a', 'Enter', ' ']) {
      const event = key(f, k);
      expect(event.defaultPrevented).toBe(false);
    }
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('50');
  });

  it('claims the keys it does handle, so the page does not scroll under it', async () => {
    const f = await compare();
    for (const k of ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']) {
      expect(key(f, k).defaultPrevented).toBe(true);
    }
  });

  /**
   * ★★ THE SPOKEN VALUE NAMES THE IMAGES, NOT THE CONTROL. "50%" tells a screen
   * reader user how far a handle has moved; it does not tell them what they would
   * be looking at.
   */
  it('speaks the position in terms of the two images', async () => {
    const f = await compare({ beforeAlt: 'the original', afterAlt: 'the retouch', position: 0.25 });
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuetext'))
      .toBe('25% the retouch, 75% the original.');

    key(f, 'Home');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuetext'))
      .toBe('Showing the original only.');
  });

  it('keeps a live read-out for assistive tech', async () => {
    const f = await compare({ beforeAlt: 'before', afterAlt: 'after' });
    const readout = q(f, '[data-sv-readout]') as HTMLElement;
    expect(readout.className).toContain('sr-only');
    expect(text(readout)).toBe('50% after, 50% before.');
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-describedby'))
      .toBe(readout.id);
  });

  /**
   * ★★ THE HANDLE STAYS OPERABLE WHEN IT IS NOT DRAWN. The `bare` variant hides
   * the visual affordance for a designer who wants a clean image; hiding the
   * control along with it would silently remove keyboard access at a variant
   * switch.
   */
  it('keeps the slider reachable in the bare variant', async () => {
    const f = await compare({ variant: 'bare' });
    const handle = q(f, '[data-sv-handle]') as HTMLElement;
    expect(handle).not.toBeNull();
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(q(f, '[data-sv-divider]')).toBeNull();

    key(f, 'ArrowRight');
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('51');
  });
});

// ── The pointer ─────────────────────────────────────────────────────────────

describe('SvImageCompareComponent — the pointer', () => {
  function down(f: { nativeElement: HTMLElement }, clientX: number) {
    const box = q(f, '[data-sv-box]') as HTMLElement;
    const event = new Event('pointerdown', { bubbles: true }) as PointerEvent;
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    Object.defineProperty(event, 'pointerId', { value: 1, configurable: true });
    box.dispatchEvent(event);
    return event;
  }

  function move(f: { nativeElement: HTMLElement }, clientX: number) {
    const box = q(f, '[data-sv-box]') as HTMLElement;
    const event = new Event('pointermove', { bubbles: true }) as PointerEvent;
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    box.dispatchEvent(event);
  }

  it('moves the wipe to where the pointer went down', async () => {
    const f = await compare();
    boxAt(f, 100, 400);
    down(f, 200);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('25');
  });

  /**
   * ★★ A MOVE WITHOUT A PRECEDING PRESS IS A HOVER, and a wipe that follows the
   * cursor across the page cannot be left anywhere — the reader can never stop
   * and look at what they uncovered.
   */
  it('ignores a pointer that is merely passing over', async () => {
    const f = await compare();
    boxAt(f, 100, 400);
    move(f, 300);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('50');
  });

  it('follows the pointer while it is down and stops when it is released', async () => {
    const f = await compare();
    boxAt(f, 100, 400);
    down(f, 200);
    move(f, 300);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('50');

    (q(f, '[data-sv-box]') as HTMLElement).dispatchEvent(new Event('pointerup', { bubbles: true }));
    move(f, 500);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('50');
  });

  /**
   * ★★★ POINTER CAPTURE, OR THE DRAG DIES AT THE EDGE — which is exactly where
   * people drag it to, because that is how you see one of the two images whole.
   */
  it('captures the pointer so a drag can leave the box', async () => {
    const f = await compare();
    boxAt(f, 100, 400);
    const box = q(f, '[data-sv-box]') as HTMLElement;
    const captured: number[] = [];
    (box as HTMLElement & { setPointerCapture(id: number): void }).setPointerCapture = (id) =>
      captured.push(id);

    down(f, 200);
    expect(captured).toEqual([1]);
  });

  it('clamps a drag past either edge instead of running off', async () => {
    const f = await compare();
    boxAt(f, 100, 400);
    down(f, 200);
    move(f, -900);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('0');

    move(f, 9999);
    f.detectChanges();
    expect((q(f, '[data-sv-handle]') as HTMLElement).getAttribute('aria-valuenow')).toBe('100');
  });

  /**
   * ★★ `touch-action: none` ON THE BOX. Without it a drag on a phone scrolls the
   * page instead of moving the wipe, and the control is unusable on the devices
   * where before/after comparisons are most often shared.
   */
  it('claims the touch gesture rather than letting the page scroll', async () => {
    const f = await compare();
    expect((q(f, '[data-sv-box]') as HTMLElement).className).toContain('touch-none');
  });
});

// ── Rendering ───────────────────────────────────────────────────────────────

describe('SvImageCompareComponent — rendering', () => {
  it('clips the after image to the wipe rather than resizing it', async () => {
    const f = await compare({ position: 0.25 });
    const after = q(f, '[data-sv-after]') as HTMLElement;
    expect(after.style.clipPath).toBe('inset(0 75.000% 0 0)');
    // Resizing would change the geometry of what is on screen, so the two halves
    // would no longer line up along the wipe.
    expect(after.style.width).toBe('');
  });

  it('leaves the before image whole underneath', async () => {
    const f = await compare({ position: 0.25 });
    const before = q(f, '[data-sv-before]') as HTMLElement;
    expect(before.style.clipPath).toBe('');
  });

  /**
   * ★★ THE PAIR IS ANNOUNCED ONCE. Both images carry the same subject, and a
   * screen reader reading two alt texts for one picture — then a slider value
   * describing the same thing a third time — is noise, not access.
   */
  it('hides the stacked copy from assistive tech', async () => {
    const f = await compare();
    expect((q(f, '[data-sv-after]') as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect((q(f, '[data-sv-before]') as HTMLElement).getAttribute('aria-hidden')).toBeNull();
  });

  /**
   * ★★★ THE REGRESSION THIS EXISTS TO CATCH. The after image is clipped to the
   * region LEFT of the handle — that is what makes dragging right reveal more
   * of it — so a "Before" chip in the bottom-left corner names one image while
   * sitting on top of the other. Every comparison in the kit was captioned
   * backwards until this was fixed, and nothing failed: the pictures were
   * plausible either way round, which is exactly why a reader would have
   * believed the wrong one.
   */
  it('puts each label on the side its own image occupies', async () => {
    const f = await compare({ beforeLabel: 'Before', afterLabel: 'After' });
    const before = (q(f, '[data-sv-label-before]') as HTMLElement).className;
    const after = (q(f, '[data-sv-label-after]') as HTMLElement).className;
    // The before is what remains on the right of the wipe.
    expect(before).toContain('right-2');
    expect(before).not.toContain('left-2');
    // The after is clipped in from the left, so its label belongs there.
    expect(after).toContain('left-2');
    expect(after).not.toContain('right-2');
  });

  it('carries the alt text on the image a reader is given', async () => {
    const f = await compare({ beforeAlt: 'the unretouched photograph' });
    expect((q(f, '[data-sv-before]') as HTMLElement).getAttribute('alt'))
      .toBe('the unretouched photograph');
  });

  it('draws the divider at the wipe', async () => {
    const f = await compare({ position: 0.3 });
    expect((q(f, '[data-sv-divider]') as HTMLElement).style.left).toBe('30%');
  });

  it('shows the corner captions only when they are given', async () => {
    const bare = await compare();
    expect(q(bare, '[data-sv-label-before]')).toBeNull();

    const named = await compare({ beforeLabel: '2019', afterLabel: '2024' });
    expect(text(q(named, '[data-sv-label-before]'))).toBe('2019');
    expect(text(q(named, '[data-sv-label-after]'))).toBe('2024');
  });

  it('does not let the captions eat the drag', async () => {
    const f = await compare({ beforeLabel: '2019' });
    expect((q(f, '[data-sv-label-before]') as HTMLElement).className)
      .toContain('pointer-events-none');
  });

  it('shows the inspect read-out only in the inspect variant', async () => {
    expect(q(await compare({ variant: 'slider' }), '[data-sv-inspect]')).toBeNull();
    expect(q(await compare({ variant: 'inspect' }), '[data-sv-inspect]')).not.toBeNull();
  });

  it('says in the inspect read-out where the ratios came from', async () => {
    const f = await compare({ variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-caveat]'))).toContain('intrinsic size');
  });

  it('states the framing limit: matching sizes do not prove matching framing (DD-15-I1)', async () => {
    const f = await compare({ variant: 'inspect' });
    const caveat = text(q(f, '[data-sv-inspect-caveat]'));
    expect(caveat).toContain('Matching dimensions do not prove matching framing');
    expect(caveat).toContain('different crops of the same scene');
    expect(caveat).toContain('landmarks');
    expect(q(f, '[data-sv-inspect-caveat] em')?.textContent).toBe('framing');
    // Not rendered outside the inspect variant, where there is no read-out to qualify.
    expect(q(await compare({ variant: 'slider' }), '[data-sv-inspect-caveat]')).toBeNull();
  });

  it('gives every instance its own ids', async () => {
    // Both instances must share one application: ids are per application (svUniqueId).
    const a = await compare();
    const b = TestBed.createComponent(SvImageCompareComponent);
    b.componentRef.setInput('beforeSrc', SRC_A);
    b.componentRef.setInput('afterSrc', SRC_B);
    b.detectChanges();
    await b.whenStable();
    const idA = (q(a, '[data-sv-readout]') as HTMLElement).id;
    const idB = (q(b, '[data-sv-readout]') as HTMLElement).id;
    expect(idA).not.toBe('');
    expect(idA).not.toBe(idB);
  });

  it('tags the variant on the root', async () => {
    const f = await compare({ variant: 'inspect' });
    expect((q(f, '[data-sv-image-compare]') as HTMLElement).getAttribute('data-sv-variant'))
      .toBe('inspect');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SvImageCompareComponent — naming which mismatch it is', () => {
  it('diagnoses a quarter turn as orientation, not as a reframing', async () => {
    const f = await compare({ variant: 'inspect' });
    loaded(f, 'before', 4000, 3000);
    loaded(f, 'after', 3000, 4000);
    f.detectChanges();

    // ★ Telling this reader their images are "different shapes" sends them to
    //   re-crop, which is the one thing that is not wrong.
    const warning = text(q(f, '[data-sv-aspect-warning]'));
    expect(warning).toContain('quarter turn');
    expect(warning).toContain('re-export');
    expect(q(f, '[data-sv-verdict]')?.getAttribute('data-sv-verdict')).toBe('rotated');
  });

  it('still calls a genuine reframing what it is', async () => {
    const f = await compare();
    loaded(f, 'before', 1600, 1200);
    loaded(f, 'after', 1920, 1080);
    f.detectChanges();

    const warning = text(q(f, '[data-sv-aspect-warning]'));
    expect(warning).toContain('different shapes');
    expect(warning).not.toContain('EXIF');
  });

  it('notes a scaled pair without raising a warning about it', async () => {
    const f = await compare();
    loaded(f, 'before', 4000, 3000);
    loaded(f, 'after', 800, 600);
    f.detectChanges();

    // The wipe is honest; the softness is the upscale, not the picture.
    expect(q(f, '[data-sv-aspect-warning]')).toBeNull();
    expect(text(q(f, '[data-sv-frame-note]'))).toContain('softer');
  });

  it('says nothing at all about a matched pair', async () => {
    const f = await compare();
    loaded(f, 'before', 1920, 1080);
    loaded(f, 'after', 1920, 1080);
    f.detectChanges();

    expect(q(f, '[data-sv-aspect-warning]')).toBeNull();
    expect(q(f, '[data-sv-frame-note]')).toBeNull();
  });

  it('lets allowMismatch silence the note as well as the warning', async () => {
    const f = await compare({ allowMismatch: true });
    loaded(f, 'before', 4000, 3000);
    loaded(f, 'after', 800, 600);
    f.detectChanges();
    expect(q(f, '[data-sv-frame-note]')).toBeNull();
  });
});

describe('SvImageCompareComponent — alignment landmarks', () => {
  it('draws nothing by default', async () => {
    const f = await compare();
    expect(q(f, '[data-sv-landmarks]')).toBeNull();
  });

  it('draws a fixed reference over the whole box, not inside the clipped layer', async () => {
    const f = await compare({ landmarks: 'thirds' });
    const svg = q(f, '[data-sv-landmarks]') as SVGElement;
    expect(svg).not.toBeNull();

    // ★★★ The entire value is that it does NOT move with the wipe: a landmark
    //     inside the clipped layer would sit at the same place on whatever
    //     happened to be under it and prove nothing.
    expect(svg.closest('[data-sv-after]')).toBeNull();
    expect(svg.parentElement?.getAttribute('data-sv-box')).not.toBeNull();
    expect(svg.getAttribute('style') ?? '').not.toContain('clip-path');
  });

  it('draws the lines each set calls for', async () => {
    for (const [set, lines] of [
      ['crosshair', 4],
      ['thirds', 8],
      ['grid', 12],
    ] as const) {
      const f = await compare({ landmarks: set });
      // Two strokes per line — a dark one and a dashed light one, because a
      // single colour disappears over either a white sky or a black shadow.
      expect(q(f, '[data-sv-landmarks]')!.querySelectorAll('line')).toHaveLength(lines);
    }
  });

  it('keeps the reference out of the accessibility tree and out of the way', async () => {
    const f = await compare({ landmarks: 'grid' });
    const svg = q(f, '[data-sv-landmarks]') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // It sits over the images, so it must not eat the drag.
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
  });

  it('does not move when the wipe does', async () => {
    const f = await compare({ landmarks: 'crosshair' });
    const before = q(f, '[data-sv-landmarks]')!.innerHTML;
    boxAt(f, 0, 200);
    f.componentInstance.moveTo(160);
    f.detectChanges();
    expect(f.componentInstance.ariaValue()).toBe(80);
    expect(q(f, '[data-sv-landmarks]')!.innerHTML).toBe(before);
  });
});
