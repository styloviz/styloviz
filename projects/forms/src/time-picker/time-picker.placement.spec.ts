import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * Placement, the scroll tracker, and the parsing corners.
 *
 * ★ jsdom lays nothing out: every `getBoundingClientRect()` is zeros and
 * `window.innerHeight` is a constant. A "the panel flipped above" assertion
 * against those numbers would be measuring nothing — 0 < 300 and 0 > 0 is
 * false, so the unstubbed environment can only ever produce ONE of the four
 * placements. So each placement test installs an explicit rect on the trigger
 * and explicit viewport dimensions, and asserts on the arithmetic the component
 * does with them. Nothing here is inferred from a measurement jsdom made.
 *
 * The constants are the component's own: PANEL_H 300, PANEL_W 220, GAP 6,
 * MARGIN 8, MIN_PANEL_H 160.
 */

async function setup(inputs: Partial<ComponentInput<SvTimePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvTimePickerComponent, {
    inputs: inputs as ComponentInput<SvTimePickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]')!;
const panel = () => document.querySelector<HTMLElement>('.sv-tp-portal');

/** Give an element a rect jsdom never computed, and say so at the call site. */
function stubRect(node: HTMLElement, r: Partial<DOMRect>): void {
  const rect = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...r };
  node.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
}

/** Stub the viewport; returns a restore function. */
function stubViewport(width: number, height: number): () => void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  return () => {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  };
}

afterEach(() => {
  document.querySelectorAll('.sv-tp-portal').forEach((n) => n.remove());
});

