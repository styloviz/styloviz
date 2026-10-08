import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until } from '@testing/async';
import { svResetWarnOnce } from '@styloviz/core';
import { SvSelectDropdownComponent } from './select-dropdown.component';
import type { SelectOption, SvSelectOptionSource } from './select-dropdown.component';

/**
 * `FI-23-I2` / `FI-23-M2` / `FI-23-M3` re-verified 2026-09-26 (free twin).
 *
 * The stale-value policy was only ever RENDERED for a single select. In multi
 * mode `hasStaleValue()` was true and nothing on screen said so: the trigger
 * drew chips for the values it could resolve and silently skipped the rest —
 * with every value dropped, it drew an empty trigger and no placeholder —
 * while the form went on submitting them. And with `loadOptions`, a pick made
 * under one search term vanished from the chips under the next one, because
 * the fetched list is "whatever answers this term", not the catalogue.
 */

const FRUIT: SelectOption[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
];

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const r = await render(SvSelectDropdownComponent, {
    inputs: { options: FRUIT, ...inputs } as ComponentInput<SvSelectDropdownComponent>,
  });
  const host = r.fixture.nativeElement as HTMLElement;
  return { fixture: r.fixture, c: r.fixture.componentInstance, host };
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('SvSelectDropdownComponent — a stale value in a single select', () => {
  it('renders "Unavailable (id)" instead of the placeholder', async () => {
    const { fixture, host } = await setup({ value: 'a' });
    fixture.componentRef.setInput('options', [FRUIT[1]]);
    fixture.detectChanges();
    const trig = host.querySelector('[role="combobox"]');
    expect(text(trig)).toContain('Unavailable (a)');
    expect(text(trig)).not.toContain('Select an option');
  });
});

describe('SvSelectDropdownComponent — a stale value in a MULTI select', () => {
  it('draws a chip for the missing value beside the ones that resolve', async () => {
    const { fixture, host } = await setup({ multiple: true, value: ['a', 'b'] });
    fixture.componentRef.setInput('options', [FRUIT[1]]);
    fixture.detectChanges();
    const chip = host.querySelector('[data-sv-stale-chip]');
    expect(chip).not.toBeNull();
    expect(text(chip)).toContain('Unavailable (a)');
    expect(chip!.getAttribute('title')).toContain('No longer in the list');
    expect(text(host.querySelector('[data-chip]'))).toContain('Banana');
  });

  it('never leaves the trigger blank when every value is gone', async () => {
    const { fixture, host } = await setup({ multiple: true, value: ['a', 'b'] });
    fixture.componentRef.setInput('options', []);
    fixture.detectChanges();
    expect(text(host.querySelector('[data-sv-stale-chip]'))).toContain('2 unavailable');
  });

  it('lets the user drop the unavailable values, and only those', async () => {
    const { fixture, c, host } = await setup({ multiple: true, value: ['a', 'b'] });
    const emitted: unknown[] = [];
    c.selectionChange.subscribe((v: unknown) => emitted.push(v));
    fixture.componentRef.setInput('options', [FRUIT[1]]);
    fixture.detectChanges();
    const remove = host.querySelector('[data-sv-stale-chip] button') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Remove Unavailable (a)');
    remove.click();
    fixture.detectChanges();
    expect(c.value()).toEqual(['b']);
    expect(emitted).toEqual([['b']]);
    expect(host.querySelector('[data-sv-stale-chip]')).toBeNull();
  });

  it('draws no stale chip when everything resolves', async () => {
    const { host } = await setup({ multiple: true, value: ['a', 'b'] });
    expect(host.querySelector('[data-sv-stale-chip]')).toBeNull();
  });
});

describe('SvSelectDropdownComponent — loadOptions keeps what the user picked', () => {
  it('keeps an earlier pick labelled after a search that does not return it', async () => {
    const DB: SelectOption[] = [
      { value: 'ada', label: 'Ada Lovelace' },
      { value: 'bob', label: 'Bob Kahn' },
    ];
    const load: SvSelectOptionSource = async (term) =>
      DB.filter((o) => o.label.toLowerCase().includes(term.toLowerCase()));
    const { fixture, c, host } = await setup({
      options: [], multiple: true, value: [], searchable: true, debounceMs: 0, loadOptions: load,
    });

    c.openDropdown();
    c.setSearch('ada');
    await until(() => c.effectiveOptions().length === 1 && c.effectiveOptions()[0].value === 'ada',
      { label: 'ada results' });
    c.selectOption(c.effectiveOptions()[0]);

    c.setSearch('bob');
    await until(() => c.effectiveOptions().length === 1 && c.effectiveOptions()[0].value === 'bob',
      { label: 'bob results' });
    c.selectOption(c.effectiveOptions()[0]);
    fixture.detectChanges();

    expect(c.value()).toEqual(['ada', 'bob']);
    expect(c.hasStaleValue()).toBe(false);
    expect(c.selectedOptions().map((o) => o.label)).toEqual(['Bob Kahn', 'Ada Lovelace']);
    expect(host.querySelector('[data-sv-stale-chip]')).toBeNull();
  });

  it('still treats a value dropped from LOCAL options as stale', async () => {
    const { fixture, c } = await setup({ multiple: true, value: [] });
    c.selectOption(FRUIT[0]);
    fixture.componentRef.setInput('options', [FRUIT[1]]);
    fixture.detectChanges();
    expect(c.staleValues()).toEqual(['a']);
  });
});
