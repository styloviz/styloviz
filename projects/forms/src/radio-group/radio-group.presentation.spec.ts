import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvRadioGroupComponent } from './radio-group.component';
import type { RadioOption } from './radio-group.component';

/**
 * Layout, size and card/button styling. All of it is class arithmetic that a
 * screenshot would catch and a behavioural test never will — a grid that lays
 * out as a column still selects the right option.
 *
 * The interesting rule is the precedence one: `radioStyle: 'button'` owns its
 * own wrapper and must beat whatever `layout` says, because the button style is
 * a horizontal pill row by definition.
 */

const OPTIONS: RadioOption[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large', disabled: true },
];

async function setup(inputs: ComponentInput<SvRadioGroupComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvRadioGroupComponent, {
    inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvRadioGroupComponent>,
  });
}

describe('SvRadioGroupComponent — layout', () => {
  it('stacks vertically by default', async () => {
    const { fixture } = await setup({ value: 'md' });
    expect(fixture.componentInstance.wrapperClasses()).toBe('flex flex-col gap-3');
  });

  it('lays out in a wrapping row when horizontal', async () => {
    const { fixture } = await setup({ value: 'md', layout: 'horizontal' });
    expect(fixture.componentInstance.wrapperClasses()).toBe('flex flex-wrap gap-x-6 gap-y-3');
  });

  it('lays out in a responsive grid when grid', async () => {
    const { fixture } = await setup({ value: 'md', layout: 'grid' });
    expect(fixture.componentInstance.wrapperClasses()).toBe(
      'grid grid-cols-2 gap-3 sm:grid-cols-3',
    );
  });

  it('lets the button style override every layout', async () => {
    // The precedence, checked against the layout most likely to fight it.
    for (const layout of ['vertical', 'horizontal', 'grid'] as const) {
      const { fixture } = await setup({ value: 'md', layout, radioStyle: 'button' });
      expect(fixture.componentInstance.wrapperClasses()).toBe('flex flex-wrap gap-2');
    }
  });
});

describe('SvRadioGroupComponent — size', () => {
  it('scales the dot, the inner dot and the label together', async () => {
    const expected = {
      sm: { dot: 'h-3.5 w-3.5', inner: 'h-1.5 w-1.5', label: 'text-xs' },
      md: { dot: 'h-4 w-4', inner: 'h-2 w-2', label: 'text-sm' },
      lg: { dot: 'h-5 w-5', inner: 'h-2.5 w-2.5', label: 'text-base' },
    } as const;

    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ value: 'md', size });
      const c = fixture.componentInstance;
      expect(c.dotSize()).toBe(expected[size].dot);
      expect(c.innerDotSize()).toBe(expected[size].inner);
      expect(c.labelSize()).toBe(expected[size].label);
    }
  });

  it('keeps the inner dot smaller than the ring at every size', async () => {
    // Not a tautology: an inner dot at or above the ring size paints over the
    // border and the control stops reading as a radio at all.
    const px = (cls: string) => Number(cls.split(' ')[0].replace('h-', ''));
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ value: 'md', size });
      const c = fixture.componentInstance;
      expect(px(c.innerDotSize())).toBeLessThan(px(c.dotSize()));
    }
  });
});

describe('SvRadioGroupComponent — card style', () => {
  it('marks the selected card and leaves the others plain', async () => {
    const { fixture } = await setup({ value: 'md', radioStyle: 'card' });
    const c = fixture.componentInstance;
    expect(c.cardClasses(OPTIONS[1])).toContain('border-primary-500');
    expect(c.cardClasses(OPTIONS[0])).toContain('border-gray-200');
    expect(c.cardClasses(OPTIONS[0])).not.toContain('border-primary-500');
  });

  it('shows a disabled card as not clickable', async () => {
    const { fixture } = await setup({ value: 'md', radioStyle: 'card' });
    const c = fixture.componentInstance;
    expect(c.cardClasses(OPTIONS[2])).toContain('cursor-not-allowed');
    expect(c.cardClasses(OPTIONS[1])).toContain('cursor-pointer');
  });

  it('treats a whole-group disable the same as a per-option one', async () => {
    const { fixture } = await setup({ value: 'md', radioStyle: 'card', disabled: true });
    const c = fixture.componentInstance;
    expect(c.cardClasses(OPTIONS[0])).toContain('cursor-not-allowed');
  });
});

describe('SvRadioGroupComponent — hint colour and focusable option', () => {
  it('turns the hint red once there is an error', async () => {
    const bad = await setup({ value: 'md', hint: 'Pick one', errorMessage: 'Required' });
    expect(bad.fixture.componentInstance.hintColorClass()).toContain('text-danger-600');

    const good = await setup({ value: 'md', hint: 'Pick one' });
    expect(good.fixture.componentInstance.hintColorClass()).toContain('text-gray-500');
  });

  it('puts the first enabled option in the tab order when nothing is selected', async () => {
    const { fixture } = await setup({ value: '', radioStyle: 'button' });
    expect(fixture.componentInstance.focusableValue()).toBe('sm');
  });

  it('skips a disabled selection rather than trapping the tab order on it', async () => {
    // 'lg' is disabled. Selecting it (a stale server value, say) must not make
    // it the roving-tabindex holder — the group would be unreachable by keyboard.
    const { fixture } = await setup({ value: 'lg', radioStyle: 'button' });
    expect(fixture.componentInstance.focusableValue()).toBe('sm');
  });

  it('has no focusable option when every option is disabled', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvRadioGroupComponent, {
      inputs: {
        options: [{ value: 'a', label: 'A', disabled: true }],
        value: '',
      } as ComponentInput<SvRadioGroupComponent>,
    });
    expect(fixture.componentInstance.focusableValue()).toBe('');
  });

  it('treats a null from the form model as no selection', async () => {
    const { fixture } = await setup({ value: 'md' });
    fixture.componentInstance.writeValue(null as unknown as string);
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('reports a string serverError as-is and an error object by its message', async () => {
    const asString = await setup({ value: 'md', serverError: 'Pick a size' });
    expect(asString.fixture.componentInstance.resolvedError()).toBe('Pick a size');

    const asObject = await setup({ value: 'md', serverError: { message: 'Pick a size' } });
    expect(asObject.fixture.componentInstance.resolvedError()).toBe('Pick a size');
  });
});
