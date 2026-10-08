import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvSelectDropdownComponent,
  type SelectOption,
} from './select-dropdown.component';

const OPTIONS = (): SelectOption[] => [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const triggerOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;

describe('SvSelectDropdownComponent — trigger chrome', () => {
  /** Each variant owns a distinct border treatment; they must not blur together. */
  it('gives each variant its own frame', async () => {
    const def = (await setup()).componentInstance.triggerClasses();
    expect(def).toContain('rounded-md border bg-white');

    const filled = (await setup({ variant: 'filled' })).componentInstance.triggerClasses();
    expect(filled).toContain('bg-gray-100');
    expect(filled).not.toContain('rounded-none');

    const flushed = (await setup({ variant: 'flushed' })).componentInstance.triggerClasses();
    expect(flushed).toContain('rounded-none border-0 border-b');
    expect(flushed).toContain('bg-transparent');
  });

  it('scales height and text with size', async () => {
    for (const [size, height, text] of [
      ['sm', 'min-h-8', 'text-xs'],
      ['md', 'min-h-10', 'text-sm'],
      ['lg', 'min-h-11', 'text-base'],
    ] as const) {
      const c = (await setup({ size })).componentInstance;
      expect(c.triggerClasses(), size).toContain(height);
      expect(c.triggerClasses(), size).toContain(text);
      expect(c.labelSizeClass()).toBe(text);
    }
  });

  /** Error must beat focus, and focus must beat rest — in every variant. */
  it('ranks error above focus above rest', async () => {
    for (const variant of ['default', 'filled', 'flushed'] as const) {
      const errored = (await setup({ variant, errorMessage: 'Nope' })).componentInstance;
      expect(errored.triggerClasses(), variant).toMatch(/border-danger-(400|500)/);

      const focused = (await setup({ variant })).componentInstance;
      focused.onFocus();
      expect(focused.triggerClasses(), variant).toContain('border-primary-500');
      expect(focused.triggerClasses(), variant).not.toMatch(/border-danger-/);
    }
  });

  it('paints a disabled field differently and refuses to open', async () => {
    const f = await setup({ disabled: true });
    expect(f.componentInstance.triggerClasses()).toContain('bg-gray-50');
    expect(triggerOf(f).disabled).toBe(true);
    f.componentInstance.toggleDropdown();
    expect(f.componentInstance.isOpen()).toBe(false);
  });

  it('sizes the option rows and icons from the same size input', async () => {
    const sm = (await setup({ size: 'sm' })).componentInstance;
    expect(sm.optionPadClass()).toBe('px-2.5 py-1.5');
    expect(sm.iconSizeClass()).toBe('h-3.5 w-3.5');
    expect(sm.chevronSizeClass()).toBe('h-3 w-3');
    expect(sm.chipTextClass()).toBe('text-xs');

    const lg = (await setup({ size: 'lg' })).componentInstance;
    expect(lg.optionPadClass()).toBe('px-4 py-2.5');
    expect(lg.optionTextClass()).toBe('text-base');
    expect(lg.chipTextClass()).toBe('text-sm');
  });

  it('falls back to the gray badge palette for an unknown badge colour', async () => {
    const c = (await setup()).componentInstance;
    expect(c.badgeColorMap['purple']).toContain('purple');
    expect(c.badgeColorMap['chartreuse']).toBeUndefined();
  });

  it('appends customClass to the root wrapper', async () => {
    const f = await setup({ customClass: 'w-64' });
    expect(f.nativeElement.querySelector('.w-64')).not.toBeNull();
  });
});

/**
 * ★ THE FREE/PRO LINE. `variant: 'floating'` is a Pro feature: the free
 * `SelectVariant` union does not list it and `isFloating()` is hard-wired to
 * false. A free build handed that variant must therefore degrade to the plain
 * stacked layout — silently, without a broken half-floating field — and must
 * NOT quietly ship the Pro chrome.
 */
describe('SvSelectDropdownComponent — no floating variant (free tier)', () => {
  /** `variant` is typed to exclude it, so this is how a stray value arrives. */
  const floatingish = { variant: 'floating' as unknown as 'default' };

  it('never reports itself as floating', async () => {
    const f = await setup({ ...floatingish, label: 'Country', value: 'a' });
    expect(f.componentInstance.isFloating()).toBe(false);
  });

  it('keeps the label above the trigger rather than inside it', async () => {
    const f = await setup({ ...floatingish, label: 'Country' });
    const label = f.nativeElement.querySelector('label')!;

    expect(label.textContent).toContain('Country');
    // The Pro floating label is absolutely positioned inside the trigger
    // wrapper; the free one is a plain stacked label.
    expect(label.className).not.toContain('absolute');
    expect(label.parentElement!.querySelector('button[role="combobox"]')).toBeNull();
  });

  it('keeps the standard trigger geometry, not the taller floating box', async () => {
    const c = (await setup({ ...floatingish, label: 'Country' })).componentInstance;
    expect(c.triggerClasses()).toContain('min-h-10');
    expect(c.triggerClasses()).not.toContain('min-h-14');
    expect(c.triggerClasses()).not.toContain('pt-3 pb-2');
  });

  /** Nothing overlaps the placeholder here, so it stays visible at rest. */
  it('shows the placeholder straight away', async () => {
    const f = await setup({ ...floatingish, label: 'Country', placeholder: 'Pick one' });
    expect(f.componentInstance.labelIsFloated()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Pick one');
  });

  it('shows no compact "(opt)" tag — only the full optional wording', async () => {
    const f = await setup({ ...floatingish, label: 'Country', optionalTag: true });
    expect(f.nativeElement.textContent).toContain('(optional)');
    expect(f.nativeElement.textContent).not.toContain('(opt)</');
  });
});
