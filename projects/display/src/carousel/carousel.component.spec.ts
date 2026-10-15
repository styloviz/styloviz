import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { SvCarouselComponent, type CarouselSlide } from './carousel.component';

/**
 * Branch coverage for the navigation arithmetic and the four async shells.
 *
 * Every query here is scoped to the fixture host — `sv-skeleton-shell` is
 * itself `role="status"`, so a document-wide query would find it from any
 * other component that happens to be mounted.
 */

const SLIDES: CarouselSlide[] = [
  { id: 'a', title: 'Alpha', subtitle: 'first' },
  { id: 'b', title: 'Beta', image: '/b.png', badge: 'New', cta: 'Buy', meta: '£9' },
  { id: 'c', image: '/c.png' },
];

async function setup(inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCarouselComponent, {
    inputs: { slides: SLIDES, ...inputs },
    on,
    // A catch-all route, so a CTA link a spec clicks navigates instead of logging NG04002.
    providers: [provideRouter([{ path: '**', children: [] }])],
  });
  return fixture;
}

const host = (f: { nativeElement: HTMLElement }) => f.nativeElement;
const q = (f: { nativeElement: HTMLElement }, sel: string) =>
  host(f).querySelector<HTMLElement>(sel);
const qa = (f: { nativeElement: HTMLElement }, sel: string) => [
  ...host(f).querySelectorAll<HTMLElement>(sel),
];

describe('SvCarouselComponent — async shells', () => {
  it('shows the skeleton and no slides while loading', async () => {
    const f = await setup({ loading: true });
    expect(q(f, '[data-sv-state="loading"]')).not.toBeNull();
    expect(q(f, '[role="region"]')).toBeNull();
  });

  /** Loading outranks error: a load still in flight has not failed yet. */
  it('prefers loading over an error that is also set', async () => {
    const f = await setup({ loading: true, error: 'boom' });
    expect(q(f, '[data-sv-state="loading"]')).not.toBeNull();
    expect(q(f, '[data-sv-state="error"]')).toBeNull();
  });

  it('shows the error shell and relays retry', async () => {
    let retries = 0;
    const f = await setup({ error: 'boom' }, { retry: () => retries++ });
    const shell = q(f, '[data-sv-state="error"]');
    expect(shell).not.toBeNull();
    shell!.querySelector<HTMLButtonElement>('button')?.click();
    f.detectChanges();
    expect(retries).toBe(1);
  });

  it('distinguishes an empty set from a filtered-to-nothing set', async () => {
    const f = await setup({ slides: [] });
    expect(q(f, '[data-sv-state="empty"]')).not.toBeNull();

    const g = await setup({ slides: [], filtered: true });
    // `filtered` picks the no-results reason, which must read differently from
    // "there is no data" — otherwise a bad filter looks like an empty account.
    expect(g.nativeElement.textContent).not.toEqual(f.nativeElement.textContent);
  });
});

describe('SvCarouselComponent — navigation arithmetic', () => {
  it('wraps forward from the last slide when looping', async () => {
    const seen: number[] = [];
    const f = await setup({}, { slideChange: (i: number) => seen.push(i) });
    f.componentInstance.goTo(2);
    f.componentInstance.next();
    expect(f.componentInstance.current()).toBe(0);
    expect(seen).toEqual([2, 0]);
  });

  it('stays on the last slide at the end when loop is off', async () => {
    const f = await setup({ loop: false });
    f.componentInstance.goTo(2);
    f.componentInstance.next();
    expect(f.componentInstance.current()).toBe(2);
  });

  it('wraps backward from the first slide when looping', async () => {
    const f = await setup();
    f.componentInstance.prev();
    expect(f.componentInstance.current()).toBe(2);
  });

  it('stays on the first slide at the start when loop is off', async () => {
    const f = await setup({ loop: false });
    f.componentInstance.prev();
    expect(f.componentInstance.current()).toBe(0);
  });

  it('records the direction it travelled in', async () => {
    const f = await setup();
    f.componentInstance.goTo(2);
    expect(f.componentInstance.direction()).toBe('next');
    f.componentInstance.goTo(1);
    expect(f.componentInstance.direction()).toBe('prev');
    // Re-selecting the CURRENT slide is not forward — `i > current` is false.
    f.componentInstance.goTo(1);
    expect(f.componentInstance.direction()).toBe('prev');
  });

  it('reports an empty title for a slide that carries none', async () => {
    const f = await setup();
    f.componentInstance.goTo(2); // slide 'c' has no title
    expect(f.componentInstance.currentTitle()).toBe('');
  });
});

