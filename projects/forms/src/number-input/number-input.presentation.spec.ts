import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvNumberInputComponent } from './number-input.component';

/**
 * The sizing and preset work is class arithmetic, and class arithmetic is
 * exactly the kind of code that rots invisibly: a `switch` arm that returns the
 * wrong height still renders a working spinner, so nothing fails and nobody
 * looks. Each test below therefore pins one arm against its neighbours — the
 * assertions are as much "and NOT the other size" as "this size".
 *
 * Everything is read off the DOM through public computed outputs; no protected
 * member is reached into.
 */

async function setup(inputs: ComponentInput<SvNumberInputComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvNumberInputComponent, { inputs });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const field = (host: HTMLElement) => host.querySelector('input') as HTMLInputElement;
const buttons = (host: HTMLElement) => [...host.querySelectorAll('button')];

describe('SvNumberInputComponent — size', () => {
  it('gives each size a distinct control height', async () => {
    const heights: Record<string, string> = {};
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size });
      heights[size] = fixture.componentInstance.inputHeight();
    }
    expect(heights['sm']).toBe('h-8 text-xs');
    expect(heights['md']).toBe('h-9 text-sm');
    expect(heights['lg']).toBe('h-11 text-base');
    expect(new Set(Object.values(heights)).size).toBe(3); // no two alias
  });

  it('sizes the stepper buttons to match the field', async () => {
    const sm = await setup({ size: 'sm' });
    expect(sm.fixture.componentInstance.btnSize()).toBe('h-8 w-8 text-xs');
    const lg = await setup({ size: 'lg' });
    expect(lg.fixture.componentInstance.btnSize()).toBe('h-11 w-11 text-base');
    const md = await setup({ size: 'md' });
    expect(md.fixture.componentInstance.btnSize()).toBe('h-9 w-9 text-sm');
  });

  it('sizes the label to match, and renders it that way', async () => {
    const sm = await setup({ size: 'sm', label: 'Qty' });
    expect(sm.fixture.componentInstance.labelSize()).toBe('text-xs');
    expect(el(sm.fixture).querySelector('label')?.className).toContain('text-xs');

    const lg = await setup({ size: 'lg', label: 'Qty' });
    expect(lg.fixture.componentInstance.labelSize()).toBe('text-base');
    expect(el(lg.fixture).querySelector('label')?.className).toContain('text-base');

    const md = await setup({ size: 'md', label: 'Qty' });
    expect(md.fixture.componentInstance.labelSize()).toBe('text-sm');
  });
});

describe('SvNumberInputComponent — the quantity preset', () => {
  it('overrides the size-derived button height with its own fixed one', async () => {
    // The preset is a *layout*, so it has to win over `size`. A quantity
    // stepper that shrinks because someone passed size="sm" is not the preset.
    const { fixture } = await setup({ preset: 'quantity', size: 'sm' });
    const c = fixture.componentInstance;
    expect(c.qtyMode()).toBe(true);
    expect(c.btnSize()).toBe('h-11 w-11 text-lg');
    expect(c.inputBoxClass()).toBe('w-16 h-11 text-base');
    expect(c.iconSize()).toBe('h-4 w-4');
  });

  it('rounds the group and the outer button corners more than the default', async () => {
    const qty = await setup({ preset: 'quantity' });
    expect(qty.fixture.componentInstance.groupClass()).toContain('rounded-xl w-fit');
    expect(qty.fixture.componentInstance.decBtnClass()).toContain('rounded-l-[11px]');
    expect(qty.fixture.componentInstance.incBtnClass()).toContain('rounded-r-[11px]');

    const plain = await setup({});
    expect(plain.fixture.componentInstance.groupClass()).toContain('rounded-md');
    expect(plain.fixture.componentInstance.decBtnClass()).toContain('rounded-l-[5px]');
    expect(plain.fixture.componentInstance.incBtnClass()).toContain('rounded-r-[5px]');
    expect(plain.fixture.componentInstance.iconSize()).toBe('h-3.5 w-3.5');
    expect(plain.fixture.componentInstance.inputBoxClass()).toContain('flex-1');
  });

  it('uses a white button face in the quantity preset and a grey one otherwise', async () => {
    const qty = await setup({ preset: 'quantity' });
    expect(qty.fixture.componentInstance.decBtnClass()).toContain('bg-white');

    const plain = await setup({});
    expect(plain.fixture.componentInstance.decBtnClass()).toContain('bg-gray-50');
    expect(plain.fixture.componentInstance.decBtnClass()).not.toContain('bg-white');
  });

  it('renders the preset classes onto the real buttons', async () => {
    const { fixture } = await setup({ preset: 'quantity', value: 5, min: 0, max: 10 });
    // Angular merges `[class]` into the element's class list, which the DOM
    // then reports in its own order — so match on tokens, not a substring.
    const [dec, inc] = buttons(el(fixture));
    for (const token of ['h-11', 'w-11', 'rounded-l-[11px]']) {
      expect(dec.classList.contains(token)).toBe(true);
    }
    expect(inc.classList.contains('rounded-r-[11px]')).toBe(true);
    expect(field(el(fixture)).classList.contains('w-16')).toBe(true);
  });
});

