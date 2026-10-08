import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ICON_REGISTRY } from '@styloviz/icons';
import { SvChipComponent } from './chip.component';

/**
 * A chip is a `<span>`, so everything that makes it operable is opt-in: the
 * role, the tab stop, the keys. The two things worth pinning are that a plain
 * decorative chip claims none of it — an unselectable `role="checkbox"` is a
 * promise to a screen-reader user that nothing keeps — and that dismissing a
 * selectable chip dismisses it rather than also selecting it on the way out.
 */

async function setup(inputs: Partial<ComponentInput<SvChipComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvChipComponent, {
    inputs: { label: 'Design', ...inputs } as ComponentInput<SvChipComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const root = (f: { nativeElement: unknown }) => el(f).firstElementChild as HTMLElement;

/** Dispatch a real key event so `defaultPrevented` can be read back. */
function press(target: HTMLElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

describe('SvChipComponent — a plain chip claims nothing', () => {
  it('renders the label', async () => {
    const { fixture } = await setup();
    expect(root(fixture).textContent?.trim()).toBe('Design');
  });

  it('has no role, no tab stop and no checked state', async () => {
    const { fixture } = await setup();
    const r = root(fixture);
    expect(r.getAttribute('role')).toBeNull();
    expect(r.getAttribute('tabindex')).toBeNull();
    expect(r.getAttribute('aria-checked')).toBeNull();
  });

  it('ignores a click', async () => {
    const { fixture } = await setup();
    await userEvent.click(root(fixture));
    expect(fixture.componentInstance.selected()).toBe(false);
  });
});

describe('SvChipComponent — selectable', () => {
  it('is a checkbox in the tab order', async () => {
    const { fixture } = await setup({ selectable: true });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBe('checkbox');
    expect(r.getAttribute('aria-checked')).toBe('false');
    expect(r.getAttribute('tabindex')).toBe('0');
  });

  it('toggles on click and reports once', async () => {
    const seen: boolean[] = [];
    const { fixture } = await setup({ selectable: true });
    fixture.componentInstance.selected.subscribe((v) => seen.push(v));

    await userEvent.click(root(fixture));
    expect(fixture.componentInstance.selected()).toBe(true);
    expect(root(fixture).getAttribute('aria-checked')).toBe('true');

    await userEvent.click(root(fixture));
    expect(seen).toEqual([true, false]);
  });

  it('toggles on Space, and swallows the key so the page does not scroll', async () => {
    const { fixture } = await setup({ selectable: true });
    const ev = press(root(fixture), ' ');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('toggles on Enter', async () => {
    const { fixture } = await setup({ selectable: true });
    const ev = press(root(fixture), 'Enter');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('accepts a starting state from the host', async () => {
    const { fixture } = await setup({ selectable: true, selected: true });
    expect(root(fixture).getAttribute('aria-checked')).toBe('true');
  });

  it('shows a checkmark only once selected', async () => {
    const { fixture } = await setup({ selectable: true });
    expect(el(fixture).querySelectorAll('svg').length).toBe(0);

    fixture.componentInstance.selected.set(true);
    fixture.detectChanges();
    expect(el(fixture).querySelectorAll('svg').length).toBe(1);
  });

  it('names itself for a screen reader', async () => {
    const { fixture } = await setup({ selectable: true, ariaLabel: 'Filter by design' });
    expect(root(fixture).getAttribute('aria-label')).toBe('Filter by design');
  });

  it('falls back to the visible label as its name', async () => {
    const { fixture } = await setup({ selectable: true });
    expect(root(fixture).getAttribute('aria-label')).toBe('Design');
  });
});

describe('SvChipComponent — disabled', () => {
  it('says so, and leaves the tab order', async () => {
    const { fixture } = await setup({ selectable: true, disabled: true });
    const r = root(fixture);
    expect(r.getAttribute('aria-disabled')).toBe('true');
    expect(r.getAttribute('tabindex')).toBeNull();
  });

  it('does not toggle on click or on a key', async () => {
    const { fixture } = await setup({ selectable: true, disabled: true });
    await userEvent.click(root(fixture));
    press(root(fixture), 'Enter');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(false);
  });
});

describe('SvChipComponent — removable', () => {
  it('offers a named dismiss button', async () => {
    await setup({ removable: true });
    expect(screen.getByRole('button', { name: 'Remove Design' })).toBeTruthy();
  });

  it('names the dismiss button by the accessible label when there is no text', async () => {
    await setup({ label: '', avatarInitials: 'SH', removable: true, ariaLabel: 'Sazzad' });
    expect(screen.getByRole('button', { name: 'Remove Sazzad' })).toBeTruthy();
  });

  it('reports removal once', async () => {
    let removals = 0;
    const { fixture } = await setup({ removable: true });
    fixture.componentInstance.removed.subscribe(() => { removals += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Design' }));
    expect(removals).toBe(1);
  });

  it('dismisses without also selecting', async () => {
    // The dismiss button sits inside the chip's own click target. Without the
    // stopPropagation, removing a chip would flip its selection on the way out
    // and the host would get a selectedChange for a chip it is deleting.
    const seen: boolean[] = [];
    const { fixture } = await setup({ removable: true, selectable: true });
    fixture.componentInstance.selected.subscribe((v) => seen.push(v));

    await userEvent.click(screen.getByRole('button', { name: 'Remove Design' }));
    expect(fixture.componentInstance.selected()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('refuses to dismiss while disabled', async () => {
    let removals = 0;
    const { fixture } = await setup({ removable: true, disabled: true });
    fixture.componentInstance.removed.subscribe(() => { removals += 1; });

    const button = screen.getByRole('button', { name: 'Remove Design' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fixture.componentInstance.onRemove(new MouseEvent('click'));
    expect(removals).toBe(0);
  });

  it('has no dismiss button unless asked for one', async () => {
    await setup();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SvChipComponent — leading media', () => {
  it('renders an avatar with the label as its alt text', async () => {
    const { fixture } = await setup({ avatarSrc: 'https://example.test/a.png' });
    const img = el(fixture).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.test/a.png');
    expect(img.getAttribute('alt')).toBe('Design');
  });

  it('falls back to initials', async () => {
    const { fixture } = await setup({ avatarInitials: 'SH' });
    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).textContent).toContain('SH');
  });

  /**
   * `icon` used to be `iconPath` — a raw `<path d="…">` the template piped
   * straight into an inline `<svg>`. It is a library NAME now, so the check is
   * that the name resolved: the rendered geometry has to be the registry's,
   * not whatever string was passed.
   */
  it('falls back to an icon last, drawn from the library', async () => {
    const { fixture } = await setup({ icon: 'star' });
    const host = el(fixture);
    expect(host.querySelector('sv-icon')).toBeTruthy();
    const expected = (ICON_REGISTRY.star[0] as { d?: string }).d;
    expect(host.querySelector('path')?.getAttribute('d')).toBe(expected);
  });

  it('draws no glyph by hand', async () => {
    const { fixture } = await setup({ icon: 'star', removable: true });
    const svgs = [...el(fixture).querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('shows one piece of media, not three', async () => {
    const { fixture } = await setup({
      avatarSrc: 'https://example.test/a.png',
      avatarInitials: 'SH',
      icon: 'star',
    });
    expect(el(fixture).querySelectorAll('img').length).toBe(1);
    expect(el(fixture).querySelector('path')).toBeNull();
    expect(el(fixture).textContent).not.toContain('SH');
  });
});

describe('SvChipComponent — appearance', () => {
  it('scales every part together', async () => {
    const { fixture } = await setup({ size: 'lg' });
    const c = fixture.componentInstance;
    expect(c.sizeClasses()).toContain('h-8');
    expect(c.avatarSize()).toContain('h-5');
    expect(c.iconSize()).toContain('h-3.5');
  });

  it('adds the active colour only when selected', async () => {
    const { fixture } = await setup({ selectable: true, variant: 'primary', chipStyle: 'filled' });
    expect(fixture.componentInstance.rootClasses()).not.toContain('bg-primary-700');

    fixture.componentInstance.selected.set(true);
    expect(fixture.componentInstance.rootClasses()).toContain('bg-primary-700');
  });

  it('offers a pointer only when there is something to click', async () => {
    const { fixture: plain } = await setup();
    expect(plain.componentInstance.rootClasses()).not.toContain('cursor-pointer');

    const { fixture: live } = await setup({ selectable: true });
    expect(live.componentInstance.rootClasses()).toContain('cursor-pointer');
  });
});
