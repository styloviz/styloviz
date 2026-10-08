import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOverlayStackService } from '@styloviz/core';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * The edges of `sv-time-picker` the topic specs walk past: a host value that is
 * well-formed but not zero-padded, the seconds column under the keyboard, the
 * ends of a column when a `[min, max]` window has made the ends themselves
 * unreachable, and the typed field's keys other than a successful Enter.
 *
 * Keys are dispatched on the cells and the text field themselves — the panel is
 * portalled into `<body>`, so that is where a user's keystrokes land.
 */

async function setup(inputs: Partial<ComponentInput<SvTimePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvTimePickerComponent, {
    inputs: inputs as ComponentInput<SvTimePickerComponent>,
  });
  const c = r.fixture.componentInstance;
  const changes: string[] = [];
  c.changed.subscribe((v) => changes.push(v));
  return { ...r, c, changes };
}

const panel = (): HTMLElement | null => document.querySelector<HTMLElement>('.sv-tp-portal');
const cellIn = (column: string, item: string): HTMLElement =>
  panel()!.querySelector<HTMLElement>(`[data-col="${column}"] [data-cell="${item}"]`)!;
const typedField = (): HTMLInputElement => panel()!.querySelector<HTMLInputElement>('[data-typed]')!;

function press(target: Element, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

function typeInto(field: HTMLInputElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => document.querySelectorAll('.sv-tp-portal').forEach((el) => el.remove()));

describe('sv-time-picker — a value with a one-digit hour', () => {
  /**
   * ★★ `toMinutes` already reads `9:30` for `min`/`max`, so a host passing the
   *    same spelling as the VALUE is not exotic. It used to split to `'9'`,
   *    which matched no cell in `'00'…'23'`: the hour column had no tab stop at
   *    all, and ↓ in it started from the top and selected 01:30.
   */
  it('still gives the hour column its one tab stop, on the right cell', async () => {
    const { c } = await setup({ value: '9:30', format: '24h' });
    c.toggle();
    const stops = panel()!.querySelectorAll('[data-col="hours"] [tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('data-cell')).toBe('09');
  });

  /**
   * ★ The trigger and the panel's field are two spellings of one value, so
   *   they must be the SAME spelling: the field already showed `09:30` while the
   *   trigger repeated the host's `9:30` back.
   */
  it.each([
    ['24h', false, '09:30'],
    ['12h', false, '09:30 AM'],
    ['24h', true, '09:30:00'],
    ['12h', true, '09:30:00 AM'],
  ] as const)('shows it on the trigger exactly as the %s typed field does (seconds: %s)', async (format, withSeconds, shown) => {
    const { c, fixture } = await setup({ value: '9:30', format, withSeconds });
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('[data-trigger]')!;
    expect(trigger.textContent?.trim()).toBe(shown);
    c.toggle();
    expect(typedField().value).toBe(shown);
  });

  it('moves to the NEXT hour on ↓, not to the top of the column', async () => {
    const { c, changes } = await setup({ value: '9:30', format: '24h' });
    c.toggle();
    press(cellIn('hours', '09'), 'ArrowDown');
    expect(c.value()).toBe('10:30');
    expect(changes).toEqual(['10:30']);
  });
});

describe('sv-time-picker — the seconds column under the keyboard', () => {
  it('steps, pages and is never bounded by the minute-grained window', async () => {
    const { c } = await setup({
      value: '10:30:15', format: '24h', withSeconds: true, min: '10:30', max: '10:30',
    });
    c.toggle();
    press(cellIn('seconds', '15'), 'ArrowDown');
    expect(c.value()).toBe('10:30:16');
    press(cellIn('seconds', '16'), 'PageUp');
    expect(c.value()).toBe('10:30:11');
    press(cellIn('seconds', '11'), 'End');
    expect(c.value()).toBe('10:30:59');
  });
});

describe('sv-time-picker — the ends of a bounded column', () => {
  it('Home and End land on the first and last REACHABLE hour', async () => {
    const { c } = await setup({ value: '12:00', format: '24h', min: '08:55', max: '17:00' });
    c.toggle();
    press(cellIn('hours', '12'), 'End');
    expect(c.value()).toBe('17:00');

    press(cellIn('hours', '17'), 'Home');
    // Hour 08 is reachable from 08:55, and choosing it is clamped into the window.
    expect(c.value()).toBe('08:55');
  });

  it('PageUp toward a disabled stretch settles on the nearest reachable minute', async () => {
    const { c } = await setup({ value: '10:32', format: '24h', min: '10:30' });
    c.toggle();
    press(cellIn('minutes', '32'), 'PageUp');   // aims at :27, which is out of the window
    expect(c.value()).toBe('10:30');
  });

  it('stays put, and says nothing, when there is nowhere further to go', async () => {
    const { c, changes } = await setup({ value: '10:30', format: '24h', max: '10:30' });
    c.toggle();
    const ev = press(cellIn('minutes', '30'), 'ArrowDown');
    expect(ev.defaultPrevented).toBe(true);
    expect(c.value()).toBe('10:30');
    expect(changes).toEqual([]);
  });
});

describe('sv-time-picker — the typed field, beyond a good Enter', () => {
  it('opens empty when the host has cleared the value', async () => {
    const { c } = await setup({ value: '', format: '24h' });
    c.toggle();
    expect(typedField().value).toBe('');
  });

  it('spells midnight as 12 AM, and fills in seconds the value never had', async () => {
    const { c } = await setup({ value: '00:15', format: '12h', withSeconds: true });
    c.toggle();
    expect(typedField().value).toBe('12:15:00 AM');
  });

  it('reads a value with no minutes as the whole hour', async () => {
    const { c } = await setup({ value: '14', format: '24h' });
    c.toggle();
    expect(typedField().value).toBe('14:00');
  });

  it('keeps the panel open when Enter commits nothing it can read', async () => {
    const { c, changes } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    typeInto(typedField(), 'half nine');
    const ev = press(typedField(), 'Enter');
    expect(ev.defaultPrevented).toBe(true);
    expect(c.open()).toBe(true);
    TestBed.inject(ApplicationRef).tick();
    expect(typedField().getAttribute('aria-invalid')).toBe('true');
    expect(changes).toEqual([]);
  });

  it('Escape in the field throws the edit away and keeps the value', async () => {
    const { c, fixture, changes } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    const field = typedField();
    field.focus();
    typeInto(field, '25:99');
    press(field, 'Enter');                      // refused, and marked invalid
    fixture.detectChanges();
    expect(field.getAttribute('aria-invalid')).toBe('true');

    // A readable time this time — Escape must not commit that either.
    typeInto(field, '14:00');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(c.value()).toBe('09:00');
    expect(changes).toEqual([]);

    c.toggle();
    expect(typedField().value).toBe('09:00');
    expect(typedField().hasAttribute('aria-invalid')).toBe(false);
  });

  it('ignores every other key, so the field can be edited', async () => {
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    typeInto(typedField(), '14:3');
    for (const k of ['Backspace', 'ArrowLeft', '7']) {
      expect(press(typedField(), k).defaultPrevented, k).toBe(false);
    }
    expect(typedField().value).toBe('14:3');
    expect(c.value()).toBe('09:00');
  });
});

describe('sv-time-picker — bounds and the overlay stack', () => {
  it('treats a null bound from an untyped template as no bound', async () => {
    const { c } = await setup({
      value: '23:59', format: '24h',
      max: null as unknown as string, min: null as unknown as string,
    });
    c.toggle();
    expect(c.isHourDisabled('00')).toBe(false);
    expect(c.isHourDisabled('23')).toBe(false);
    expect(cellIn('hours', '23').hasAttribute('disabled')).toBe(false);
  });

  it('leaves Escape to a surface opened above it, then takes it', async () => {
    const { c, fixture } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    fixture.detectChanges();   // the panel takes its place on the overlay stack

    const child = TestBed.inject(SvOverlayStackService).push('anchored');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c.open()).toBe(true);

    child.release();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c.open()).toBe(false);
  });

  it('does nothing — and leaves no portal behind — when opened before it has rendered', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SvTimePickerComponent);
    // A host calling `toggle()` from its own `ngOnInit`, before this view exists.
    expect(() => fixture.componentInstance.toggle()).not.toThrow();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(panel()).toBeNull();
    fixture.destroy();
  });
});
