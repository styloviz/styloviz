import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvColorPickerComponent } from './color-picker.component';
import { until } from '../../../../src/testing/async';

/**
 * The keyboard axes the sibling specs do not walk (brightness and the opacity
 * rail's right-hand keys), the HSL conversion's magenta branch, and the panel
 * lifecycle around scroll and destroy.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvColorPickerComponent, { inputs });
  return fixture;
}

const portal = () => document.querySelector<HTMLElement>('.sv-cp-portal');
const trigger = (f: { nativeElement: HTMLElement }) =>
  f.nativeElement.querySelector<HTMLButtonElement>('[data-trigger]')!;
const gradient = () => portal()!.querySelector<HTMLElement>('[data-gradient]')!;

async function open(f: { nativeElement: HTMLElement; detectChanges(): void }) {
  trigger(f).click();
  f.detectChanges();
  await until(() => portal() !== null, { label: 'the picker panel' });
}

function press(node: HTMLElement, key: string, shiftKey = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  node.dispatchEvent(e);
  return e;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

afterEach(() => {
  document.querySelectorAll('.sv-cp-portal').forEach((n) => n.remove());
});

describe('SvColorPickerComponent — the brightness axis', () => {
  it('moves brightness up and down with the vertical arrows', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const c = fixture.componentInstance;
    const v = c.brightness();

    press(gradient(), 'ArrowDown');
    expect(c.brightness()).toBeCloseTo(v - 0.02, 5);

    press(gradient(), 'ArrowUp');
    expect(c.brightness()).toBeCloseTo(v, 5);
  });

  it('takes a bigger brightness step with Shift held', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const v = fixture.componentInstance.brightness();
    press(gradient(), 'ArrowDown', true);
    expect(fixture.componentInstance.brightness()).toBeCloseTo(v - 0.1, 5);
  });

  it('clamps brightness at black and at full, rather than wrapping', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const c = fixture.componentInstance;

    for (let i = 0; i < 60; i++) press(gradient(), 'ArrowDown');
    expect(c.brightness()).toBe(0);
    press(gradient(), 'ArrowDown');
    expect(c.brightness()).toBe(0);

    for (let i = 0; i < 60; i++) press(gradient(), 'ArrowUp');
    expect(c.brightness()).toBe(1);
    press(gradient(), 'ArrowUp');
    expect(c.brightness()).toBe(1);
  });

  it('leaves a key it does not handle to the page', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const before = fixture.componentInstance.brightness();
    const e = press(gradient(), 'PageUp');
    expect(e.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.brightness()).toBe(before);
  });
});

describe('SvColorPickerComponent — the opacity rail', () => {
  async function railFixture() {
    const fixture = await setup({ value: '#3b82f6', showAlpha: true });
    await open(fixture);
    return { fixture, rail: screen.getByRole('slider', { name: 'Opacity' }) };
  }

  it('increases opacity on ArrowRight and ArrowUp', async () => {
    const { fixture, rail } = await railFixture();
    const c = fixture.componentInstance;
    press(rail, 'Home');
    expect(c.alpha()).toBe(0);

    press(rail, 'ArrowRight');
    expect(c.alpha()).toBe(0.01);
    press(rail, 'ArrowUp');
    expect(c.alpha()).toBe(0.02);
  });

  it('moves opacity ten points at a time with Shift held', async () => {
    const { fixture, rail } = await railFixture();
    const c = fixture.componentInstance;
    press(rail, 'Home');
    press(rail, 'ArrowRight', true);
    expect(c.alpha()).toBe(0.1);
    press(rail, 'ArrowLeft', true);
    expect(c.alpha()).toBe(0);
  });

  it('rounds opacity to whole percents so the value never drifts', async () => {
    // 0.1 + 0.01 is 0.11000000000000001 in binary floating point, and that ends
    // up in the emitted `rgba(...)` string verbatim.
    const { fixture, rail } = await railFixture();
    press(rail, 'Home');
    press(rail, 'ArrowRight', true);
    press(rail, 'ArrowRight');
    expect(fixture.componentInstance.alpha()).toBe(0.11);
  });

  it('leaves an unhandled key alone', async () => {
    const { fixture, rail } = await railFixture();
    const before = fixture.componentInstance.alpha();
    const e = press(rail, 'PageDown');
    expect(e.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.alpha()).toBe(before);
  });
});

describe('SvColorPickerComponent — the hue rail', () => {
  it('leaves a key it does not handle to the page', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const rail = screen.getByRole('slider', { name: 'Hue' });
    const before = fixture.componentInstance.hue();
    const e = press(rail, 'PageUp');
    expect(e.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.hue()).toBe(before);
  });
});

describe('SvColorPickerComponent — HSL output', () => {
  it('places a magenta on the red side of the wheel, not 360° away', async () => {
    // The `max === r` arm has to add a full turn when green is below blue,
    // otherwise every colour between magenta and red comes out with a negative
    // hue and reads as a wildly different colour.
    const fixture = await setup({ value: '#ff0080', format: 'hsl' });
    expect(fixture.componentInstance.displayValue()).toBe('hsl(330, 100%, 50%)');
  });

  it('still places an orange correctly, where green is above blue', async () => {
    const fixture = await setup({ value: '#ff8000', format: 'hsl' });
    expect(fixture.componentInstance.displayValue()).toBe('hsl(30, 100%, 50%)');
  });

  it('handles the green- and blue-dominant arms too', async () => {
    const green = await setup({ value: '#00ff00', format: 'hsl' });
    expect(green.componentInstance.displayValue()).toBe('hsl(120, 100%, 50%)');

    const blue = await setup({ value: '#0000ff', format: 'hsl' });
    expect(blue.componentInstance.displayValue()).toBe('hsl(240, 100%, 50%)');
  });

  it('reports a grey as having no hue at all', async () => {
    const fixture = await setup({ value: '#808080', format: 'hsl' });
    expect(fixture.componentInstance.displayValue()).toBe('hsl(0, 0%, 50%)');
  });

  it('uses the light-side saturation formula above 50% lightness', async () => {
    // `l > 0.5` picks a different denominator. A pale colour is the only way to
    // reach it, and getting it wrong makes every pastel report as over-saturated.
    const fixture = await setup({ value: '#ffcccc', format: 'hsl' });
    expect(fixture.componentInstance.displayValue()).toBe('hsl(0, 100%, 90%)');
  });
});

describe('SvColorPickerComponent — panel lifecycle', () => {
  it('closes on a second toggle', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(portal()).toBeNull();
  });

  it('refuses to open when the form has disabled it', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(portal()).toBeNull();
  });

  it('stays open for a mousedown on its own trigger', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    trigger(fixture).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(portal()).not.toBeNull();
  });

  it('coalesces a burst of scrolls into one recalculation', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const t = trigger(fixture);
    let measurements = 0;
    // ★ An explicit rect: jsdom measures nothing, so the count is what is under
    // test here, not the geometry.
    const r = { top: 100, bottom: 130, left: 40, right: 240, width: 200, height: 30, x: 40, y: 100 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(measurements).toBe(1);
  });

  it('ignores a scroll while closed', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    const t = trigger(fixture);
    let measurements = 0;
    const r = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(measurements).toBe(0);
  });

  it('does not recalculate for a frame that lands after the panel closed', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    const t = trigger(fixture);
    let measurements = 0;
    const r = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    fixture.componentInstance.close();
    fixture.detectChanges();
    await nextFrame();
    expect(measurements).toBe(0);
  });

  it('cancels a queued frame when destroyed', async () => {
    const fixture = await setup({ value: '#3b82f6' });
    await open(fixture);
    window.dispatchEvent(new Event('scroll'));
    expect(() => fixture.destroy()).not.toThrow();
    await nextFrame();
    expect(portal()).toBeNull();
  });
});
