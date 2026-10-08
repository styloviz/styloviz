import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvSegmentedControlComponent,
  type SegmentOption,
} from './segmented-control.component';
import { until } from '../../../../src/testing/async';

/**
 * The five visual variants, the swatch picker (sold-out stock, colour dots) and
 * the roving-focus follow-up — the parts the sibling spec, which is about
 * structure and keyboard semantics, does not reach.
 */

const OPTIONS: SegmentOption[] = [
  { value: 'a', label: 'Day', icon: 'sun', badge: 3 },
  { value: 'b', label: 'Week' },
  { value: 'c', label: 'Month', disabled: true },
];

const SWATCHES: SegmentOption[] = [
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'blue', label: 'Blue', color: '#3b82f6', soldOut: true },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M', soldOut: true },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSegmentedControlComponent, {
    inputs: { options: OPTIONS, value: 'a', ...inputs },
  });
  return fixture;
}

const qa = (f: { nativeElement: HTMLElement }, sel: string) => [
  ...f.nativeElement.querySelectorAll<HTMLElement>(sel),
];
const buttons = (f: { nativeElement: HTMLElement }) => qa(f, 'button[role="radio"]');

describe('SvSegmentedControlComponent — sizes and variants', () => {
  it.each([
    ['xs', 'h-6', 'h-3 w-3'],
    ['sm', 'h-7', 'h-3.5 w-3.5'],
    ['md', 'h-9', 'h-4 w-4'],
    ['lg', 'h-11', 'h-5 w-5'],
  ])('sizes the segments and their icons for %s', async (size, seg, icon) => {
    const f = await setup({ size });
    expect(f.componentInstance.sizeClass()).toContain(seg);
    expect(f.componentInstance.iconSize()).toBe(icon);
  });

  it.each([
    ['default', 'bg-gray-100'],
    ['pills', 'gap-1'],
    ['underline', 'border-b'],
    ['bordered', 'rounded-xl border'],
    ['swatch', 'flex-wrap'],
  ])('wraps the %s variant in its own chrome', async (variant, cls) => {
    const f = await setup({ variant });
    expect(f.componentInstance.wrapperClass()).toContain(cls);
  });

  it.each([
    ['default', 'bg-white', 'text-gray-600'],
    ['bordered', 'bg-white', 'text-gray-600'],
    ['pills', 'bg-primary-600', 'hover:bg-gray-100'],
    ['underline', 'border-primary-600', 'border-transparent'],
  ])('styles the active and inactive %s segment differently', async (variant, on, off) => {
    const f = await setup({ variant });
    expect(f.componentInstance.buttonClass(OPTIONS[0])).toContain(on);
    expect(f.componentInstance.buttonClass(OPTIONS[1])).toContain(off);
  });

  it('marks a disabled segment as not-allowed in its class list', async () => {
    const f = await setup();
    expect(f.componentInstance.buttonClass(OPTIONS[2])).toContain('cursor-not-allowed');
    expect(f.componentInstance.buttonClass(OPTIONS[1])).toContain('cursor-pointer');
  });

  it('stretches the segments only when asked', async () => {
    const plain = await setup();
    expect(buttons(plain)[0].className).not.toContain('flex-1');
    const wide = await setup({ fullWidth: true });
    expect(buttons(wide)[0].className).toContain('flex-1');
    expect(wide.nativeElement.querySelector('[role="radiogroup"]')!.className).toContain('w-full');
  });

  it('dims the whole group when the control is disabled', async () => {
    const f = await setup({ disabled: true });
    expect(f.nativeElement.querySelector('[role="radiogroup"]')!.className).toContain('opacity-50');
  });

  it('renders an icon and a badge only where the option supplies them', async () => {
    const f = await setup();
    expect(qa(f, 'svg')).toHaveLength(1);
    expect(f.nativeElement.textContent).toContain('3');
  });

  /** A badge of `0` is a real count and must still render. */
  it('renders a zero badge rather than hiding it', async () => {
    const f = await setup({ options: [{ value: 'z', label: 'Zero', badge: 0 }] });
    expect(f.nativeElement.textContent).toContain('0');
  });

  it('names the group only when the host supplied a label', async () => {
    const bare = await setup();
    expect(bare.nativeElement.querySelector('[role="radiogroup"]')!.getAttribute('aria-label'))
      .toBeNull();
    const named = await setup({ ariaLabel: 'Range' });
    expect(named.nativeElement.querySelector('[role="radiogroup"]')!.getAttribute('aria-label'))
      .toBe('Range');
  });
});

