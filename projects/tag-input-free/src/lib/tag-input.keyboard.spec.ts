import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

const OPTIONS = (): TagOption[] => [
  { value: 'ng', label: 'Angular' },
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue', disabled: true },
  { value: 'svelte', label: 'Svelte' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

const inputOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;

/** Type into the real input so `onInput` reads it the way the browser feeds it. */
function type(fixture: { nativeElement: HTMLElement }, value: string): void {
  const el = inputOf(fixture);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(el: Element, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(ev);
  return ev;
}

describe('SvTagInputComponent — arrow navigation', () => {
  /** A closed panel must open first; the same press must not also move. */
  it('opens on ArrowDown without moving the highlight', async () => {
    const f = await setup();
    const ev = press(inputOf(f), 'ArrowDown');
    expect(f.componentInstance.isOpen()).toBe(true);
    expect(f.componentInstance.activeIndex()).toBe(-1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('walks down the list and stops at the last row', async () => {
    const f = await setup();
    const el = inputOf(f);
    press(el, 'ArrowDown');                      // open
    for (let i = 0; i < 4; i++) press(el, 'ArrowDown');
    expect(f.componentInstance.activeIndex()).toBe(3);

    // Boundary: the list does not wrap, so a fifth press changes nothing.
    press(el, 'ArrowDown');
    expect(f.componentInstance.activeIndex()).toBe(3);
  });

  /** ArrowUp past the top parks at -1 (nothing highlighted), never at -2. */
  it('walks back up to nothing and stays there', async () => {
    const f = await setup();
    const el = inputOf(f);
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    expect(f.componentInstance.activeIndex()).toBe(0);

    expect(press(el, 'ArrowUp').defaultPrevented).toBe(true);
    expect(f.componentInstance.activeIndex()).toBe(-1);
    press(el, 'ArrowUp');
    expect(f.componentInstance.activeIndex()).toBe(-1);
  });

  it('highlights nothing when every option is already chosen', async () => {
    const f = await setup({ values: ['ng', 'react', 'vue', 'svelte'] });
    const el = inputOf(f);
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    expect(f.componentInstance.navigableList()).toEqual([]);
    expect(f.componentInstance.activeIndex()).toBe(-1);
    expect(f.componentInstance.noResults()).toBe(true);
  });

  it('resets the highlight after every keystroke in the box', async () => {
    const f = await setup();
    const el = inputOf(f);
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    expect(f.componentInstance.activeIndex()).toBe(0);
    type(f, 'v');
    // The list just changed underneath; keeping index 0 would highlight a row
    // the user never chose.
    expect(f.componentInstance.activeIndex()).toBe(-1);
  });

  it('opens the panel as soon as the user types into a closed field', async () => {
    const f = await setup();
    expect(f.componentInstance.isOpen()).toBe(false);
    type(f, 'v');
    expect(f.componentInstance.isOpen()).toBe(true);
    expect(f.componentInstance.query()).toBe('v');
  });
});

describe('SvTagInputComponent — Enter', () => {
  it('adds the highlighted option and clears the box', async () => {
    const f = await setup();
    const el = inputOf(f);
    type(f, 'rea');
    press(el, 'ArrowDown');
    expect(press(el, 'Enter').defaultPrevented).toBe(true);

    expect(f.componentInstance.values()).toEqual(['react']);
    expect(f.componentInstance.query()).toBe('');
    expect(f.componentInstance.activeIndex()).toBe(-1);
  });

  /** Nothing highlighted — Enter must not guess at the first row. */
  it('adds nothing when no row is highlighted', async () => {
    const f = await setup();
    press(inputOf(f), 'ArrowDown');
    press(inputOf(f), 'Enter');
    expect(f.componentInstance.values()).toEqual([]);
  });

  /** A disabled row can be highlighted, but committing it must be refused. */
  it('refuses to add a disabled option', async () => {
    const f = await setup();
    const el = inputOf(f);
    press(el, 'ArrowDown');
    for (let i = 0; i < 3; i++) press(el, 'ArrowDown');   // index 2 = Vue (disabled)
    expect(f.componentInstance.navigableList()[2].value).toBe('vue');
    press(el, 'Enter');
    expect(f.componentInstance.values()).toEqual([]);
  });

  it('refuses to add anything at all while disabled', async () => {
    const f = await setup({ disabled: true });
    f.componentInstance.selectOption(OPTIONS()[0]);
    expect(f.componentInstance.values()).toEqual([]);
  });
});

describe('SvTagInputComponent — Backspace', () => {
  it('deletes the last tag when the box is empty', async () => {
    const f = await setup({ values: ['ng', 'react'] });
    const seen: string[][] = [];
    f.componentInstance.tagsChange.subscribe((e) => seen.push(e.values));

    press(inputOf(f), 'Backspace');
    expect(f.componentInstance.values()).toEqual(['ng']);
    expect(seen).toEqual([['ng']]);
  });

  /** With text in the box Backspace belongs to the text, not to the chips. */
  it('leaves the tags alone while there is text to delete', async () => {
    const f = await setup({ values: ['ng', 'react'] });
    type(f, 'v');
    const ev = press(inputOf(f), 'Backspace');
    expect(f.componentInstance.values()).toEqual(['ng', 'react']);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('emits nothing when there is nothing to delete', async () => {
    const f = await setup();
    let emits = 0;
    f.componentInstance.tagsChange.subscribe(() => emits++);
    press(inputOf(f), 'Backspace');
    expect(emits).toBe(0);
  });
});

describe('SvTagInputComponent — Escape and Tab', () => {
  it('Escape closes the panel and drops the highlight', async () => {
    const f = await setup();
    press(inputOf(f), 'ArrowDown');
    press(inputOf(f), 'ArrowDown');
    press(inputOf(f), 'Escape');
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(-1);
  });

  it('Tab closes the panel and lets focus move on', async () => {
    const f = await setup();
    press(inputOf(f), 'ArrowDown');
    const ev = press(inputOf(f), 'Tab');
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });
});

/**
 * ★ THE FREE/PRO LINE. `@styloviz-pro/tag-input` adds Tab quick-add, a
 * `creatable` variant and a `maxTags` cap. None of them exist here, and the
 * free field must behave predictably rather than half-implementing them.
 */
describe('SvTagInputComponent — Pro behaviours are absent (free tier)', () => {
  /** Pro commits the first match on Tab. Free must not: it just leaves. */
  it('never quick-adds a tag on Tab', async () => {
    const f = await setup();
    type(f, 'ang');
    const ev = press(inputOf(f), 'Tab');

    expect(f.componentInstance.values()).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
    expect(f.componentInstance.isOpen()).toBe(false);
    // …and the query it did not use is still there for the next focus.
    expect(f.componentInstance.query()).toBe('ang');
  });

  /** Pro offers "Create ‹term›". Free offers nothing for an unknown term. */
  it('never offers to create an unknown term', async () => {
    const f = await setup();
    type(f, 'Solid');
    sync(f);

    expect(f.componentInstance.filteredOptions()).toEqual([]);
    expect(f.componentInstance.noResults()).toBe(true);
    const panel = document.querySelector('.sv-tag-input-portal')!;
    expect(panel.textContent).toContain('No results found');
    expect(panel.textContent).not.toContain('Create');

    press(inputOf(f), 'Enter');
    expect(f.componentInstance.values()).toEqual([]);
  });

  /** Pro filters on the secondary line too; free matches the label only. */
  it('matches on the label only, not on the sublabel', async () => {
    const f = await setup({
      options: [{ value: 'ada', label: 'Ada Lovelace', sublabel: 'Engineering' }] as TagOption[],
    });
    f.componentInstance.query.set('engineer');
    expect(f.componentInstance.filteredOptions()).toEqual([]);
    f.componentInstance.query.set('lovelace');
    expect(f.componentInstance.filteredOptions()).toHaveLength(1);
  });

  /** No cap exists, so the field never stops accepting tags or shuts its box. */
  it('has no tag cap', async () => {
    const f = await setup({ values: ['ng', 'react', 'vue', 'svelte'] });
    sync(f);
    expect(inputOf(f)).not.toBeNull();
    f.componentInstance.selectOption({ value: 'solid', label: 'Solid' });
    expect(f.componentInstance.values()).toHaveLength(5);
    f.componentInstance.open();
    expect(f.componentInstance.isOpen()).toBe(true);
  });
});

describe('SvTagInputComponent — combobox ARIA', () => {
  it('tracks the active row and clears the pointer when closed', async () => {
    const f = await setup();
    const el = inputOf(f);
    sync(f);
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(el.getAttribute('aria-controls')).toBeNull();
    expect(el.getAttribute('aria-activedescendant')).toBeNull();

    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    sync(f);
    expect(el.getAttribute('aria-expanded')).toBe('true');
    expect(el.getAttribute('aria-controls')).toBe(f.componentInstance.listboxId);
    const id = el.getAttribute('aria-activedescendant');
    expect(id).toBe(f.componentInstance.optionId(0));

    const row = document.getElementById(id!)!;
    expect(row.getAttribute('role')).toBe('option');

    press(el, 'Escape');
    sync(f);
    expect(el.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('names the box from the label, and from the placeholder without one', async () => {
    const labelled = await setup({ label: 'Skills' });
    expect(inputOf(labelled).getAttribute('aria-label')).toBeNull();
    expect(inputOf(labelled).getAttribute('aria-labelledby'))
      .toBe(labelled.componentInstance.labelId);

    const bare = await setup({ placeholder: 'Add skills…' });
    expect(inputOf(bare).getAttribute('aria-label')).toBe('Add skills…');
    expect(bare.componentInstance.accessibleName()).toBe('Add skills…');
  });

  it('renders the required marker next to the label only when asked', async () => {
    const req = await setup({ label: 'Skills', required: true });
    expect(req.nativeElement.querySelector('[aria-hidden="true"]')!.textContent).toBe('*');

    const opt = await setup({ label: 'Skills' });
    expect(opt.nativeElement.textContent).not.toContain('*');
  });
});