describe('SvTimePickerComponent — panel placement', () => {
  it('drops below the trigger when there is room', async () => {
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      stubRect(trigger(fixture), { top: 100, bottom: 130, left: 40, right: 240 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();

      const style = fixture.componentInstance.panelStyle();
      expect(fixture.componentInstance.openAbove()).toBe(false);
      expect(style['top']).toBe('136px'); // rect.bottom + GAP
      expect(style['bottom']).toBeUndefined();
      expect(style['left']).toBe('40px');
      expect(style['maxHeight']).toBe(`${800 - 130 - 6 - 8}px`);
    } finally {
      restore();
    }
  });

  it('flips above when the space below is too small and above is bigger', async () => {
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      // 100px below (< PANEL_H 300) and 700px above → flip.
      stubRect(trigger(fixture), { top: 670, bottom: 700, left: 40, right: 240 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();

      const style = fixture.componentInstance.panelStyle();
      expect(fixture.componentInstance.openAbove()).toBe(true);
      expect(style['bottom']).toBe(`${800 - 670 + 6}px`); // vh - rect.top + GAP
      expect(style['top']).toBeUndefined();
      expect(style['maxHeight']).toBe(`${670 - 6 - 8}px`); // capped to the room above
    } finally {
      restore();
    }
  });

  it('stays below when neither side has room, rather than flipping into less', async () => {
    // spaceBelow 100, spaceAbove 60: below is cramped but above is worse. The
    // second half of the condition is what stops the flip here — and the height
    // cap must not collapse the panel to nothing.
    const restore = stubViewport(1024, 200);
    try {
      const { fixture } = await setup({ value: '09:00' });
      stubRect(trigger(fixture), { top: 60, bottom: 100, left: 40, right: 240 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();

      expect(fixture.componentInstance.openAbove()).toBe(false);
      // 200 - 100 - 6 - 8 = 86, below MIN_PANEL_H, so the floor applies.
      expect(fixture.componentInstance.panelStyle()['maxHeight']).toBe('160px');
    } finally {
      restore();
    }
  });

  it('anchors to the right edge when the panel would overflow it', async () => {
    const restore = stubViewport(400, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      // left 300 + PANEL_W 220 = 520 > 400 → anchor right.
      stubRect(trigger(fixture), { top: 100, bottom: 130, left: 300, right: 380 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();

      const style = fixture.componentInstance.panelStyle();
      expect(fixture.componentInstance.alignRight()).toBe(true);
      expect(style['right']).toBe(`${400 - 380}px`);
      expect(style['left']).toBeUndefined();
      expect(style['maxWidth']).toBe(`${400 - 20 - 8}px`);
    } finally {
      restore();
    }
  });

  it('never anchors closer to an edge than the margin', async () => {
    // A trigger flush against the left edge would otherwise anchor at 0 and the
    // panel would touch the viewport border.
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      stubRect(trigger(fixture), { top: 100, bottom: 130, left: 0, right: 200 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();
      expect(fixture.componentInstance.panelStyle()['left']).toBe('8px');
    } finally {
      restore();
    }
  });

  it('positions the panel as fixed, above everything', async () => {
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    const style = fixture.componentInstance.panelStyle();
    expect(style['position']).toBe('fixed');
    expect(style['zIndex']).toBe('9999');
  });
});

describe('SvTimePickerComponent — tracking the trigger on scroll', () => {
  /** rAF in jsdom is real; resolve after one frame. */
  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  it('recomputes the position when an ancestor scrolls', async () => {
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      const t = trigger(fixture);
      stubRect(t, { top: 100, bottom: 130, left: 40, right: 240 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();
      expect(fixture.componentInstance.panelStyle()['top']).toBe('136px');

      // The page scrolled 50px: the trigger is now higher up.
      stubRect(t, { top: 50, bottom: 80, left: 40, right: 240 });
      window.dispatchEvent(new Event('scroll'));
      await nextFrame();
      fixture.detectChanges();
      expect(fixture.componentInstance.panelStyle()['top']).toBe('86px');
    } finally {
      restore();
    }
  });

  it('coalesces a burst of scrolls into a single recalculation', async () => {
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      const t = trigger(fixture);
      let measurements = 0;
      const rect = { top: 100, bottom: 130, left: 40, right: 240, width: 200, height: 30, x: 40, y: 100 };
      t.getBoundingClientRect = () => {
        measurements++;
        return { ...rect, toJSON: () => rect } as DOMRect;
      };
      fixture.componentInstance.toggle();
      fixture.detectChanges();
      const afterOpen = measurements;

      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      await nextFrame();

      expect(measurements).toBe(afterOpen + 1);
    } finally {
      restore();
    }
  });

  it('ignores scroll entirely while the panel is closed', async () => {
    const { fixture } = await setup({ value: '09:00' });
    const t = trigger(fixture);
    let measurements = 0;
    const rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...rect, toJSON: () => rect } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    // Assert the negative: a closed picker must not measure anything, or every
    // page with one on it pays a layout per scroll frame.
    expect(measurements).toBe(0);
  });

  it('does not recalculate for a frame that lands after the panel closed', async () => {
    const restore = stubViewport(1024, 800);
    try {
      const { fixture } = await setup({ value: '09:00' });
      const t = trigger(fixture);
      stubRect(t, { top: 100, bottom: 130, left: 40, right: 240 });
      fixture.componentInstance.toggle();
      fixture.detectChanges();

      window.dispatchEvent(new Event('scroll'));
      fixture.componentInstance.close(); // closed before the frame runs
      fixture.detectChanges();
      stubRect(t, { top: 500, bottom: 530, left: 40, right: 240 });
      await nextFrame();

      expect(fixture.componentInstance.panelStyle()['top']).toBe('136px'); // unchanged
    } finally {
      restore();
    }
  });

  it('cancels a queued frame when the picker is destroyed', async () => {
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    window.dispatchEvent(new Event('scroll'));
    expect(() => fixture.destroy()).not.toThrow();
    await nextFrame();
    expect(panel()).toBeNull();
  });
});

describe('SvTimePickerComponent — toggle, escape and resize', () => {
  it('closes on a second toggle', async () => {
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('refuses to open when the form has disabled it', async () => {
    // The button is disabled, so a click cannot reach `toggle()` at all; the
    // guard inside it is what protects a programmatic caller.
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('stays open for a mousedown on its own trigger', async () => {
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    trigger(fixture).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).not.toBeNull();
  });

  it('does nothing on Escape while closed', async () => {
    const { fixture } = await setup({ value: '09:00' });
    let touched = false;
    fixture.componentInstance.registerOnTouched(() => (touched = true));
    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();
    // Closing marks the control touched; nothing closed, so nothing may.
    expect(touched).toBe(false);
  });

  it('closes on a window resize, and ignores one while closed', async () => {
    const { fixture } = await setup({ value: '09:00' });
    let touched = false;
    fixture.componentInstance.registerOnTouched(() => (touched = true));

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(touched).toBe(false); // nothing was open to close

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(touched).toBe(true);
  });
});

describe('SvTimePickerComponent — parsing corners', () => {
  it('reads a bound with a one-digit hour', async () => {
    const { fixture } = await setup({ value: '09:00', format: '24h', min: '9:00', max: '17:00' });
    fixture.detectChanges();
    // A `min` of '9:00' has to mean 09:00, not "unparseable, so no bound".
    expect(fixture.componentInstance.isHourDisabled('08')).toBe(true);
    expect(fixture.componentInstance.isHourDisabled('09')).toBe(false);
  });

  it.each([
    ['an hour past 23', '24:00'],
    ['a minute past 59', '10:75'],
    ['a bare hour', '10'],
    ['words', 'noon'],
    ['nothing', ''],
  ] as const)('treats %s as no bound rather than as midnight', async (_why, bound) => {
    // Coercing a malformed bound to 0 would silently pin the whole control to
    // midnight — every cell disabled, and no error anywhere to explain it.
    const { fixture } = await setup({ value: '09:00', format: '24h', min: bound });
    fixture.detectChanges();
    expect(fixture.componentInstance.isHourDisabled('00')).toBe(false);
    expect(fixture.componentInstance.isHourDisabled('23')).toBe(false);
  });

  it('falls back to a whole hour when the value carries no minutes', async () => {
    const { fixture } = await setup({ value: '09', format: '24h' });
    expect(fixture.componentInstance.currentMinute()).toBe('00');
    expect(fixture.componentInstance.currentSecond()).toBe('00');
  });

  it('falls back to 09 when there is no value at all', async () => {
    const { fixture } = await setup({ value: '', format: '24h' });
    expect(fixture.componentInstance.currentHour()).toBe('09');
    expect(fixture.componentInstance.displayValue()).toBe('');
  });

  it('shows midnight as 12 AM and noon as 12 PM on a 12-hour clock', async () => {
    // The two values a naive `hour % 12` gets wrong in opposite directions.
    const midnight = await setup({ value: '00:00' });
    expect(midnight.fixture.componentInstance.displayValue()).toBe('12:00 AM');
    expect(midnight.fixture.componentInstance.period()).toBe('AM');

    const noon = await setup({ value: '12:00' });
    expect(noon.fixture.componentInstance.displayValue()).toBe('12:00 PM');
    expect(noon.fixture.componentInstance.period()).toBe('PM');

    const oneAfterNoon = await setup({ value: '13:00' });
    expect(oneAfterNoon.fixture.componentInstance.displayValue()).toBe('01:00 PM');
  });

  it('names the trigger by label alone when there is no value yet', async () => {
    const { fixture } = await setup({ value: '', label: 'Start' });
    expect(trigger(fixture).getAttribute('aria-label')).toBe('Start');
  });

  it('has no accessible name of its own when there is no label', async () => {
    const { fixture } = await setup({ value: '09:00' });
    expect(fixture.componentInstance.triggerAriaLabel()).toBeNull();
  });
});

describe('SvTimePickerComponent — writeValue', () => {
  it('keeps the current time when a form writes an empty value', async () => {
    // Reactive forms call `writeValue('')` on `reset()`. Clearing to '' would
    // leave the columns with nothing to highlight; the control keeps its last
    // time and simply shows nothing in the trigger.
    const { fixture } = await setup({ value: '09:00', format: '24h' });
    fixture.componentInstance.writeValue('');
    expect(fixture.componentInstance.value()).toBe('09:00');
  });

  it('accepts a real value', async () => {
    const { fixture } = await setup({ value: '09:00', format: '24h' });
    fixture.componentInstance.writeValue('16:20');
    expect(fixture.componentInstance.value()).toBe('16:20');
  });
});
