import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction, ToolbarGroup } from './toolbar.component';
import { quietFor, until } from '../../../../src/testing/async';

/**
 * The toolbar has two kinds of button that look identical and behave nothing
 * alike: a plain action, which flashes and forgets, and a toggle, which latches
 * into `activeIds` and stays there. Everything below is about keeping those two
 * apart, and about the states where a click must do nothing at all.
 */

const plain: ToolbarAction[] = [
  { id: 'save', label: 'Save', icon: 'save' },
  { id: 'publish', label: 'Publish', icon: 'upload' },
];

const withToggles: ToolbarAction[] = [
  { id: 'bold', label: 'Bold', icon: 'b', toggle: true },
  { id: 'italic', label: 'Italic', icon: 'i', toggle: true },
  { id: 'save', label: 'Save', icon: 'save' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToolbarComponent, { inputs: { actions: plain, ...inputs } });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const btn = (f: { nativeElement: unknown }, id: string) =>
  el(f).querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`);

describe('SvToolbarComponent — toggles vs plain actions', () => {
  it('latches a toggle on, and the second click takes it off again', async () => {
    const f = await setup({ actions: withToggles });
    const c = f.componentInstance;

    c.click(withToggles[0]);
    expect([...c.activeIds()]).toEqual(['bold']);
    expect(c.isActive(withToggles[0])).toBe(true);

    c.click(withToggles[0]);
    expect([...c.activeIds()]).toEqual([]);
    expect(c.isActive(withToggles[0])).toBe(false);
  });

  /** Toggling one must not clear the others — a formatting bar holds several at once. */
  it('keeps the other toggles alone', async () => {
    const f = await setup({ actions: withToggles });
    const c = f.componentInstance;

    c.click(withToggles[0]);
    c.click(withToggles[1]);
    expect([...c.activeIds()].sort()).toEqual(['bold', 'italic']);

    c.click(withToggles[0]);
    expect([...c.activeIds()]).toEqual(['italic']);
  });

  it('accepts a pre-seeded active set from the host', async () => {
    const f = await setup({ actions: withToggles, activeIds: new Set(['italic']) });
    expect(f.componentInstance.isActive(withToggles[1])).toBe(true);
    expect(f.componentInstance.isActive(withToggles[0])).toBe(false);
  });

  it('exposes aria-pressed on toggles only', async () => {
    const f = await setup({ actions: withToggles, activeIds: new Set(['bold']) });
    expect(btn(f, 'bold')?.getAttribute('aria-pressed')).toBe('true');
    expect(btn(f, 'italic')?.getAttribute('aria-pressed')).toBe('false');
    // A plain action is not a toggle, so it must not claim a pressed state.
    expect(btn(f, 'save')?.getAttribute('aria-pressed')).toBeNull();
  });

  /** A plain action flashes "pressed" and clears itself; a toggle would not. */
  it('flashes a plain action briefly and then releases it', async () => {
    const f = await setup();
    const c = f.componentInstance;

    c.click(plain[0]);
    expect(c.isActive(plain[0])).toBe(true);
    expect(c.isActive(plain[1])).toBe(false);

    await until(() => !c.isActive(plain[0]), { label: 'the pressed flash to clear' });
  });

  /** Clicking again mid-flash must restart the timer, not leave the first one to fire early. */
  it('restarts the flash when the same action is clicked again', async () => {
    const f = await setup();
    const c = f.componentInstance;

    c.click(plain[0]);
    c.click(plain[0]);
    expect(c.isActive(plain[0])).toBe(true);
    await until(() => !c.isActive(plain[0]), { label: 'the restarted flash to clear' });
  });

  /**
   * ★ REGRESSION TEST — PHASE3_LAYOUT_UTILITIES_AUDIT.md finding #1 (backlog
   * `X-1` / `X-3`): the pressed-flash timer used to survive `ngOnDestroy` and
   * write to a destroyed component's signal. The assertion below is what
   * proves the clear: had the 150ms timer fired, `isActive` would read false.
   */
  it('regression: never leaves a flash timer running past destruction (audit finding #1)', async () => {
    const f = await setup();
    f.componentInstance.click(plain[0]);
    f.destroy();
    // Nothing to assert beyond "no unhandled work" — the point is ngOnDestroy's
    // clearTimeout branch runs with a live timer rather than a null one.
    await quietFor(200);
    expect(f.componentInstance.isActive(plain[0])).toBe(true);
  });

  it('emits the id for both kinds of button', async () => {
    const f = await setup({ actions: withToggles });
    const fired: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => fired.push(id));

    f.componentInstance.click(withToggles[0]);
    f.componentInstance.click(withToggles[2]);
    expect(fired).toEqual(['bold', 'save']);
  });
});

describe('SvToolbarComponent — clicks that must not land', () => {
  it('swallows a click on a disabled action', async () => {
    const disabled: ToolbarAction[] = [{ id: 'del', label: 'Delete', icon: 'x', disabled: true }];
    const f = await setup({ actions: disabled });
    const fired: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => fired.push(id));

    f.componentInstance.click(disabled[0]);
    expect(fired).toEqual([]);
  });

  /** A disabled TOGGLE must not latch either — the guard runs before the toggle branch. */
  it('does not latch a disabled toggle', async () => {
    const a: ToolbarAction[] = [{ id: 'bold', label: 'Bold', icon: 'b', toggle: true, disabled: true }];
    const f = await setup({ actions: a });
    f.componentInstance.click(a[0]);
    expect([...f.componentInstance.activeIds()]).toEqual([]);
  });

  /** A toggle whose write is still in flight must not flip optimistically twice. */
  it('does not toggle an action that is still in flight', async () => {
    const f = await setup({ actions: withToggles, busyIds: ['bold'] });
    f.componentInstance.click(withToggles[0]);
    expect([...f.componentInstance.activeIds()]).toEqual([]);
  });

  it('renders the real button through the DOM too, not just the method', async () => {
    const f = await setup({ actions: withToggles });
    const fired: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => fired.push(id));
    const bold = btn(f, 'bold');
    expect(bold).toBeTruthy();
    await userEvent.click(bold as HTMLButtonElement);
    expect(fired).toEqual(['bold']);
    expect(btn(f, 'bold')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('SvToolbarComponent — where the actions come from', () => {
  const groups: ToolbarGroup[] = [
    { id: 'file', actions: [{ id: 'save', label: 'Save', icon: 's' }] },
    { id: 'edit', actions: [{ id: 'undo', label: 'Undo', icon: 'u' }] },
  ];

  it('prefers the flat list when one is given', async () => {
    const f = await setup({ actions: plain, groups });
    expect(f.componentInstance.allActions().map((g) => g.id)).toEqual(['default']);
    expect(f.componentInstance.flatActions().map((a) => a.id)).toEqual(['save', 'publish']);
  });

  /** The untaken branch: an EMPTY flat list has to fall through to `groups`. */
  it('falls back to the groups when the flat list is empty', async () => {
    const f = await setup({ actions: [], groups });
    expect(f.componentInstance.allActions().map((g) => g.id)).toEqual(['file', 'edit']);
    expect(f.componentInstance.flatActions().map((a) => a.id)).toEqual(['save', 'undo']);
  });

  it('draws a separator between groups but not after the last one', async () => {
    const f = await setup({ actions: [], groups });
    expect(el(f).querySelectorAll('[role="separator"]').length).toBe(1);
  });

  it('draws a separator after an action that asks for one', async () => {
    const f = await setup({
      actions: [{ id: 'a', label: 'A', icon: 'a', dividerAfter: true }, { id: 'b', label: 'B', icon: 'b' }],
    });
    expect(el(f).querySelectorAll('[role="separator"]').length).toBe(1);
  });

  it('renders an empty toolbar when given neither', async () => {
    const f = await setup({ actions: [], groups: [] });
    expect(f.componentInstance.flatActions()).toEqual([]);
    expect(el(f).querySelectorAll('[data-action-id]').length).toBe(0);
  });
});
