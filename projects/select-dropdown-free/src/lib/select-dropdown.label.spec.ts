import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSelectDropdownComponent, type SelectOption } from './select-dropdown.component';

/**
 * The floating-label styling, the server-side search contract, and the error
 * slot.
 *
 * ★ On the floating label: the free tier pins `isFloating()` to `false`, so the
 * label never renders in this variant — but `floatingLabelClasses()` is public
 * API and is what the Pro variant's template binds, so the four states it can
 * be in (resting, floated, floated-and-active, and each of those with an error)
 * are worth pinning here rather than only in the paid package. Every assertion
 * below distinguishes one state from its neighbour; none of them just checks
 * that a string is non-empty.
 *
 * ⚠️ BUT CLASS STRINGS ARE NOT THE FEATURE, and `FI-23-I3` was filed because
 *    this file was the ONLY label spec in either twin. Whether the label
 *    actually renders, whether it collides with the placeholder, and whether it
 *    still names the trigger are all Pro-side facts, and they now live in
 *    `select-dropdown/src/lib/select-dropdown.label.spec.ts`. Read the two
 *    together: this one pins what the classes say, that one pins what the user
 *    gets.
 */

const OPTIONS = (): SelectOption[] => [
  { value: 'a', label: 'Alpha', sublabel: 'first' },
  { value: 'b', label: 'Beta', sublabel: 'second' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => {
  document.querySelectorAll('.sv-sd-portal').forEach((n) => n.remove());
  TestBed.resetTestingModule();
});

describe('SvSelectDropdownComponent — the floating label at rest', () => {
  it('sits over the field, in the field text size, with no backdrop', async () => {
    const c = (await setup({ label: 'Country' })).componentInstance;
    const cls = c.floatingLabelClasses();
    expect(c.labelIsFloated()).toBe(false);
    expect(cls).toContain('left-3.5');
    expect(cls).toContain('top-1/2');
    expect(cls).toContain('text-sm'); // the md label size, not the shrunken one
    expect(cls).not.toContain('bg-white');
    expect(cls).toContain('text-gray-500');
  });

  it('takes the resting text size from the field size', async () => {
    const sm = (await setup({ label: 'Country', size: 'sm' })).componentInstance;
    expect(sm.floatingLabelClasses()).toContain('text-xs');

    const lg = (await setup({ label: 'Country', size: 'lg' })).componentInstance;
    expect(lg.floatingLabelClasses()).toContain('text-base');
  });

  it('stays grey at rest even when the field is in error', async () => {
    // Only a *floated* label turns red: at rest it sits inside the field where
    // red-on-red is unreadable, and the error message below carries the colour.
    const c = (await setup({ label: 'Country', errorMessage: 'Required' })).componentInstance;
    expect(c.labelIsFloated()).toBe(false);
    expect(c.floatingLabelClasses()).toContain('text-gray-500');
    expect(c.floatingLabelClasses()).not.toContain('text-danger-500');
  });
});

describe('SvSelectDropdownComponent — the floating label once it floats', () => {
  it('floats because there is a value', async () => {
    const c = (await setup({ label: 'Country', value: 'a' })).componentInstance;
    expect(c.labelIsFloated()).toBe(true);
    const cls = c.floatingLabelClasses();
    expect(cls).toContain('left-3');
    expect(cls).toContain('-top-px');
    expect(cls).toContain('text-[0.7rem] leading-none');
    // It sits on the border, so it needs a backdrop to punch through it.
    expect(cls).toContain('bg-white');
  });

  it('floats because the panel is open, even with no value', async () => {
    const f = await setup({ label: 'Country' });
    f.componentInstance.openDropdown();
    f.detectChanges();
    expect(f.componentInstance.labelIsFloated()).toBe(true);
    expect(f.componentInstance.floatingLabelClasses()).toContain('-top-px');
  });

  it('turns the accent colour while the field is active', async () => {
    const f = await setup({ label: 'Country' });
    f.componentInstance.openDropdown();
    f.detectChanges();
    expect(f.componentInstance.floatingLabelClasses()).toContain('text-primary-600');
  });

  it('turns red while active and in error', async () => {
    const f = await setup({ label: 'Country', errorMessage: 'Required' });
    f.componentInstance.openDropdown();
    f.detectChanges();
    const cls = f.componentInstance.floatingLabelClasses();
    expect(cls).toContain('text-danger-500');
    expect(cls).not.toContain('text-primary-600');
  });

  it('goes grey once it is floated but no longer active', async () => {
    // Value selected, panel closed, focus elsewhere: floated, but nothing about
    // this field is current, so it must not keep the accent colour.
    const c = (await setup({ label: 'Country', value: 'a' })).componentInstance;
    expect(c.labelIsFloated()).toBe(true);
    expect(c.isFocused()).toBe(false);
    expect(c.isOpen()).toBe(false);
    const cls = c.floatingLabelClasses();
    expect(cls).toContain('text-gray-500');
    expect(cls).not.toContain('text-primary-600');
  });

  it('goes red-but-muted once it is floated, in error, and not active', async () => {
    const c = (await setup({ label: 'Country', value: 'a', errorMessage: 'Bad' })).componentInstance;
    const cls = c.floatingLabelClasses();
    expect(cls).toContain('text-danger-500 dark:text-danger-400');
    expect(cls).not.toContain('text-primary-600');
  });

  it('does not render the label in the free variant', async () => {
    // `isFloating()` is pinned false here, and the template is gated on it.
    // Asserting the negative keeps the two facts — the classes exist, the
    // markup does not — from drifting apart silently.
    const f = await setup({ label: 'Country', value: 'a' });
    expect(f.componentInstance.isFloating()).toBe(false);
    const host = f.nativeElement as HTMLElement;
    const floating = host.querySelector('.pointer-events-none.absolute.z-10');
    expect(floating).toBeNull();
  });
});

describe('SvSelectDropdownComponent — server-side search', () => {
  it('does not filter locally when the host owns the query', async () => {
    // The options ARE the server's answer. Filtering them again by the same
    // term drops rows the server deliberately returned — a fuzzy or
    // accent-insensitive backend match disappears the moment it is re-checked
    // with `includes`.
    const f = await setup({ serverSide: true });
    f.componentInstance.searchQuery.set('zzz');
    f.detectChanges();
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).toEqual(['a', 'b']);
  });

  it('filters locally when it owns the query itself', async () => {
    const f = await setup();
    f.componentInstance.searchQuery.set('bet');
    f.detectChanges();
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).toEqual(['b']);
  });

  it('matches a sublabel as well as a label', async () => {
    const f = await setup();
    f.componentInstance.searchQuery.set('second');
    f.detectChanges();
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).toEqual(['b']);
  });

  it('leaves grouped options to the server too', async () => {
    const f = await setup({
      options: [],
      groups: [{ label: 'Europe', options: [{ value: 'fr', label: 'France' }] }],
      serverSide: true,
    });
    f.componentInstance.searchQuery.set('zzz');
    f.detectChanges();
    expect(f.componentInstance.filteredGroups()[0]?.options.map((o) => o.value)).toEqual(['fr']);
  });

  it('counts characters in the singular for a one-character minimum', async () => {
    const one = (await setup({ minChars: 1 })).componentInstance;
    expect(one.minCharsHint()).toBe('Type 1 character to search');

    const three = (await setup({ minChars: 3 })).componentInstance;
    expect(three.minCharsHint()).toBe('Type 3 characters to search');
  });

  it('knows when the typed term is still too short', async () => {
    const f = await setup({ minChars: 3 });
    expect(f.componentInstance.belowMinChars()).toBe(true);
    f.componentInstance.searchQuery.set('abc');
    f.detectChanges();
    expect(f.componentInstance.belowMinChars()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — the trigger text', () => {
  it('is the selected label for a single select', async () => {
    const c = (await setup({ value: 'b' })).componentInstance;
    expect(c.triggerText()).toBe('Beta');
  });

  it('is empty when nothing is selected', async () => {
    const c = (await setup()).componentInstance;
    expect(c.triggerText()).toBe('');
  });

  it('is empty for a multi-select, which renders chips instead', async () => {
    const c = (await setup({ multiple: true, value: ['a', 'b'] })).componentInstance;
    expect(c.triggerText()).toBe('');
  });
});

describe('SvSelectDropdownComponent — the error slot', () => {
  it('takes a plain string', async () => {
    const c = (await setup({ value: 'a', serverError: 'That option is gone.' })).componentInstance;
    expect(c.resolvedError()).toBe('That option is gone.');
  });

  it('takes an error object and reads its message', async () => {
    const c = (await setup({ value: 'a', serverError: { message: 'That option is gone.' } }))
      .componentInstance;
    expect(c.resolvedError()).toBe('That option is gone.');
  });

  it('lets a server rejection outrank the client message', async () => {
    const c = (await setup({ value: 'a', errorMessage: 'Required', serverError: 'Gone' }))
      .componentInstance;
    expect(c.resolvedError()).toBe('Gone');
  });

  it('expires the server rejection once the value changes', async () => {
    // The rejection was about the old value. Leaving it up makes the field look
    // permanently broken however the user answers it.
    const f = await setup({ value: 'a', errorMessage: 'Required', serverError: 'Gone' });
    expect(f.componentInstance.resolvedError()).toBe('Gone');

    f.componentInstance.selectOption(OPTIONS()[1]);
    f.detectChanges();
    expect(f.componentInstance.resolvedError()).toBe('Required');
  });

  it('says nothing when there is nothing wrong', async () => {
    const c = (await setup({ value: 'a' })).componentInstance;
    expect(c.resolvedError()).toBe('');
  });
});
