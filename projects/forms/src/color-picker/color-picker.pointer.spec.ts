import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvColorPickerComponent } from './color-picker.component';
import { until } from '../../../../src/testing/async';

/**
 * Pointer dragging, the colour maths at its awkward inputs, and the panel's
 * placement — the parts the sibling spec (keyboard, ARIA, forms) leaves alone.
 *
 * ★ EVERY RECT HERE IS AN EXPLICIT STUB. jsdom lays nothing out, so
 * `getBoundingClientRect()` is all zeros and the drag arithmetic would divide
 * by a zero width and yield NaN for any input. The rails are given the
 * geometry a browser would report for the panel's own CSS (a 240×160 gradient
 * box, a 240×12 rail), so what is under test is the arithmetic.
 */

async function setup(inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvColorPickerComponent, { inputs, on });
  return fixture;
}

const portal = () => document.querySelector<HTMLElement>('.sv-cp-portal');
const trigger = (f: { nativeElement: HTMLElement }) =>
  f.nativeElement.querySelector<HTMLButtonElement>('[data-trigger]')!;

async function open(f: { nativeElement: HTMLElement; detectChanges(): void }) {
  trigger(f).click();
  f.detectChanges();
  await until(() => portal() !== null, { label: 'the picker panel' });
}

const rect = (width: number, height: number, left = 0, top = 0) =>
  () => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

/** Give the three rails the geometry a browser would report for them. */
function stubRails(c: SvColorPickerComponent): void {
  c.gradientCanvas()!.nativeElement.getBoundingClientRect = rect(240, 160);
  c.hueSlider()!.nativeElement.getBoundingClientRect = rect(240, 12);
  const alpha = c.alphaSlider();
  if (alpha) alpha.nativeElement.getBoundingClientRect = rect(240, 12);
}

const mouse = (type: string, clientX: number, clientY = 0) =>
  new MouseEvent(type, { clientX, clientY, bubbles: true });
const touch = (clientX: number, clientY = 0) =>
  ({ touches: [{ clientX, clientY }] }) as unknown as TouchEvent;

afterEach(() => document.querySelectorAll('.sv-cp-portal').forEach((n) => n.remove()));

describe('SvColorPickerComponent — dragging the gradient', () => {
  it('maps a pointer position onto saturation and brightness', async () => {
    const seen: string[] = [];
    const f = await setup({}, { colorChange: (v: string) => seen.push(v) });
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onGradientMousedown(mouse('mousedown', 120, 40)); // half across, quarter down
    expect(c.saturation()).toBeCloseTo(0.5, 5);
    expect(c.brightness()).toBeCloseTo(0.75, 5);
    expect(seen).toHaveLength(1);
  });

  it('keeps following the pointer until the button comes up', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onGradientMousedown(mouse('mousedown', 0, 160));
    document.dispatchEvent(mouse('mousemove', 240, 0));
    expect(c.saturation()).toBe(1);
    expect(c.brightness()).toBe(1);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.dispatchEvent(mouse('mousemove', 0, 160));
    // The drag has ended, so the move must be ignored entirely.
    expect(c.saturation()).toBe(1);
  });

  it('clamps a pointer dragged outside the box to its edges', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onGradientMousedown(mouse('mousedown', -500, -500));
    expect(c.saturation()).toBe(0);
    expect(c.brightness()).toBe(1);

    c.onGradientMousedown(mouse('mousedown', 900, 900));
    expect(c.saturation()).toBe(1);
    expect(c.brightness()).toBe(0);
  });

  it('follows a touch as well as a mouse', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onGradientTouch(touch(60, 80));
    expect(c.saturation()).toBeCloseTo(0.25, 5);
    expect(c.brightness()).toBeCloseTo(0.5, 5);
  });

  it('ignores a touch event that carries no touch at all', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);
    const before = c.saturation();

    const empty = { touches: [] } as unknown as TouchEvent;
    c.onGradientTouch(empty);
    c.onHueTouch(empty);
    c.onAlphaTouch(empty);
    expect(c.saturation()).toBe(before);
  });

  it('does nothing at all while the panel is shut and the rails do not exist', async () => {
    const seen: string[] = [];
    const f = await setup({}, { colorChange: (v: string) => seen.push(v) });
    const c = f.componentInstance;
    expect(c.gradientCanvas()).toBeUndefined();

    c.onGradientMousedown(mouse('mousedown', 120, 40));
    c.onHueMousedown(mouse('mousedown', 120));
    expect(seen).toEqual([]);
  });
});

