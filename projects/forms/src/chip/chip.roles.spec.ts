import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvChipComponent } from './chip.component';

/**
 * `FI-07-I1` / `FI-07-M1` — four jobs, one component.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * ★★★ THE ONLY WAY TO PICK A ROLE WAS A STYLING FLAG. `selectable` decided
 *     whether a chip announced as a checkbox, so:
 *
 *     • "Add label" — a chip that DOES something — had to be marked selectable
 *       to become clickable at all, and then announced as a checkbox that never
 *       checks. There was no output to listen to either: `removed` and
 *       `selectedChange` were the entire surface.
 *     • An "Overdue" badge and a "Frontend" filter, which mean entirely
 *       different things, presented identically to a screen reader.
 *     • An icon-only chip that was not selectable had NO ACCESSIBLE NAME. The
 *       `ariaLabel` input existed and was documented as required for exactly
 *       that case, and the template only applied it when `selectable` was set.
 *
 * ── Why `'auto'` is the default ─────────────────────────────────────────────
 *
 * Every existing usage in the kit states `selectable` / `removable` and nothing
 * else. `'auto'` resolves those the way the component always behaved, so naming
 * the role is opt-in and no caller changes meaning underneath.
 */

async function setup(inputs: Partial<ComponentInput<SvChipComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvChipComponent, {
    inputs: { label: 'Design', ...inputs } as ComponentInput<SvChipComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const root = (f: { nativeElement: unknown }) => el(f).firstElementChild as HTMLElement;
const press = (t: HTMLElement, key: string) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  t.dispatchEvent(ev);
  return ev;
};

describe('SvChipComponent — auto keeps every existing caller where it was', () => {
  it('a selectable chip is still a checkbox', async () => {
    const { fixture } = await setup({ selectable: true });
    expect(fixture.componentInstance.resolvedRole()).toBe('filter');
    expect(root(fixture).getAttribute('role')).toBe('checkbox');
    expect(root(fixture).getAttribute('aria-checked')).toBe('false');
  });

  it('a removable chip is a token, with no role on the body', async () => {
    const { fixture } = await setup({ removable: true });
    expect(fixture.componentInstance.resolvedRole()).toBe('token');
    expect(root(fixture).getAttribute('role')).toBeNull();
  });

  it('a plain chip is a status chip, and still claims nothing', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.resolvedRole()).toBe('status');
    expect(root(fixture).getAttribute('role')).toBeNull();
    expect(root(fixture).getAttribute('tabindex')).toBeNull();
  });

  it('selectable wins over removable — a dismissible filter is still a filter', async () => {
    const { fixture } = await setup({ selectable: true, removable: true });
    expect(fixture.componentInstance.resolvedRole()).toBe('filter');
  });
});

describe('SvChipComponent — action: the role that could not be built', () => {
  it('is a button, not a checkbox', async () => {
    const { fixture } = await setup({ chipRole: 'action' });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBe('button');
    expect(r.getAttribute('aria-checked')).toBeNull();
    expect(r.getAttribute('tabindex')).toBe('0');
  });

  it('emits activated on click, and carries no selection state', async () => {
    let fired = 0;
    const { fixture } = await render(SvChipComponent, {
      inputs: { label: 'Add label', chipRole: 'action' } as ComponentInput<SvChipComponent>,
      on: { activated: () => { fired++; } },
    });
    root(fixture).click();
    expect(fired).toBe(1);
    // ★ The whole point: "Add label" must not acquire a checked appearance.
    expect(fixture.componentInstance.selected()).toBe(false);
  });

  it('activates from Enter and Space', async () => {
    let fired = 0;
    const { fixture } = await render(SvChipComponent, {
      inputs: { label: 'Add label', chipRole: 'action' } as ComponentInput<SvChipComponent>,
      on: { activated: () => { fired++; } },
    });
    const r = root(fixture);
    press(r, 'Enter');
    press(r, ' ');
    expect(fired).toBe(2);
  });

  it('stays silent when disabled', async () => {
    let fired = 0;
    const { fixture } = await render(SvChipComponent, {
      inputs: { label: 'Add label', chipRole: 'action', disabled: true } as ComponentInput<SvChipComponent>,
      on: { activated: () => { fired++; } },
    });
    root(fixture).click();
    expect(fired).toBe(0);
    expect(root(fixture).getAttribute('tabindex')).toBeNull();
  });
});

describe('SvChipComponent — stating status overrides a styling flag', () => {
  it('refuses to announce as a checkbox even when selectable is set', async () => {
    // Somebody wanted the hover treatment and reached for `selectable`. A badge
    // that announces as a checkbox is a promise to a screen-reader user that
    // nothing in the page keeps.
    const { fixture } = await setup({ chipRole: 'status', selectable: true });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBeNull();
    expect(r.getAttribute('aria-checked')).toBeNull();
    expect(r.getAttribute('tabindex')).toBeNull();
  });

  it('does not toggle on click either', async () => {
    const { fixture } = await setup({ chipRole: 'status', selectable: true });
    root(fixture).click();
    expect(fixture.componentInstance.selected()).toBe(false);
  });
});

describe('SvChipComponent — saying what kind of thing this is', () => {
  it('prefixes a roleless chip with the category, as real text', async () => {
    // `aria-label` on a bare <span> is not reliably announced, so the category
    // is rendered sr-only rather than asserted into an attribute nobody reads.
    const { fixture } = await setup({ chipRole: 'status', categoryLabel: 'Status', label: 'Overdue' });
    const sr = root(fixture).querySelector('.sr-only');
    expect(sr?.textContent).toBe('Status: ');
    expect(root(fixture).textContent).toContain('Overdue');
  });

  it('folds the category into the name of a chip that has a role', async () => {
    const { fixture } = await setup({ selectable: true, categoryLabel: 'Filter', label: 'Frontend' });
    expect(root(fixture).getAttribute('aria-label')).toBe('Filter: Frontend');
    // Not doubled up: a roled chip takes its name from aria-label.
    expect(root(fixture).querySelector('.sr-only')).toBeNull();
  });

  it('leaves an explicit ariaLabel alone — the host stated the whole name', async () => {
    const { fixture } = await setup({ selectable: true, categoryLabel: 'Filter', ariaLabel: 'Frontend work' });
    expect(root(fixture).getAttribute('aria-label')).toBe('Frontend work');
  });

  it('adds no prefix by default, so a skills list is not read as statuses', async () => {
    const { fixture } = await setup({ label: 'Angular' });
    expect(root(fixture).querySelector('.sr-only')).toBeNull();
    expect(root(fixture).textContent?.trim()).toBe('Angular');
  });

  it('names an icon-only status chip, which previously had no name at all', async () => {
    const { fixture } = await setup({ label: '', ariaLabel: 'Starred', icon: 'star' });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBeNull();
    expect(r.querySelector('.sr-only')?.textContent).toBe('Starred');
  });

  it('still names an icon-only filter chip through aria-label', async () => {
    const { fixture } = await setup({ label: '', ariaLabel: 'Starred', icon: 'star', selectable: true });
    expect(root(fixture).getAttribute('aria-label')).toBe('Starred');
  });
});
