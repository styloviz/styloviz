import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvSelectDropdownComponent,
  type SelectOption,
} from './select-dropdown.component';

const OPTIONS = (): SelectOption[] => [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const portal = () => document.querySelector<HTMLElement>('.sv-sd-portal');

function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

const triggerOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;

/** Option rows live in the body portal, not under the host element. */
const rows = () => Array.from(portal()?.querySelectorAll('li[role="option"]') ?? []);

describe('SvSelectDropdownComponent — pointer highlight', () => {
  /**
   * Regression: the option rows used to publish their index in the RAW
   * navigable list while every keyboard path indexes the enabled-only list.
   * With a disabled option anywhere above, hovering row N highlighted row
   * N-(disabled before it) — and Enter then committed that wrong option.
   */
  it('hovering an option highlights that same option', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    sync(f);

    const gamma = rows().find((r) => r.textContent?.includes('Gamma'))!;
    gamma.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    sync(f);

    expect(f.componentInstance.activeOption()?.value).toBe('c');
    expect(gamma.getAttribute('data-active')).toBe('true');
  });

  /** Enter after a hover must commit the option the pointer was actually on. */
  it('Enter after a hover selects the hovered option', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    sync(f);

    rows().find((r) => r.textContent?.includes('Delta'))!
      .dispatchEvent(new MouseEvent('mouseenter'));
    sync(f);
    triggerOf(f).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
    );

    expect(f.componentInstance.value()).toBe('d');
  });

  /** A disabled option must never become the active option, by any route. */
  it('hovering a disabled option activates nothing', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    sync(f);

    rows().find((r) => r.textContent?.includes('Beta'))!
      .dispatchEvent(new MouseEvent('mouseenter'));
    sync(f);

    expect(f.componentInstance.activeOption()).toBeNull();
    expect(portal()!.querySelectorAll('[data-active="true"]')).toHaveLength(0);
  });

  it('clicking a disabled option does not select it', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    sync(f);

    (rows().find((r) => r.textContent?.includes('Beta')) as HTMLElement).click();
    expect(f.componentInstance.hasValue()).toBe(false);
    expect(f.componentInstance.isOpen()).toBe(true);
  });
});

describe('SvSelectDropdownComponent — multiple selection', () => {
  it('toggles a value off when picked twice and keeps the panel open', async () => {
    const f = await setup({ multiple: true });
    const c = f.componentInstance;
    c.openDropdown();
    c.selectOption(OPTIONS()[0]);
    c.selectOption(OPTIONS()[2]);
    expect(c.value()).toEqual(['a', 'c']);
    expect(c.isOpen()).toBe(true);

    c.selectOption(OPTIONS()[0]);
    expect(c.value()).toEqual(['c']);
  });

  /** At the cap, an unselected option must be refused — but toggling OFF must still work. */
  it('refuses a new value at maxSelected yet still allows deselection', async () => {
    const f = await setup({ multiple: true, maxSelected: 2 });
    const c = f.componentInstance;
    c.selectOption(OPTIONS()[0]);
    c.selectOption(OPTIONS()[2]);
    expect(c.maxReached()).toBe(true);

    c.selectOption(OPTIONS()[3]);            // blocked
    expect(c.value()).toEqual(['a', 'c']);

    c.selectOption(OPTIONS()[0]);            // deselect is not a new value
    expect(c.value()).toEqual(['c']);
    expect(c.maxReached()).toBe(false);
  });

  /** maxSelected only caps in multiple mode. */
  it('does not treat a single-select field as capped', async () => {
    const f = await setup({ maxSelected: 1 });
    f.componentInstance.selectOption(OPTIONS()[0]);
    expect(f.componentInstance.maxReached()).toBe(false);
    f.componentInstance.selectOption(OPTIONS()[2]);
    expect(f.componentInstance.value()).toBe('c');
  });

  it('caps the chip strip at three and counts the rest when maxSelected is set', async () => {
    const f = await setup({
      multiple: true,
      maxSelected: 5,
      value: ['a', 'c', 'd', 'e'],
      options: [...OPTIONS(), { value: 'e', label: 'Epsilon' }] as SelectOption[],
    });
    expect(f.componentInstance.visibleChips().map((o) => o.value)).toEqual(['a', 'c', 'd']);
    expect(f.componentInstance.overflowCount()).toBe(1);
  });

  /** Nothing selected means no overflow badge, not a negative count. */
  it('reports no overflow for an empty selection', async () => {
    const f = await setup({ multiple: true, maxSelected: 5 });
    expect(f.componentInstance.overflowCount()).toBe(0);
    expect(f.componentInstance.visibleChips()).toEqual([]);
  });

  it('renders a checkbox per row and marks the selected ones', async () => {
    const f = await setup({ multiple: true, value: ['a'] });
    f.componentInstance.openDropdown();
    sync(f);
    const alpha = rows().find((r) => r.textContent?.includes('Alpha'))!;
    expect(alpha.getAttribute('aria-selected')).toBe('true');
    expect(rows().find((r) => r.textContent?.includes('Gamma'))!.getAttribute('aria-selected'))
      .toBe('false');
    expect(portal()!.querySelector('ul[role="listbox"]')!
      .getAttribute('aria-multiselectable')).toBe('true');
  });

  it('displays no single-value label in multiple mode', async () => {
    const f = await setup({ multiple: true, value: ['a'] });
    expect(f.componentInstance.displayLabel()).toBe('');
    expect(f.componentInstance.triggerText()).toBe('');
  });
});

