import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvCheckboxComponent } from './checkbox/checkbox.component';
import { SvRadioGroupComponent } from './radio-group/radio-group.component';
import { SvRatingComponent } from './rating/rating.component';
import { SvSegmentedControlComponent } from './segmented-control/segmented-control.component';
import { SvSliderComponent } from './slider/slider.component';

/**
 * `FL-J3-FI-02` / `FI-06-M3` — forced colours (Windows High Contrast).
 *
 * jsdom cannot emulate `forced-colors: active`, so this pins the CLASS
 * contract the media query hangs off: every element that says the control's
 * STATE with a fill carries a system-colour fallback, and the fallback differs
 * between states — the point is that "checked" and "unchecked" stop looking
 * the same. `scripts/check-reduced-motion.mjs` ledgers the same claims
 * statically; the Tailwind build emits each one as an `@media (forced-colors:
 * active)` rule with a system colour.
 */
const reset = () => TestBed.resetTestingModule();
const cls = (el: Element | null | undefined) => el?.getAttribute('class') ?? '';

describe('forced colours — sv-checkbox', () => {
  const box = (root: HTMLElement) => root.querySelector('span[aria-hidden="true"]');

  it('fills the box with Highlight only when checked or mixed', async () => {
    reset();
    const off = await render(SvCheckboxComponent, { inputs: { label: 'Off' } });
    expect(cls(box(off.fixture.nativeElement))).not.toContain('forced-colors:bg-[Highlight]');
    expect(cls(box(off.fixture.nativeElement))).toContain('forced-colors:border-[ButtonText]');

    for (const state of [{ checked: true }, { indeterminate: true }]) {
      reset();
      const on = await render(SvCheckboxComponent, { inputs: { label: 'On', ...state } });
      expect(cls(box(on.fixture.nativeElement))).toContain('forced-colors:bg-[Highlight]');
      const mark = on.fixture.nativeElement.querySelector('svg');
      expect(cls(mark)).toContain('forced-colors:text-[HighlightText]');
      expect(mark.querySelector('path').getAttribute('stroke')).toBe('currentColor');
    }
  });

  it('turns the shadow focus ring into a real outline', async () => {
    reset();
    const { fixture } = await render(SvCheckboxComponent, { inputs: { label: 'A' } });
    expect(cls(box(fixture.nativeElement))).toContain('forced-colors:peer-focus-visible:outline-solid');
  });
});

describe('forced colours — sv-radio-group', () => {
  const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

  it('paints the selected dot Highlight and edges the unselected ring in ButtonText', async () => {
    reset();
    const { fixture } = await render(SvRadioGroupComponent, { inputs: { options: OPTIONS, value: 'a', groupLabel: 'Pick' } });
    const c = fixture.componentInstance;
    expect(c.variantDot()).toContain('forced-colors:bg-[Highlight]');
    expect(c.dotClasses(OPTIONS[0])).toContain('forced-colors:border-[Highlight]');
    expect(c.dotClasses(OPTIONS[1])).toContain('forced-colors:border-[ButtonText]');
    const dot = fixture.nativeElement.querySelector('.rounded-full.forced-colors\\:bg-\\[Highlight\\]');
    expect(dot).not.toBeNull();
  });

  it('keeps the selected button style as the Highlight pair', async () => {
    reset();
    const { fixture } = await render(SvRadioGroupComponent, {
      inputs: { options: OPTIONS, value: 'b', radioStyle: 'button', groupLabel: 'Pick' },
    });
    const c = fixture.componentInstance;
    expect(c.buttonClasses(OPTIONS[1])).toContain('forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]');
    expect(c.buttonClasses(OPTIONS[0])).not.toContain('forced-colors:bg-[Highlight]');
  });
});

describe('forced colours — sv-segmented-control', () => {
  const OPTIONS = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }];

  for (const variant of ['default', 'bordered', 'pills'] as const) {
    it(`${variant}: only the selected segment takes the Highlight pair`, async () => {
      reset();
      const { fixture } = await render(SvSegmentedControlComponent, {
        inputs: { options: OPTIONS, value: 'day', variant, ariaLabel: 'Range' },
      });
      const [sel, other] = fixture.nativeElement.querySelectorAll('button');
      expect(cls(sel)).toContain('forced-colors:bg-[Highlight]');
      expect(cls(other)).not.toContain('forced-colors:bg-[Highlight]');
      expect(cls(other)).toContain('forced-colors:focus-visible:outline-solid');
    });
  }

  it('underline: a Highlight rule under the selected tab, Canvas under the rest', async () => {
    reset();
    const { fixture } = await render(SvSegmentedControlComponent, {
      inputs: { options: OPTIONS, value: 'week', variant: 'underline', ariaLabel: 'Range' },
    });
    const [other, sel] = fixture.nativeElement.querySelectorAll('button');
    expect(cls(sel)).toContain('forced-colors:border-[Highlight]');
    expect(cls(other)).toContain('forced-colors:border-[Canvas]');
  });

  it('swatch: colours survive forced colours and the selected one gets a Highlight outline', async () => {
    reset();
    const { fixture } = await render(SvSegmentedControlComponent, {
      inputs: {
        options: [{ value: 'red', label: 'Red', color: '#ef4444' }, { value: 'blue', label: 'Blue', color: '#3b82f6' }],
        value: 'red', variant: 'swatch', ariaLabel: 'Colour',
      },
    });
    const [sel, other] = fixture.nativeElement.querySelectorAll('button');
    expect(cls(sel)).toContain('forced-colors:outline-[Highlight]');
    expect(cls(other)).not.toContain('forced-colors:outline-[Highlight]');
    expect(cls(sel.querySelector('span'))).toContain('forced-colors:forced-color-adjust-none');
  });
});

describe('forced colours — sv-slider', () => {
  for (const range of [false, true]) {
    it(`${range ? 'range' : 'single'}: Highlight fill, GrayText track, ButtonText thumb`, async () => {
      reset();
      const { fixture } = await render(SvSliderComponent, { inputs: { range, label: 'Volume', showTicks: !range } });
      const html = fixture.nativeElement.innerHTML as string;
      expect(html).toContain('forced-colors:bg-[GrayText]');
      expect(fixture.componentInstance.fillColor()).toContain('forced-colors:bg-[Highlight]');
      const inputs = fixture.nativeElement.querySelectorAll('input[type="range"]');
      expect(inputs.length).toBe(range ? 2 : 1);
      for (const i of inputs) {
        expect(cls(i)).toContain('forced-colors:[&::-webkit-slider-thumb]:bg-[ButtonText]');
        expect(cls(i)).toContain('forced-colors:focus-visible:outline-solid');
      }
    });
  }
});

describe('forced colours — sv-rating', () => {
  it('filled stars are Highlight (outranking the inline colour), empty stars GrayText', async () => {
    reset();
    const { fixture } = await render(SvRatingComponent, { inputs: { value: 3, max: 5 } });
    const root = fixture.nativeElement as HTMLElement;
    const filled = root.querySelectorAll('span.start-0');
    expect(filled.length).toBe(3);
    for (const f of filled) expect(cls(f)).toContain('forced-colors:text-[Highlight]!');
    expect(root.innerHTML).toContain('forced-colors:text-[GrayText]');
    expect(cls(root.querySelector('[role="slider"]'))).toContain('forced-colors:focus-visible:outline-solid');
  });
});
