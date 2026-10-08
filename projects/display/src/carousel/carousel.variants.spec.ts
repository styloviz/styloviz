import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { SvCarouselComponent, type CarouselSlide, type CarouselVariant } from './carousel.component';

/**
 * The `variant` input used to be read by nothing — `card`, `fade` and
 * `coverflow` all rendered the default slide. Each now has its own layout, and
 * the reduced-motion preference (via `@styloviz/core`, kept live — X-11)
 * removes only the transition, never the layout.
 */
const SLIDES: CarouselSlide[] = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'c', title: 'Gamma' },
  { id: 'd', title: 'Delta' },
];

type Listener = (e: { matches: boolean }) => void;
let listeners: Listener[] = [];
const original = (window as { matchMedia?: unknown }).matchMedia;

function stubMotion(reduced: boolean): void {
  listeners = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_: string, cb: Listener) => listeners.push(cb),
      removeEventListener: (_: string, cb: Listener) => { listeners = listeners.filter(l => l !== cb); },
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCarouselComponent, {
    inputs: { slides: SLIDES, ...inputs },
    providers: [provideRouter([])],
  });
  return fixture;
}
type F = Awaited<ReturnType<typeof setup>>;
const slides = (f: F) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[aria-roledescription="slide"]')];
const has = (el: HTMLElement, ...cls: string[]) => cls.every(c => el.classList.contains(c));

describe('SvCarouselComponent — variant changes the rendering', () => {
  beforeEach(() => stubMotion(false));

  it('default: full-bleed slides that translate', async () => {
    const [a, b] = slides(await setup());
    expect(has(a, 'absolute', 'inset-0', 'translate-x-0', 'opacity-100', 'transition-all')).toBe(true);
    expect(has(b, 'translate-x-full', 'opacity-0')).toBe(true);
  });

  it('fade: slides stay in place and cross-fade', async () => {
    const [a, b] = slides(await setup({ variant: 'fade' }));
    expect(has(a, 'inset-0', 'opacity-100', 'transition-opacity')).toBe(true);
    expect(has(b, 'opacity-0')).toBe(true);
    expect(b.className).not.toContain('translate-x');
    expect(a.classList.contains('transition-all')).toBe(false);
  });

  it('card: slides are inset rounded cards', async () => {
    const [a, b] = slides(await setup({ variant: 'card' }));
    expect(has(a, 'inset-3', 'rounded-xl', 'shadow-lg', 'scale-100')).toBe(true);
    expect(a.classList.contains('inset-0')).toBe(false);
    expect(has(b, 'scale-95', 'opacity-0')).toBe(true);
  });

  it('coverflow: neighbours are visible and scaled down either side', async () => {
    const f = await setup({ variant: 'coverflow' });
    f.componentInstance.goTo(1);
    f.detectChanges();
    const [a, b, c, d] = slides(f);
    expect(has(b, 'scale-100', 'opacity-100', 'z-[2]')).toBe(true);
    expect(has(a, 'scale-75', 'opacity-60', '-translate-x-[72%]')).toBe(true);
    expect(has(c, 'scale-75', 'opacity-60', 'translate-x-[72%]')).toBe(true);
    expect(has(d, 'opacity-0')).toBe(true);
    // Neighbours are decoration: still inert and hidden from assistive tech.
    expect(a.getAttribute('aria-hidden')).toBe('true');
    expect(a.hasAttribute('inert')).toBe(true);
  });

  it('coverflow: with loop the last slide is the first slide\'s left neighbour', async () => {
    const [a, , , d] = slides(await setup({ variant: 'coverflow', loop: true }));
    expect(has(a, 'scale-100')).toBe(true);
    expect(has(d, '-translate-x-[72%]', 'scale-75')).toBe(true);
  });
});

describe('SvCarouselComponent — reduced motion per variant', () => {
  const VARIANTS: CarouselVariant[] = ['default', 'fade', 'card', 'coverflow'];

  it.each(VARIANTS)('%s: no transition classes under reduced motion, layout kept', async (variant) => {
    stubMotion(true);
    const f = await setup({ variant });
    for (const s of slides(f)) {
      expect(s.className).not.toMatch(/transition-|duration-/);
    }
    expect(has(slides(f)[0], 'opacity-100')).toBe(true);
  });

  it.each(VARIANTS)('%s: transitions present when motion is welcome', async (variant) => {
    stubMotion(false);
    const f = await setup({ variant });
    expect(slides(f)[0].className).toMatch(/transition-(all|opacity)/);
  });
});

describe('SvCarouselComponent — reduced motion reacts live (X-11)', () => {
  it('stops auto-play and transitions when the OS setting flips mid-session', async () => {
    stubMotion(false);
    const f = await setup({ autoPlay: true });
    expect(f.componentInstance.autoPlayOn()).toBe(true);
    expect(listeners).toHaveLength(1);

    listeners.forEach(l => l({ matches: true }));
    f.detectChanges();
    expect(f.componentInstance.autoPlayOn()).toBe(false);
    expect(f.componentInstance.animate()).toBe(false);
    expect(slides(f)[0].classList.contains('transition-all')).toBe(false);

    listeners.forEach(l => l({ matches: false }));
    f.detectChanges();
    expect(f.componentInstance.autoPlayOn()).toBe(true);
  });

  it('unsubscribes when destroyed', async () => {
    stubMotion(false);
    const f = await setup();
    expect(listeners).toHaveLength(1);
    f.destroy();
    expect(listeners).toHaveLength(0);
  });
});