describe('SvSelectDropdownComponent — chips and clearing', () => {
  it('removes one chip and leaves the rest', async () => {
    const f = await setup({ multiple: true, value: ['a', 'c', 'd'] });
    const seen: (string | string[])[] = [];
    f.componentInstance.selectionChange.subscribe((v) => seen.push(v));

    const ev = new MouseEvent('click', { cancelable: true, bubbles: true });
    const stop = vi.spyOn(ev, 'stopPropagation');
    f.componentInstance.removeChip('c', ev);

    expect(f.componentInstance.value()).toEqual(['a', 'd']);
    expect(seen).toEqual([['a', 'd']]);
    // Otherwise the click bubbles to the trigger and re-opens the panel.
    expect(stop).toHaveBeenCalled();
  });

  /** A disabled field must not lose chips to a stray click. */
  it('refuses to remove a chip while disabled', async () => {
    const f = await setup({ multiple: true, value: ['a', 'c'], disabled: true });
    f.componentInstance.removeChip('a', new MouseEvent('click'));
    expect(f.componentInstance.value()).toEqual(['a', 'c']);
  });

  it('clears to an empty array in multiple mode and an empty string otherwise', async () => {
    const multi = await setup({ multiple: true, value: ['a', 'c'] });
    multi.componentInstance.clearAll(new MouseEvent('click'));
    expect(multi.componentInstance.value()).toEqual([]);

    const single = await setup({ value: 'a' });
    single.componentInstance.clearAll(new MouseEvent('click'));
    expect(single.componentInstance.value()).toBe('');
  });

  it('shows the clear control only when there is something to clear', async () => {
    expect((await setup({ clearable: true })).componentInstance.showClear()).toBe(false);
    expect((await setup({ clearable: true, value: 'a' })).componentInstance.showClear()).toBe(true);
    expect((await setup({ value: 'a' })).componentInstance.showClear()).toBe(false);
    expect((await setup({ clearable: true, value: 'a', disabled: true }))
      .componentInstance.showClear()).toBe(false);
    expect((await setup({ clearable: true, value: 'a', loading: true }))
      .componentInstance.showClear()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — ControlValueAccessor', () => {
  it('pushes every kind of change to the registered onChange', async () => {
    const f = await setup({ multiple: true });
    const c = f.componentInstance;
    const seen: (string | string[])[] = [];
    c.registerOnChange((v) => seen.push(v));

    c.selectOption(OPTIONS()[0]);
    c.removeChip('a', new MouseEvent('click'));
    c.clearAll(new MouseEvent('click'));
    expect(seen).toEqual([['a'], [], []]);
  });

  it('marks the control touched on blur', async () => {
    const f = await setup();
    let touched = 0;
    f.componentInstance.registerOnTouched(() => touched++);
    triggerOf(f).dispatchEvent(new FocusEvent('blur'));
    expect(touched).toBe(1);
  });

  /** A null from the form model must land as the right empty shape. */
  it('writes null as an empty string, or an empty array in multiple mode', async () => {
    const single = await setup();
    single.componentInstance.writeValue(null as unknown as string);
    expect(single.componentInstance.value()).toBe('');

    const multi = await setup({ multiple: true });
    multi.componentInstance.writeValue(null as unknown as string[]);
    expect(multi.componentInstance.value()).toEqual([]);
  });

  it('honours a disabled parent FormControl even with [disabled]=false', async () => {
    const f = await setup();
    const c = f.componentInstance;
    expect(c.resolvedDisabled()).toBe(false);

    c.setDisabledState(true);
    expect(c.resolvedDisabled()).toBe(true);
    c.openDropdown();
    expect(c.isOpen()).toBe(false);

    c.setDisabledState(false);
    c.openDropdown();
    expect(c.isOpen()).toBe(true);
  });

  it('will not open while loading', async () => {
    const f = await setup({ loading: true });
    f.componentInstance.toggleDropdown();
    expect(f.componentInstance.isOpen()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — description wiring', () => {
  /** aria-describedby must only be present when something is there to read. */
  it('describes the trigger only when a hint or error exists', async () => {
    const bare = await setup();
    expect(bare.componentInstance.hasDescription()).toBe(false);
    expect(triggerOf(bare).getAttribute('aria-describedby')).toBeNull();

    const hinted = await setup({ hint: 'Pick one' });
    expect(hinted.componentInstance.hasDescription()).toBe(true);
    const id = triggerOf(hinted).getAttribute('aria-describedby');
    expect(hinted.nativeElement.querySelector(`[id="${id}"]`)!.textContent).toContain('Pick one');
  });

  /** The error outranks the hint in the same slot, and flips aria-invalid. */
  it('shows the error instead of the hint and marks the field invalid', async () => {
    const f = await setup({ hint: 'Pick one', errorMessage: 'Required' });
    const desc = f.nativeElement.querySelector('[role="alert"]')!;
    expect(desc.textContent).toContain('Required');
    expect(f.nativeElement.textContent).not.toContain('Pick one');
    expect(triggerOf(f).getAttribute('aria-invalid')).toBe('true');
  });

  it('uses an explicit inputId when given, and a unique one otherwise', async () => {
    const explicit = await setup({ inputId: 'country' });
    expect(explicit.componentInstance.resolvedId()).toBe('country');
    expect(explicit.componentInstance.listboxId()).toBe('country-listbox');

    // Both auto instances must share an application: ids are per application (svUniqueId).
    const auto = await setup();
    expect(auto.componentInstance.resolvedId()).toMatch(/^sv-select-\w+-\d+$/);
    const other = TestBed.createComponent(SvSelectDropdownComponent);
    other.componentRef.setInput('options', OPTIONS());
    other.detectChanges();
    expect(other.componentInstance.resolvedId()).toMatch(/^sv-select-\w+-\d+$/);
    expect(other.componentInstance.resolvedId()).not.toBe(auto.componentInstance.resolvedId());
  });

  /** Without a visible label the combobox still needs an accessible name. */
  it('names the trigger from ariaLabel, then the placeholder', async () => {
    const labelled = await setup({ label: 'Country' });
    expect(triggerOf(labelled).getAttribute('aria-label')).toBeNull();
    expect(triggerOf(labelled).getAttribute('aria-labelledby'))
      .toBe(labelled.componentInstance.labelId());

    const aria = await setup({ ariaLabel: 'Pick a country' });
    expect(triggerOf(aria).getAttribute('aria-label')).toBe('Pick a country');

    const bare = await setup({ placeholder: 'Choose…' });
    expect(triggerOf(bare).getAttribute('aria-label')).toBe('Choose…');
  });

  it('renders the required asterisk, and the optional tag only without it', async () => {
    const req = await setup({ label: 'Country', required: true, optionalTag: true });
    expect(req.nativeElement.textContent).not.toContain('(optional)');
    expect(triggerOf(req).getAttribute('aria-required')).toBe('true');

    const opt = await setup({ label: 'Country', optionalTag: true });
    expect(opt.nativeElement.textContent).toContain('(optional)');
    expect(triggerOf(opt).getAttribute('aria-required')).toBeNull();
  });
});
