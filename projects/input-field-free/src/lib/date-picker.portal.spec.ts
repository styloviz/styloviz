import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until, quietFor } from '../../../../src/testing/async';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * The panel is mounted into `<body>`, positioned with `position: fixed` from
 * the trigger's viewport rect, and re-anchored on every scroll of any ancestor.
 *
 * ★★ jsdom HAS NO LAYOUT. `getBoundingClientRect()` returns all zeros and
 * `clientWidth` is 0, so nothing here may be concluded from a measurement the
 * environment made. Every geometry test below therefore installs an EXPLICIT
 * fake rect on the host element and fixes `innerWidth`/`innerHeight`, and then
 * asserts the arithmetic the component does with them. That is the only part
 * that is the component's own; the measuring is the browser's.
 */

async function setup(inputs: Partial<ComponentInput<SvDatePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvDatePickerComponent, {
    inputs: inputs as ComponentInput<SvDatePickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('.sv-dp-trigger')!;
const panel = () => document.querySelector<HTMLElement>('.sv-dp-portal');
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Fixture = { nativeElement: unknown; detectChanges(): void };

async function open(f: Fixture) {
  await userEvent.click(trigger(f));
  f.detectChanges();
  await tick();
}

/** These mirror the module constants in date-picker.component.ts. */
const PANEL_W = 280;
const PANEL_H = 390;
const GAP = 6;
const MARGIN = 8;
const MIN_PANEL_H = 160;

/** Give the HOST element a rect jsdom cannot produce for itself. */
function stubRect(host: HTMLElement, r: { top: number; left: number; width?: number; height?: number }) {
  const width = r.width ?? 200;
  const height = r.height ?? 40;
  host.getBoundingClientRect = () =>
    ({
      top: r.top, left: r.left, width, height,
      bottom: r.top + height, right: r.left + width,
      x: r.left, y: r.top, toJSON: () => ({}),
    }) as DOMRect;
}

function stubViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

const originalW = window.innerWidth;
const originalH = window.innerHeight;
afterEach(() => stubViewport(originalW, originalH));

describe('SvDatePickerComponent — where the panel is put', () => {
  it('sits below the trigger when there is room, at a fixed viewport position', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 900);
    stubRect(el(fixture), { top: 100, left: 300 });
    await open(fixture);

    const style = fixture.componentInstance.panelStyle();
    expect(fixture.componentInstance.openAbove()).toBe(false);
    expect(style['position']).toBe('fixed');
    expect(style['top']).toBe(`${140 + GAP}px`);   // rect.bottom + GAP
    expect(style['bottom']).toBeUndefined();
    expect(style['left']).toBe('300px');
    expect(style['width']).toBe(`${PANEL_W}px`);
  });

  it('flips above when the space below is tighter than the panel', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 600);
    // The trigger sits low: 100px of room below it, 460 above.
    stubRect(el(fixture), { top: 460, left: 300 });
    await open(fixture);

    const style = fixture.componentInstance.panelStyle();
    expect(600 - 500).toBeLessThan(PANEL_H);        // the premise, stated
    expect(fixture.componentInstance.openAbove()).toBe(true);
    expect(style['bottom']).toBe(`${600 - 460 + GAP}px`);
    expect(style['top']).toBeUndefined();
  });

  it('stays below when space is tight on BOTH sides but tighter above', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 420);
    stubRect(el(fixture), { top: 20, left: 300 });
    await open(fixture);
    // 360 below vs 20 above: below is short of the 390 the panel wants, but
    // flipping would be worse, so it must not flip.
    expect(fixture.componentInstance.openAbove()).toBe(false);
  });

  it('right-aligns rather than running off the right edge', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(600, 900);
    stubRect(el(fixture), { top: 100, left: 500, width: 80 });
    await open(fixture);

    const style = fixture.componentInstance.panelStyle();
    expect(fixture.componentInstance.alignRight()).toBe(true);
    // right edge 580 − 280 = 300, which is inside the clamp.
    expect(style['left']).toBe('300px');
  });

  it('clamps the left edge to the gutter rather than going negative', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(320, 900);
    stubRect(el(fixture), { top: 100, left: 100, width: 60 });
    await open(fixture);

    // Too far right to left-align (100 + 280 > 320), so it right-aligns — and
    // right-aligning wants 160 − 280 = −120. The clamp floor is GAP.
    expect(fixture.componentInstance.alignRight()).toBe(true);
    const left = Number(fixture.componentInstance.panelStyle()['left'].replace('px', ''));
    expect(left).toBe(GAP);
  });

  it('clamps the left edge to the right-hand gutter too', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(320, 900);
    stubRect(el(fixture), { top: 100, left: 38, width: 2 });
    await open(fixture);

    // Left-aligning at 38 would leave 320 − 38 − 280 = 2px on the right, under
    // the 6px gutter; the ceiling is vw − PANEL_W − GAP.
    expect(fixture.componentInstance.alignRight()).toBe(false);
    expect(fixture.componentInstance.panelStyle()['left']).toBe(`${320 - PANEL_W - GAP}px`);
  });

  it('caps the height to the room on the side it chose', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 900);
    stubRect(el(fixture), { top: 100, left: 300 });
    await open(fixture);

    expect(fixture.componentInstance.panelStyle()['maxHeight'])
      .toBe(`${900 - 140 - GAP - MARGIN}px`);
  });

  it('never caps below the floor, however little room there is', async () => {
    // Flipping ABOVE a trigger near the top of the viewport used to put the
    // panel's own top edge off-screen.
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 300);
    stubRect(el(fixture), { top: 40, left: 300 });
    await open(fixture);

    const max = Number(fixture.componentInstance.panelStyle()['maxHeight'].replace('px', ''));
    expect(max).toBeGreaterThanOrEqual(MIN_PANEL_H);
  });
});

