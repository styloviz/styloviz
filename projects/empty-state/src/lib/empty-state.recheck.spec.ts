import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvEmptyStateComponent } from './empty-state.component';
import type { EmptyStateAction } from './empty-state.component';

/**
 * `OF-07-I1` / `OF-07-I2` / `OF-07-M1` — re-verification.
 *
 * ★★★ FIVE CAUSES, FIVE PRESENTATIONS. First-use, no-results, no-access,
 *     error and offline each get their own sentence, glyph, accessible name
 *     and next action — and with a filter active there is exactly one
 *     primary action on the page: clearing it.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvEmptyStateComponent, { inputs });
  const host = view.fixture.nativeElement as HTMLElement;
  return {
    ...view,
    component: view.fixture.componentInstance,
    host,
    title: () => host.querySelector('h3')?.textContent?.trim() ?? '',
    iconName: () => view.fixture.componentInstance.resolvedIconName(),
    clearBtn: () => host.querySelector('[data-sv-clear-filters]') as HTMLButtonElement | null,
    retryBtn: () => host.querySelector('[data-sv-empty-retry]') as HTMLButtonElement | null,
    hostButtons: () =>
      Array.from(host.querySelectorAll('button')).filter(
        b => !b.hasAttribute('data-sv-clear-filters') && !b.hasAttribute('data-sv-empty-retry'),
      ),
    primaries: () => Array.from(host.querySelectorAll('button')).filter(b => b.className.includes('bg-primary-600')),
  };
}

const actions: EmptyStateAction[] = [
  { id: 'new', label: 'New invoice' },
  { id: 'import', label: 'Import' },
];

describe('SvEmptyStateComponent — every cause is rendered differently (OF-07-I1, OF-07-M1)', () => {
  it('★ gives the five causes five distinct titles and glyphs', async () => {
    const cases: Record<string, unknown>[] = [
      {},
      { reason: 'no-results' },
      { reason: 'no-access' },
      { reason: 'error' },
      { offline: true },
    ];
    const titles: string[] = [];
    const icons: string[] = [];
    for (const inputs of cases) {
      const v = await setup(inputs);
      titles.push(v.title());
      icons.push(v.iconName());
    }
    expect(new Set(titles).size).toBe(5);
    expect(new Set(icons).size).toBe(5);
    expect(titles[4]).toBe('You are offline');
    // No cause but first-use draws the cheerful inbox.
    expect(icons.filter(i => i === 'inbox')).toHaveLength(1);
  });

  it('★ names the region after the title it ACTUALLY shows, not an empty input', async () => {
    // The region was labelled from the raw `title` input, so every preset that
    // supplied its own heading produced an unnamed region.
    await setup({ reason: 'no-access' });
    expect(screen.getByRole('region', { name: 'You do not have access' })).toBeTruthy();
  });

  it('offline wins over the stated reason, and a host title still wins over offline', async () => {
    const v = await setup({ offline: true, reason: 'error' });
    expect(v.title()).toBe('You are offline');
    const w = await setup({ offline: true, title: 'Orders unavailable offline' });
    expect(w.title()).toBe('Orders unavailable offline');
  });

  it('★ offers the retry for error and offline only, and only when labelled', async () => {
    expect((await setup({ reason: 'error' })).retryBtn()).toBeNull();

    const error = await setup({ reason: 'error', retryLabel: 'Try again' });
    let retries = 0;
    error.component.retry.subscribe(() => retries++);
    error.retryBtn()!.click();
    expect(retries).toBe(1);

    expect((await setup({ offline: true, retryLabel: 'Try again' })).retryBtn()).not.toBeNull();
    expect((await setup({ reason: 'no-access', retryLabel: 'Try again' })).retryBtn()).toBeNull();
    expect((await setup({ retryLabel: 'Try again' })).retryBtn()).toBeNull();
  });

  it('the retry leads, and the host actions step down behind it', async () => {
    const v = await setup({ reason: 'error', retryLabel: 'Try again', actions });
    expect(v.primaries()).toEqual([v.retryBtn()]);
    expect(v.hostButtons().every(b => !b.className.includes('bg-primary-600'))).toBe(true);
  });
});

describe('SvEmptyStateComponent — a filtered-zero state has ONE primary action (OF-07-I2)', () => {
  it('★ makes "Clear filters" the primary and demotes "New invoice"', async () => {
    const v = await setup({ activeFilters: ['Status: Archived'], actions });
    expect(v.primaries()).toEqual([v.clearBtn()]);
    expect(v.component.resolvedActions().map(a => a.resolvedStyle)).toEqual(['secondary', 'secondary']);
  });

  it('demotes a host action that STATED primary, too — the page gets one', async () => {
    const v = await setup({
      activeFilters: ['Owner: Dana'],
      actions: [{ id: 'new', label: 'New', style: 'primary' }, { id: 'learn', label: 'Learn', style: 'ghost' }],
    });
    expect(v.component.resolvedActions().map(a => a.resolvedStyle)).toEqual(['secondary', 'ghost']);
    expect(v.primaries()).toHaveLength(1);
  });

  it('leaves the host hierarchy alone when there is nothing to clear', async () => {
    const unfiltered = await setup({ actions });
    expect(unfiltered.component.resolvedActions()[0].resolvedStyle).toBe('primary');

    // Filters shown but the clear button suppressed: the host keeps its primary.
    const noClear = await setup({ activeFilters: ['Owner: Dana'], clearFiltersLabel: null, actions });
    expect(noClear.component.resolvedActions()[0].resolvedStyle).toBe('primary');
  });
});
