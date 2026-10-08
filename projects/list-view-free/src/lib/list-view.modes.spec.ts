import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';

/**
 * ★ The Pro/free split lives here.
 *
 * `mode` is a preset switch, and the free tier honours only two of its values:
 * `checklist` and `virtualization`. `nested`, `grouped` and `scrolling` are Pro
 * presets — the *type* still accepts them, so the interesting assertion is the
 * negative: setting them here must leave the list flat, ungrouped and
 * unconstrained, rather than half-enabling a paid layout.
 *
 * The explicit `[nested]` / `[grouped]` inputs are free-tier features and keep
 * working; only the derivation from `mode` is withheld. The mirror of this file
 * is `projects/list-view/src/lib/list-view.modes.spec.ts`, which asserts the
 * presence of everything asserted absent below.
 */

const items = (): ListViewItem[] => [
  { id: 1, title: 'Alpha', group: 'Today', children: [{ id: 11, title: 'Alpha child' }] },
  { id: 2, title: 'Beta', group: 'Earlier' },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: items(), ...inputs },
  });
  return fixture;
}

describe('SvListViewComponent — presets derived from mode', () => {
  it('defaults every preset off', async () => {
    const c = (await setup()).componentInstance;
    expect([c.isCheckable(), c.isNested(), c.isGrouped(), c.isVirtualized(), c.isScrollingMode()]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('turns on checkboxes for mode="checklist"', async () => {
    const f = await setup({ mode: 'checklist' });
    expect(f.componentInstance.isCheckable()).toBe(true);
    expect(f.nativeElement.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('turns on windowing for mode="virtualization"', async () => {
    const f = await setup({ mode: 'virtualization' });
    expect(f.componentInstance.isVirtualized()).toBe(true);
  });
});

describe('SvListViewComponent — Pro-only presets stay off', () => {
  /** Pro derives the tree from mode="nested"; the free tier renders a flat list. */
  it('does not turn on the tree for mode="nested"', async () => {
    const f = await setup({ mode: 'nested' });
    const c = f.componentInstance;
    expect(c.isNested()).toBe(false);
    expect(c.flattenedNestedItems()).toEqual([]);
    expect(f.nativeElement.querySelector('button[aria-expanded]')).toBeNull();
    // …and the rows still render, flat — a withheld preset must not blank the list.
    expect(c.renderItems().map((i) => i.id)).toEqual([1, 2]);
  });

  /** Pro derives section headers from mode="grouped"; here the rows stay in one run. */
  it('does not turn on section headers for mode="grouped"', async () => {
    const f = await setup({ mode: 'grouped' });
    expect(f.componentInstance.isGrouped()).toBe(false);
    expect(f.componentInstance.groupedItems()).toEqual([]);
    expect(f.nativeElement.querySelector('section > header')).toBeNull();
    expect(f.componentInstance.renderItems().map((i) => i.id)).toEqual([1, 2]);
  });

  /** `isScrollingMode` is hard-wired false, so no mode value can fix the height. */
  it.each([['scrolling'], ['default'], ['checklist'], ['call-history']])(
    'never reports scrolling mode, not even for mode="%s"',
    async (mode) => {
      expect((await setup({ mode })).componentInstance.isScrollingMode()).toBe(false);
    },
  );

  it('caps rather than fixes the scroller height in mode="scrolling"', async () => {
    const f = await setup({ mode: 'scrolling', viewportHeight: 240 });
    const scroller = f.nativeElement.querySelector('.overflow-auto') as HTMLElement;
    expect(scroller.style.height).toBe('');
    expect(scroller.style.maxHeight).toBe('240px');
  });

  /** Pro shows the load-more footer for mode="scrolling" alone; here it needs
   *  `infiniteScroll`, which is the free tier's own opt-in. */
  it('needs infiniteScroll for the load-more footer', async () => {
    const withoutFlag = await setup({ mode: 'scrolling', hasMore: true });
    expect(withoutFlag.nativeElement.textContent).not.toContain('Scroll to load more');

    const withFlag = await setup({ infiniteScroll: true, hasMore: true });
    expect(withFlag.nativeElement.textContent).toContain('Scroll to load more');
  });

  /** The explicit inputs are not withheld — only the mode shorthand is. */
  it('still honours the explicit nested and grouped flags', async () => {
    const f = await setup({ nested: true, grouped: true, checkable: true, virtualized: true });
    const c = f.componentInstance;
    expect([c.isNested(), c.isGrouped(), c.isCheckable(), c.isVirtualized()]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(f.nativeElement.querySelector('button[aria-expanded="false"]')).toBeTruthy();
  });
});

describe('SvListViewComponent — search box', () => {
  /** `virtualization` opens the search box unasked; `scrolling` is Pro-only and
   *  in the free tier reveals nothing, so it must not open it either. */
  it('reveals the search box in virtualization mode without `searchable`', async () => {
    const f = await setup({ mode: 'virtualization' });
    expect(f.nativeElement.querySelector('input[type="search"]')).toBeTruthy();
  });

  it('hides the search box for the modes that do not imply one', async () => {
    for (const mode of ['grouped', 'nested', 'default']) {
      const f = await setup({ mode });
      expect(f.nativeElement.querySelector('input[type="search"]')).toBeNull();
    }
  });

  /**
   * ★ Defect regression. The free search box carried a placeholder and no
   * accessible name, so a screen reader announced it as an unlabelled edit
   * field. The Pro twin already had the label; this locks the parity.
   */
  it('names the search box after its placeholder', async () => {
    const f = await setup({ searchable: true, searchPlaceholder: 'Find an invoice' });
    const input = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.getAttribute('placeholder')).toBe('Find an invoice');
    expect(input.getAttribute('aria-label')).toBe('Find an invoice');
  });
});
