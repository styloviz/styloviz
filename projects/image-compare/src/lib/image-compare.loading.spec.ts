import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageCompareComponent } from './image-compare.component';

/**
 * FL-J3-DD-15 — loading and error states: the wipe stays covered until BOTH
 * images have loaded, a failure says which image, and the slider does nothing
 * meanwhile.
 */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const errors: string[] = [];
  const { fixture } = await render(SvImageCompareComponent, {
    inputs: { beforeSrc: '/a.png', afterSrc: '/b.png', beforeAlt: 'the original', afterAlt: 'the retouch', ...inputs },
    on: { loadError: (w: string) => errors.push(w) },
  });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const fire = (sel: string, type: 'load' | 'error') => {
    el.querySelector(sel)!.dispatchEvent(new Event(type));
    fixture.detectChanges();
  };
  return { fixture, el, c: fixture.componentInstance, errors, fire };
}
const box = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-sv-box]')!;
const overlay = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-sv-load-overlay]');
const handle = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-sv-handle]')!;

describe('SvImageCompareComponent — loading (DD-15-I3)', () => {
  it('covers the wipe and says so until both images have loaded', async () => {
    const { el, fire } = await setup();
    expect(box(el).getAttribute('data-sv-media-state')).toBe('loading');
    expect(box(el).getAttribute('aria-busy')).toBe('true');
    expect(overlay(el)?.querySelector('[role="status"]')?.textContent?.trim()).toBe('Loading the images to compare…');
    expect(handle(el).getAttribute('aria-disabled')).toBe('true');

    fire('[data-sv-before]', 'load');
    expect(overlay(el)).not.toBeNull(); // half a pair is still nothing to compare

    fire('[data-sv-after]', 'load');
    expect(overlay(el)).toBeNull();
    expect(box(el).hasAttribute('data-sv-media-state')).toBe(false);
    expect(box(el).hasAttribute('aria-busy')).toBe(false);
    expect(handle(el).hasAttribute('aria-disabled')).toBe(false);
  });

  it('ignores the keyboard and the pointer until it is ready', async () => {
    const { el, c, fixture, fire } = await setup({ position: 0.5 });
    handle(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    c.onPointerDown({ clientX: 0, pointerId: 1, target: box(el) } as unknown as PointerEvent);
    fixture.detectChanges();
    expect(c.position()).toBe(0.5);
    fire('[data-sv-before]', 'load');
    fire('[data-sv-after]', 'load');
    handle(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(c.position()).toBe(1);
  });

  it('re-arms when a source changes', async () => {
    const { el, fixture, fire } = await setup();
    fire('[data-sv-before]', 'load');
    fire('[data-sv-after]', 'load');
    expect(overlay(el)).toBeNull();
    fixture.componentRef.setInput('afterSrc', '/c.png');
    fixture.detectChanges();
    expect(overlay(el)).not.toBeNull();
  });
});

describe('SvImageCompareComponent — errors (DD-15-I3)', () => {
  it('names the image that failed and reports it', async () => {
    const { el, errors, fire } = await setup();
    fire('[data-sv-before]', 'load');
    fire('[data-sv-after]', 'error');
    expect(box(el).getAttribute('data-sv-media-state')).toBe('error');
    expect(overlay(el)?.textContent?.trim()).toBe('the retouch could not be loaded, so there is nothing to compare.');
    expect(errors).toEqual(['after']);
  });

  it('treats a missing source as a failure, not an endless load', async () => {
    const { el } = await setup({ beforeSrc: '' });
    expect(box(el).getAttribute('data-sv-media-state')).toBe('error');
  });
});

describe('SvImageCompareComponent — touch (DD-15-I5)', () => {
  it('lets a vertical swipe scroll the page: touch-pan-y, never touch-none', async () => {
    const { el } = await setup();
    expect(box(el).classList).toContain('touch-pan-y');
    // …and pinch-zoom still zooms the page: `pan-y` alone would forbid it.
    expect(box(el).classList).toContain('touch-pinch-zoom');
    expect(box(el).classList).not.toContain('touch-none');
  });
});