describe('SvColorPickerComponent — dragging the hue rail', () => {
  it('maps the position onto degrees and updates the hex field with it', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onHueMousedown(mouse('mousedown', 120)); // half way = 180°
    expect(c.hue()).toBeCloseTo(180, 5);
    expect(c.hexInput()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clamps past either end of the rail', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onHueMousedown(mouse('mousedown', -40));
    expect(c.hue()).toBe(0);
    c.onHueMousedown(mouse('mousedown', 400));
    expect(c.hue()).toBe(360);
  });

  it('keeps tracking through a move and stops on mouseup', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onHueMousedown(mouse('mousedown', 0));
    document.dispatchEvent(mouse('mousemove', 240));
    expect(c.hue()).toBe(360);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.dispatchEvent(mouse('mousemove', 0));
    expect(c.hue()).toBe(360);
  });

  it('follows a touch on the hue rail', async () => {
    const f = await setup();
    await open(f);
    const c = f.componentInstance;
    stubRails(c);
    c.onHueTouch(touch(60));
    expect(c.hue()).toBeCloseTo(90, 5);
  });
});

describe('SvColorPickerComponent — dragging the alpha rail', () => {
  it('maps the position onto whole percents', async () => {
    const f = await setup({ showAlpha: true });
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onAlphaMousedown(mouse('mousedown', 60));
    expect(c.alpha()).toBe(0.25);
    expect(c.currentColor()).toContain('rgba(');
  });

  it('clamps to fully transparent and fully opaque', async () => {
    const f = await setup({ showAlpha: true });
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onAlphaMousedown(mouse('mousedown', -10));
    expect(c.alpha()).toBe(0);
    c.onAlphaMousedown(mouse('mousedown', 999));
    expect(c.alpha()).toBe(1);
  });

  it('keeps tracking through a move and stops on mouseup', async () => {
    const f = await setup({ showAlpha: true });
    await open(f);
    const c = f.componentInstance;
    stubRails(c);

    c.onAlphaMousedown(mouse('mousedown', 240));
    document.dispatchEvent(mouse('mousemove', 0));
    expect(c.alpha()).toBe(0);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.dispatchEvent(mouse('mousemove', 240));
    expect(c.alpha()).toBe(0);
  });

  it('follows a touch on the alpha rail', async () => {
    const f = await setup({ showAlpha: true });
    await open(f);
    const c = f.componentInstance;
    stubRails(c);
    c.onAlphaTouch(touch(180));
    expect(c.alpha()).toBe(0.75);
  });

  /** No alpha rail is rendered at all unless the host asked for one. */
  it('has no alpha rail to drag when alpha is hidden', async () => {
    const f = await setup();
    await open(f);
    expect(f.componentInstance.alphaSlider()).toBeUndefined();
    f.componentInstance.onAlphaMousedown(mouse('mousedown', 120));
    expect(f.componentInstance.alpha()).toBe(1);
  });
});

describe('SvColorPickerComponent — the colour maths at its edges', () => {
  it('expands a three-digit hex the same as its six-digit form', async () => {
    const short = await setup({ value: '#0f0' });
    const long = await setup({ value: '#00ff00' });
    expect(short.componentInstance.displayValue()).toBe(long.componentInstance.displayValue());
  });

  it('reports a grey as zero-saturation HSL, whatever its lightness', async () => {
    const white = await setup({ value: '#ffffff', format: 'hsl' });
    expect(white.componentInstance.displayValue()).toBe('hsl(0, 0%, 100%)');
    const black = await setup({ value: '#000000', format: 'hsl' });
    expect(black.componentInstance.displayValue()).toBe('hsl(0, 0%, 0%)');
  });

  it.each([
    ['#ff0000', 'hsl(0, 100%, 50%)'],
    ['#00ff00', 'hsl(120, 100%, 50%)'],
    ['#0000ff', 'hsl(240, 100%, 50%)'],
    ['#00ffff', 'hsl(180, 100%, 50%)'],
  ])('converts %s to %s', async (hex, hsl) => {
    const f = await setup({ value: hex, format: 'hsl' });
    expect(f.componentInstance.displayValue()).toBe(hsl);
  });

  /** A light colour takes the `l > 0.5` branch of the saturation formula. */
  it('keeps saturation right for a light and a dark shade of the same hue', async () => {
    const light = await setup({ value: '#ffcccc', format: 'hsl' });
    const dark = await setup({ value: '#330000', format: 'hsl' });
    expect(light.componentInstance.displayValue()).toBe('hsl(0, 100%, 90%)');
    expect(dark.componentInstance.displayValue()).toBe('hsl(0, 100%, 10%)');
  });

  it.each([0, 60, 120, 180, 240, 300, 360])(
    'round-trips a fully saturated hue at %s degrees',
    async (h) => {
      const f = await setup();
      await open(f);
      const c = f.componentInstance;
      c.hue.set(h);
      c.saturation.set(1);
      c.brightness.set(1);
      // Every sector of the HSV→RGB table must produce a colour whose own hue
      // reads back the same — a transposed row would rotate it by 60°.
      const hex = c.displayValue();
      const back = await setup({ value: hex });
      expect(Math.round(back.componentInstance.hue()) % 360).toBe(h % 360);
    },
  );

  it('leaves a value it cannot parse alone', async () => {
    const f = await setup({ value: '#3b82f6' });
    const before = f.componentInstance.displayValue();
    f.componentRef.setInput('value', 'rebeccapurple'); // not a hex
    f.detectChanges();
    expect(f.componentInstance.displayValue()).toBe(before);
  });

  it('ignores an empty value written by a form', async () => {
    const f = await setup({ value: '#ff0000' });
    f.componentInstance.writeValue('');
    expect(f.componentInstance.displayValue()).toBe('#ff0000');
  });

  it('places the selector and the hue handle where the value says', async () => {
    const f = await setup({ value: '#ff0000' });
    expect(f.componentInstance.selectorPosition()).toEqual({ left: '100%', top: '0%' });
    expect(f.componentInstance.huePosition()).toBe('0%');
  });

  it.each([
    ['sm', 'h-7', 'h-4 w-4'],
    ['md', 'h-9', 'h-5 w-5'],
    ['lg', 'h-11', 'h-6 w-6'],
  ])('sizes the trigger and its chip for %s', async (size, trig, chip) => {
    const f = await setup({ size });
    expect(f.componentInstance.triggerSizeClass()).toContain(trig);
    expect(f.componentInstance.swatchSizeClass()).toBe(chip);
  });

  it('names the trigger with the value, with or without a field label', async () => {
    const named = await setup({ value: '#ff0000', label: 'Brand' });
    expect(named.componentInstance.triggerAriaLabel()).toBe('Brand: vivid red, #ff0000');
    const bare = await setup({ value: '#ff0000' });
    expect(bare.componentInstance.triggerAriaLabel()).toBe('Pick colour: vivid red, #ff0000');
  });
});

