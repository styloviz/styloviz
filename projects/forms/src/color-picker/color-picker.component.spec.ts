import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvColorPickerComponent } from './color-picker.component';
import { DEFAULT_SWATCHES } from './color-picker.types';

/**
 * A colour picker has one promise above all others: the colour that goes in is
 * the colour that comes out. It was not keeping it. The HSV→RGB table had `q`
 * and `t` transposed, which rotated every result by a full hue sector —
 * selecting the Red preset handed the form back `#efef44`, and the default
 * `#3b82f6` rendered as `#3baff6`. Nothing about that is visible in a test that
 * only checks the panel opens, so the round trip is pinned first here.
 *
 * The panel itself is portalled into `<body>`, which is why Escape is worth its
 * own test: bound to the host it could never have fired, because focus moves
 * into the portal the moment the panel opens.
 */

async function setup(inputs: Partial<ComponentInput<SvColorPickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvColorPickerComponent, {
    inputs: inputs as ComponentInput<SvColorPickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]')!;
const panel = () => document.querySelector<HTMLElement>('.sv-cp-portal');
const gradient = () => screen.getByRole('slider', { name: 'Saturation and brightness' });
const hueRail = () => screen.getByRole('slider', { name: 'Hue' });
const hexField = () => screen.getByRole('textbox', { name: 'Hex color value' }) as HTMLInputElement;
const tick = () => new Promise((r) => setTimeout(r, 0));

async function open(f: { nativeElement: unknown; detectChanges(): void }) {
  await userEvent.click(trigger(f));
  f.detectChanges();
}

function press(target: HTMLElement, key: string, shiftKey = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

describe('SvColorPickerComponent — the colour that goes in comes out', () => {
  it.each(DEFAULT_SWATCHES.map((s) => [s.label, s.value] as const))(
    'round-trips %s exactly',
    async (_label, hex) => {
      const { fixture } = await setup({ value: hex });
      expect(fixture.componentInstance.displayValue()).toBe(hex);
    },
  );

  it('hands back the preset that was clicked, not its neighbour', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: '#3b82f6' });
    fixture.componentInstance.colorChange.subscribe((v) => seen.push(v));
    await open(fixture);

    await userEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(fixture.componentInstance.value()).toBe('#ef4444');
    expect(seen).toEqual(['#ef4444']);
  });

  it('marks the preset it is currently showing as pressed', async () => {
    const { fixture } = await setup({ value: '#22c55e' });
    await open(fixture);
    expect(screen.getByRole('button', { name: 'Green' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Red' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('treats the far end of the hue rail as red, not yellow', async () => {
    // Hue is a circle: 360 is 0. Un-wrapped it indexed one past the end of the
    // conversion table, and both End and a drag to the right edge came back
    // #ffff00.
    const { fixture } = await setup({ value: '#ff0000' });
    await open(fixture);

    press(hueRail(), 'End');
    expect(fixture.componentInstance.hue()).toBe(360);
    expect(fixture.componentInstance.value()).toBe('#ff0000');

    press(hueRail(), 'Home');
    expect(fixture.componentInstance.value()).toBe('#ff0000');
  });

  it('renders the value in the format the host asked for', async () => {
    const { fixture: hex } = await setup({ value: '#3b82f6' });
    expect(hex.componentInstance.displayValue()).toBe('#3b82f6');

    const { fixture: rgb } = await setup({ value: '#3b82f6', format: 'rgb' });
    expect(rgb.componentInstance.displayValue()).toBe('rgb(59, 130, 246)');

    const { fixture: hsl } = await setup({ value: '#3b82f6', format: 'hsl' });
    expect(hsl.componentInstance.displayValue()).toBe('hsl(217, 91%, 60%)');
  });

  it('adds the alpha channel to the value only when it is shown', async () => {
    const { fixture } = await setup({ value: '#3b82f6', showAlpha: true });
    expect(fixture.componentInstance.currentColor()).toBe('rgba(59,130,246,1)');

    const { fixture: opaque } = await setup({ value: '#3b82f6' });
    expect(opaque.componentInstance.currentColor()).toBe('#3b82f6');
  });
});

describe('SvColorPickerComponent — opening and closing', () => {
  it('mounts the panel outside its own element', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    expect(panel()).toBeNull();

    await open(fixture);
    expect(panel()).not.toBeNull();
    expect(el(fixture).contains(panel())).toBe(false);
    expect(trigger(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus into the panel so it can be used from the keyboard', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    await tick();
    expect(document.activeElement).toBe(gradient());
  });

  it('closes on Escape pressed inside the panel, and hands focus back', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    await tick();

    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger(fixture));
  });

  it('closes on a click outside it, leaving focus alone', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('stays open for a click inside it', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);

    hueRail().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).not.toBeNull();
  });

  it('refuses to open while disabled', async () => {
    const { fixture } = await setup({ value: '#3b82f6', disabled: true });
    await open(fixture);
    expect(panel()).toBeNull();
  });

  it('takes the panel down with it', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    fixture.destroy();
    expect(panel()).toBeNull();
  });
});