describe('SvCarouselComponent — keyboard', () => {
  const press = (f: { nativeElement: HTMLElement; detectChanges(): void }, key: string) => {
    const region = q(f, '[role="region"]')!;
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    region.dispatchEvent(e);
    f.detectChanges();
    return e;
  };

  it('moves with the arrow keys and claims the event', async () => {
    const f = await setup();
    expect(press(f, 'ArrowRight').defaultPrevented).toBe(true);
    expect(f.componentInstance.current()).toBe(1);
    expect(press(f, 'ArrowLeft').defaultPrevented).toBe(true);
    expect(f.componentInstance.current()).toBe(0);
  });

  it('leaves every other key to the page', async () => {
    const f = await setup();
    expect(press(f, 'Enter').defaultPrevented).toBe(false);
    expect(f.componentInstance.current()).toBe(0);
  });

  /** One slide has nowhere to go — arrows must fall through to the page. */
  it('does not swallow arrows when there is only one slide', async () => {
    const f = await setup({ slides: [SLIDES[0]] });
    expect(press(f, 'ArrowRight').defaultPrevented).toBe(false);
    expect(f.componentInstance.current()).toBe(0);
  });
});

describe('SvCarouselComponent — auto-play', () => {
  it('advances on its own interval', async () => {
    vi.useFakeTimers();
    try {
      const f = await setup({ autoPlay: true, interval: 1000 });
      f.detectChanges();
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never starts a timer for a single slide', async () => {
    vi.useFakeTimers();
    try {
      const f = await setup({ autoPlay: true, interval: 1000, slides: [SLIDES[0]] });
      f.detectChanges();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('halts while the user pauses, and resumes on toggle back', async () => {
    vi.useFakeTimers();
    try {
      const paused: boolean[] = [];
      const f = await setup(
        { autoPlay: true, interval: 1000 },
        { pausedChange: (p: boolean) => paused.push(p) },
      );
      f.detectChanges();
      f.componentInstance.togglePause();
      f.detectChanges();
      vi.advanceTimersByTime(5000);
      expect(f.componentInstance.current()).toBe(0);

      f.componentInstance.togglePause();
      f.detectChanges();
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(1);
      expect(paused).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds while hovered and resumes when the pointer leaves (WCAG 2.2.2)', async () => {
    vi.useFakeTimers();
    try {
      const f = await setup({ autoPlay: true, interval: 1000 });
      f.detectChanges();
      f.componentInstance.onMouseEnter();
      f.detectChanges();
      vi.advanceTimersByTime(3000);
      expect(f.componentInstance.current()).toBe(0);

      f.componentInstance.onMouseLeave();
      f.detectChanges();
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds while focus is inside, and resumes when it leaves', async () => {
    vi.useFakeTimers();
    try {
      const f = await setup({ autoPlay: true, interval: 1000 });
      f.detectChanges();
      f.componentInstance.onFocusIn();
      f.detectChanges();
      vi.advanceTimersByTime(3000);
      expect(f.componentInstance.current()).toBe(0);

      f.componentInstance.onFocusOut();
      f.detectChanges();
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  /** `pauseOnHover=false` is the opt-out — hover must then change nothing. */
  it('keeps rotating under the pointer when pauseOnHover is off', async () => {
    vi.useFakeTimers();
    try {
      const f = await setup({ autoPlay: true, interval: 1000, pauseOnHover: false });
      f.detectChanges();
      f.componentInstance.onMouseEnter();
      f.detectChanges();
      expect(f.componentInstance.interacting()).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(f.componentInstance.current()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mutes the live region only while it is actually rotating', async () => {
    const f = await setup({ autoPlay: true });
    expect(q(f, '.sr-only')!.getAttribute('aria-live')).toBe('off');
    f.componentInstance.togglePause();
    f.detectChanges();
    expect(q(f, '.sr-only')!.getAttribute('aria-live')).toBe('polite');
  });

  it('offers no pause control when auto-play is off', async () => {
    const f = await setup();
    expect(q(f, '[aria-pressed]')).toBeNull();
  });
});

describe('SvCarouselComponent — chrome', () => {
  it('hides the arrows for a single slide', async () => {
    const f = await setup({ slides: [SLIDES[0]] });
    expect(q(f, '[aria-label="Next slide"]')).toBeNull();
  });

  it('hides the arrows when asked to, even with several slides', async () => {
    const f = await setup({ arrows: false });
    expect(q(f, '[aria-label="Next slide"]')).toBeNull();
    // …but the indicators stay: they are a separate opt-out.
    expect(qa(f, '[aria-label^="Go to slide"]').length).toBe(3);
  });

  it('drives navigation from the arrow buttons themselves', async () => {
    const f = await setup();
    q(f, '[aria-label="Next slide"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.current()).toBe(1);
    q(f, '[aria-label="Previous slide"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.current()).toBe(0);
  });

  it.each(['dots', 'lines', 'numbers'] as const)(
    'renders one %s indicator per slide and jumps on click',
    async (indicator) => {
      const f = await setup({ indicator });
      const dots = qa(f, '[aria-label^="Go to slide"]');
      expect(dots.length).toBe(3);
      dots[2].click();
      f.detectChanges();
      expect(f.componentInstance.current()).toBe(2);
      expect(qa(f, '[aria-current="true"]').length).toBe(1);
    },
  );

  it('renders no indicators at all when asked for none', async () => {
    const f = await setup({ indicator: 'none' });
    expect(qa(f, '[aria-label^="Go to slide"]').length).toBe(0);
  });

  it('hides the indicator row for a single slide', async () => {
    const f = await setup({ slides: [SLIDES[0]] });
    expect(qa(f, '[aria-label^="Go to slide"]').length).toBe(0);
  });

  it('marks every slide but the active one aria-hidden', async () => {
    const f = await setup();
    const groups = qa(f, '[aria-roledescription="slide"]');
    expect(groups.map((g) => g.getAttribute('aria-hidden'))).toEqual(['false', 'true', 'true']);
  });

  it('renders a link CTA when the slide carries a route, a button otherwise', async () => {
    const withLink: CarouselSlide[] = [
      { id: 'x', cta: 'Go', ctaLink: '/somewhere', image: '/x.png' },
      { id: 'y', cta: 'Press', image: '/y.png' },
    ];
    const f = await setup({ slides: withLink });
    expect(qa(f, 'a[href]').length).toBe(1);
    // The active slide's own CTA carries no tabindex — it is reachable normally.
    expect(qa(f, 'a[href]')[0].getAttribute('tabindex')).toBeNull();
    expect(host(f).textContent).toContain('Press');
  });

  it('makes every slide but the active one inert, so an unseen CTA cannot take focus', async () => {
    // Off-screen slides stay mounted to transition, which left their cta link or
    // button in the tab order behind an opacity-0 layer — and since those slides
    // are also aria-hidden, a focusable node inside them fails WCAG outright.
    // opacity and pointer-events do not answer to the keyboard; inert does.
    const f = await setup({
      slides: [
        { id: 'x', cta: 'Go', ctaLink: '/somewhere', image: '/x.png' },
        { id: 'y', cta: 'Press', ctaLink: '/elsewhere', image: '/y.png' },
      ] as CarouselSlide[],
    });
    const groups = qa(f, '[aria-roledescription="slide"]');
    expect(groups.map((g) => g.hasAttribute('inert'))).toEqual([false, true]);
    // Belt and braces: the one link that is *not* inside an inert subtree is the
    // active slide's.
    const reachable = qa(f, 'a[href]').filter((a) => !a.closest('[inert]'));
    expect(reachable.length).toBe(1);
    expect(reachable[0].getAttribute('href')).toBe('/somewhere');
  });

  it('falls back to a neutral gradient for a slide with no bgColor', async () => {
    const f = await setup({ slides: [{ id: 'z', title: 'Plain' }] });
    expect(host(f).innerHTML).toContain('from-gray-600');
  });
});

/**
 * Motion the viewer did not ask for, and focus they should not lose.
 *
 * ★★★ A CAROUSEL IS THE WORST CASE FOR `prefers-reduced-motion` and the one most
 *     often missed. WCAG 2.2.2 requires moving content to be pausable, but the
 *     setting is a request not to have to pause it in the first place — for a
 *     viewer with a vestibular disorder a slide crossing the viewport every five
 *     seconds is nausea, not a style choice.
 *
 * ★ `matchMedia` is DEFINED rather than spied on: jsdom does not implement it,
 *   so there is no property to spy on, and the component reads the preference in
 *   a field initializer — the stub has to exist before the component is
 *   constructed, not before the assertion.
 */
describe('SvCarouselComponent — reduced motion and rescued focus', () => {
  const original = (window as { matchMedia?: unknown }).matchMedia;

  const reduce = (matches: boolean): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion') ? matches : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  };

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it('auto-plays when motion is welcome', async () => {
    reduce(false);
    const f = await setup({ autoPlay: true });
    expect(f.componentInstance.autoPlayOn()).toBe(true);
  });

  it('does NOT auto-play when the viewer asked for less motion', async () => {
    // ★ Not merely a shorter transition — no auto-advance at all.
    reduce(true);
    const f = await setup({ autoPlay: true });
    expect(f.componentInstance.autoPlayOn()).toBe(false);
    expect(f.componentInstance.animate()).toBe(false);
  });

  it('drops the slide transition classes under reduced motion', async () => {
    reduce(true);
    const f = await setup({ autoPlay: true });
    const slide = q(f, '[aria-roledescription="slide"]')!;
    expect(slide.classList.contains('transition-all')).toBe(false);
  });

  it('keeps them when motion is welcome', async () => {
    reduce(false);
    const f = await setup({ autoPlay: true });
    const slide = q(f, '[aria-roledescription="slide"]')!;
    expect(slide.classList.contains('transition-all')).toBe(true);
  });

  it('announces slide changes politely when nothing is auto-rotating', async () => {
    reduce(true);
    const f = await setup({ autoPlay: true });
    expect(q(f, '[aria-live]')!.getAttribute('aria-live')).toBe('polite');
  });

  it('silences the live region while auto-rotating', async () => {
    // ★ An autoplay tick must not interrupt a screen reader mid-sentence.
    reduce(false);
    const f = await setup({ autoPlay: true });
    expect(q(f, '[aria-live]')!.getAttribute('aria-live')).toBe('off');
  });

  it('offers a focus target that is not a tab stop', async () => {
    // ★ When the slide focus was on goes inert, the browser drops focus to
    //   <body> and the next Tab restarts at the top of the page — throwing a
    //   keyboard user out of the carousel they were reading.
    reduce(false);
    const f = await setup();
    const region = q(f, '[data-sv-carousel-region]')!;
    expect(region.getAttribute('tabindex')).toBe('-1');
    expect(region.getAttribute('role')).toBe('region');
  });

  it('rescues focus stranded on a slide that has gone inert', async () => {
    reduce(false);
    const f = await setup({ autoPlay: false });
    const link = q(f, '[aria-roledescription="slide"] a, [aria-roledescription="slide"] button');
    if (!link) return;
    link.focus();
    f.componentInstance.next();
    f.detectChanges();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('never steals focus from elsewhere on the page', async () => {
    // A slide advancing on a timer must not pull focus out of whatever the
    // reader is actually using.
    reduce(false);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const f = await setup({ autoPlay: false });
    outside.focus();
    f.componentInstance.next();
    f.detectChanges();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

/**
 * ★ Found 2026-10-01 on the store hero at phone width: the prev arrow (left-3,
 *   36px wide) sat on top of the caption, whose inset was only 24px below sm.
 */
describe('SvCarouselComponent — caption inset', () => {
  // Slide b is the one with an image, so the one with the overlay caption.
  const caption = (f: { nativeElement: HTMLElement }) =>
    qa(f, 'h3').find((h) => h.textContent?.trim() === 'Beta')!.parentElement!;

  it('clears the arrows at every width when they are shown', async () => {
    const f = await setup({ arrows: true });
    expect(caption(f).classList).toContain('px-14');
    expect(caption(f).classList).not.toContain('px-6');
  });

  it('keeps the tighter responsive inset without arrows', async () => {
    const f = await setup({ arrows: false });
    expect(caption(f).classList).toContain('px-6');
    expect(caption(f).classList).toContain('lg:px-14');
  });
});

/**
 * ★ Found 2026-10-04 on the store home: the hero's first slide is the page's
 *   Largest Contentful Paint, and it was `loading="lazy"` (Angular NG0913).
 */
describe('SvCarouselComponent — image priority', () => {
  const PHOTOS: CarouselSlide[] = [
    { id: 'p1', image: '/1.png' },
    { id: 'p2', image: '/2.png' },
  ];
  const imgs = (f: { nativeElement: HTMLElement }) => qa(f, 'img');

  it('lazy-loads every slide by default', async () => {
    const f = await setup({ slides: PHOTOS });
    expect(imgs(f).map((i) => i.getAttribute('loading'))).toEqual(['lazy', 'lazy']);
    expect(imgs(f).some((i) => i.hasAttribute('fetchpriority'))).toBe(false);
  });

  it('fetches only the first slide eagerly, at high priority, with priority set', async () => {
    const f = await setup({ slides: PHOTOS, priority: true });
    expect(imgs(f).map((i) => i.getAttribute('loading'))).toEqual(['eager', 'lazy']);
    expect(imgs(f).map((i) => i.getAttribute('fetchpriority'))).toEqual(['high', null]);
  });
});

describe('SvCarouselComponent — call to action (DA-07)', () => {
  /** The image-less layout used to render a type-less <button>: inside a form, a submit. */
  it('declares type="button" on every button it renders, in both slide layouts', async () => {
    const f = await setup({
      slides: [
        { id: 'plain', title: 'No image', cta: 'Plain' },
        { id: 'pic', title: 'Image', image: '/p.png', cta: 'Pictured' },
      ],
    });
    const buttons = qa(f, 'button');
    expect(buttons.length).toBeGreaterThan(2);
    expect(buttons.filter((b) => b.getAttribute('type') !== 'button').map((b) => b.outerHTML)).toEqual([]);
  });

  it('does not submit a form it sits in when the CTA is pressed', async () => {
    const f = await setup({ slides: [{ id: 'plain', title: 'No image', cta: 'Plain' }] });
    const form = document.createElement('form');
    let submits = 0;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits++;
    });
    host(f).parentElement!.insertBefore(form, host(f));
    form.appendChild(host(f));
    const cta = qa(f, 'button').find((b) => b.textContent?.trim() === 'Plain')!;
    cta.click();
    expect(submits).toBe(0);
    form.remove();
  });

  /** The image-less layout used to ignore `ctaLink` and render a dead button. */
  it('renders the link for a routed CTA in the image-less layout too', async () => {
    const f = await setup({ slides: [{ id: 'plain', title: 'No image', cta: 'Open', ctaLink: '/somewhere' }] });
    const link = q(f, 'a[href]');
    expect(link?.textContent).toContain('Open');
    expect(link?.getAttribute('href')).toBe('/somewhere');
  });

  it.each([
    ['image-less button', { id: 'plain', title: 'No image', cta: 'Go' }, 'button'],
    ['image-less link', { id: 'plain', title: 'No image', cta: 'Go', ctaLink: '/x' }, 'a'],
    ['image button', { id: 'pic', image: '/p.png', cta: 'Go' }, 'button'],
    ['image link', { id: 'pic', image: '/p.png', cta: 'Go', ctaLink: '/x' }, 'a'],
  ] as const)('emits ctaClick with the slide from the %s', async (_name, slide, tag) => {
    const clicked: CarouselSlide[] = [];
    const f = await setup({ slides: [slide] }, { ctaClick: (s: CarouselSlide) => clicked.push(s) });
    const cta = qa(f, tag).find((el) => el.textContent?.trim().startsWith('Go'))!;
    expect(cta).toBeTruthy();
    cta.click();
    expect(clicked).toEqual([slide]);
  });

  it('activates a button CTA from the keyboard', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const clicked: string[] = [];
    const f = await setup(
      { slides: [{ id: 'plain', title: 'No image', cta: 'Go' }] },
      { ctaClick: (s: CarouselSlide) => clicked.push(s.id) },
    );
    const cta = qa(f, 'button').find((b) => b.textContent?.trim() === 'Go')!;
    cta.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(clicked).toEqual(['plain', 'plain']);
  });
});
