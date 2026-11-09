import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { SvCarouselComponent, type CarouselSlide } from './carousel.component';

/**
 * FL-J3-DD-16 — swipe to change slide: pointer events, horizontal only, the
 * region stays `touch-pan-y` so a vertical swipe scrolls the page, and the
 * click a swipe ends in is swallowed.
 */
const SLIDES: CarouselSlide[] = [
  { id: 'a', title: 'Alpha', cta: 'Open' },
  { id: 'b', title: 'Beta', cta: 'Open' },
  { id: 'c', title: 'Gamma', cta: 'Open' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const changes: number[] = [];
  const ctas: unknown[] = [];
  const { fixture } = await render(SvCarouselComponent, {
    inputs: { slides: SLIDES, ...inputs },
    on: { slideChange: (i: number) => changes.push(i), ctaClick: (e: unknown) => ctas.push(e) },
    providers: [provideRouter([])],
  });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const region = el.querySelector<HTMLElement>('[data-sv-carousel-region]')!;
  return { fixture, el, region, c: fixture.componentInstance, changes, ctas };
}

/** jsdom has no PointerEvent constructor; a MouseEvent with the pointer fields is what the handlers read. */
function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  Object.assign(e, { pointerId: 1, isPrimary: true, pointerType: 'touch', ...extra });
  return e;
}
function swipe(target: HTMLElement, dx: number, dy = 0) {
  target.dispatchEvent(pointer('pointerdown', 200, 100));
  target.dispatchEvent(pointer('pointerup', 200 + dx, 100 + dy));
}

describe('SvCarouselComponent — swipe (DD-05-I5)', () => {
  it('a leftward swipe shows the next slide, a rightward one the previous', async () => {
    const { region, c, changes, fixture } = await setup();
    swipe(region, -80);
    fixture.detectChanges();
    expect(c.current()).toBe(1);
    swipe(region, 90);
    fixture.detectChanges();
    expect(c.current()).toBe(0);
    expect(changes).toEqual([1, 0]);
  });

  it('ignores a short drag and a mostly vertical one (that is a scroll)', async () => {
    const { region, c } = await setup();
    swipe(region, -20);
    swipe(region, -60, 120);
    expect(c.current()).toBe(0);
  });

  it('lets the page keep vertical scrolling and pinch-zoom: touch-pan-y touch-pinch-zoom', async () => {
    const { region } = await setup();
    expect(region.classList).toContain('touch-pan-y');
    expect(region.classList).toContain('touch-pinch-zoom');
  });

  it('respects loop=false at the ends', async () => {
    const { region, c } = await setup({ loop: false });
    swipe(region, 80);
    expect(c.current()).toBe(0);
  });

  it('mirrors under dir="rtl"', async () => {
    const { region, c, el } = await setup();
    el.setAttribute('dir', 'rtl');
    swipe(region, 80);
    expect(c.current()).toBe(1);
  });

  it('does nothing with a single slide', async () => {
    const { region, c } = await setup({ slides: [SLIDES[0]] });
    swipe(region, -80);
    expect(c.current()).toBe(0);
  });

  it('swallows the click a swipe ends in, but not a plain tap', async () => {
    const { el, ctas, fixture } = await setup();
    const cta = () => el.querySelector<HTMLElement>('[aria-hidden="false"] button, [aria-hidden="false"] a')!;
    const button = cta();
    button.dispatchEvent(pointer('pointerdown', 200, 100));
    button.dispatchEvent(pointer('pointerup', 120, 100));
    button.click();
    fixture.detectChanges();
    expect(ctas).toEqual([]);
    cta().click();
    expect(ctas).toHaveLength(1);
  });

  it('ignores a cancelled pointer (the browser took it for scrolling)', async () => {
    const { region, c } = await setup();
    region.dispatchEvent(pointer('pointerdown', 200, 100));
    region.dispatchEvent(pointer('pointercancel', 200, 100));
    region.dispatchEvent(pointer('pointerup', 100, 100));
    expect(c.current()).toBe(0);
  });
});
