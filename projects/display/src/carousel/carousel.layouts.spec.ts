import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { SvCarouselComponent, type CarouselSlide } from './carousel.component';

/**
 * FL-G2 — thumbnails, a vertical carousel and several slides per view.
 *
 * A row of cards steps one slide at a time and stops when the last slide is in
 * view; a slide outside the view is `inert`, as an inactive slide always was.
 * The row drops to fewer cards when each would be narrower than
 * `slideMinWidth`, which is measured from the carousel, not the screen.
 */
const SLIDES: CarouselSlide[] = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((title, i) => ({
  id: String(i),
  title,
  image: `/demo/${i}.svg`,
}));

afterEach(() => vi.restoreAllMocks());

async function setup(inputs: Record<string, unknown> = {}, width = 0) {
  TestBed.resetTestingModule();
  // jsdom lays nothing out: the carousel's own width is what `slidesPerView` fits against.
  // Restored in afterEach, not here: the width is read after the first render, which may land after `render()` resolves.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    // The carousel's host is whatever element the test renders it into: the one whose child is its region.
    const isHost = this.querySelector(':scope > [data-sv-carousel-region]') !== null;
    return { width: isHost ? width : 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const { fixture } = await render(SvCarouselComponent, {
    inputs: { slides: SLIDES, ...inputs },
    providers: [provideRouter([])],
  });
  // `afterNextRender` (where the width is measured) runs on an application tick,
  // which a fixture's own change detection is not.
  TestBed.inject(ApplicationRef).tick();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const changes: number[] = [];
  fixture.componentInstance.slideChange.subscribe((i: number) => changes.push(i));
  return { fixture, el, c: fixture.componentInstance, changes };
}

const slides = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]')];
const shownTitles = (el: HTMLElement) =>
  slides(el).filter((s) => !s.hasAttribute('inert')).map((s) => s.querySelector('h3')?.textContent?.trim());
