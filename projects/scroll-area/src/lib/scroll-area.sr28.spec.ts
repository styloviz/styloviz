import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvScrollAreaComponent } from './scroll-area.component';

/**
 * `SR-28` — the free variants: overlay vs inset gutter, thumb style and size,
 * shadow fades and a fade colour that is the host's, back-to-top, a progress
 * bar, programmatic scrolling that honours reduced motion, reachedEnd /
 * reachedStart once per arrival, and a thumb that shows while scrolling.
 */

async function area(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvScrollAreaComponent, { inputs });
  fixture.detectChanges();
  return { f: fixture, c: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  TestBed.resetTestingModule();
});

function size(host: HTMLElement, viewport: number, content: number, top = 0) {
  const port = host.querySelector('[data-sv-port]') as HTMLElement;
  Object.defineProperty(port, 'clientHeight', { value: viewport, configurable: true });
  Object.defineProperty(port, 'scrollHeight', { value: content, configurable: true });
  Object.defineProperty(port, 'scrollTop', { value: top, writable: true, configurable: true });
  return port;
}

/** Scroll to `top` and let the component read it. */
function scrollTo(host: HTMLElement, top: number) {
  const port = host.querySelector('[data-sv-port]') as HTMLElement;
  port.scrollTop = top;
  port.dispatchEvent(new Event('scroll'));
}

describe('scroll-area (SR-28) — nothing changes for a host that sets nothing', () => {
  it('overlay, 8 px pill thumb, gradient fade, no extras', async () => {
    const { f, host } = await area();
    size(host, 400, 4000, 100).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    const port = host.querySelector('[data-sv-port]') as HTMLElement;
    expect(port.style.paddingInlineEnd).toBe('');
    const thumb = host.querySelector('[data-sv-thumb]') as HTMLElement;
    expect(thumb.style.width).toBe('8px');
    expect(thumb.className).toContain('rounded-full');
    expect(host.querySelector('[data-sv-fade-start]')!.className).toContain('from-[var(--sv-sa-fade,#fff)]');
    expect(host.querySelector('[data-sv-progress]')).toBeNull();
    expect(host.querySelector('[data-sv-back-to-top]')).toBeNull();
  });
});

describe('scroll-area (SR-28) — gutter, thumb, fades', () => {
  it('★ inset reserves a gutter the thumb sits in, so it covers nothing', async () => {
    const { f, host } = await area({ scrollbars: 'inset', size: 'lg' });
    size(host, 400, 4000).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect((host.querySelector('[data-sv-port]') as HTMLElement).style.paddingInlineEnd).toBe('18px');
    expect((host.querySelector('[data-sv-thumb]') as HTMLElement).style.width).toBe('12px');
  });

  it('square and track styles', async () => {
    const sq = await area({ thumbStyle: 'square', variant: 'always' });
    size(sq.host, 400, 4000).dispatchEvent(new Event('scroll'));
    sq.f.detectChanges();
    expect(sq.host.querySelector('[data-sv-thumb]')!.className).toContain('rounded-none');

    const tr = await area({ thumbStyle: 'track', variant: 'always' });
    size(tr.host, 400, 4000).dispatchEvent(new Event('scroll'));
    tr.f.detectChanges();
    expect(tr.host.querySelector('[data-sv-track]')!.className).toContain('bg-gray-200/80');
  });

  it('★ a shadow fade needs no colour; a gradient takes the host\'s', async () => {
    const shadow = await area({ fadeStyle: 'shadow' });
    size(shadow.host, 400, 4000, 100).dispatchEvent(new Event('scroll'));
    shadow.f.detectChanges();
    expect(shadow.host.querySelector('[data-sv-fade-end]')!.className).toContain('from-black/15');

    const tinted = await area({ fadeColor: 'rgb(30 58 138)' });
    expect((tinted.host.querySelector('[data-sv-scroll-area]') as HTMLElement).style.getPropertyValue('--sv-sa-fade')).toBe('rgb(30 58 138)');
  });

  it('hover keeps the thumb for hideDelay after the pointer leaves', async () => {
    const { f, host } = await area({ variant: 'hover', hideDelay: 900 });
    size(host, 400, 4000).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    const track = host.querySelector('[data-sv-track]') as HTMLElement;
    expect(track.className).toContain('opacity-0');      // hover only — not on scroll
    expect(track.className).toContain('[transition-delay:var(--sv-sa-hide-delay)]');
    expect((host.querySelector('[data-sv-scroll-area]') as HTMLElement).style.getPropertyValue('--sv-sa-hide-delay')).toBe('900ms');
  });
});