describe('SvColorPickerComponent — keyboard', () => {
  it('nudges saturation and brightness with the arrows', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    const c = fixture.componentInstance;
    const sat = c.saturation();

    press(gradient(), 'ArrowLeft');
    expect(c.saturation()).toBeCloseTo(sat - 0.02, 5);

    press(gradient(), 'ArrowRight');
    expect(c.saturation()).toBeCloseTo(sat, 5);
  });

  it('takes bigger steps with Shift held', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    const sat = fixture.componentInstance.saturation();

    press(gradient(), 'ArrowLeft', true);
    expect(fixture.componentInstance.saturation()).toBeCloseTo(sat - 0.1, 5);
  });

  it('stops at the ends instead of wrapping round', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    const c = fixture.componentInstance;

    press(gradient(), 'Home');
    expect(c.saturation()).toBe(0);
    press(gradient(), 'ArrowLeft');
    expect(c.saturation()).toBe(0);

    press(gradient(), 'End');
    expect(c.saturation()).toBe(1);
    press(gradient(), 'ArrowRight');
    expect(c.saturation()).toBe(1);
  });

  it('leaves keys it does not handle to the page', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    const ev = press(gradient(), 'Tab');
    expect(ev.defaultPrevented).toBe(false);

    const handled = press(gradient(), 'ArrowLeft');
    expect(handled.defaultPrevented).toBe(true);
  });

  it('moves hue by one degree, or ten with Shift, and clamps at both ends', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    const c = fixture.componentInstance;
    const hue = c.hue();

    press(hueRail(), 'ArrowRight');
    expect(c.hue()).toBeCloseTo(hue + 1, 5);

    press(hueRail(), 'ArrowLeft', true);
    expect(c.hue()).toBeCloseTo(hue - 9, 5);

    press(hueRail(), 'Home');
    press(hueRail(), 'ArrowDown');
    expect(c.hue()).toBe(0);

    press(hueRail(), 'End');
    press(hueRail(), 'ArrowUp');
    expect(c.hue()).toBe(360);
  });

  it('has no opacity rail unless alpha is shown', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    expect(screen.queryByRole('slider', { name: 'Opacity' })).toBeNull();
  });

  it('moves opacity in whole percents and clamps to the ends', async () => {
    const { fixture } = await setup({ value: '#3b82f6', showAlpha: true });
    await open(fixture);
    const rail = screen.getByRole('slider', { name: 'Opacity' });
    const c = fixture.componentInstance;

    press(rail, 'ArrowLeft');
    expect(c.alpha()).toBe(0.99);
    expect(c.alphaValue()).toBe(99);

    press(rail, 'Home');
    expect(c.alpha()).toBe(0);
    press(rail, 'ArrowDown');
    expect(c.alpha()).toBe(0);

    press(rail, 'End');
    expect(c.alpha()).toBe(1);
  });
});

