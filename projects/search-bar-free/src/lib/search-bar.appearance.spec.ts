import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until, quietFor } from '../../../../src/testing/async';
import {
  SvSearchBarComponent,
  type SearchBarSize,
  type SearchBarVariant,
  type SearchFilter,
} from './search-bar.component';

/**
 * The chrome: sizes, variants, the shortcut badge, the filter chips, the
 * loading state — and the panel's own position, which is the only arithmetic in
 * this file.
 *
 * ★★ jsdom HAS NO LAYOUT, so the positioning tests install an EXPLICIT fake
 * rect on the track element and fix `innerWidth`/`innerHeight` before asserting.
 * Nothing is concluded from a zero-size measurement.
 */

async function setup(inputs: Partial<ComponentInput<SvSearchBarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSearchBarComponent, {
    inputs: inputs as ComponentInput<SvSearchBarComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const input = (f: { nativeElement: unknown }) => el(f).querySelector<HTMLInputElement>('input')!;
const panel = () => document.querySelector<HTMLElement>('.sv-search-portal');

type Fixture = {
  nativeElement: unknown;
  detectChanges(): void;
  componentInstance: SvSearchBarComponent;
};

function focusIn(f: Fixture) {
  f.componentInstance.onFocus();
  f.detectChanges();
}

const SUGGESTIONS = [{ id: '1', label: 'Invoices' }, { id: '2', label: 'Inventory' }];

/** Mirrors the module constants in search-bar.component.ts. */
const PANEL_GAP = 4;
const PANEL_MARGIN = 8;
const PANEL_PREFERRED_HEIGHT = 288;

function stubTrackRect(f: Fixture, r: { top: number; left: number; width?: number; height?: number }) {
  const track = f.componentInstance.trackRef()!.nativeElement;
  const width = r.width ?? 300;
  const height = r.height ?? 40;
  track.getBoundingClientRect = () =>
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

describe('SvSearchBarComponent — sizes and variants', () => {
  const sizes: SearchBarSize[] = ['sm', 'md', 'lg'];
  const variants: SearchBarVariant[] = ['default', 'filled', 'borderless'];

  it('gives every size its own track height, icon and padding', async () => {
    const seen = new Set<string>();
    for (const size of sizes) {
      const { fixture } = await setup({ size });
      const c = fixture.componentInstance;
      seen.add([c.trackClasses(), c.iconSizeClass(), c.iconPaddingClass(), c.inputPaddingClass()].join('|'));
    }
    expect(seen.size).toBe(3);
  });

  it('gives every variant its own surface', async () => {
    const seen = new Set<string>();
    for (const variant of variants) {
      const { fixture } = await setup({ variant });
      seen.add(fixture.componentInstance.trackClasses());
    }
    expect(seen.size).toBe(3);
  });

  it('swaps the hover border for a focus ring while focused', async () => {
    const { fixture } = await setup({});
    const idle = fixture.componentInstance.trackClasses();
    expect(idle).toContain('hover:border-gray-400');

    focusIn(fixture);
    const focused = fixture.componentInstance.trackClasses();
    expect(focused).toContain('ring-2');
    expect(focused).not.toContain('hover:border-gray-400');
  });

  it('shows neither hover nor focus affordance while disabled', async () => {
    const { fixture } = await setup({ disabled: true });
    const classes = fixture.componentInstance.trackClasses();
    expect(classes).toContain('cursor-not-allowed');
    expect(classes).not.toContain('ring-2');
    expect(classes).not.toContain('hover:border-gray-400');
    expect(input(fixture).disabled).toBe(true);
  });

  it('appends the host class to the wrapper', async () => {
    expect((await setup({})).fixture.componentInstance.wrapperClasses()).toBe('relative w-full ');
    expect((await setup({ customClass: 'mb-4' })).fixture.componentInstance.wrapperClasses())
      .toBe('relative w-full mb-4');
  });

  it('drops the input\'s own left padding when the magnifier occupies that space', async () => {
    for (const size of sizes) {
      const withIcon = await setup({ size, showSearchIcon: true });
      const without = await setup({ size, showSearchIcon: false });
      expect(withIcon.fixture.componentInstance.inputNativePadClass()).toContain('pl-0');
      expect(without.fixture.componentInstance.inputNativePadClass())
        .toBe(without.fixture.componentInstance.inputPaddingClass());
    }
  });

  it('hides the magnifier entirely when told to', async () => {
    const shown = await setup({ showSearchIcon: true });
    expect(el(shown.fixture).querySelector('sv-icon')).not.toBeNull();

    const hidden = await setup({ showSearchIcon: false });
    expect(el(hidden.fixture).querySelector('sv-icon')).toBeNull();
  });

  it('replaces the magnifier with a spinner while loading, and says so', async () => {
    const { fixture } = await setup({ loading: true });
    expect(el(fixture).querySelector('sv-spinner-arc')).not.toBeNull();
    expect(input(fixture).getAttribute('aria-busy')).toBe('true');

    const idle = await setup({ loading: false });
    expect(el(idle.fixture).querySelector('sv-spinner-arc')).toBeNull();
    // `null` rather than "false": aria-busy="false" is noise on every field.
    expect(input(idle.fixture).hasAttribute('aria-busy')).toBe(false);
  });

  /**
   * ★ DIVERGENCE FROM THE PRO TWIN, pinned deliberately.
   *
   * `isFloating()` is hard-wired to `false` here; the Pro twin returns
   * `variant() === 'floating'` and has a fourth variant for it. So the free bar
   * never renders the in-track label and never blanks its placeholder — the
   * label input exists but only ever names the field.
   */
  it('never floats its label — the floating variant is Pro-only', async () => {
    for (const variant of variants) {
      const { fixture } = await setup({ variant, label: 'Search', placeholder: 'Type here' });
      expect(fixture.componentInstance.isFloating()).toBe(false);
      expect(el(fixture).querySelector('[aria-hidden="true"] , span')).toBeTruthy();
      expect(input(fixture).getAttribute('placeholder')).toBe('Type here');
    }
  });

  it('still tracks whether the label WOULD float, from focus or from a value', async () => {
    const empty = await setup({ label: 'Search' });
    expect(empty.fixture.componentInstance.labelIsFloated()).toBe(false);
    focusIn(empty.fixture);
    expect(empty.fixture.componentInstance.labelIsFloated()).toBe(true);

    const filled = await setup({ label: 'Search', value: 'x' });
    expect(filled.fixture.componentInstance.labelIsFloated()).toBe(true);
  });

  it('positions the floating label around the magnifier, at every size', async () => {
    // The classes are still computed and still bound; only the element that
    // consumes them is gated off in this twin.
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as SearchBarSize[]) {
      for (const showSearchIcon of [true, false]) {
        const { fixture } = await setup({ size, showSearchIcon, label: 'Search' });
        seen.add(fixture.componentInstance.floatingLabelClasses());
      }
    }
    expect(seen.size).toBe(6);

    const floated = await setup({ label: 'Search', value: 'x' });
    expect(floated.fixture.componentInstance.floatingLabelClasses()).toContain('left-3');
    focusIn(floated.fixture);
    expect(floated.fixture.componentInstance.floatingLabelClasses())
      .toContain('text-primary-600');
  });
});

describe('SvSearchBarComponent — the shortcut badge', () => {
  it('shows only when there is a hint, no value, no focus and no spinner', async () => {
    const shown = await setup({ shortcutHint: '⌘K' });
    expect(shown.fixture.componentInstance.showShortcut()).toBe(true);
    expect(el(shown.fixture).querySelector('kbd')?.textContent?.trim()).toBe('⌘K');

    expect((await setup({})).fixture.componentInstance.showShortcut()).toBe(false);
    expect((await setup({ shortcutHint: '⌘K', value: 'x' }))
      .fixture.componentInstance.showShortcut()).toBe(false);
    expect((await setup({ shortcutHint: '⌘K', loading: true }))
      .fixture.componentInstance.showShortcut()).toBe(false);

    const focused = await setup({ shortcutHint: '⌘K' });
    focusIn(focused.fixture);
    expect(focused.fixture.componentInstance.showShortcut()).toBe(false);
    expect(el(focused.fixture).querySelector('kbd')).toBeNull();
  });
});

describe('SvSearchBarComponent — filter chips', () => {
  const FILTERS: SearchFilter[] = [
    { id: 'open', label: 'Open' },
    { id: 'mine', label: 'Assigned to me' },
  ];

  it('renders one removable chip per filter, each named for its own filter', async () => {
    const { fixture } = await setup({ filters: FILTERS });
    const buttons = [...el(fixture).querySelectorAll<HTMLButtonElement>('[aria-label^="Remove filter"]')];
    expect(buttons.map((b) => b.getAttribute('aria-label')))
      .toEqual(['Remove filter Open', 'Remove filter Assigned to me']);
    expect(el(fixture).textContent).toContain('Assigned to me');
  });

  it('reports the id of the chip that was dismissed, and only that one', async () => {
    const { fixture } = await setup({ filters: FILTERS });
    const seen: string[] = [];
    fixture.componentInstance.filterRemoved.subscribe((id) => seen.push(id));

    await userEvent.click(el(fixture).querySelector<HTMLButtonElement>('[aria-label="Remove filter Assigned to me"]')!);
    expect(seen).toEqual(['mine']);
  });

  it('lets the track wrap once there are chips in it', async () => {
    const none = await setup({ filters: [] });
    expect(none.fixture.componentInstance.trackClasses()).not.toContain('flex-wrap');

    const some = await setup({ filters: FILTERS });
    expect(some.fixture.componentInstance.trackClasses()).toContain('flex-wrap');
  });
});

describe('SvSearchBarComponent — where the panel is put', () => {
  it('sits below the track when there is room', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    stubViewport(1024, 900);
    focusIn(fixture);
    stubTrackRect(fixture, { top: 100, left: 200, width: 320 });
    // Re-run the calculation now the rect is in place.
    window.dispatchEvent(new Event('scroll'));

    await until(() => fixture.componentInstance.panelStyle()['top'] === `${140 + PANEL_GAP}px`, {
      label: 'the panel to be positioned below the track',
    });
    const style = fixture.componentInstance.panelStyle();
    expect(fixture.componentInstance.openAbove()).toBe(false);
    expect(style['position']).toBe('fixed');
    expect(style['left']).toBe('200px');
    // The panel matches the track's width, not the viewport's.
    expect(style['width']).toBe('320px');
    expect(style['bottom']).toBeUndefined();
  });

  it('flips above when the room below is tighter than the list wants', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    stubViewport(1024, 600);
    focusIn(fixture);
    stubTrackRect(fixture, { top: 460, left: 200 });
    window.dispatchEvent(new Event('scroll'));

    await until(() => fixture.componentInstance.openAbove(), {
      label: 'the panel to flip above the track',
    });
    expect(600 - 500 - PANEL_MARGIN).toBeLessThan(PANEL_PREFERRED_HEIGHT);
    expect(fixture.componentInstance.panelStyle()['bottom']).toBe(`${600 - 460 + PANEL_GAP}px`);
    expect(fixture.componentInstance.panelStyle()['top']).toBeUndefined();
  });

  it('stays below when both sides are tight but above is tighter', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    stubViewport(1024, 320);
    focusIn(fixture);
    stubTrackRect(fixture, { top: 20, left: 200 });
    window.dispatchEvent(new Event('scroll'));
    await quietFor();

    expect(fixture.componentInstance.openAbove()).toBe(false);
  });

  it('never caps the height below the floor, however little room there is', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    stubViewport(1024, 200);
    focusIn(fixture);
    stubTrackRect(fixture, { top: 150, left: 200 });
    window.dispatchEvent(new Event('scroll'));
    await quietFor();

    const max = Number(fixture.componentInstance.panelStyle()['maxHeight'].replace('px', ''));
    expect(max).toBeGreaterThanOrEqual(120);
  });

  it('coalesces a burst of scroll events into one frame', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);

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

  it('does nothing on scroll while the list is shut', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    const before = fixture.componentInstance.panelStyle();
    window.dispatchEvent(new Event('scroll'));
    await quietFor();
    expect(fixture.componentInstance.panelStyle()).toBe(before);
  });

  it('leaves nothing in <body> when destroyed while open', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(document.querySelectorAll('.sv-search-portal').length).toBe(1);

    fixture.destroy();
    expect(document.querySelectorAll('.sv-search-portal').length).toBe(0);
  });

  it('stops listening to scroll once destroyed', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    stubViewport(1024, 900);
    focusIn(fixture);
    const before = fixture.componentInstance.panelStyle();

    fixture.destroy();
    stubTrackRect(fixture, { top: 700, left: 200 });
    window.dispatchEvent(new Event('scroll'));
    await quietFor();
    expect(fixture.componentInstance.panelStyle()).toBe(before);
  });

  it('opens and closes repeatedly without stacking portals', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    for (let i = 0; i < 3; i++) {
      focusIn(fixture);
      expect(document.querySelectorAll('.sv-search-portal').length).toBe(1);
      fixture.componentInstance.isFocused.set(false);
      fixture.detectChanges();
      expect(document.querySelectorAll('.sv-search-portal').length).toBe(0);
    }
    expect(panel()).toBeNull();
  });
});
