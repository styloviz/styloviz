import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { ICON_REGISTRY } from '@styloviz/icons';
import userEvent from '@testing-library/user-event';
import { SvEmptyStateComponent } from './empty-state.component';

async function setup(inputs: Record<string, unknown> = {}) {
  // ★ Without this, the SECOND render in a single test throws "Cannot configure
  // the test module when the test module has already been instantiated" — and
  // the "every preset resolves" guard below renders twelve times.
  TestBed.resetTestingModule();
  const { fixture } = await render(SvEmptyStateComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvEmptyStateComponent — icon resolution', () => {
  it('resolves a preset icon to a library name', async () => {
    const c = await setup({ icon: 'inbox' });
    expect(c.resolvedIconName()).toBe('inbox');
  });

  it('uses the custom icon name when icon is "custom"', async () => {
    const c = await setup({ icon: 'custom', customIcon: 'star' });
    expect(c.resolvedIconName()).toBe('star');
  });

  /** Every preset must resolve, or a documented option renders a blank box. */
  it('gives every preset a resolvable name', async () => {
    for (const p of ['inbox','search','folder','users','chart','document',
                     'notification','cart','filter','star','lock','error'] as const) {
      const c = await setup({ icon: p });
      const n = c.resolvedIconName();
      expect(n, p).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ICON_REGISTRY[n as keyof typeof ICON_REGISTRY], p).toBeTruthy();
    }
  });
});

describe('SvEmptyStateComponent — rendering', () => {
  it('renders the title and message text', async () => {
    await setup({ title: 'No results', message: 'Try a different search.' });
    expect(screen.getByText('No results')).toBeTruthy();
    expect(screen.getByText('Try a different search.')).toBeTruthy();
  });

  it('emits actionClick with the action id when its button is clicked', async () => {
    const spy = vi.fn();
    const c = await setup({ actions: [{ id: 'create', label: 'Create' }] });
    c.actionClick.subscribe(spy);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(spy).toHaveBeenCalledWith('create');
  });
});