const button = (el: HTMLElement, name: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const counter = (el: HTMLElement) => el.querySelector('[data-sv-carousel-region] .absolute.end-3.top-3')?.textContent?.replace(/\s+/g, ' ').trim();

describe('SvCarouselComponent — several slides per view (FL-G2)', () => {
  it('shows a row of three, steps one slide at a time and stops with the last in view', async () => {
    const { el, fixture, changes } = await setup({ slidesPerView: 3, loop: false }, 900);
    expect(el.querySelector('[data-sv-carousel-track]')).not.toBeNull();
    expect(shownTitles(el)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(counter(el)).toBe('1 / 4');

    for (let i = 0; i < 5; i++) {
      button(el, 'Next slide').click();
      fixture.detectChanges();
    }
    expect(shownTitles(el)).toEqual(['Delta', 'Epsilon', 'Zeta']);
    expect(changes).toEqual([1, 2, 3, 3, 3]);
    expect(counter(el)).toBe('4 / 4');
  });

  it('with loop, the step after the last view is the first', async () => {
    const { el, fixture, c } = await setup({ slidesPerView: 3 }, 900);
    c.goTo(3);
    fixture.detectChanges();
    button(el, 'Next slide').click();
    fixture.detectChanges();
    expect(shownTitles(el)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('moves the track by a slide width, and makes each slide its share of it', async () => {
    const { el, fixture, c } = await setup({ slidesPerView: 3 }, 900);
    c.next();
    fixture.detectChanges();
    const track = el.querySelector<HTMLElement>('[data-sv-carousel-track]')!;
    expect(track.style.transform).toMatch(/translateX\(-33\.33\d*%\)/);
    expect(slides(el)[0].style.width).toMatch(/^33\.33\d*%$/);
  });

  it('fits fewer when each would be narrower than slideMinWidth', async () => {
    const { el } = await setup({ slidesPerView: 3, slideMinWidth: 220 }, 500);
    expect(shownTitles(el)).toEqual(['Alpha', 'Beta']);
    const { el: phone } = await setup({ slidesPerView: 3 }, 360);
    expect(phone.querySelector('[data-sv-carousel-track]')).toBeNull();
    expect(shownTitles(phone)).toEqual(['Alpha']);
  });

  it('gives each slide the aspect ratio, so the row is three ratios wide', async () => {
    const { c } = await setup({ slidesPerView: 3, aspectRatio: '4/3' }, 900);
    // Read from the component: jsdom's style object does not keep `aspect-ratio`.
    expect(Number(c.regionAspect())).toBeCloseTo(4, 5);
    const { c: one } = await setup({ aspectRatio: '21 / 9' });
    expect(one.regionAspect()).toBe('21 / 9');
  });

  it('draws one indicator per place the row can start', async () => {
    const { el } = await setup({ slidesPerView: 3 }, 900);
    expect(el.querySelectorAll('button[aria-label^="Go to slide"]').length).toBe(4);
  });
});

describe('SvCarouselComponent — vertical (FL-G2)', () => {
  it('moves slides on the y axis and takes ↑ / ↓, not ← / →', async () => {
    const { el, fixture, c } = await setup({ orientation: 'vertical' });
    const region = el.querySelector<HTMLElement>('[data-sv-carousel-region]')!;
    expect(slides(el)[1].className).toContain('translate-y-full');

    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(c.current()).toBe(0);
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(c.current()).toBe(1);
    expect(slides(el)[0].className).toContain('-translate-y-full');
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(c.current()).toBe(0);
    expect(region.classList).toContain('touch-pan-x');
  });

  it('an upward swipe shows the next slide', async () => {
    const { el, c } = await setup({ orientation: 'vertical' });
    const region = el.querySelector<HTMLElement>('[data-sv-carousel-region]')!;
    const at = (type: string, y: number) => {
      const e = new MouseEvent(type, { clientX: 100, clientY: y, bubbles: true, button: 0 });
      Object.assign(e, { pointerId: 1, isPrimary: true, pointerType: 'touch' });
      region.dispatchEvent(e);
    };
    at('pointerdown', 300);
    at('pointerup', 200);
    expect(c.current()).toBe(1);
  });

  it('puts the arrows above and below', async () => {
    const { el } = await setup({ orientation: 'vertical' });
    expect(button(el, 'Previous slide').className).toContain('top-3');
    expect(button(el, 'Next slide').className).toContain('bottom-3');
  });

  it('coverflow stays horizontal', async () => {
    const { c } = await setup({ orientation: 'vertical', variant: 'coverflow' });
    expect(c.vertical()).toBe(false);
  });
});

describe('SvCarouselComponent — thumbnails (FL-G2)', () => {
  it('draws a preview button per slide under the carousel; one marks the current slide', async () => {
    const { el, fixture, c } = await setup({ indicator: 'thumbnails' });
    const strip = el.querySelector<HTMLElement>('[data-sv-carousel-thumbnails]')!;
    expect(el.querySelector('[data-sv-carousel-region]')!.contains(strip)).toBe(false);
    const thumbs = [...strip.querySelectorAll<HTMLButtonElement>('button')];
    expect(thumbs.length).toBe(6);
    expect(thumbs[3].getAttribute('aria-label')).toBe('Go to slide 4');
    expect(thumbs[3].querySelector('img')!.getAttribute('alt')).toBe('');

    thumbs[3].click();
    fixture.detectChanges();
    expect(c.current()).toBe(3);
    expect(thumbs[3].getAttribute('aria-current')).toBe('true');
    expect(thumbs[0].hasAttribute('aria-current')).toBe(false);
    // No dots inside the carousel as well.
    expect(el.querySelector('[data-sv-carousel-region] button[aria-label^="Go to slide"]')).toBeNull();
  });
});

/**
 * FL-L4-05 — a captioned single-slide carousel keeps a 14rem floor whatever its
 * aspect ratio: a 21:9 hero was 140 px tall on a phone and cut off its own CTA.
 */
describe('SvCarouselComponent caption floor', () => {
  const region = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-sv-carousel-region]')!;

  it('holds a minimum height when a slide in a single view carries copy', async () => {
    const { el } = await setup({ aspectRatio: '21/9' });
    expect(region(el).classList).toContain('min-h-56');
  });

  it('does not when no slide has a caption', async () => {
    const bare = SLIDES.map(({ id, image }) => ({ id, image }));
    const { el } = await setup({ slides: bare, aspectRatio: '21/9' });
    expect(region(el).classList).not.toContain('min-h-56');
  });

  it('does not with several slides in view, whose cards carry their own captions', async () => {
    const { el } = await setup({ slidesPerView: 3 }, 900);
    expect(region(el).classList).not.toContain('min-h-56');
  });
});