/**
 * Placement. Every rect below is an explicit stub — see the file header.
 */
describe('SvColorPickerComponent — where the panel goes', () => {
  const stubTrigger = (f: { nativeElement: HTMLElement }, r: Partial<DOMRect>) => {
    trigger(f).getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...r }) as DOMRect;
  };

  it('drops below a trigger near the top', async () => {
    const f = await setup();
    stubTrigger(f, { top: 40, bottom: 70, left: 30, right: 130 });
    await open(f);

    const style = f.componentInstance.panelStyle();
    expect(f.componentInstance.openAbove()).toBe(false);
    expect(f.componentInstance.alignRight()).toBe(false);
    expect(style['top']).toBe('76px');
    expect(style['left']).toBe('30px');
    expect(style['width']).toBe('264px');
  });

  it('flips above a trigger with more room over it', async () => {
    const f = await setup();
    stubTrigger(f, { top: 700, bottom: 730, left: 30, right: 130 });
    await open(f);

    const style = f.componentInstance.panelStyle();
    expect(f.componentInstance.openAbove()).toBe(true);
    expect(style['bottom']).toBe(`${768 - 700 + 6}px`);
    expect(style['maxHeight']).toBe(`${700 - 6 - 8}px`);
  });

  it('right-anchors a trigger too close to the right edge', async () => {
    const f = await setup();
    stubTrigger(f, { top: 40, bottom: 70, left: 900, right: 1000 });
    await open(f);

    const style = f.componentInstance.panelStyle();
    expect(f.componentInstance.alignRight()).toBe(true);
    expect(style['right']).toBe(`${1024 - 1000}px`);
    expect(style['left']).toBeUndefined();
  });

  it('keeps a usable height when the chosen side has almost none', async () => {
    const f = await setup();
    stubTrigger(f, { top: 4, bottom: 764, left: 30, right: 130 });
    await open(f);
    expect(f.componentInstance.panelStyle()['maxHeight']).toBe('160px');
  });

  it('follows the trigger while an ancestor scrolls, and ignores scroll when shut', async () => {
    const f = await setup();
    stubTrigger(f, { top: 40, bottom: 70, left: 30, right: 130 });
    await open(f);
    expect(f.componentInstance.panelStyle()['top']).toBe('76px');

    stubTrigger(f, { top: 140, bottom: 170, left: 30, right: 130 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => f.componentInstance.panelStyle()['top'] === '176px', {
      label: 'the panel to track the trigger',
    });

    f.componentInstance.close();
    f.detectChanges();
    const frozen = f.componentInstance.panelStyle();
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(f.componentInstance.panelStyle()).toBe(frozen);
  });

  it('closes on a window resize', async () => {
    const f = await setup();
    await open(f);
    window.dispatchEvent(new Event('resize'));
    f.detectChanges();
    expect(portal()).toBeNull();
  });

  it('ignores a resize and an outside click while it is shut', async () => {
    const f = await setup();
    window.dispatchEvent(new Event('resize'));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(f.componentInstance.open()).toBe(false);
  });
});
