import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SV_SERIES_DIMMED_OPACITY, createSeriesEmphasis, type SvSeriesEmphasis } from './series-emphasis';

/**
 * FL-J3-CH-03 — the one series-emphasis model the radar and line charts (both
 * tiers) share: isolate (fade the others), toggle (hide/show), and the legend
 * toolbar's single tab stop with arrow roving.
 */
function make(keys: string[] = ['A', 'B', 'C'], hidden: string[] = []) {
  TestBed.resetTestingModule();
  const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
  const keySig = signal(keys);
  const hiddenSig = signal<readonly string[]>(hidden);
  const e = runInInjectionContext(TestBed.inject(Injector), () =>
    createSeriesEmphasis({ keys: () => keySig(), hidden: hiddenSig }),
  );
  return { e, keySig, hiddenSig, announce };
}

describe('createSeriesEmphasis — isolate', () => {
  it('fades every series but the emphasised one', () => {
    const { e } = make();
    expect(e.isDimmed('A')).toBe(false);
    e.emphasize('B');
    expect(e.emphasized()).toBe('B');
    expect(e.isDimmed('A')).toBe(true);
    expect(e.isDimmed('B')).toBe(false);
    expect(e.opacity('A')).toBe(SV_SERIES_DIMMED_OPACITY);
    expect(e.opacity('B')).toBe(1);
    e.emphasize(null);
    expect(e.opacity('A')).toBe(1);
  });

  it('never emphasises a hidden or unknown series — nothing dims behind an absent one', () => {
    const { e } = make(['A', 'B', 'C'], ['B']);
    e.emphasize('B');
    expect(e.emphasized()).toBeNull();
    expect(e.isDimmed('A')).toBe(false);
    e.emphasize('Z');
    expect(e.emphasized()).toBeNull();
  });

  it('drops the emphasis when the emphasised series is hidden', () => {
    const { e } = make();
    e.emphasize('A');
    e.toggle('A');
    expect(e.isHidden('A')).toBe(true);
    expect(e.emphasized()).toBeNull();
  });
});

describe('createSeriesEmphasis — toggle', () => {
  it('hides and shows through the host-bound hidden set, announcing each', () => {
    const { e, hiddenSig, announce } = make();
    expect(e.toggle('B')).toBe(true);
    expect(hiddenSig()).toEqual(['B']);
    expect(e.visibleKeys()).toEqual(['A', 'C']);
    expect(announce).toHaveBeenLastCalledWith('B hidden');
    expect(e.toggle('B')).toBe(true);
    expect(hiddenSig()).toEqual([]);
    expect(announce).toHaveBeenLastCalledWith('B shown');
  });

  it('refuses to hide the last visible series, and says so', () => {
    const { e, hiddenSig, announce } = make(['A', 'B'], ['A']);
    expect(e.toggle('B')).toBe(false);
    expect(hiddenSig()).toEqual(['A']);
    expect(announce).toHaveBeenLastCalledWith('B is the only series shown, so it stays visible.');
  });

  it('reads a hidden set the host restored', () => {
    const { e, hiddenSig } = make();
    hiddenSig.set(['C']);
    expect(e.isHidden('C')).toBe(true);
    expect(e.visibleKeys()).toEqual(['A', 'B']);
  });

  it('ignores a key that is not a series', () => {
    const { e, hiddenSig } = make();
    expect(e.toggle('Z')).toBe(false);
    expect(hiddenSig()).toEqual([]);
  });
});

describe('createSeriesEmphasis — the legend toolbar', () => {
  function toolbar(e: SvSeriesEmphasis, n: number): HTMLElement {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'toolbar');
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.setAttribute('data-sv-series-index', String(i));
      b.addEventListener('focus', () => e.focusEntry(i));
      // Bound per button, as the chart templates do (a focusable element).
      b.addEventListener('keydown', (ev) => e.onLegendKeydown(ev));
      bar.appendChild(b);
    }
    document.body.appendChild(bar);
    return bar;
  }
  const press = (bar: HTMLElement, key: string) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? bar).dispatchEvent(ev);
    return ev;
  };

  it('has one tab stop, on the first entry by default', () => {
    const { e } = make();
    expect([0, 1, 2].map((i) => e.tabIndex(i))).toEqual([0, -1, -1]);
  });

  it('moves the tab stop and focus with the arrow keys, wrapping, and isolates each entry it lands on', () => {
    const { e } = make();
    const bar = toolbar(e, 3);
    (bar.children[0] as HTMLElement).focus();
    expect(press(bar, 'ArrowRight').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(bar.children[1]);
    expect(e.tabIndex(1)).toBe(0);
    expect(e.emphasized()).toBe('B');
    press(bar, 'ArrowDown');
    press(bar, 'ArrowRight');
    expect(document.activeElement).toBe(bar.children[0]);
    press(bar, 'ArrowLeft');
    expect(document.activeElement).toBe(bar.children[2]);
    press(bar, 'Home');
    expect(document.activeElement).toBe(bar.children[0]);
    press(bar, 'End');
    expect(document.activeElement).toBe(bar.children[2]);
    expect(e.emphasized()).toBe('C');
    bar.remove();
  });

  it('leaves other keys alone — Enter and Space belong to the button', () => {
    const { e } = make();
    const bar = toolbar(e, 3);
    (bar.children[0] as HTMLElement).focus();
    expect(press(bar, 'Enter').defaultPrevented).toBe(false);
    expect(press(bar, ' ').defaultPrevented).toBe(false);
    bar.remove();
  });

  it('keeps the tab stop inside the legend when series are removed', () => {
    const { e, keySig } = make();
    e.focusEntry(2);
    keySig.set(['A']);
    expect(e.activeIndex()).toBe(0);
    expect(e.tabIndex(0)).toBe(0);
  });

  it('exposes the toolbar name and hint from the core labels', () => {
    const { e } = make();
    expect(e.legendLabel).toBe('Series');
    expect(e.legendHint).toContain('Arrow keys');
  });
});