describe('SvSegmentedControlComponent — the swatch variant', () => {
  const swatch = (inputs: Record<string, unknown> = {}) =>
    setup({ options: SWATCHES, variant: 'swatch', value: 'red', ...inputs });

  it('renders a colour dot for a coloured option and the label otherwise', async () => {
    const f = await swatch();
    const dots = qa(f, 'span[style*="background-color"]');
    expect(dots).toHaveLength(2);
    expect(f.nativeElement.textContent).toContain('S');
  });

  it('rings the chosen colour and merely outlines the others', async () => {
    const f = await swatch();
    expect(f.componentInstance.swatchClass(SWATCHES[0])).toContain('ring-2 ring-primary-500');
    expect(f.componentInstance.swatchClass(SWATCHES[1])).toContain('ring-inset');
  });

  it('marks the chosen size chip and leaves the rest plain', async () => {
    const f = await swatch({ value: 's' });
    expect(f.componentInstance.swatchClass(SWATCHES[2])).toContain('bg-primary-50');
    expect(f.componentInstance.swatchClass(SWATCHES[3])).not.toContain('bg-primary-50');
  });

  it('fades a sold-out colour and strikes through a sold-out chip', async () => {
    const f = await swatch();
    expect(f.componentInstance.swatchClass(SWATCHES[1])).toContain('opacity-45');
    expect(f.componentInstance.swatchClass(SWATCHES[3])).toContain('line-through');
    // The diagonal slash overlay is for coloured swatches only.
    expect(qa(f, '.rotate-45')).toHaveLength(1);
  });

  it('says "sold out" in the accessible name, and only there', async () => {
    const f = await swatch();
    const labels = buttons(f).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Red', 'Blue (sold out)', 'S', 'M (sold out)']);
  });

  it('refuses a sold-out option, from click and from Space alike', async () => {
    const chosen: string[] = [];
    const f = await swatch();
    f.componentInstance.changed.subscribe((v: string) => chosen.push(v));

    expect(f.componentInstance.isEnabled(SWATCHES[1])).toBe(false);
    f.componentInstance.select(SWATCHES[1]);
    f.componentInstance.onKeydown(
      new KeyboardEvent('keydown', { key: ' ', cancelable: true }),
      SWATCHES[1],
    );
    expect(chosen).toEqual([]);
    expect(f.componentInstance.value()).toBe('red');
    expect((buttons(f)[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('skips sold-out options when the arrows walk the group', async () => {
    const f = await swatch();
    f.componentInstance.onKeydown(
      new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
      SWATCHES[0],
    );
    // Blue is sold out, so the next stop is the 'S' chip.
    expect(f.componentInstance.value()).toBe('s');
  });

  it('shows the sold-out chip with a cursor that says so', async () => {
    const f = await swatch();
    expect(f.componentInstance.swatchClass(SWATCHES[3])).toContain('cursor-not-allowed');
    expect(f.componentInstance.swatchClass(SWATCHES[2])).toContain('cursor-pointer');
  });

  it('treats every option as non-interactive once the control is disabled', async () => {
    const f = await swatch({ disabled: true });
    expect(f.componentInstance.isEnabled(SWATCHES[0])).toBe(false);
    expect(f.componentInstance.swatchClass(SWATCHES[0])).toContain('cursor-not-allowed');
    expect(f.componentInstance.focusableValue()).toBe('');
    expect(buttons(f).every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
  });
});

describe('SvSegmentedControlComponent — focus follows the keyboard', () => {
  it('moves DOM focus onto the newly selected segment', async () => {
    const f = await setup();
    document.body.appendChild(f.nativeElement);

    f.componentInstance.onKeydown(
      new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
      OPTIONS[0],
    );
    f.detectChanges();

    // The focus call is deferred one turn so the roving tabindex has settled.
    await until(() => document.activeElement === buttons(f)[1], {
      label: 'focus to move to the newly selected segment',
    });
  });

  it('does not throw when the newly selected segment is not in the DOM', async () => {
    // A detached fixture is the same shape as a group re-rendered between the
    // keystroke and the deferred focus call.
    const f = await setup();
    f.componentInstance.onKeydown(
      new KeyboardEvent('keydown', { key: 'End', cancelable: true }),
      OPTIONS[0],
    );
    f.destroy();
    await new Promise((r) => setTimeout(r, 0));
    expect(true).toBe(true);
  });

  it('reports touched when a segment loses focus', async () => {
    const f = await setup();
    let touched = 0;
    f.componentInstance.registerOnTouched(() => touched++);
    buttons(f)[0].dispatchEvent(new Event('blur'));
    expect(touched).toBe(1);
  });

  it('takes a null written value as no selection', async () => {
    const f = await setup();
    f.componentInstance.writeValue(null as unknown as string);
    expect(f.componentInstance.value()).toBe('');
    // …and the first enabled segment becomes the tab stop.
    expect(f.componentInstance.focusableValue()).toBe('a');
  });
});
