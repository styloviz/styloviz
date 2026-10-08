import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction } from './toolbar.component';

const actions: ToolbarAction[] = [
  { id: 'save', label: 'Save', icon: 'save' },
  { id: 'publish', label: 'Publish', icon: 'upload' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToolbarComponent, { inputs: { actions, ...inputs } });
  return fixture;
}

describe('SvToolbarComponent — actions that hit the server', () => {
  it('reports a busy action from either a Set or an array', async () => {
    const fromArray = await setup({ busyIds: ['save'] });
    expect(fromArray.componentInstance.isBusy('save')).toBe(true);
    expect(fromArray.componentInstance.isBusy('publish')).toBe(false);

    const fromSet = await setup({ busyIds: new Set(['publish']) });
    expect(fromSet.componentInstance.isBusy('publish')).toBe(true);
  });

  /** A second click while the first request runs is how duplicate records happen. */
  it('swallows a click on an action already in flight', async () => {
    const f = await setup({ busyIds: ['save'] });
    const fired: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => fired.push(id));

    f.componentInstance.click(actions[0]);
    expect(fired).toEqual([]);

    f.componentInstance.click(actions[1]);
    expect(fired).toEqual(['publish']);
  });

  it('marks the busy control for assistive tech', async () => {
    const f = await setup({ busyIds: ['save'] });
    expect(f.nativeElement.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it('shows an action failure without removing anything from view', async () => {
    const f = await setup({ error: 'Publish failed' });
    expect(f.nativeElement.querySelector('[data-sv-state="error"]')?.textContent)
      .toContain('Publish failed');
    // The toolbar renders icon buttons, so the label lives on aria-label.
    expect(f.nativeElement.querySelector('[aria-label="Save"]')).toBeTruthy();
  });

  /** The action is re-run by clicking it again; a dead "Try again" is worse than none. */
  it('offers no retry button it cannot honour', async () => {
    const f = await setup({ error: 'Publish failed' });
    const strip = f.nativeElement.querySelector('[data-sv-state="error"]');
    expect(strip?.querySelector('button')).toBeNull();
  });

  it('reports whether anything is in flight', async () => {
    expect((await setup()).componentInstance.hasBusy()).toBe(false);
    expect((await setup({ busyIds: ['save'] })).componentInstance.hasBusy()).toBe(true);
  });
});