describe('SvDatePickerComponent — keeping the panel anchored', () => {
  it('re-runs the position on scroll from any ancestor', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 900);
    stubRect(el(fixture), { top: 100, left: 300 });
    await open(fixture);
    expect(fixture.componentInstance.panelStyle()['top']).toBe(`${146}px`);

    // The page scrolls: the trigger's viewport rect moves up.
    stubRect(el(fixture), { top: 60, left: 300 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => fixture.componentInstance.panelStyle()['top'] === '106px', {
      label: 'the panel to follow the trigger up the viewport',
    });
  });

  it('does nothing on scroll while it is shut', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    const before = fixture.componentInstance.panelStyle();

    window.dispatchEvent(new Event('scroll'));
    await quietFor();
    expect(fixture.componentInstance.panelStyle()).toBe(before);
    expect(panel()).toBeNull();
  });

  it('coalesces a burst of scroll events into one reposition', async () => {
    // The handler is RAF-throttled: a second event arriving before the frame
    // runs must be dropped, not queued.
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 900);
    stubRect(el(fixture), { top: 100, left: 300 });
    await open(fixture);

    let frames = 0;
    const realRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames++;
      return realRaf(cb);
    }) as typeof window.requestAnimationFrame;
    try {
      for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('scroll'));
      expect(frames).toBe(1);
    } finally {
      window.requestAnimationFrame = realRaf;
    }
  });

  it('closes on a viewport resize rather than repositioning from stale numbers', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    await open(fixture);
    expect(panel()).not.toBeNull();

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('ignores a resize while it is already shut', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    const seen: string[] = [];
    fixture.componentInstance.closed.subscribe(() => seen.push('closed'));

    window.dispatchEvent(new Event('resize'));
    expect(seen).toEqual([]);
  });
});

describe('SvDatePickerComponent — the portal is cleaned up', () => {
  it('leaves nothing in <body> when destroyed while open', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    await open(fixture);
    expect(document.querySelectorAll('.sv-dp-portal').length).toBe(1);

    fixture.destroy();
    expect(document.querySelectorAll('.sv-dp-portal').length).toBe(0);
  });

  it('stops listening to scroll once destroyed', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    stubViewport(1024, 900);
    stubRect(el(fixture), { top: 100, left: 300 });
    await open(fixture);
    const after = fixture.componentInstance.panelStyle();

    fixture.destroy();
    stubRect(el(fixture), { top: 700, left: 300 });
    window.dispatchEvent(new Event('scroll'));
    await quietFor();
    expect(fixture.componentInstance.panelStyle()).toBe(after);
  });

  it('opens and closes repeatedly without stacking portals', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    for (let i = 0; i < 3; i++) {
      await open(fixture);
      expect(document.querySelectorAll('.sv-dp-portal').length).toBe(1);
      fixture.componentInstance.close();
      fixture.detectChanges();
      expect(document.querySelectorAll('.sv-dp-portal').length).toBe(0);
    }
  });
});

describe('SvDatePickerComponent — clearing', () => {
  it('clears from the inline button and returns focus to the trigger', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    const clear = el(fixture).querySelector<HTMLButtonElement>('[aria-label="Clear date"]')!;
    clear.focus();

    await userEvent.click(clear);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
    // The clear button unrenders the instant the value goes, so it owes focus
    // somewhere; without this it fell to <body>.
    expect(document.activeElement).toBe(trigger(fixture));
  });

  it('clears from inside the panel and shuts it', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    await open(fixture);
    const inPanel = [...panel()!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Clear')!;

    await userEvent.click(inPanel);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger(fixture));
  });
});

describe('SvDatePickerComponent — a disabled form control', () => {
  it('shuts an open panel when the form disables it underneath', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    await open(fixture);
    expect(panel()).not.toBeNull();

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
  });

  it('does not try to close a panel that was never open', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    const seen: string[] = [];
    fixture.componentInstance.closed.subscribe(() => seen.push('closed'));

    fixture.componentInstance.setDisabledState(true);
    expect(seen).toEqual([]);

    fixture.componentInstance.setDisabledState(false);
    expect(fixture.componentInstance.resolvedDisabled()).toBe(false);
  });
});