describe('SvColorPickerComponent — what a screen reader is told', () => {
  it('gives the two-axis area a number and a sentence', async () => {
    // ARIA has no two-axis slider. Saturation is the horizontal axis the left
    // and right arrows move, so it carries the number; the text carries both.
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    expect(gradient().getAttribute('aria-valuenow')).toBe(String(fixture.componentInstance.saturationValue()));
    expect(gradient().getAttribute('aria-valuetext')).toBe('Saturation 76%, brightness 96%');
  });

  it('reports the hue as a whole number of degrees', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    expect(hueRail().getAttribute('aria-valuenow')).toBe('217');
  });

  it('names the panel and its preset row', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);
    expect(screen.getByRole('dialog', { name: 'Color picker' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Presets' })).toBeTruthy();
  });

  it('does not point at a label it never rendered', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
    // ★ The NAME comes before the code now: a reader gets the useful half
    //   immediately and can keep listening for the exact value if it wants it.
    //   `#3B82F6` read one character at a time is not an announcement.
    expect(trigger(fixture).getAttribute('aria-label')).toBe('Pick colour: vivid blue, #3b82f6');
  });

  it('is named by the computed label, not by the visible label span', async () => {
    // ★ `aria-labelledby` OUTRANKS `aria-label`, so pointing at the span
    // discarded the computed name — and the computed one carries the field name
    // AND the current value where the span carries only the field name. This
    // used to assert the opposite; the assertion was pinning the bug.
    // Gated by `aria-label-outranked`.
    const { fixture } = await setup({ value: '#3b82f6', label: 'Brand colour' });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-label')).toContain('Brand colour');
  });
});

describe('SvColorPickerComponent — the hex field', () => {
  it('applies a complete hex', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);

    const input = hexField();
    input.value = '#22c55e';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.value()).toBe('#22c55e');
  });

  it('ignores anything that is not one yet', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    await open(fixture);

    for (const partial of ['#22c', '22c55e', '#22c55', '#gggggg']) {
      const input = hexField();
      input.value = partial;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(fixture.componentInstance.value()).toBe('#3b82f6');
    }
  });
});

describe('SvColorPickerComponent — presets and forms', () => {
  it('takes the palette the host supplies', async () => {
    const { fixture } = await setup({
      value: '#3b82f6',
      swatches: [{ label: 'Brand', value: '#123456' }],
    });
    await open(fixture);
    expect(screen.getByRole('button', { name: 'Brand' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Red' })).toBeNull();
  });

  it('takes a value from a form and reports changes back', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: '#3b82f6' });
    fixture.componentInstance.registerOnChange((v) => seen.push(v));
    fixture.componentInstance.writeValue('#22c55e');
    fixture.detectChanges();
    expect(fixture.componentInstance.displayValue()).toBe('#22c55e');

    fixture.componentInstance.selectSwatch('#ef4444');
    expect(seen).toEqual(['#ef4444']);
  });

  it('marks itself touched when the panel closes', async () => {
    let touched = false;
    const { fixture } = await setup({ value: '#3b82f6' });
    fixture.componentInstance.registerOnTouched(() => { touched = true; });
    await open(fixture);
    fixture.componentInstance.close();
    expect(touched).toBe(true);
  });

  it('takes disabled from the form as well as its own input', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(trigger(fixture).disabled).toBe(true);
  });
});

describe('SvColorPickerComponent — the error slot', () => {
  it('renders a client-side message and points the trigger at it', async () => {
    const { fixture } = await setup({ value: '#3b82f6', errorMessage: 'Pick a brand colour.' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Pick a brand colour.');
    expect(trigger(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(trigger(fixture).getAttribute('aria-describedby')).toBe(alert.getAttribute('id'));
  });

  it('expires a server rejection once the colour changes', async () => {
    const { fixture } = await setup({ value: '#3b82f6', serverError: 'Too close to the error red.' });
    expect(screen.getByRole('alert').textContent).toContain('Too close to the error red.');

    fixture.componentInstance.selectSwatch('#22c55e');
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says nothing when there is nothing wrong', async () => {
    const { fixture } = await setup({ value: '#3b82f6' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-invalid')).toBeNull();
  });
});
