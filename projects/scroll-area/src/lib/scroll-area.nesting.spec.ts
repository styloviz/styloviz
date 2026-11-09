import { Component, signal, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SvScrollAreaComponent } from './scroll-area.component';

/**
 * FL-J3-LU-06 — nested scroll areas, and one added after init (`X-13`,
 * `LU-06-I4`'s "nested areas").
 *
 * A card list in a scrolling panel inside a scrolling page is the ordinary
 * case. What has to hold: each area measures, thumbs and tab-stops ITSELF (an
 * inner overflow must not make the outer a tab stop or move its thumb), a scroll
 * inside the inner one is not reported by the outer (`scroll` does not bubble,
 * and nothing may re-dispatch it), their generated ids never collide, and an
 * area rendered later measures itself without a host `measure()` call.
 */

@Component({
  imports: [SvScrollAreaComponent],
  template: `
    <sv-scroll-area ariaLabel="Outer" variant="always" (scrolled)="outerScrolls.push($event)">
      <p>Intro</p>
      <sv-scroll-area ariaLabel="Inner" variant="always" maxHeight="8rem" (scrolled)="innerScrolls.push($event)">
        <p>Rows</p>
      </sv-scroll-area>
      @if (late()) {
        <sv-scroll-area ariaLabel="Late" variant="always" maxHeight="8rem"><p>Late rows</p></sv-scroll-area>
      }
    </sv-scroll-area>`,
})
class NestedAreas {
  readonly late = signal(false);
  readonly outerScrolls: number[] = [];
  readonly innerScrolls: number[] = [];
  readonly areas = viewChildren(SvScrollAreaComponent);
}

/** Per-port dimensions, keyed by the area's aria-label — jsdom lays nothing out. */
const DIMS: Record<string, { clientHeight: number; scrollHeight: number }> = {
  Outer: { clientHeight: 400, scrollHeight: 400 },
  Inner: { clientHeight: 128, scrollHeight: 512 },
  Late: { clientHeight: 128, scrollHeight: 256 },
};

function stubLayout() {
  const dim = (el: HTMLElement, key: 'clientHeight' | 'scrollHeight') =>
    el.hasAttribute('data-sv-port') ? (DIMS[el.getAttribute('aria-label') ?? '']?.[key] ?? 0) : 0;
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return dim(this, 'clientHeight');
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return dim(this, 'scrollHeight');
  });
}

function setup() {
  stubLayout();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [NestedAreas] });
  const fixture = TestBed.createComponent(NestedAreas);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const port = (label: string) => root.querySelector<HTMLElement>(`[data-sv-port][aria-label="${label}"]`)!;
  /** The thumb belonging to the area whose port is labelled `label` — not a descendant area's. */
  const thumb = (label: string) => {
    const host = port(label).closest('sv-scroll-area')!;
    return Array.from(host.querySelectorAll<HTMLElement>('[data-sv-thumb]')).find(
      (t) => t.closest('sv-scroll-area') === host,
    ) ?? null;
  };
  return { fixture, root, port, thumb, host: fixture.componentInstance };
}

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('SvScrollAreaComponent — nested (X-13, LU-06-I4)', () => {
  it('★ the inner area overflows and is a tab stop; the outer, which fits, is not', () => {
    const { port } = setup();
    expect(port('Inner').getAttribute('tabindex')).toBe('0');
    expect(port('Outer').hasAttribute('tabindex')).toBe(false);
  });

  it('★ each area draws its own thumb from its own box — the inner overflow does not give the outer one', () => {
    const { thumb } = setup();
    // 128 / 512 of a 128px track.
    expect(thumb('Inner')?.style.height).toBe('32px');
    expect(thumb('Outer')).toBeNull();
  });

  it('a scroll inside the inner area is reported by the inner area only', () => {
    const { port, host } = setup();
    Object.defineProperty(port('Inner'), 'scrollTop', { value: 100, configurable: true });
    port('Inner').dispatchEvent(new Event('scroll'));
    expect(host.innerScrolls).toEqual([100]);
    expect(host.outerScrolls).toEqual([]);
  });

  it('generated ids never collide between the nested areas', () => {
    const { root } = setup();
    const ids = Array.from(root.querySelectorAll('[id]')).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // Each port is described by its OWN readout.
    for (const p of Array.from(root.querySelectorAll('[data-sv-port]'))) {
      const readout = root.querySelector(`#${p.getAttribute('aria-describedby')}`);
      expect(readout?.closest('sv-scroll-area')).toBe(p.closest('sv-scroll-area'));
    }
  });

  it('keeps native scrolling on both — neither area traps the other\'s wheel or keys', () => {
    const { port } = setup();
    for (const label of ['Outer', 'Inner']) {
      expect(port(label).classList).toContain('overflow-y-auto');
      expect(port(label).style.transform).toBe('');
    }
  });
});

describe('SvScrollAreaComponent — added after init (X-13)', () => {
  it('★ an area rendered later measures itself — thumb and tab stop with no host measure() call', () => {
    const { fixture, port, thumb, host } = setup();
    host.late.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(port('Late').getAttribute('tabindex')).toBe('0');
    // 128 / 256 of a 128px track.
    expect(thumb('Late')?.style.height).toBe('64px');
  });

  it('the late area joins without disturbing its siblings', () => {
    const { fixture, port, thumb, host } = setup();
    const before = thumb('Inner')?.style.height;
    host.late.set(true);
    fixture.detectChanges();
    expect(thumb('Inner')?.style.height).toBe(before);
    expect(port('Outer').hasAttribute('tabindex')).toBe(false);
    expect(host.areas()).toHaveLength(3);
  });
});