describe('SvNumberInputComponent — variant affixes', () => {
  it('adds a currency symbol only for the currency variant', async () => {
    const money = await setup({ variant: 'currency', value: 12, decimals: 2 });
    expect(money.fixture.componentInstance.effectivePrefix()).toBe('$');
    expect(el(money.fixture).textContent).toContain('$');

    const plain = await setup({ variant: 'default', value: 12 });
    expect(plain.fixture.componentInstance.effectivePrefix()).toBe('');
  });

  it('adds a percent sign only for the percentage variant', async () => {
    const pct = await setup({ variant: 'percentage', value: 40 });
    expect(pct.fixture.componentInstance.effectiveSuffix()).toBe('%');
    expect(el(pct.fixture).textContent).toContain('%');

    const plain = await setup({ variant: 'default', value: 40 });
    expect(plain.fixture.componentInstance.effectiveSuffix()).toBe('');
  });

  it('lets an explicit prefix or suffix beat the variant preset', async () => {
    const { fixture } = await setup({ variant: 'currency', prefix: '€', suffix: 'kg' });
    expect(fixture.componentInstance.effectivePrefix()).toBe('€');
    expect(fixture.componentInstance.effectiveSuffix()).toBe('kg');
  });

  it('announces the affixed value, and stays silent when there is no affix', async () => {
    // `aria-valuetext` is what a screen reader reads instead of the raw number.
    // Emitting it unconditionally would make every plain field announce its own
    // value twice.
    const money = await setup({ variant: 'currency', value: 12, decimals: 2 });
    expect(field(el(money.fixture)).getAttribute('aria-valuetext')).toBe('$12.00');

    const plain = await setup({ value: 12 });
    expect(field(el(plain.fixture)).getAttribute('aria-valuetext')).toBeNull();
  });
});

describe('SvNumberInputComponent — error styling', () => {
  it('turns the hint red once there is an error, and leaves it grey otherwise', async () => {
    const bad = await setup({ errorMessage: 'Too many', hint: 'Up to 10' });
    expect(bad.fixture.componentInstance.hintColorClass()).toContain('text-danger-600');
    expect(bad.fixture.componentInstance.groupClass()).toContain('border-danger-400');

    const good = await setup({ hint: 'Up to 10' });
    expect(good.fixture.componentInstance.hintColorClass()).toContain('text-gray-500');
    expect(good.fixture.componentInstance.groupClass()).toContain('border-gray-300');
  });

  it('marks the disabled group as such', async () => {
    const { fixture } = await setup({ disabled: true });
    expect(fixture.componentInstance.groupClass()).toContain('cursor-not-allowed');
  });

  it('reports a string serverError as-is and an error object by its message', async () => {
    const asString = await setup({ serverError: 'Out of stock' });
    expect(asString.fixture.componentInstance.resolvedError()).toBe('Out of stock');

    const asObject = await setup({ serverError: { message: 'Out of stock' } });
    expect(asObject.fixture.componentInstance.resolvedError()).toBe('Out of stock');
  });
});

describe('SvNumberInputComponent — writeValue', () => {
  it('treats a null from the form model as zero', async () => {
    // Reactive forms hand `null` to `writeValue` for an empty control, and
    // `value.toFixed()` on null throws — taking the whole form down on reset().
    const { fixture } = await setup({ value: 7 });
    fixture.componentInstance.writeValue(null as unknown as number);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(0);
    expect(field(el(fixture)).value).toBe('0');
  });

  it('keeps a real zero rather than confusing it with empty', async () => {
    const { fixture } = await setup({ value: 7 });
    fixture.componentInstance.writeValue(0);
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('accepts an ordinary number', async () => {
    const { fixture } = await setup({ value: 7 });
    fixture.componentInstance.writeValue(42);
    expect(fixture.componentInstance.value()).toBe(42);
  });
});
