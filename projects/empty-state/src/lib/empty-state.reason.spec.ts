import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvEmptyStateComponent } from './empty-state.component';
import type { EmptyStateAction } from './empty-state.component';

/**
 * `OF-07-I5` / `OF-07-I2` / `OF-07-M2` — an empty state that says WHY.
 *
 * ★★★ "NOTHING HERE YET" WHEN THE USER HAS FILTERED IS A LIE THAT READS AS A
 *     BUG. It tells a customer with four thousand orders that they have none
 *     because they mistyped a search term — and the cheerful inbox glyph above
 *     it agrees. "No orders" and "no orders MATCHING THESE FILTERS" are
 *     different facts, and `sv-empty-shell` in core has drawn that distinction
 *     for a while; this is the full-page treatment catching up.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvEmptyStateComponent, { inputs });
  const host = view.fixture.nativeElement as HTMLElement;
  return {
    ...view,
    component: view.fixture.componentInstance,
    host,
    title: () => (host.querySelector('h3') as HTMLElement).textContent?.trim(),
    message: () => (host.querySelector('p') as HTMLElement | null)?.textContent?.trim() ?? null,
    filters: () => host.querySelector('[data-sv-active-filters]') as HTMLElement | null,
    clearBtn: () => host.querySelector('[data-sv-clear-filters]') as HTMLButtonElement | null,
    buttons: () =>
      Array.from(host.querySelectorAll('button')).filter(
        (b) => !b.hasAttribute('data-sv-clear-filters'),
      ),
  };
}

describe('SvEmptyStateComponent — copy that matches the reason', () => {
  it('keeps "Nothing here yet" for an unfiltered empty list', async () => {
    const view = await setup();
    expect(view.title()).toBe('Nothing here yet');
  });

  it('★ says "No matching results" when a filter is narrowing it', async () => {
    const view = await setup({ activeFilters: ['Status: Overdue'] });
    expect(view.title()).toBe('No matching results');
  });

  it('★ infers the reason from the filters, so the commonest mistake is impossible', async () => {
    // Requiring BOTH reason="no-results" and [activeFilters] would leave
    // "filters echoed under Nothing here yet" possible — which is the mistake
    // this item is about.
    const view = await setup({ activeFilters: ['Owner: Dana'] });
    expect(view.component.resolvedReason()).toBe('no-results');
  });

  it('respects an explicit reason over the inference', async () => {
    const view = await setup({ reason: 'no-access', activeFilters: ['Owner: Dana'] });
    expect(view.component.resolvedReason()).toBe('no-access');
    expect(view.title()).toBe('You do not have access');
  });

  it('has its own copy for an error and for no access', async () => {
    expect((await setup({ reason: 'error' })).title()).toBe('Could not load this');
    expect((await setup({ reason: 'no-access' })).title()).toBe('You do not have access');
  });

  it('a host title always wins', async () => {
    const view = await setup({ title: 'No invoices for March', activeFilters: ['Month: March'] });
    expect(view.title()).toBe('No invoices for March');
  });

  it('★ says nothing extra for a filtered list', async () => {
    // A generic "try adjusting your filters" above a list of the actual
    // filters is noise between the user and the fix.
    const view = await setup({ activeFilters: ['Status: Overdue'] });
    expect(view.component.resolvedMessage()).toBe('');
  });

  it('a host message always wins', async () => {
    const view = await setup({ reason: 'error', message: 'The report service is down.' });
    expect(view.message()).toBe('The report service is down.');
  });
});

describe('SvEmptyStateComponent — the glyph is part of the lie', () => {
  it('draws the inbox for an unfiltered empty list', async () => {
    const view = await setup();
    expect(view.component.resolvedIconName()).toBe('inbox');
  });

  it('★ draws a search glyph for a filtered one, not a cheerful inbox', async () => {
    const view = await setup({ activeFilters: ['Status: Overdue'] });
    expect(view.component.resolvedIconName()).toBe('search');
  });

  it('draws an alert for an error and a lock for no access', async () => {
    expect((await setup({ reason: 'error' })).component.resolvedIconName()).toBe('alert-circle');
    expect((await setup({ reason: 'no-access' })).component.resolvedIconName()).toBe('lock');
  });

  it('an explicitly chosen icon always wins', async () => {
    const view = await setup({ icon: 'cart', activeFilters: ['Status: Overdue'] });
    expect(view.component.resolvedIconName()).toBe('shopping-cart');
  });

  it('a custom icon still wins', async () => {
    const view = await setup({ icon: 'custom', customIcon: 'rocket', reason: 'error' });
    expect(view.component.resolvedIconName()).toBe('rocket');
  });
});

describe('SvEmptyStateComponent — the filters (OF-07-M2)', () => {
  it('★ echoes them, because the user cannot otherwise see why', async () => {
    const view = await setup({ activeFilters: ['Status: Overdue', 'Owner: Dana'] });
    const text = view.filters()?.textContent ?? '';
    expect(text).toContain('Status: Overdue');
    expect(text).toContain('Owner: Dana');
  });

  it('offers to clear them', async () => {
    const view = await setup({ activeFilters: ['Status: Overdue'] });
    const cleared: number[] = [];
    view.component.clearFilters.subscribe(() => cleared.push(1));
    view.clearBtn()?.click();
    expect(cleared).toHaveLength(1);
  });

  it('★ offers nothing to clear when nothing is filtered', async () => {
    const view = await setup();
    expect(view.filters()).toBeNull();
    expect(view.clearBtn()).toBeNull();
  });

  it('renders no clear button when the label is null', async () => {
    const view = await setup({ activeFilters: ['Status: Overdue'], clearFiltersLabel: null });
    expect(view.filters()).not.toBeNull();
    expect(view.clearBtn()).toBeNull();
  });
});

describe('SvEmptyStateComponent — action hierarchy (OF-07-I2)', () => {
  const actions: EmptyStateAction[] = [
    { id: 'new', label: 'New invoice' },
    { id: 'import', label: 'Import' },
    { id: 'learn', label: 'Learn more' },
  ];

  it('★ makes only the FIRST unstated action primary', async () => {
    // `action.style ?? 'primary'` made all three primary, which is no
    // hierarchy at all: the user reads all three to find the one the page
    // expects, and the page has told them nothing.
    const view = await setup({ actions });
    expect(view.component.resolvedActions().map((a) => a.resolvedStyle)).toEqual([
      'primary',
      'secondary',
      'secondary',
    ]);
  });

  it('honours a stated style, in any position', async () => {
    const view = await setup({
      actions: [
        { id: 'a', label: 'A', style: 'ghost' },
        { id: 'b', label: 'B', style: 'primary' },
      ] satisfies EmptyStateAction[],
    });
    expect(view.component.resolvedActions().map((a) => a.resolvedStyle)).toEqual([
      'ghost',
      'primary',
    ]);
  });

  it('renders the weights it resolved', async () => {
    const view = await setup({ actions });
    const classes = view.buttons().map((b) => b.className);
    // The primary treatment is a filled button; the secondary ones are not.
    expect(classes[0]).toContain('bg-primary-600');
    expect(classes[1]).not.toContain('bg-primary-600');
    expect(classes[2]).not.toContain('bg-primary-600');
  });

  it('a single action is primary', async () => {
    const view = await setup({ actions: [{ id: 'new', label: 'New invoice' }] });
    expect(view.component.resolvedActions()[0].resolvedStyle).toBe('primary');
  });

  it('no actions is no buttons', async () => {
    const view = await setup();
    expect(view.buttons()).toHaveLength(0);
  });
});
