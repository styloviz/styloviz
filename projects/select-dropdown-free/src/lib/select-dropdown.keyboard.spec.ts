import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { flush } from '../../../../src/testing/async';
import {
  SvSelectDropdownComponent,
  type SelectOption,
  type SelectGroup,
} from './select-dropdown.component';

/**
 * Keyboard navigation for the Pro select.
 *
 * `b` is disabled on purpose: every navigation path in the component runs over
 * `navigableOptions().filter(o => !o.disabled)`, so a list with a disabled
 * option in the MIDDLE is the only shape that can tell a correct
 * implementation from one that indexes the raw list.
 */
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

/** The panel lives in a body portal outside the fixture's CD subtree. */
const portal = () => document.querySelector<HTMLElement>('.sv-sd-portal');

/** Refresh the fixture AND the detached portal view. */
function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

/** Dispatch a real cancelable keydown so the template binding is exercised too. */
function press(el: Element, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(ev);
  return ev;
}

const triggerOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;

describe('SvSelectDropdownComponent — trigger keyboard', () => {
  it('opens on ArrowDown and activates the first option, swallowing the key', async () => {
    const f = await setup();
    const ev = press(triggerOf(f), 'ArrowDown');

    expect(f.componentInstance.isOpen()).toBe(true);
    expect(f.componentInstance.activeIndex()).toBe(0);
    // The component claims to swallow navigation keys — otherwise the page
    // scrolls underneath the freshly opened panel.
    expect(ev.defaultPrevented).toBe(true);
  });

  it('opens on Space, Enter, Home and End too', async () => {
    for (const key of [' ', 'Enter', 'Home', 'End']) {
      const f = await setup();
      press(triggerOf(f), key);
      expect(f.componentInstance.isOpen(), `${key} should open`).toBe(true);
      expect(f.componentInstance.activeIndex()).toBe(0);
    }
  });

  /** A closed listbox must not react to keys it does not own. */
  it('leaves an unrelated key alone and stays closed', async () => {
    const f = await setup();
    const ev = press(triggerOf(f), 'x');

    expect(f.componentInstance.isOpen()).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('steps over a disabled option going down', async () => {
    const f = await setup();
    const t = triggerOf(f);
    press(t, 'ArrowDown');                       // -> Alpha
    expect(f.componentInstance.activeOption()?.value).toBe('a');

    press(t, 'ArrowDown');
    // Beta is disabled: it must never become the active option.
    expect(f.componentInstance.activeOption()?.value).toBe('c');

    press(t, 'ArrowDown');
    expect(f.componentInstance.activeOption()?.value).toBe('d');
  });

  it('wraps from the last option back to the first', async () => {
    const f = await setup();
    const t = triggerOf(f);
    press(t, 'ArrowDown');   // opens; the first key press only opens
    press(t, 'End');
    expect(f.componentInstance.activeOption()?.value).toBe('d');
    press(t, 'ArrowDown');
    expect(f.componentInstance.activeOption()?.value).toBe('a');
  });

  /** The boundary case: ArrowUp while already on the first option. */
  it('wraps from the first option round to the last', async () => {
    const f = await setup();
    const t = triggerOf(f);
    press(t, 'ArrowDown');
    expect(f.componentInstance.activeIndex()).toBe(0);
    press(t, 'ArrowUp');
    expect(f.componentInstance.activeOption()?.value).toBe('d');
  });

  it('Home and End jump to the first and last ENABLED option', async () => {
    const f = await setup({
      options: [
        { value: 'b', label: 'Beta', disabled: true },
        { value: 'c', label: 'Gamma' },
        { value: 'd', label: 'Delta' },
        { value: 'e', label: 'Epsilon', disabled: true },
      ] as SelectOption[],
    });
    const t = triggerOf(f);
    press(t, 'ArrowDown');
    press(t, 'End');
    expect(f.componentInstance.activeOption()?.value).toBe('d');
    press(t, 'Home');
    expect(f.componentInstance.activeOption()?.value).toBe('c');
  });

  it('Enter on the open panel selects the active option', async () => {
    const f = await setup();
    const seen: (string | string[])[] = [];
    f.componentInstance.selectionChange.subscribe((v) => seen.push(v));
    const t = triggerOf(f);
    press(t, 'ArrowDown');
    press(t, 'ArrowDown');   // Gamma (Beta skipped)
    press(t, 'Enter');

    expect(f.componentInstance.value()).toBe('c');
    expect(seen).toEqual(['c']);
    expect(f.componentInstance.isOpen()).toBe(false);
  });

  it('Escape and Tab both close the panel', async () => {
    for (const key of ['Escape', 'Tab']) {
      const f = await setup();
      f.componentInstance.openDropdown();
      press(triggerOf(f), key);
      expect(f.componentInstance.isOpen(), `${key} should close`).toBe(false);
    }
  });
});

describe('SvSelectDropdownComponent — navigation with nothing to navigate', () => {
  /** An empty list must not park activeIndex on a phantom row. */
  it('does nothing when there are no options at all', async () => {
    const f = await setup({ options: [] as SelectOption[] });
    const t = triggerOf(f);
    press(t, 'ArrowDown');            // opens, then activeIndex := 0
    expect(f.componentInstance.isOpen()).toBe(true);
    press(t, 'ArrowDown');            // navigateList bails: nothing enabled
    expect(f.componentInstance.activeOption()).toBeNull();
    press(t, 'Enter');                // selectActive must not throw or select
    expect(f.componentInstance.hasValue()).toBe(false);
  });

  /** Every option disabled is the same as no options for navigation. */
  it('never activates anything when every option is disabled', async () => {
    const f = await setup({
      options: [
        { value: 'a', label: 'Alpha', disabled: true },
        { value: 'b', label: 'Beta', disabled: true },
      ] as SelectOption[],
    });
    const t = triggerOf(f);
    press(t, 'ArrowDown');
    press(t, 'ArrowDown');
    press(t, 'End');
    expect(f.componentInstance.activeOption()).toBeNull();
    press(t, 'Enter');
    expect(f.componentInstance.hasValue()).toBe(false);
  });

  /** A group whose options all filter away must not leave an empty heading. */
  it('drops a group that has no matching children', async () => {
    const f = await setup({
      options: [] as SelectOption[],
      searchable: true,
      groups: [
        { label: 'Nordics', options: [{ value: 'se', label: 'Sweden' }] },
        { label: 'Empty', options: [] },
      ] as SelectGroup[],
    });
    f.componentInstance.setSearch('swe');
    expect(f.componentInstance.filteredGroups().map((g) => g.label)).toEqual(['Nordics']);

    f.componentInstance.setSearch('zzz');
    expect(f.componentInstance.filteredGroups()).toEqual([]);
    expect(f.componentInstance.noResults()).toBe(true);
  });

  it('navigates across flat options and group children as one list', async () => {
    const f = await setup({
      options: [{ value: 'a', label: 'Alpha' }] as SelectOption[],
      groups: [
        { label: 'More', options: [{ value: 'g1', label: 'G One' }, { value: 'g2', label: 'G Two' }] },
      ] as SelectGroup[],
    });
    const t = triggerOf(f);
    press(t, 'ArrowDown');
    expect(f.componentInstance.activeOption()?.value).toBe('a');
    press(t, 'ArrowDown');
    expect(f.componentInstance.activeOption()?.value).toBe('g1');
    press(t, 'End');
    expect(f.componentInstance.activeOption()?.value).toBe('g2');
  });
});

describe('SvSelectDropdownComponent — search box keyboard', () => {
  /** The search input lives in the portal, so query the portal, not the host. */
  const searchBox = () => portal()?.querySelector('input[type="text"]') as HTMLInputElement;

  async function open(inputs: Record<string, unknown> = {}) {
    const f = await setup({ searchable: true, ...inputs });
    f.componentInstance.openDropdown();
    sync(f);
    return f;
  }

  it('ArrowDown/ArrowUp/Home/End move the active option and are swallowed', async () => {
    const f = await open();
    const box = searchBox();

    expect(press(box, 'ArrowDown').defaultPrevented).toBe(true);
    expect(f.componentInstance.activeOption()?.value).toBe('a');
    expect(press(box, 'End').defaultPrevented).toBe(true);
    expect(f.componentInstance.activeOption()?.value).toBe('d');
    expect(press(box, 'ArrowUp').defaultPrevented).toBe(true);
    expect(f.componentInstance.activeOption()?.value).toBe('c');
    expect(press(box, 'Home').defaultPrevented).toBe(true);
    expect(f.componentInstance.activeOption()?.value).toBe('a');
  });

  it('Enter selects the active option from the search box', async () => {
    const f = await open();
    press(searchBox(), 'ArrowDown');
    press(searchBox(), 'Enter');
    expect(f.componentInstance.value()).toBe('a');
  });

  /** Enter with nothing highlighted must not pick the first row by accident. */
  it('Enter with no active option selects nothing', async () => {
    const f = await open();
    const ev = press(searchBox(), 'Enter');
    expect(ev.defaultPrevented).toBe(true);
    expect(f.componentInstance.hasValue()).toBe(false);
    expect(f.componentInstance.isOpen()).toBe(true);
  });

  it('Escape closes the panel and hands focus back to the trigger', async () => {
    const f = await open();
    const focusSpy = vi.spyOn(triggerOf(f), 'focus');
    press(searchBox(), 'Escape');
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
  });

  /** Closing clears the query, so re-opening does not show a stale filter. */
  it('forgets the query when the panel closes', async () => {
    const f = await open();
    f.componentInstance.setSearch('alp');
    expect(f.componentInstance.filteredOptions()).toHaveLength(1);
    f.componentInstance.closeDropdown();
    expect(f.componentInstance.searchQuery()).toBe('');
    expect(f.componentInstance.filteredOptions()).toHaveLength(4);
  });
});

describe('SvSelectDropdownComponent — aria-activedescendant', () => {
  it('points at the active option row and clears when the panel closes', async () => {
    const f = await setup();
    const t = triggerOf(f);

    expect(t.getAttribute('aria-activedescendant')).toBeNull();

    press(t, 'ArrowDown');
    sync(f);
    const id = t.getAttribute('aria-activedescendant');
    expect(id).toBe(f.componentInstance.optionDomId('a'));

    // The id must actually resolve to the rendered row it names.
    const row = portal()?.querySelector(`[id="${id}"]`);
    expect(row?.getAttribute('role')).toBe('option');
    expect(row?.getAttribute('data-active')).toBe('true');

    press(t, 'Escape');
    sync(f);
    expect(t.getAttribute('aria-activedescendant')).toBeNull();
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  /** Exactly one row may carry data-active, or the highlight is ambiguous. */
  it('marks exactly one row active at a time', async () => {
    const f = await setup();
    press(triggerOf(f), 'ArrowDown');
    press(triggerOf(f), 'ArrowDown');
    sync(f);
    const active = portal()!.querySelectorAll('[data-active="true"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('Gamma');
  });

  /**
   * jsdom implements no scrolling and no layout, so the assertion here is about
   * WHICH row the component asks to be revealed — never about a pixel moving.
   * Without it a long list scrolls the highlight straight off the bottom.
   */
  it('asks for the newly active row to be scrolled into view', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView, configurable: true, writable: true,
    });
    try {
      const f = await setup();
      const t = triggerOf(f);
      press(t, 'ArrowDown');
      press(t, 'ArrowDown');            // Gamma (Beta is disabled and skipped)
      sync(f);                          // the portal must render data-active first
      await flush();                    // the scroll is deferred one macrotask

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      const target = scrollIntoView.mock.instances[0] as HTMLElement;
      expect(target.textContent).toContain('Gamma');
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>)['scrollIntoView'];
    }
  });

  it('sanitises option values that are not id-safe', async () => {
    const f = await setup({ options: [{ value: 'a/b c', label: 'Odd' }] as SelectOption[] });
    expect(f.componentInstance.optionDomId('a/b c')).toMatch(/-opt-a-b-c$/);
  });
});
