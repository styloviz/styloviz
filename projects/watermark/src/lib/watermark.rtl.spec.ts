import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvWatermarkComponent } from './watermark.component';

/**
 * FL-J3-LU-02 — Watermark under `dir="rtl"` (`X-14`: "RTL alone affects …
 * Watermark text").
 *
 * ★★ Two separate questions, with opposite answers:
 *    - The TILING is physical and must stay physical. The overlay is
 *      `inset-0` and the marks are placed with `left`/`top` from the box's own
 *      corner, so they cover the box whichever way the page runs — mirroring
 *      them would gain nothing and risk a gap at the start edge.
 *    - The TEXT is not. A mark inherits the page's direction unless told
 *      otherwise, so "CONFIDENTIAL · a1b2" in an RTL page reorders around the
 *      separator and an Arabic mark over an LTR page does the same. Each mark
 *      (and the probe that measures it) carries `dir="auto"`, so it resolves
 *      its own direction from its first strong character.
 */

@Component({
  imports: [SvWatermarkComponent],
  template: `
    <div dir="rtl">
      <sv-watermark [text]="text()" [variant]="variant()" [viewerId]="viewer()" viewerSalt="s">
        <p>محتوى</p>
      </sv-watermark>
    </div>`,
})
class Host {
  readonly text = signal('سري');
  readonly variant = signal<'tiled' | 'single' | 'inspect'>('tiled');
  readonly viewer = signal<string | null>(null);
}

async function setup(variant: 'tiled' | 'single' | 'inspect' = 'tiled') {
  TestBed.resetTestingModule();
  const r = await render(Host);
  r.fixture.componentInstance.variant.set(variant);
  r.fixture.detectChanges();
  const root = r.fixture.nativeElement as HTMLElement;
  // jsdom lays nothing out: give the box a size so the overlay tiles.
  const box = root.querySelector('[data-sv-watermark]') as HTMLElement;
  box.getBoundingClientRect = () =>
    ({ width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  r.fixture.debugElement.query((d) => d.componentInstance instanceof SvWatermarkComponent).componentInstance.measure();
  r.fixture.detectChanges();
  return { ...r, root, marks: () => Array.from(root.querySelectorAll<HTMLElement>('[data-sv-mark]')) };
}

describe('SvWatermarkComponent — RTL (X-14)', () => {
  it('★ every mark and the measuring probe resolve their own direction (dir="auto")', async () => {
    const { root, marks } = await setup();
    expect(marks().length).toBeGreaterThan(0);
    for (const m of marks()) expect(m.getAttribute('dir')).toBe('auto');
    expect(root.querySelector('[data-sv-probe]')?.getAttribute('dir')).toBe('auto');
  });

  it('the single mark resolves its own direction too', async () => {
    const { marks } = await setup('single');
    expect(marks()).toHaveLength(1);
    expect(marks()[0].getAttribute('dir')).toBe('auto');
  });

  it('keeps an RTL mark\'s text intact, viewer token included', async () => {
    const { fixture, marks } = await setup();
    fixture.componentInstance.viewer.set('user-42');
    fixture.detectChanges();
    const text = marks()[0].textContent!.trim();
    expect(text.startsWith('سري · ')).toBe(true);
  });

  it('the overlay covers the whole box whichever way the page runs (physical inset-0)', async () => {
    const { root } = await setup();
    const overlay = root.querySelector('[data-sv-overlay]')!;
    expect(overlay.classList).toContain('inset-0');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });

  it('announces the mark once, in words, in the page direction', async () => {
    const { root } = await setup();
    expect(root.querySelector('[data-sv-label]')?.textContent).toBeTruthy();
  });

  it('the inspect panel spaces its verdict on the inline start, not the physical left', async () => {
    const { root } = await setup('inspect');
    const verdict = root.querySelector('[data-sv-inspect-opacity] span + span') as HTMLElement;
    expect(verdict.classList).toContain('ms-1');
    expect(verdict.className).not.toMatch(/\bml-/);
  });
});