describe('scroll-area (SR-28) — progress and back to top', () => {
  it('★ the progress bar fills with the scroll, by transform', async () => {
    const { f, host } = await area({ progress: true });
    size(host, 400, 1400, 500).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    const fill = host.querySelector('[data-sv-progress] > span') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(0.5)');
  });

  it('★ back-to-top appears after showAfter and scrolls to the start', async () => {
    const { f, c, host } = await area({ backToTop: true, showAfter: 300 });
    const port = size(host, 400, 4000, 200);
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(host.querySelector('[data-sv-back-to-top]')).toBeNull();

    scrollTo(host, 900);
    f.detectChanges();
    const button = host.querySelector<HTMLButtonElement>('[data-sv-back-to-top]')!;
    expect(button.getAttribute('aria-label')).toBe('Back to top');
    const spy = vi.spyOn(c, 'scrollTo');
    button.click();
    expect(spy).toHaveBeenCalledWith(0, {});
  });
});

describe('scroll-area (SR-28) — scrolling it from code', () => {
  it('★ scrollTo is smooth, unless the user prefers reduced motion', async () => {
    const { host, c } = await area();
    const port = size(host, 400, 4000);
    const calls: ScrollToOptions[] = [];
    port.scrollTo = ((o: ScrollToOptions) => calls.push(o)) as typeof port.scrollTo;
    port.dispatchEvent(new Event('scroll'));

    c.scrollTo(1200);
    expect(calls.at(-1)).toEqual({ top: 1200, behavior: 'smooth' });

    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    c.scrollTo(99_999);
    expect(calls.at(-1)).toEqual({ top: 3600, behavior: 'instant' });   // clamped to the end
  });

  it('scrollBy and scrollToEnd are relative to where it is', async () => {
    const { host, c } = await area();
    const port = size(host, 400, 4000, 1000);
    const calls: ScrollToOptions[] = [];
    port.scrollTo = ((o: ScrollToOptions) => calls.push(o)) as typeof port.scrollTo;
    port.dispatchEvent(new Event('scroll'));
    c.scrollBy(-250, { behavior: 'instant' });
    expect(calls.at(-1)).toEqual({ top: 750, behavior: 'instant' });
    c.scrollToEnd();
    expect(calls.at(-1)!.top).toBe(3600);
  });
});

describe('scroll-area (SR-28) — reachedEnd / reachedStart', () => {
  it('★ fires once per arrival, not once per scroll event', async () => {
    const { c, host } = await area({ threshold: 50 });
    size(host, 400, 2000);
    let ends = 0;
    c.reachedEnd.subscribe(() => ends++);
    for (const top of [1500, 1560, 1580, 1600]) scrollTo(host, top);
    expect(ends).toBe(1);

    scrollTo(host, 900);      // leave the threshold — re-armed
    scrollTo(host, 1590);
    expect(ends).toBe(2);
  });

  it('★ re-arms when a page is appended under the user', async () => {
    const { c, host } = await area({ threshold: 50 });
    const port = size(host, 400, 2000);
    let ends = 0;
    c.reachedEnd.subscribe(() => ends++);
    scrollTo(host, 1580);
    expect(ends).toBe(1);
    Object.defineProperty(port, 'scrollHeight', { value: 2400, configurable: true });
    scrollTo(host, 1580);     // the list grew; this read re-arms
    scrollTo(host, 1990);
    expect(ends).toBe(2);
  });

  it('reachedStart fires on coming back to the top', async () => {
    const { c, host } = await area({ threshold: 20 });
    size(host, 400, 2000);
    let starts = 0;
    c.reachedStart.subscribe(() => starts++);
    scrollTo(host, 0);
    expect(starts).toBe(0);   // already there on load is not an arrival
    scrollTo(host, 600);
    scrollTo(host, 10);
    expect(starts).toBe(1);
  });
});
