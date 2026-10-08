import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { SvCarouselComponent, type CarouselSlide } from './carousel.component';

/**
 * ★★ 1.0 audit H2 — no auto-advance interval on the server. A zone-based SSR
 *    render waits for the app to become stable, and a live `setInterval` means
 *    it never does: the request hangs.
 */
const SLIDES: CarouselSlide[] = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];

async function setup(platform: 'server' | 'browser') {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCarouselComponent, {
    inputs: { slides: SLIDES, autoPlay: true, interval: 1000 },
    providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: platform }],
  });
  return fixture;
}

describe('SvCarouselComponent — auto-play and the server', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedules no interval when rendered on the server', async () => {
    await setup('server');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still auto-advances in the browser', async () => {
    const fixture = await setup('browser');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    fixture.destroy();
  });
});
